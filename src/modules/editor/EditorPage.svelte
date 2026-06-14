<script>
  import { get } from 'svelte/store';
  import { editor, order, ctx, regions, regionId, freshEditor, catalogOverrides, catalogPresets, descConfig, catalogMaterials, companyInfo, orders, orderHistory, commissionRule, currentUser, editingOrderId, quotingClient, clients } from '../../lib/stores.js';
  import { PRESETS, clone } from '../../lib/presets.js';
  import { compute, describe, buildDescCfg, nf, brl } from '../../lib/engine.js';
  import { priceFor } from '../../lib/pricing.js';
  import { commissionForItem, DEFAULT_RULE } from '../../lib/commission.js';
  import { effectivePreset, DEFAULT_RESTRICTIONS } from '../../lib/catalog.js';
  import { validateProfile } from '../../lib/validation.js';

  import Sidebar      from './Sidebar.svelte';
  import Blueprint    from './Blueprint.svelte';
  import Planilha     from './Planilha.svelte';
  import MateriaPrima from './MateriaPrima.svelte';
  import Params       from './Params.svelte';
  import Results      from './Results.svelte';
  import Docs    from '../orders/Docs.svelte';
  import CutPlan from '../cutplan/CutPlan.svelte';

  let doc = { open: false, kind: 'op' };
  let cutPlanGroup = null;

  // ── Client search modal ───────────────────────────────────────────────────
  let clientSearchOpen = false;
  let clientNewOpen    = false;
  let clientSearchQ    = '';
  let clientNewForm    = { nome: '', tel: '', email: '' };

  $: clientResults = clientSearchQ.trim().length >= 1
    ? ($clients || []).filter(c =>
        (c.nome  || '').toLowerCase().includes(clientSearchQ.toLowerCase()) ||
        (c.tel   || '').includes(clientSearchQ) ||
        (c.email || '').toLowerCase().includes(clientSearchQ.toLowerCase())
      ).slice(0, 10)
    : ($clients || []).slice(0, 10);

  function pickClient(c) {
    $ctx = { ...$ctx, cliente: c.nome };
    clientSearchOpen = false;
    clientSearchQ = '';
  }

  function openClientSearch() { clientSearchQ = ''; clientSearchOpen = true; }
  function closeClientSearch() { clientSearchOpen = false; clientSearchQ = ''; }

  function openClientNew() { clientNewForm = { nome: '', tel: '', email: '' }; clientNewOpen = true; }
  function closeClientNew() { clientNewOpen = false; }

  function saveClientNew() {
    if (!clientNewForm.nome.trim()) return;
    const nc = { ...clientNewForm, id: Date.now(), createdAt: new Date().toISOString() };
    clients.update(list => [nc, ...list]);
    $ctx = { ...$ctx, cliente: nc.nome };
    closeClientNew();
  }

  $: C    = compute($editor.rows, $editor.params, $editor.conv, $editor.bd);
  $: name = $editor.mode === 'cat' && PRESETS[$editor.key] ? PRESETS[$editor.key].name : 'Perfil livre';
  $: sel  = $order.sel;

  $: ordTot  = $order.items.reduce((a, it) => a + it.C.tot, 0);
  $: ordTotR = $order.items.reduce((a, it) => a + (it.total || 0), 0);

  $: groups = (() => {
    const map = new Map();
    $order.items.forEach((it, i) => {
      const p = it.params;
      const key = p.forma === 'bobina'
        ? `${p.matName}|${p.revest}|${p.t}|bobina|${p.coil}`
        : `${p.matName}|${p.revest}|${p.t}|chapa|${p.chapaL}x${p.chapaC}`;
      if (!map.has(key)) {
        const dim = p.forma === 'bobina'
          ? `bobina ${nf(p.coil, 0)} mm`
          : `chapa ${nf(p.chapaL, 0)}×${nf(p.chapaC, 0)} mm`;
        const rev = p.revest !== 'Sem revestimento' ? ` ${p.revest}` : '';
        map.set(key, { label: `${p.matName}${rev} ${nf(p.t, 2)} mm — ${dim}`, entries: [], totKg: 0 });
      }
      const g = map.get(key);
      g.entries.push({ it, i });
      g.totKg += it.C.tot;
    });
    return [...map.values()];
  })();

  $: restrictions = $editor.mode === 'cat'
    ? (effectivePreset($editor.key, $catalogOverrides)?.restrictions ?? DEFAULT_RESTRICTIONS)
    : DEFAULT_RESTRICTIONS;

  $: violations = validateProfile($editor.rows, $editor.params, $editor.h0, restrictions);

  // Pedido sendo editado (quando vem de OrdersPage)
  $: editingOrder = $editingOrderId ? $orders.find(o => o.id === $editingOrderId) : null;

  function load(key) {
    const p = effectivePreset(key, $catalogOverrides) ?? PRESETS[key];
    if (!p) return;
    $editor.mode = 'cat'; $editor.key = key; $editor.h0 = p.h0; $editor.rows = clone(p.rows);
    $editor = $editor;
    $order.sel = -1; $order = $order;
  }

  function loadCustom(preset) {
    $editor.mode = 'cat'; $editor.key = preset.key;
    $editor.h0   = preset.h0;
    $editor.rows = clone(preset.rows);
    $editor = $editor;
    $order.sel = -1; $order = $order;
  }

  function snapshot() {
    const e  = get(editor);
    const Cc = compute(e.rows, e.params, e.conv, e.bd);
    const customP = get(catalogPresets).find((p) => p.key === e.key);
    const nm = (e.mode === 'cat' && PRESETS[e.key])
      ? PRESETS[e.key].name
      : customP?.name ?? 'Perfil livre';
    const { custo: custoKg, venda: vendaKg } = priceFor(get(regions), get(regionId), e.params.matName, e.params.revest);
    const custoTotal = Cc.tot * custoKg;
    const precoTotal = e.params.priceMode === 'pc'
      ? (e.params.precoPc ?? 0) * e.params.Q
      : Cc.tot * (e.params.precoKg > 0 ? e.params.precoKg : (custoKg > 0 ? custoKg * (1 + e.params.mg / 100) : vendaKg));
    return {
      key: e.key, mode: e.mode, h0: e.h0, conv: e.conv, bd: e.bd,
      rows: clone(e.rows), params: clone(e.params), C: Cc,
      custoTotal, precoTotal,
      total: precoTotal,
      tipoProduto: 'perfil',
      name: nm, label: `${nm} ${e.params.matName.toLowerCase()} ${nf(e.params.t, 2)}`,
      code: describe(nm, e.params, Cc.des, e.rows, e.conv, e.key, buildDescCfg(get(descConfig), get(catalogMaterials))),
    };
  }

  function addItem() {
    const snap = snapshot();
    if ($order.sel >= 0) $order.items[$order.sel] = snap;
    else { $order.items.push(snap); $order.sel = $order.items.length - 1; }
    $order = $order;
  }
  function newItem() { $order.sel = -1; $order = $order; editor.set(freshEditor()); }
  function remove(i) {
    $order.items.splice(i, 1);
    if ($order.sel >= i) $order.sel -= 1;
    $order = $order;
  }
  function loadItem(i) {
    const it = $order.items[i];
    editor.set({ mode: it.mode, key: it.key, conv: it.conv, bd: it.bd, h0: it.h0, rows: clone(it.rows), params: clone(it.params) });
    $order.sel = i; $order = $order;
  }

  function openOP()  { if (!$order.items.length) addItem(); doc = { open: true, kind: 'op' }; }
  function openOrc() { if (!$order.items.length) addItem(); doc = { open: true, kind: 'orc' }; }

  // ── Salvar / editar pedido ────────────────────────────────────────────────
  const TIPOS_CLIENTE = [
    { value: '',               label: 'Não informado'              },
    { value: 'construtora',   label: 'Construtora / Empreiteira'  },
    { value: 'revendedor',    label: 'Revendedor / Distribuidor'  },
    { value: 'industria',     label: 'Indústria / Fabricante'     },
    { value: 'pessoa_fisica', label: 'Pessoa Física'              },
    { value: 'outro',         label: 'Outro'                      },
  ];
  const VALIDADE_OPTS = [7, 15, 30, 60];

  let saveStage = '';   // '' | 'form' | 'done'
  let savedEntry = null;
  let saveForm = { tipo: 'orcamento', validadeDias: 30, tipoCliente: '', cidade: '' };

  function abrirSave() {
    if ($order.sel >= 0) addItem();
    else if ($order.items.length === 0) addItem();

    const eo = editingOrder;
    const qc = get(quotingClient);

    if (eo) {
      // Editando pedido existente — pré-preenche com dados originais
      const validadeRestante = eo.dataValidade
        ? Math.max(1, Math.ceil((new Date(eo.dataValidade) - Date.now()) / 86400000))
        : 30;
      saveForm = {
        tipo:         ['orcamento', 'pedido'].includes(eo.status) ? eo.status : 'orcamento',
        validadeDias: validadeRestante,
        tipoCliente:  eo.tipoCliente || '',
        cidade:       eo.cidade || '',
      };
    } else if (qc) {
      // Novo orçamento iniciado via cadastro de cliente — usa dados do cadastro
      saveForm = {
        tipo:         'orcamento',
        validadeDias: 30,
        tipoCliente:  qc.segmento || '',
        cidade:       qc.cidade   || '',
      };
    }

    saveStage = 'form';
  }

  function confirmarSave() {
    const now = new Date().toISOString();
    const items = $order.items;
    const dataValidade = saveForm.tipo === 'orcamento'
      ? new Date(Date.now() + saveForm.validadeDias * 86400000).toISOString()
      : null;
    const totW = items.reduce((a, it) => a + it.C.tot, 0);
    const totV = items.reduce((a, it) => a + (it.precoTotal || it.total || 0), 0);
    const rule = $commissionRule ?? DEFAULT_RULE;
    const comm = items.reduce((a, it) => a + commissionForItem(it, rule), 0);
    const itemsDetalhe = items.map(it => ({
      tipo:  it.key || it.mode,
      name:  it.name,
      peso:  it.C.tot,
      valor: it.precoTotal || it.total || 0,
    }));

    const eoId = get(editingOrderId);
    const qc   = get(quotingClient);

    if (eoId) {
      // Atualiza pedido existente
      let updated;
      orders.update(list => list.map(o => {
        if (o.id !== eoId) return o;
        updated = {
          ...o,
          updatedAt:   now,
          status:      saveForm.tipo,
          dataValidade,
          dataPedido:  saveForm.tipo === 'pedido' ? (o.dataPedido || now) : null,
          cliente:     $ctx.cliente  || o.cliente,
          orc:         $ctx.orc      || o.orc,
          vendedor:    $ctx.vendedor || o.vendedor,
          obs:         $ctx.obs      || '',
          tipoCliente: saveForm.tipoCliente,
          cidade:      saveForm.cidade,
          items:       items.length,
          totW, totV, comm, itemsDetalhe,
          orderItems:  [...items],
        };
        return updated;
      }));
      if (updated && saveForm.tipo === 'pedido') {
        orderHistory.update(h => [{ ...updated, date: now }, ...h]);
      }
      savedEntry = updated;
      editingOrderId.set(null);
    } else {
      // Cria novo pedido
      const entry = {
        id:          Date.now(),
        createdAt:   now,
        updatedAt:   now,
        status:      saveForm.tipo,
        dataValidade,
        dataPedido:  saveForm.tipo === 'pedido' ? now : null,
        cliente:     $ctx.cliente  || '—',
        orc:         $ctx.orc      || '—',
        vendedor:    $ctx.vendedor || ($currentUser.nome || '—'),
        obs:         $ctx.obs      || '',
        tipoCliente: saveForm.tipoCliente,
        cidade:      saveForm.cidade,
        region:      $regionId,
        clientId:    qc?.id ?? null,
        items:       items.length,
        totW, totV, comm, itemsDetalhe,
        orderItems:  [...items],
      };
      orders.update(list => [entry, ...list]);
      if (saveForm.tipo === 'pedido') {
        orderHistory.update(h => [{ ...entry, date: now }, ...h]);
      }
      savedEntry = entry;
    }

    order.set({ items: [], sel: -1 });
    ctx.set({ cliente: '', orc: '', vendedor: '', obs: '' });
    editor.set(freshEditor());
    quotingClient.set(null);
    saveForm = { tipo: 'orcamento', validadeDias: 30, tipoCliente: '', cidade: '' };
    saveStage = 'done';
  }

  function cancelarEdicao() {
    editingOrderId.set(null);
    quotingClient.set(null);
    order.set({ items: [], sel: -1 });
    ctx.set({ cliente: '', orc: '', vendedor: '', obs: '' });
    editor.set(freshEditor());
  }

  function fecharModal() {
    saveStage = '';
    savedEntry = null;
  }
