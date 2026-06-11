<script>
  import { editor, catalogMaterials, catalogRevests, catalogGauges } from '../lib/stores.js';
  import Tooltip from './Tooltip.svelte';

  let tFree = false;
  $: P = $editor.params;

  function setMat(e) {
    const m = MATERIALS.find((x) => x.name === e.target.value);
    P.matName = m.name; P.dens = m.dens; $editor = $editor;
  }
  function setGauge(e) {
    if (e.target.value === 'outra') { tFree = true; return; }
    tFree = false; P.t = parseFloat(e.target.value); $editor = $editor;
  }
  const num = (k) => (e) => { P[k] = parseFloat(e.target.value) || 0; $editor = $editor; };
  const str = (k) => (e) => { P[k] = e.target.value; $editor = $editor; };
  function setForma(f) { P.forma = f; $editor = $editor; }
  function setSobra(v) { P.cobrarSobra = v; $editor = $editor; }
</script>

<div class="card">
  <div class="card-h"><span class="t">Matéria-prima</span></div>
  <div class="body">
    <div class="grid">
      <div class="field"><label>Material <Tooltip text="Liga do aço. Define a densidade usada no cálculo de peso." /></label>
        <select on:change={setMat} value={P.matName}>{#each $catalogMaterials as m}<option value={m.name}>{m.name}</option>{/each}</select>
      </div>
      <div class="field"><label>Revestimento <Tooltip text="Camada de proteção (ex.: Z275 = 275 g/m² de zinco). Entra na descrição do produto." /></label>
        <select value={P.revest} on:change={str('revest')}>{#each $catalogRevests as r}<option>{r}</option>{/each}</select>
      </div>
      <div class="field"><label>Espessura / bitola <span class="u">mm</span><Tooltip text="Espessura nominal da chapa. Multiplica direto no peso." /></label>
        <select on:change={setGauge} value={$catalogGauges.includes(P.t) ? P.t : 'outra'}>
          {#each $catalogGauges as g}<option value={g}>{g.toFixed(2)}</option>{/each}<option value="outra">Outra…</option>
        </select>
        {#if tFree || !$catalogGauges.includes(P.t)}<input type="number" step="0.05" value={P.t} on:input={num('t')} placeholder="mm" style="margin-top:6px" />{/if}
      </div>
    </div>

    <div class="split">
      <div class="field"><label>Forma <Tooltip text="Bobina: tira contínua, pedida por comprimento. Chapa: corte padrão, mantido em estoque." /></label>
        <div class="seg">
          <button class:on={P.forma === 'bobina'} on:click={() => setForma('bobina')}>Bobina</button>
          <button class:on={P.forma === 'chapa'} on:click={() => setForma('chapa')}>Chapa</button>
        </div>
      </div>

      {#if P.forma === 'bobina'}
        <div class="field"><label>Largura da bobina <span class="u">mm</span><Tooltip text="Largura da bobina. Define quantas tiras do desenvolvimento saem lado a lado." /></label>
          <input type="number" step="10" value={P.coil} on:input={num('coil')} /></div>
      {:else}
        <div class="field"><label>Chapa: largura <span class="u">mm</span><Tooltip text="Largura da chapa padrão em estoque." /></label>
          <input type="number" step="10" value={P.chapaL} on:input={num('chapaL')} /></div>
        <div class="field"><label>Chapa: comprimento <span class="u">mm</span><Tooltip text="Comprimento da chapa padrão em estoque." /></label>
          <input type="number" step="10" value={P.chapaC} on:input={num('chapaC')} /></div>
      {/if}

      <div class="field"><label>Cobrar sobra <Tooltip text="Ligado: o peso faturado inclui a sobra da tira/chapa (cliente paga o retalho). Desligado: fatura só o peso líquido do produto." /></label>
        <div class="seg">
          <button class:on={P.cobrarSobra} on:click={() => setSobra(true)}>Sim</button>
          <button class:on={!P.cobrarSobra} on:click={() => setSobra(false)}>Não</button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); margin-top: 14px; }
  .card-h { padding: 10px 12px; border-bottom: 1px solid var(--line); }
  .t { font-weight: 600; font-size: 13.5px; }
  .body { padding: 12px 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .split { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .field label { display: block; font-size: 11.5px; color: var(--ink-soft); margin-bottom: 4px; }
  .field :global(input), .field :global(select) { width: 100%; height: 32px; border: 1px solid var(--line); border-radius: 6px; padding: 0 8px; background: var(--panel); font-size: 13px; }
  .field :global(input:focus), .field :global(select:focus) { outline: none; border-color: var(--amber); }
  .u { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); background: var(--panel-2); padding: 1px 5px; border-radius: 4px; margin-left: 2px; }
  .seg { display: flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; height: 32px; }
  .seg button { flex: 1; color: var(--ink-soft); background: none; border: 0; cursor: pointer; font-size: 12.5px; }
  .seg button.on { background: var(--ink); color: #fff; font-weight: 500; }
</style>
