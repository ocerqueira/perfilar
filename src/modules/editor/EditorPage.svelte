<script>
  import { get } from 'svelte/store';
  import { editor, order, ctx, regions, regionId, freshEditor, catalogOverrides, catalogPresets, descConfig, catalogMaterials, companyInfo } from '../../lib/stores.js';
  import { PRESETS, clone } from '../../lib/presets.js';
  import { compute, describe, buildDescCfg, nf, brl } from '../../lib/engine.js';
  import { priceFor } from '../../lib/pricing.js';
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
</script>

<div class="page">
  <Sidebar {load} {loadCustom} />

  <div class="main">
    <!-- toolbar: ctx fields + action buttons -->
    <div class="toolbar">
      <div class="ctxf">
        <input placeholder="Cliente" bind:value={$ctx.cliente} />
        <input placeholder="Nº orçamento" bind:value={$ctx.orc} />
        <input placeholder="Vendedor" bind:value={$ctx.vendedor} class="narrow" />
        <input placeholder="Observação" bind:value={$ctx.obs} class="wide" />
      </div>
      <div class="spacer"></div>
      <button class="btn btn-ghost" on:click={openOrc}>Orçamento</button>
      <button class="btn btn-amber" on:click={openOP}>Ordem de produção</button>
    </div>

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

{#if doc.open}
  <Docs kind={doc.kind} on:close={() => (doc = { ...doc, open: false })} />
{/if}
{#if cutPlanGroup}
  <CutPlan group={cutPlanGroup} ctx={$ctx} on:close={() => (cutPlanGroup = null)} />
{/if}

<style>
  .page { display: grid; grid-template-columns: 282px 1fr; height: 100%; overflow: hidden; }
  .main { display: flex; flex-direction: column; overflow: hidden; }

  .toolbar { display: flex; align-items: center; gap: 10px; padding: 0 14px; height: 52px; background: var(--ink); color: #fff; flex-shrink: 0; flex-wrap: wrap; }
  .ctxf { display: flex; gap: 8px; }
  .ctxf input { height: 32px; background: #222e3b; border: 1px solid #2f3d4d; border-radius: 6px; color: #fff; padding: 0 10px; width: 130px; font-size: 13px; }
  .ctxf input.narrow { width: 90px; }
  .ctxf input.wide   { width: 180px; }
  .spacer { flex: 1; }

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
  .btn { height: 34px; padding: 0 12px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; }
  .btn.big { height: 38px; }
  .btn-amber { background: var(--amber); color: #fff; } .btn-amber:hover { background: #d67d12; }
  .btn-ghost { background: #222e3b; color: #dfe7ef; border-color: #33414f; } .btn-ghost:hover { background: #2a3543; }
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

  @media (max-width: 980px) { .page { grid-template-columns: 1fr; } }
  @media (max-width: 720px) { .editor { grid-template-columns: 1fr; } }
</style>