</script>

<div class="page">
  <Sidebar {load} {loadCustom} />

  <div class="main">

    <!-- toolbar: ctx fields + action buttons -->
    <div class="toolbar">
      <div class="ctxf">
        <div class="ctxf-client-wrap">
          <input placeholder="Cliente" bind:value={$ctx.cliente} />
          <button class="ctxf-icon-btn" on:click={openClientSearch} title="Buscar cliente">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
              <circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l3 3"/>
            </svg>
          </button>
          <button class="ctxf-icon-btn" on:click={openClientNew} title="Novo cliente">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
              <path d="M8 3v10M3 8h10"/>
            </svg>
          </button>
        </div>
        <input placeholder="Nº orçamento" bind:value={$ctx.orc} />
        <input placeholder="Vendedor" bind:value={$ctx.vendedor} class="narrow" />
        <input placeholder="Observação" bind:value={$ctx.obs} class="wide" />
      </div>
      <div class="spacer"></div>
      <button class="btn btn-ghost" on:click={openOrc}>Orçamento</button>
      <button class="btn btn-ghost" on:click={openOP}>Ordem de produção</button>
      <button class="btn btn-save" on:click={abrirSave}>
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 13H3a1 1 0 0 1-1-1V3l3-1h7l2 2v8a1 1 0 0 1-1 1z"/><rect x="5" y="8" width="6" height="5" rx=".5"/><path d="M5 2h5v3H5z"/>
        </svg>
        {editingOrder ? 'Salvar alterações' : 'Salvar'}
      </button>
    </div>

    <!-- banner de modo edição -->
    {#if editingOrder}
      <div class="editing-bar">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z"/>
        </svg>
        <span>Editando:&nbsp;<strong>{editingOrder.cliente}</strong>{#if editingOrder.orc && editingOrder.orc !== '—'}&nbsp;·&nbsp;Nº {editingOrder.orc}{/if}</span>
        <button class="cancel-edit-btn" on:click={cancelarEdicao}>Cancelar edição</button>
      </div>
    {/if}

    <!-- scrollable content area -->
    <div class="scroll">
      <div class="editor">
        <div class="card">
          <div class="card-h">
            <span class="t">Seção <span class="dim">· {name}</span></span>
            {#if violations.length}
              <span class="vbadge" title={violations.map((v) => v.msg).join('\n')}>
                &#9888; {violations.length} {violations.length === 1 ? 'aviso' : 'avisos'}
              </span>
            {/if}
            <div class="toggle">
              <button class:on={$editor.conv === 'ext'} on:click={() => { $editor.conv = 'ext'; $editor = $editor; }}>Externa</button>
              <button class:on={$editor.conv === 'int'} on:click={() => { $editor.conv = 'int'; $editor = $editor; }}>Interna</button>
            </div>
          </div>
          <Blueprint rows={$editor.rows} h0={$editor.h0} t={$editor.params.t} conv={$editor.conv} />
          {#if violations.length}
            <div class="vlist">
              {#each violations as v}
                <div class="vrow" class:coll={v.type === 'collision'}>&#9888; {v.msg}</div>
              {/each}
            </div>
          {/if}
        </div>
        <Planilha />
      </div>

      <MateriaPrima />
      <Params {C} />
      <Results {C} {name} />

      <div class="foot">
        <button class="btn btn-amber big" on:click={addItem}>
          {sel >= 0 ? 'Salvar alterações do item' : 'Adicionar item ao pedido'}
        </button>
        <button class="btn btn-line big" on:click={newItem}>Novo item em branco</button>
      </div>

      {#if $order.items.length > 0}
        <div class="tray-card">
          <div class="tray-head">
            <span class="t">Itens do pedido</span>
            <span class="tray-tot">{nf(ordTot, 1)} kg · {brl(ordTotR)}</span>
          </div>
          <div class="tray-body">
            {#each groups as g}
              <div class="tray-group">
                <div class="group-h">
                  <span class="mp-lbl">{g.label}</span>
                  <div class="group-right">
                    <span class="group-kg">{nf(g.totKg, 1)} kg</span>
                    <button class="btn btn-line btn-xs" on:click={() => (cutPlanGroup = g)}>Plano de corte</button>
                  </div>
                </div>
                {#each g.entries as { it, i }}
                  <div class="tray-item" class:on={i === sel}>
                    <div class="nm" on:click={() => loadItem(i)} on:keydown={(e) => e.key === 'Enter' && loadItem(i)} role="button" tabindex="0">
                      <b>{it.label}</b>
                      <code class="sku">{it.code}</code>
                      <small>des {nf(it.C.des, 0)} · {it.params.Q} pç · {nf(it.C.tot, 1)} kg</small>
                    </div>
                    <button class="rm" on:click={() => remove(i)}>×</button>
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- ── Modal de salvar ──────────────────────────────────────────────────────── -->
{#if saveStage}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click|self={fecharModal}>
    <div class="modal">

      {#if saveStage === 'form'}
        <div class="modal-head">
          <span class="modal-title">{editingOrder ? 'Salvar alterações' : 'Salvar registro'}</span>
          <button class="modal-close" on:click={fecharModal}>×</button>
        </div>

        {#if $quotingClient && !editingOrder}
          <div class="client-badge">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5"/>
            </svg>
            <span><strong>{$quotingClient.nome}</strong>{#if $quotingClient.cidade} · {$quotingClient.cidade}{/if}{#if $quotingClient.uf}/{$quotingClient.uf}{/if}</span>
            <span class="client-badge-label">do cadastro</span>
          </div>
        {/if}

        <div class="modal-body">
          <div class="reg-tipo">
            <label class="radio-opt" class:on={saveForm.tipo === 'orcamento'}>
              <input type="radio" bind:group={saveForm.tipo} value="orcamento" /> Orçamento
            </label>
            <label class="radio-opt" class:on={saveForm.tipo === 'pedido'}>
              <input type="radio" bind:group={saveForm.tipo} value="pedido" /> Pedido fechado
            </label>
          </div>
          {#if saveForm.tipo === 'orcamento'}
            <div class="reg-validade">
              <span class="reg-lbl">Validade</span>
              {#each VALIDADE_OPTS as d}
                <button class="val-btn" class:on={saveForm.validadeDias === d} on:click={() => (saveForm.validadeDias = d)}>{d}d</button>
              {/each}
              <input class="inp inp-sm" type="number" bind:value={saveForm.validadeDias} min="1" style="width:52px" />
            </div>
          {/if}
          <div class="reg-row">
            <label class="reg-field">
              <span class="reg-lbl">Tipo de cliente</span>
              <select class="inp" bind:value={saveForm.tipoCliente}>
                {#each TIPOS_CLIENTE as t}<option value={t.value}>{t.label}</option>{/each}
              </select>
            </label>
            <label class="reg-field">
              <span class="reg-lbl">Cidade</span>
              <input class="inp" bind:value={saveForm.cidade} placeholder="São Paulo" />
            </label>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-line" on:click={fecharModal}>Cancelar</button>
          <button class="btn btn-amber" on:click={confirmarSave}>
            {editingOrder ? 'Confirmar atualização' : 'Confirmar e salvar'} →
          </button>
        </div>

      {:else if saveStage === 'done'}
        <div class="done-screen">
          <div class="done-check">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="16" cy="16" r="14" stroke="#86efac" stroke-width="1.5"/>
              <path d="M9 16.5l4.5 4.5 9.5-9.5"/>
            </svg>
          </div>
          <div class="done-title">
            {savedEntry?.status === 'pedido' ? 'Pedido registrado!' : (editingOrder ? 'Registro atualizado!' : 'Orçamento salvo!')}
          </div>
          {#if savedEntry}
            <div class="done-info">
              <span class="done-cliente">{savedEntry.cliente}</span>
              {#if savedEntry.totV > 0}
                <span class="done-valor">{brl(savedEntry.totV)}</span>
              {/if}
            </div>
          {/if}
          <div class="done-actions">
            <a href="#orders" class="btn btn-line done-btn" on:click={fecharModal}>
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M6 6h4M6 9h3"/>
              </svg>
              Ver em Pedidos
            </a>
            <button class="btn btn-amber done-btn" on:click={fecharModal}>
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3v10M3 8h10"/>
              </svg>
              Novo orçamento
            </button>
          </div>
        </div>
      {/if}

    </div>
  </div>
{/if}

{#if doc.open}
  <Docs kind={doc.kind} on:close={() => (doc = { ...doc, open: false })} />
{/if}
{#if cutPlanGroup}
  <CutPlan group={cutPlanGroup} ctx={$ctx} on:close={() => (cutPlanGroup = null)} />
{/if}

<!-- ── Client search modal ──────────────────────────────────────────────── -->
{#if clientSearchOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="cli-modal-back" on:click|self={closeClientSearch}>
    <div class="cli-modal">
      <div class="cli-modal-hd">
        <span class="cli-modal-title">Buscar cliente</span>
        <button class="cli-close" on:click={closeClientSearch}>×</button>
      </div>
      <div class="cli-search-row">
        <!-- svelte-ignore a11y-autofocus -->
        <input class="cli-search-inp" bind:value={clientSearchQ}
               placeholder="Nome, telefone ou e-mail..." autofocus />
      </div>
      <div class="cli-results">
        {#if clientResults.length === 0}
          <p class="cli-empty">Nenhum cliente encontrado.</p>
        {:else}
          {#each clientResults as c (c.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="cli-result-row" on:click={() => pickClient(c)}>
              <div class="cli-result-nome">{c.nome}</div>
              <div class="cli-result-sub">
                {#if c.tel}{c.tel}{/if}
                {#if c.tel && c.email} · {/if}
                {#if c.email}{c.email}{/if}
                {#if c.cidade} · {c.cidade}{/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ── Quick new client modal ───────────────────────────────────────────── -->
{#if clientNewOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="cli-modal-back" on:click|self={closeClientNew}>
    <div class="cli-modal cli-modal-new">
      <div class="cli-modal-hd">
        <span class="cli-modal-title">Novo cliente</span>
        <button class="cli-close" on:click={closeClientNew}>×</button>
      </div>
      <div class="cli-new-body">
        <label class="cli-field">
          <span>Nome *</span>
          <!-- svelte-ignore a11y-autofocus -->
          <input class="cli-inp" bind:value={clientNewForm.nome}
                 placeholder="Ex.: Construtora ABC Ltda" autofocus />
        </label>
        <label class="cli-field">
          <span>Telefone</span>
          <input class="cli-inp" type="tel" bind:value={clientNewForm.tel} placeholder="(11) 9999-9999" />
        </label>
        <label class="cli-field">
          <span>E-mail</span>
          <input class="cli-inp" type="email" bind:value={clientNewForm.email} placeholder="contato@empresa.com" />
        </label>
      </div>
      <div class="cli-new-ft">
        <button class="cli-btn-line" on:click={closeClientNew}>Cancelar</button>
        <button class="cli-btn-amber" on:click={saveClientNew}
                disabled={!clientNewForm.nome.trim()}>Salvar cliente</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Layout shell ─────────────────────────────────────────────────────────── */
  .page { display: grid; grid-template-columns: 282px 1fr; height: 100%; overflow: hidden; }
  .main { display: flex; flex-direction: column; overflow: hidden; }

  /* ── Toolbar ──────────────────────────────────────────────────────────────── */
  .toolbar { display: flex; align-items: center; gap: 10px; padding: 0 14px; height: 52px; background: var(--ink); color: #fff; flex-shrink: 0; flex-wrap: wrap; }
  .ctxf { display: flex; gap: 8px; }
  .ctxf input { height: 32px; background: #222e3b; border: 1px solid #2f3d4d; border-radius: 6px; color: #fff; padding: 0 10px; width: 130px; font-size: 13px; }
  .ctxf input.narrow { width: 90px; }
  .ctxf input.wide   { width: 180px; }
  .spacer { flex: 1; }

  .btn-ghost { background: #222e3b; color: #dfe7ef; border-color: #33414f; }
  .btn-ghost:hover { background: #2a3543; }

  .btn-save {
    background: #1a3a2a;
    color: #4ade80;
    border-color: #2a5a3a;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-save:hover { background: #1e4a32; color: #86efac; }

  /* ── Editing bar ─────────────────────────────────────────────────────────── */
  .editing-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 14px;
    background: #fefce8;
    border-bottom: 1px solid #fde68a;
    font-size: 12.5px;
    color: #854d0e;
  }
  .editing-bar svg { flex-shrink: 0; stroke: #d97706; }
  .cancel-edit-btn {
    margin-left: auto;
    background: none;
    border: 1px solid #fde68a;
    border-radius: 5px;
    color: #92400e;
    font-size: 12px;
    padding: 2px 10px;
    cursor: pointer;
    transition: background .12s;
  }
  .cancel-edit-btn:hover { background: #fef3c7; }

  /* ── Scroll / editor content ──────────────────────────────────────────────── */
  .scroll { flex: 1; overflow-y: auto; padding: 16px; }

  .editor { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 14px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); }
  .card-h { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--line); gap: 8px; }
  .t { font-weight: 600; font-size: 13.5px; flex: 1; } .dim { color: var(--ink-soft); font-weight: 400; }
  .vbadge { font-family: var(--mono); font-size: 11px; background: #fff4e6; color: var(--amber-deep); border: 1px solid #f5d9b0; border-radius: 5px; padding: 2px 8px; cursor: help; white-space: nowrap; }
  .vlist { background: #fff9f0; border-top: 1px solid #f5d9b0; padding: 8px 12px; display: flex; flex-direction: column; gap: 3px; }
  .vrow { font-size: 11.5px; color: var(--amber-deep); }
  .vrow.coll { color: var(--danger); font-weight: 500; }
  .toggle { display: flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; font-size: 11.5px; }
  .toggle button { padding: 5px 10px; color: var(--ink-soft); background: none; border: 0; cursor: pointer; }
  .toggle button.on { background: var(--ink); color: #fff; font-weight: 500; }

  .foot { margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
  .btn { height: 34px; padding: 0 12px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; gap: 6px; }
  .btn.big { height: 38px; }
  .btn-amber { background: var(--amber); color: #fff; } .btn-amber:hover { background: #d67d12; }
  .btn-line { background: var(--panel); color: var(--ink); border-color: var(--line); flex: 0 0 auto; } .btn-line:hover { background: var(--panel-2); }
  .foot .btn-amber { flex: 1; min-width: 200px; }

  .tray-card { margin-top: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); }
  .tray-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--line); }
  .tray-head .t { font-weight: 600; font-size: 13.5px; }
  .tray-tot { font-family: var(--mono); font-size: 12px; color: var(--ink-soft); }
  .tray-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 10px; }
  .tray-group { display: flex; flex-direction: column; gap: 6px; }
  .group-h { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 2px; border-bottom: 1px solid var(--line); gap: 8px; }
  .mp-lbl { font-family: var(--mono); font-size: 10.5px; letter-spacing: .3px; color: var(--ink-faint); text-transform: uppercase; flex: 1; }
  .group-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .group-kg { font-family: var(--mono); font-size: 11px; color: var(--ink-soft); }
  .btn-xs { height: 26px; padding: 0 9px; font-size: 11.5px; border-radius: 5px; }
  .tray-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r); background: var(--panel); }
  .tray-item.on { border-color: var(--amber); background: var(--amber-soft); }
  .tray-item .nm { flex: 1; min-width: 0; cursor: pointer; }
  .tray-item .nm b { font-weight: 500; font-size: 13px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tray-item .nm .sku  { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); background: var(--panel-2); border-radius: 3px; padding: 1px 5px; display: inline-block; margin: 2px 0; letter-spacing: .2px; }
  .tray-item .nm small { color: var(--ink-soft); font-family: var(--mono); font-size: 10.5px; }
  .tray-item .rm { color: var(--ink-faint); font-size: 16px; padding: 2px 4px; border-radius: 4px; background: none; border: 0; cursor: pointer; flex-shrink: 0; }
  .tray-item .rm:hover { color: var(--danger); }

  /* ── Modal ────────────────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 18, 28, .55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }
  .modal {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    width: 420px;
    max-width: calc(100vw - 32px);
    box-shadow: 0 8px 32px rgba(0,0,0,.18);
    overflow: hidden;
  }

  /* Form screen */
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
  }
  .modal-title { font-weight: 700; font-size: 15px; color: var(--ink); }
  .modal-close {
    background: none; border: none; cursor: pointer;
    color: var(--ink-faint); font-size: 20px; line-height: 1; padding: 0 2px;
  }
  .modal-close:hover { color: var(--ink); }
  .modal-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
  .modal-foot {
    display: flex;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid var(--line);
    background: var(--panel);
  }
  .modal-foot .btn-amber { flex: 1; }

  /* Client badge */
  .client-badge {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 18px;
    background: #eff6ff;
    border-bottom: 1px solid #bfdbfe;
    font-size: 12.5px;
    color: #1e40af;
  }
  .client-badge strong { font-weight: 600; }
  .client-badge-label {
    margin-left: auto;
    font-size: 11px;
    color: #60a5fa;
    font-weight: 500;
  }

  /* Form fields */
  .reg-tipo { display: flex; gap: 8px; }
  .radio-opt {
    flex: 1;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 8px 12px; border: 1px solid var(--line);
    border-radius: 7px; cursor: pointer; font-size: 13px;
    color: var(--ink-soft); background: var(--panel);
    transition: border-color .12s, background .12s, color .12s;
  }
  .radio-opt input { display: none; }
  .radio-opt.on { border-color: var(--amber); background: var(--amber-soft); color: var(--amber-deep); font-weight: 600; }

  .reg-validade { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .reg-lbl { font-size: 11.5px; color: var(--ink-faint); font-weight: 500; }
  .val-btn {
    height: 28px; padding: 0 10px; border: 1px solid var(--line);
    border-radius: 5px; background: var(--panel-2); color: var(--ink-soft);
    font-size: 12px; cursor: pointer; transition: background .1s, color .1s, border-color .1s;
  }
  .val-btn.on { border-color: var(--amber); background: var(--amber-soft); color: var(--amber-deep); font-weight: 600; }
  .val-btn:hover:not(.on) { background: var(--panel-3, #e5e7eb); }

  .reg-row { display: flex; gap: 10px; }
  .reg-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .reg-field .reg-lbl { font-size: 11px; }
  .inp {
    height: 32px; padding: 0 10px;
    border: 1px solid var(--line); border-radius: 6px;
    background: var(--panel); color: var(--ink);
    font-size: 13px; font-family: inherit; outline: none;
    transition: border-color .15s;
  }
  .inp:focus { border-color: var(--amber); }
  .inp-sm { height: 28px; font-size: 12px; }
  select.inp { cursor: pointer; }

  /* Done screen */
  .done-screen {
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  .done-check { display: flex; align-items: center; justify-content: center; }
  .done-title { font-size: 18px; font-weight: 700; color: var(--ink); }
  .done-info { display: flex; align-items: baseline; gap: 10px; }
  .done-cliente { font-size: 14px; color: var(--ink-soft); }
  .done-valor { font-family: var(--mono); font-size: 15px; font-weight: 700; color: var(--ink); }
  .done-actions { display: flex; gap: 10px; margin-top: 8px; width: 100%; }
  .done-btn { flex: 1; height: 40px; font-size: 13.5px; }

  @media (max-width: 980px) { .page { grid-template-columns: 1fr; } }
  @media (max-width: 720px) { .editor { grid-template-columns: 1fr; } }

  /* ── Client toolbar buttons ──────────────────────────────────────────────── */
  .ctxf-client-wrap { display: flex; align-items: center; gap: 4px; }
  .ctxf-client-wrap input { width: 130px; }
  .ctxf-icon-btn { width: 28px; height: 32px; background: #222e3b; border: 1px solid #2f3d4d;
                   border-radius: 6px; color: #8fa7c0; cursor: pointer; display: flex;
                   align-items: center; justify-content: center; flex-shrink: 0; }
  .ctxf-icon-btn:hover { background: #2a3d50; color: #d0dce8; }

  /* ── Client modals ───────────────────────────────────────────────────────── */
  .cli-modal-back { position: fixed; inset: 0; background: rgba(0,0,0,.45);
                    display: flex; align-items: flex-start; justify-content: center;
                    padding-top: 80px; z-index: 200; }
  .cli-modal { background: #fff; border-radius: 10px; width: 420px; max-width: 95vw;
               box-shadow: 0 8px 32px rgba(0,0,0,.22); display: flex;
               flex-direction: column; max-height: 70vh; overflow: hidden; }
  .cli-modal-hd { display: flex; align-items: center; justify-content: space-between;
                  padding: 14px 18px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .cli-modal-title { font-size: 14px; font-weight: 600; color: var(--ink); }
  .cli-close { width: 26px; height: 26px; border: none; background: none; cursor: pointer;
               font-size: 17px; color: var(--ink-soft); border-radius: 5px; line-height: 1; }
  .cli-close:hover { background: var(--panel-2); }

  .cli-search-row { padding: 12px 16px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .cli-search-inp { width: 100%; height: 34px; border: 1px solid var(--line); border-radius: 6px;
                    padding: 0 10px; font-size: 13px; box-sizing: border-box; }
  .cli-search-inp:focus { outline: none; border-color: var(--amber); }

  .cli-results { flex: 1; overflow-y: auto; }
  .cli-empty   { padding: 20px 16px; font-size: 13px; color: var(--ink-faint); margin: 0; }
  .cli-result-row { padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--line);
                    transition: background .1s; }
  .cli-result-row:hover { background: var(--amber-soft); }
  .cli-result-nome { font-size: 13.5px; font-weight: 600; color: var(--ink); }
  .cli-result-sub  { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }

  .cli-modal-new { max-height: none; }
  .cli-new-body  { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
  .cli-field     { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px;
                   font-weight: 500; color: var(--ink-soft); }
  .cli-inp       { height: 34px; border: 1px solid var(--line); border-radius: 6px;
                   padding: 0 10px; font-size: 13px; }
  .cli-inp:focus { outline: none; border-color: var(--amber); }
  .cli-new-ft    { display: flex; gap: 8px; justify-content: flex-end;
                   padding: 12px 18px; border-top: 1px solid var(--line); }
  .cli-btn-line  { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px;
                   font-weight: 500; background: var(--panel); border: 1px solid var(--line);
                   color: var(--ink); cursor: pointer; }
  .cli-btn-line:hover { background: var(--panel-2); }
  .cli-btn-amber { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px;
                   font-weight: 500; background: var(--amber); border: 1px solid var(--amber);
                   color: #fff; cursor: pointer; }
  .cli-btn-amber:hover { background: #d67d12; }
  .cli-btn-amber:disabled { opacity: .5; cursor: not-allowed; }
</style>
