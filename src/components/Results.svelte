<script>
  import { editor } from '../lib/stores.js';
  import { describe, nf, mpSummary } from '../lib/engine.js';
  import { toDXF, download } from '../lib/geometry.js';
  import Tooltip from './Tooltip.svelte';

  export let C;
  export let name;
  $: P = $editor.params;
  $: code = describe(name, P, C.des, $editor.rows, $editor.conv);
  $: cobra = P.cobrarSobra && C.totFat > C.totLiq + 0.001;

  function copyCode() { if (navigator.clipboard) navigator.clipboard.writeText(code); }
  function exportDXF() {
    const dxf = toDXF($editor.rows, $editor.h0, P.R);
    download(`${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-des${Math.round(C.des)}.dxf`, dxf);
  }
</script>

<div class="results">
  <div class="stat"><div class="k">Desenvolvimento</div><div class="v">{nf(C.des, 0)} <small>mm</small></div></div>
  <div class="stat"><div class="k">Peso / metro</div><div class="v">{nf(C.kgm, 3)} <small>kg/m</small></div></div>
  <div class="stat"><div class="k">Peso / peça <small class="tag">líq.</small></div><div class="v">{nf(C.pcLiq, 2)} <small>kg</small></div></div>
  <div class="stat hot"><div class="k">Peso total <small class="tag">{P.cobrarSobra ? 'faturado' : 'líquido'}</small></div><div class="v">{nf(C.tot, 1)} <small>kg</small></div></div>
</div>

<div class="cut">
  <span>{mpSummary(P, C)}</span>
  {#if cobra}<span class="bill">Sobra cobrada: líquido {nf(C.totLiq, 1)} kg → faturado {nf(C.totFat, 1)} kg</span>{/if}
</div>

<div class="code">
  <div class="lab">Descrição padronizada <Tooltip text="Código único do produto. Em breve o formato será configurável por tipo." /></div>
  <div class="box">
    <code>{code}</code>
    <button class="btn" on:click={copyCode} title="Copiar">⧉</button>
    <button class="btn" on:click={exportDXF} title="Exportar DXF">DXF ↓</button>
  </div>
</div>

<style>
  .results { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 14px; }
  .stat { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); padding: 11px 13px; }
  .k { font-size: 11.5px; color: var(--ink-soft); display: flex; align-items: center; gap: 5px; }
  .tag { font-family: var(--mono); font-size: 9px; background: var(--panel-2); color: var(--ink-faint); padding: 1px 5px; border-radius: 4px; }
  .v { font-family: var(--mono); font-size: 22px; font-weight: 500; margin-top: 1px; }
  .v small { font-size: 12px; color: var(--ink-faint); font-weight: 400; }
  .stat.hot { background: var(--ink); border-color: var(--ink); }
  .stat.hot .k { color: #9fb0c2; } .stat.hot .tag { background: #2a3543; color: #9fb0c2; }
  .stat.hot .v { color: #fff; } .stat.hot .v small { color: #7d8ea0; }
  .cut { margin-top: 10px; background: var(--amber-soft); border: 1px solid #f0d9bd; border-radius: var(--r); padding: 9px 12px; font-size: 12.5px; color: var(--amber-deep); display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .bill { font-weight: 500; }
  .code { margin-top: 10px; }
  .lab { font-size: 11.5px; color: var(--ink-soft); margin-bottom: 4px; }
  .box { display: flex; gap: 8px; }
  code { flex: 1; font-family: var(--mono); font-size: 12px; background: var(--panel); border: 1px solid var(--line); padding: 9px 11px; border-radius: 6px; overflow-x: auto; white-space: nowrap; }
  .btn { height: 38px; padding: 0 12px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; white-space: nowrap; }
  .btn:hover { background: var(--panel-2); }
</style>
