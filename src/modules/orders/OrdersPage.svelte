<script>
  import { orders, orderHistory, order, ctx, editor, editingOrderId, freshEditor } from '../../lib/stores.js';
  import { brl } from '../../lib/engine.js';
  import { clone } from '../../lib/presets.js';

  // ── Filtros e busca ──────────────────────────────────────────────────────
  let tab    = 'todos';   // todos | orcamento | pedido | perdido
  let search = '';
  let sort   = 'date';    // date | valor | cliente

  const TABS = [
    { key: 'todos',     label: 'Todos'       },
    { key: 'orcamento', label: 'Orçamentos'  },
    { key: 'pedido',    label: 'Pedidos'     },
    { key: 'perdido',   label: 'Perdidos'    },
  ];

  // ── Status derivado (vencido = orcamento expirado) ───────────────────────
  function effectiveStatus(o) {
    if (o.status === 'orcamento' && o.dataValidade) {
      if (new Date(o.dataValidade) < new Date()) return 'expirado';
    }
    return o.status;
  }

  function diasParaVencer(o) {
    if (!o.dataValidade) return null;
    const diff = new Date(o.dataValidade) - new Date();
    return Math.ceil(diff / 86400000);
  }

  // ── Lista filtrada ────────────────────────────────────────────────────────
  $: filtered = $orders
    .filter(o => {
      if (tab !== 'todos') {
        const es = effectiveStatus(o);
        if (tab === 'orcamento' && es !== 'orcamento') return false;
        if (tab === 'pedido'    && es !== 'pedido')    return false;
        if (tab === 'perdido'   && es !== 'perdido')   return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          (o.cliente  || '').toLowerCase().includes(q) ||
          (o.orc      || '').toLowerCase().includes(q) ||
          (o.cidade   || '').toLowerCase().includes(q) ||
          (o.vendedor || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'valor')   return (b.totV || 0) - (a.totV || 0);
      if (sort === 'cliente') return (a.cliente || '').localeCompare(b.cliente || '');
      return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
    });

  // ── Contagens para badges nos tabs ───────────────────────────────────────
  $: counts = {
    todos:     $orders.length,
    orcamento: $orders.filter(o => effectiveStatus(o) === 'orcamento').length,
    pedido:    $orders.filter(o => effectiveStatus(o) === 'pedido').length,
    perdido:   $orders.filter(o => effectiveStatus(o) === 'perdido').length,
  };

  // ── Ações de ciclo de vida ────────────────────────────────────────────────
  function fecharPedido(id) {
    const now = new Date().toISOString();
    let entry;
    orders.update(list => list.map(o => {
      if (o.id !== id) return o;
      entry = { ...o, status: 'pedido', updatedAt: now, dataPedido: now };
      return entry;
    }));
    if (entry) {
      orderHistory.update(h => [{ ...entry, date: entry.dataPedido }, ...h]);
    }
  }

  function marcarPerdido(id) {
    const now = new Date().toISOString();
    orders.update(list => list.map(o =>
      o.id === id ? { ...o, status: 'perdido', updatedAt: now } : o
    ));
  }

  function reabrir(id) {
    const now = new Date().toISOString();
    orders.update(list => list.map(o =>
      o.id === id ? { ...o, status: 'orcamento', updatedAt: now } : o
    ));
  }

  function excluir(id) {
    orders.update(list => list.filter(o => o.id !== id));
  }

  // ── Helpers de formatação ────────────────────────────────────────────────
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function nf(v, d = 0) {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  const TIPO_LABEL = {
    construtora:  'Construtora',
    revendedor:   'Revendedor',
    industria:    'Indústria',
    pessoa_fisica:'Pessoa Física',
    outro:        'Outro',
  };

  let confirmDelete = null;
  let expanded = new Set();

  // ── Modal de motivo de perda ──────────────────────────────────────────────
  const CATEGORIAS_PERDA = [
    { value: 'preco',        label: 'Preço'                   },
    { value: 'concorrencia', label: 'Concorrência'            },
    { value: 'prazo',        label: 'Prazo de entrega'        },
    { value: 'indisponivel', label: 'Produto indisponível'    },
    { value: 'desistiu',     label: 'Cliente desistiu'        },
    { value: 'sem_resposta', label: 'Sem resposta'            },
    { value: 'outro',        label: 'Outro'                   },
  ];

  let perdaModal = null; // { id } | null
  let perdaForm  = { categoria: '', motivo: '' };

  function abrirPerda(id) {
    perdaForm = { categoria: '', motivo: '' };
    perdaModal = { id };
  }

  function confirmarPerda() {
    const now = new Date().toISOString();
    orders.update(list => list.map(o =>
      o.id === perdaModal.id
        ? { ...o, status: 'perdido', updatedAt: now, motivoPerda: { ...perdaForm, date: now } }
        : o
    ));
    perdaModal = null;
  }
  function toggleExpand(id) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    expanded = expanded;
  }

  // ── Editar no editor ──────────────────────────────────────────────────────
  function editarPedido(entry) {
    const oi = entry.orderItems || [];
    order.set({ items: oi, sel: oi.length > 0 ? 0 : -1 });
    if (oi.length > 0) {
      const it = oi[0];
      editor.set({ mode: it.mode, key: it.key, conv: it.conv, bd: it.bd, h0: it.h0, rows: clone(it.rows), params: clone(it.params) });
    } else {
      editor.set(freshEditor());
    }
    ctx.set({
      cliente: entry.cliente !== '—' ? entry.cliente : '',
      orc:     entry.orc     !== '—' ? entry.orc     : '',
      vendedor:entry.vendedor !== '—' ? entry.vendedor : '',
      obs:     entry.obs     || '',
    });
    editingOrderId.set(entry.id);
    window.location.hash = 'editor';
  }
</script>

<div class="page">

  <!-- ── Cabeçalho ────────────────────────────────────────────────────────── -->
  <div class="page-head">
    <div class="page-title">
      <span class="title-text">Pedidos</span>
      <span class="total-badge">{$orders.length}</span>
    </div>
    <div class="head-actions">
      <div class="search-wrap">
        <svg class="s-icon" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="8.5" cy="8.5" r="5.5"/><path d="M15 15l-2.5-2.5"/>
        </svg>
        <input class="search-inp" bind:value={search} placeholder="Buscar cliente, Nº ORC, cidade…" />
        {#if search}<button class="search-clear" on:click={() => search = ''}>×</button>{/if}
      </div>
      <select class="inp sort-sel" bind:value={sort}>
        <option value="date">Mais recentes</option>
        <option value="valor">Maior valor</option>
        <option value="cliente">Cliente A–Z</option>
      </select>
    </div>
  </div>

  <!-- ── Tabs ─────────────────────────────────────────────────────────────── -->
  <div class="tabs">
    {#each TABS as t}
      <button
        class="tab-btn"
        class:active={tab === t.key}
        on:click={() => tab = t.key}
      >
        {t.label}
        {#if counts[t.key] > 0}
          <span class="tab-count" class:amber={tab === t.key}>{counts[t.key]}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- ── Lista ─────────────────────────────────────────────────────────────── -->
  <div class="list">

    {#if filtered.length === 0}
      <div class="empty">
        {#if $orders.length === 0}
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".3">
            <rect x="12" y="6" width="24" height="36" rx="3"/><path d="M18 16h12M18 22h12M18 28h7"/>
          </svg>
          <p>Nenhum registro ainda.</p>
          <p class="empty-hint">Registre orçamentos ou pedidos pelo <a href="#dashboard">Início</a>.</p>
        {:else}
          <p>Nenhum resultado para "<strong>{search}</strong>".</p>
          <button class="btn line" on:click={() => { search = ''; tab = 'todos'; }}>Limpar filtros</button>
        {/if}
      </div>

    {:else}
      {#each filtered as o (o.id)}
        {@const es = effectiveStatus(o)}
        {@const dias = diasParaVencer(o)}

        <div class="card" class:card-expirado={es === 'expirado'} class:card-perdido={es === 'perdido'} class:card-pedido={es === 'pedido'}>

          <!-- Linha superior: status + referência + data -->
          <div class="card-top">
            <span class="badge badge-{es}">{
              es === 'orcamento' ? 'Orçamento' :
              es === 'pedido'    ? 'Pedido fechado' :
              es === 'expirado'  ? 'Vencido' :
                                   'Perdido'
            }</span>
            {#if o.orc && o.orc !== '—'}
              <span class="card-orc">Nº {o.orc}</span>
            {/if}
            <span class="card-date">{fmtDate(o.createdAt || o.date)}</span>

            {#if es === 'orcamento' && dias !== null}
              {#if dias <= 0}
                <span class="vence vence-venc">Expirou {Math.abs(dias)}d atrás</span>
              {:else if dias <= 3}
                <span class="vence vence-warn">Vence em {dias}d</span>
              {:else}
                <span class="vence vence-ok">Vence em {dias}d</span>
              {/if}
            {/if}
            {#if es === 'pedido' && o.dataPedido}
              <span class="card-date" style="margin-left:auto">Fechado {fmtDate(o.dataPedido)}</span>
            {/if}
          </div>

          <!-- Linha do cliente -->
          <div class="card-cliente">
            <span class="card-nome">{o.cliente || '—'}</span>
            {#if o.cidade}
              <span class="card-meta">· {o.cidade}</span>
            {/if}
            {#if o.vendedor && o.vendedor !== '—'}
              <span class="card-meta">· {o.vendedor}</span>
            {/if}
            {#if o.tipoCliente}
              <span class="card-tipo">{TIPO_LABEL[o.tipoCliente] ?? o.tipoCliente}</span>
            {/if}
          </div>

          <!-- Linha de valores -->
          <div class="card-vals">
            <span class="val-item"><span class="val-n">{brl(o.totV)}</span><span class="val-l">valor total</span></span>
            <span class="val-div"></span>
            <span class="val-item"><span class="val-n">{nf(o.totW, 1)} kg</span><span class="val-l">peso</span></span>
            <span class="val-div"></span>
            <span class="val-item"><span class="val-n">{o.items || 0} {(o.items || 0) === 1 ? 'item' : 'itens'}</span><span class="val-l">peças</span></span>
            {#if o.comm > 0}
              <span class="val-div"></span>
              <span class="val-item"><span class="val-n comm-n">{brl(o.comm)}</span><span class="val-l">comissão</span></span>
            {/if}
          </div>

          <!-- Ações -->
          <div class="card-actions">
            <button class="btn-action btn-editar" on:click={() => editarPedido(o)}>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z"/>
              </svg>
              Editar
            </button>

            {#if es === 'orcamento'}
              <button class="btn-action btn-fechar" on:click={() => fecharPedido(o.id)}>
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2.5 8.5l3.5 3.5 7.5-7.5"/>
                </svg>
                Fechar pedido
              </button>
              <button class="btn-action btn-perdido" on:click={() => abrirPerda(o.id)}>
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <path d="M3 3l10 10M13 3L3 13"/>
                </svg>
                Perdido
              </button>
            {:else if es === 'expirado'}
              <button class="btn-action btn-fechar" on:click={() => fecharPedido(o.id)}>
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2.5 8.5l3.5 3.5 7.5-7.5"/>
                </svg>
                Fechar mesmo assim
              </button>
              <button class="btn-action btn-perdido" on:click={() => abrirPerda(o.id)}>Marcar como perdido</button>
            {:else if es === 'perdido'}
              <button class="btn-action btn-reabrir" on:click={() => reabrir(o.id)}>
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M13 3v4H9"/><path d="M13 7a6 6 0 1 1-1.5-4"/>
                </svg>
                Reabrir
              </button>
            {/if}

            <div class="spacer"></div>

            <button
              class="btn-action btn-expand"
              class:is-open={expanded.has(o.id)}
              on:click={() => toggleExpand(o.id)}
              title={expanded.has(o.id) ? 'Recolher detalhes' : 'Ver itens'}
            >
              {expanded.has(o.id) ? 'Recolher' : 'Ver itens'}
              <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chev">
                <path d="M4 6l4 4 4-4"/>
              </svg>
            </button>

            {#if confirmDelete === o.id}
              <span class="confirm-del">Excluir?</span>
              <button class="btn-action btn-del-confirm" on:click={() => { excluir(o.id); confirmDelete = null; }}>Sim</button>
              <button class="btn-action btn-reabrir" on:click={() => confirmDelete = null}>Não</button>
            {:else}
              <button class="btn-action btn-del" on:click={() => confirmDelete = o.id} title="Excluir">
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 4h10M6 4V2.5h4V4M5.5 4l.5 9h4l.5-9"/>
                </svg>
              </button>
            {/if}
          </div>

          <!-- Detalhes expandíveis -->
          {#if expanded.has(o.id)}
            <div class="detail">
              {#if o.orderItems?.length}
                <div class="detail-items">
                  {#each o.orderItems as it}
                    <div class="ditem">
                      <div class="ditem-left">
                        <span class="ditem-name">{it.label || it.name || '—'}</span>
                        {#if it.code}<code class="ditem-code">{it.code}</code>{/if}
                      </div>
                      <div class="ditem-right">
                        {#if it.params?.Q}
                          <span class="ditem-stat">{it.params.Q} pç</span>
                          <span class="ditem-div"></span>
                        {/if}
                        <span class="ditem-stat">{nf(it.C?.tot || 0, 1)} kg</span>
                        <span class="ditem-div"></span>
                        <span class="ditem-val">{brl(it.precoTotal || it.total || 0)}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else if o.itemsDetalhe?.length}
                <div class="detail-items">
                  {#each o.itemsDetalhe as it}
                    <div class="ditem">
                      <div class="ditem-left">
                        <span class="ditem-name">{it.label || it.name || it.key || '—'}</span>
                      </div>
                      <div class="ditem-right">
                        <span class="ditem-stat">{nf(it.peso || 0, 1)} kg</span>
                        <span class="ditem-div"></span>
                        <span class="ditem-val">{brl(it.valor || 0)}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <span class="detail-empty">{o.items || 0} {(o.items || 0) === 1 ? 'item registrado' : 'itens registrados'} · detalhes não disponíveis</span>
              {/if}

              {#if o.motivoPerda}
                {@const cat = CATEGORIAS_PERDA.find(c => c.value === o.motivoPerda.categoria)}
                <div class="detail-perda">
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
                  <div class="detail-perda-body">
                    <span class="detail-perda-cat">{cat?.label ?? 'Motivo não informado'}</span>
                    {#if o.motivoPerda.motivo}
                      <span class="detail-perda-txt">{o.motivoPerda.motivo}</span>
                    {/if}
                  </div>
                </div>
              {/if}

              {#if o.obs}
                <div class="detail-obs">
                  <span class="detail-obs-lbl">Obs.</span>
                  <span>{o.obs}</span>
                </div>
              {/if}
            </div>
          {/if}

        </div>
      {/each}
    {/if}

  </div>
</div>

<!-- ── Modal motivo de perda ──────────────────────────────────────────────── -->
{#if perdaModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click|self={() => perdaModal = null}>
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title-row">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#991b1b" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
          <span class="modal-title">Registrar motivo de perda</span>
        </div>
        <button class="modal-close" on:click={() => perdaModal = null}>×</button>
      </div>

      <div class="modal-body">
        <label class="field">
          <span class="field-lbl">Categoria <span class="req">*</span></span>
          <select class="inp" bind:value={perdaForm.categoria}>
            <option value="">Selecione…</option>
            {#each CATEGORIAS_PERDA as c}
              <option value={c.value}>{c.label}</option>
            {/each}
          </select>
        </label>

        <label class="field">
          <span class="field-lbl">Justificativa <span class="field-opt">(opcional)</span></span>
          <textarea
            class="inp inp-area"
            bind:value={perdaForm.motivo}
            placeholder="Ex.: cliente escolheu fornecedor com preço 15% menor…"
            rows="3"
          ></textarea>
        </label>
      </div>

      <div class="modal-foot">
        <button class="btn btn-ghost-neutral" on:click={() => perdaModal = null}>Cancelar</button>
        <button class="btn btn-perda" on:click={confirmarPerda} disabled={!perdaForm.categoria}>
          Confirmar perda
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Layout ──────────────────────────────────────────────────────────────── */
  .page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  /* ── Cabeçalho ───────────────────────────────────────────────────────────── */
  .page-head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--panel);
  }

  .page-title { display: flex; align-items: center; gap: 8px; margin-right: auto; }
  .title-text { font-size: 17px; font-weight: 700; color: var(--ink); }
  .total-badge {
    background: var(--panel-2);
    color: var(--ink-soft);
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 20px;
  }

  .head-actions { display: flex; align-items: center; gap: 8px; }

  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .s-icon { position: absolute; left: 9px; pointer-events: none; color: var(--ink-faint); }
  .search-inp {
    width: 240px;
    height: 32px;
    padding: 0 28px 0 30px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel);
    color: var(--ink);
    font-size: 13px;
    outline: none;
    transition: border-color .15s;
  }
  .search-inp:focus { border-color: var(--amber); }
  .search-inp::placeholder { color: var(--ink-faint); }
  .search-clear {
    position: absolute; right: 8px;
    background: none; border: none; cursor: pointer;
    color: var(--ink-faint); font-size: 16px; line-height: 1;
    padding: 0;
  }
  .search-clear:hover { color: var(--ink); }

  .sort-sel {
    height: 32px;
    font-size: 13px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel);
    color: var(--ink);
    cursor: pointer;
    outline: none;
  }

  /* ── Tabs ────────────────────────────────────────────────────────────────── */
  .tabs {
    flex-shrink: 0;
    display: flex;
    gap: 0;
    padding: 0 20px;
    border-bottom: 1px solid var(--line);
    background: var(--panel);
  }
  .tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 14px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-soft);
    transition: color .12s, border-color .12s;
    white-space: nowrap;
  }
  .tab-btn:hover { color: var(--ink); }
  .tab-btn.active { color: var(--amber-deep); border-bottom-color: var(--amber); }
  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--panel-2);
    color: var(--ink-faint);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
  }
  .tab-count.amber { background: var(--amber-soft); color: var(--amber-deep); }

  /* ── Lista ───────────────────────────────────────────────────────────────── */
  .list {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ── Empty state ─────────────────────────────────────────────────────────── */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    color: var(--ink-soft);
    font-size: 14px;
    text-align: center;
  }
  .empty p { margin: 0; }
  .empty-hint { font-size: 13px; color: var(--ink-faint); }
  .empty-hint a { color: var(--amber-deep); }
  .empty strong { color: var(--ink); }

  /* ── Card ────────────────────────────────────────────────────────────────── */
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color .15s;
  }
  .card:hover { border-color: var(--line-2, #ccc); }
  .card-expirado { border-left: 3px solid #f87171; }
  .card-perdido  { border-left: 3px solid var(--ink-faint); opacity: .8; }
  .card-pedido   { border-left: 3px solid #4ade80; }

  /* Card top row */
  .card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .card-orc { font-family: var(--mono); font-size: 12px; color: var(--ink-soft); }
  .card-date { font-size: 12px; color: var(--ink-faint); }

  /* Status badges */
  .badge {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .2px;
  }
  .badge-orcamento { background: #dbeafe; color: #1e40af; }
  .badge-pedido    { background: #dcfce7; color: #166534; }
  .badge-expirado  { background: #fee2e2; color: #991b1b; }
  .badge-perdido   { background: var(--panel-2); color: var(--ink-faint); }

  /* Vencimento */
  .vence { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
  .vence-ok   { background: #f0fdf4; color: #166534; }
  .vence-warn { background: #fef9c3; color: #854d0e; }
  .vence-venc { background: #fee2e2; color: #991b1b; }

  /* Cliente row */
  .card-cliente {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
  }
  .card-nome  { font-size: 15px; font-weight: 600; color: var(--ink); }
  .card-meta  { font-size: 13px; color: var(--ink-soft); }
  .card-tipo  {
    margin-left: auto;
    font-size: 11px;
    color: var(--ink-faint);
    background: var(--panel-2);
    padding: 1px 6px;
    border-radius: 4px;
  }

  /* Valores row */
  .card-vals {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .val-item { display: flex; flex-direction: column; gap: 1px; }
  .val-n    { font-size: 14px; font-weight: 700; color: var(--ink); font-family: var(--mono); }
  .val-l    { font-size: 10px; color: var(--ink-faint); font-family: var(--mono); text-transform: uppercase; letter-spacing: .4px; }
  .val-div  { width: 1px; height: 28px; background: var(--line); }
  .comm-n   { color: var(--amber-deep); }

  /* Ações row */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 4px;
  }
  .spacer { flex: 1; }

  .btn-action {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 10px;
    border-radius: 5px;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--ink-soft);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background .12s, color .12s, border-color .12s;
  }
  .btn-action:hover { background: var(--panel-3, #e5e7eb); color: var(--ink); }

  .btn-editar { color: var(--ink-soft); }
  .btn-editar:hover { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }

  .btn-fechar {
    border-color: #86efac;
    background: #f0fdf4;
    color: #166534;
  }
  .btn-fechar:hover { background: #dcfce7; }

  .btn-perdido {
    border-color: var(--line);
    color: var(--ink-faint);
  }
  .btn-perdido:hover { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }

  .btn-reabrir { color: var(--ink-soft); }
  .btn-reabrir:hover { color: var(--ink); }

  .btn-del { padding: 0 8px; }
  .btn-del:hover { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }

  .confirm-del { font-size: 12px; color: #991b1b; font-weight: 600; }
  .btn-del-confirm {
    border-color: #fca5a5;
    background: #fee2e2;
    color: #991b1b;
  }
  .btn-del-confirm:hover { background: #fecaca; }

  /* ── Expand button ───────────────────────────────────────────────────────── */
  .btn-expand { color: var(--ink-soft); gap: 4px; }
  .btn-expand:hover { color: var(--ink); }
  .btn-expand.is-open { background: var(--panel-3, #e5e7eb); color: var(--ink); }
  .chev { transition: transform .2s ease; }
  .btn-expand.is-open .chev { transform: rotate(180deg); }

  /* ── Detalhes expandíveis ────────────────────────────────────────────────── */
  .detail {
    border-top: 1px solid var(--line);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .detail-items { display: flex; flex-direction: column; gap: 4px; }

  .ditem {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    background: var(--panel-2);
    border-radius: 5px;
  }

  .ditem-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ditem-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ditem-code {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    letter-spacing: .2px;
  }

  .ditem-right { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
  .ditem-stat  { font-family: var(--mono); font-size: 11.5px; color: var(--ink-soft); }
  .ditem-div   { width: 1px; height: 14px; background: var(--line); }
  .ditem-val   { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--ink); }

  .detail-obs {
    display: flex;
    gap: 6px;
    font-size: 12.5px;
    color: var(--ink-soft);
    padding: 2px 2px 0;
  }
  .detail-obs-lbl { font-weight: 600; color: var(--ink-faint); flex-shrink: 0; }
  .detail-empty   { font-size: 12px; color: var(--ink-faint); }

  /* ── Motivo de perda no detalhe ─────────────────────────────────────────── */
  .detail-perda {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    padding: 8px 10px;
    background: #fff1f2;
    border: 1px solid #fecdd3;
    border-radius: 5px;
    font-size: 12.5px;
  }
  .detail-perda svg { flex-shrink: 0; margin-top: 2px; }
  .detail-perda-body { display: flex; flex-direction: column; gap: 2px; }
  .detail-perda-cat  { font-weight: 600; color: #991b1b; }
  .detail-perda-txt  { color: #7f1d1d; }

  /* ── Modal ────────────────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 18, 28, .5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    backdrop-filter: blur(2px);
  }
  .modal {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    width: 400px;
    max-width: calc(100vw - 32px);
    box-shadow: 0 8px 32px rgba(0,0,0,.15);
    overflow: hidden;
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
  }
  .modal-title-row { display: flex; align-items: center; gap: 8px; }
  .modal-title { font-weight: 700; font-size: 14px; color: var(--ink); }
  .modal-close {
    background: none; border: none; cursor: pointer;
    color: var(--ink-faint); font-size: 20px; line-height: 1; padding: 0 2px;
  }
  .modal-close:hover { color: var(--ink); }

  .modal-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }

  .field { display: flex; flex-direction: column; gap: 5px; }
  .field-lbl { font-size: 12px; font-weight: 600; color: var(--ink-soft); }
  .req { color: #dc2626; }
  .field-opt { font-weight: 400; color: var(--ink-faint); }

  .inp {
    height: 34px; padding: 0 10px;
    border: 1px solid var(--line); border-radius: 6px;
    background: var(--panel); color: var(--ink);
    font-size: 13px; font-family: inherit; outline: none;
    transition: border-color .15s;
  }
  .inp:focus { border-color: var(--amber); }
  select.inp { cursor: pointer; }
  .inp-area {
    height: auto;
    padding: 8px 10px;
    resize: vertical;
    min-height: 72px;
    line-height: 1.5;
  }

  .modal-foot {
    display: flex;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid var(--line);
    background: var(--panel);
  }
  .btn {
    height: 34px; padding: 0 14px; border-radius: 6px;
    font-size: 13px; font-weight: 500; border: 1px solid transparent;
    cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
    transition: background .12s, color .12s;
  }
  .btn-ghost-neutral {
    background: var(--panel-2); color: var(--ink-soft); border-color: var(--line);
  }
  .btn-ghost-neutral:hover { background: var(--panel-3, #e5e7eb); color: var(--ink); }
  .btn-perda {
    flex: 1;
    background: #fee2e2; color: #991b1b; border-color: #fca5a5;
  }
  .btn-perda:hover:not(:disabled) { background: #fecaca; }
  .btn-perda:disabled { opacity: .45; cursor: not-allowed; }

  /* ── Inp base (sort select) ───────────────────────────────────────────────── */
</style>
