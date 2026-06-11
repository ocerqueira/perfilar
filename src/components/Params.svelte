<script>
  import { editor } from '../lib/stores.js';
  import Tooltip from './Tooltip.svelte';
  $: P = $editor.params;
  const num = (k) => (e) => { P[k] = parseFloat(e.target.value) || 0; $editor = $editor; };
</script>

<div class="params">
  <div class="pgroup">
    <div class="lab">dobra e desenvolvimento</div>
    <div class="field"><div class="lh">Modo do desconto <Tooltip text="Fator K: calcula o desconto pela física da dobra (raio + fator). Manual: você informa quanto a dobradeira consome por dobra de 90°." /></div>
      <div class="seg">
        <button class:on={$editor.bd === 'auto'} on:click={() => { $editor.bd = 'auto'; $editor = $editor; }}>Fator K</button>
        <button class:on={$editor.bd === 'man'} on:click={() => { $editor.bd = 'man'; $editor = $editor; }}>Desconto manual</button>
      </div>
    </div>
    {#if $editor.bd === 'auto'}
      <div class="row2">
        <div class="field"><label>Raio <span class="u">mm</span><Tooltip text="Raio interno da dobra." /></label><input type="number" step="0.5" value={P.R} on:input={num('R')} /></div>
        <div class="field"><label>Fator K <Tooltip text="Posição da linha neutra (0–0,5). Aço costuma ficar entre 0,40 e 0,45." /></label><input type="number" step="0.01" value={P.K} on:input={num('K')} /></div>
      </div>
    {:else}
      <div class="field"><label>Desconto / dobra 90° <span class="u">mm</span><Tooltip text="Quanto some por dobra de 90°. Calibre pelo que sai da sua dobradeira." /></label><input type="number" step="0.1" value={P.manBD} on:input={num('manBD')} /></div>
    {/if}
  </div>

  <div class="pgroup">
    <div class="lab">peça e custo</div>
    <div class="row2">
      <div class="field"><label>Comprimento <span class="u">mm</span><Tooltip text="Comprimento de cada peça." /></label><input type="number" step="50" value={P.C} on:input={num('C')} /></div>
      <div class="field"><label>Quantidade <span class="u">pç</span></label><input type="number" step="1" value={P.Q} on:input={num('Q')} /></div>
    </div>
    <div class="field"><label>Margem <span class="u">%</span><Tooltip text="Margem aplicada sobre o custo no orçamento." /></label><input type="number" step="1" value={P.mg} on:input={num('mg')} /></div>
  </div>
</div>

<style>
  .params { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; background: var(--panel); margin-top: 14px; }
  .pgroup { padding: 12px 14px; border-right: 1px solid var(--line); }
  .pgroup:last-child { border-right: 0; }
  .lab { font-family: var(--mono); font-size: 10px; letter-spacing: .6px; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 10px; }
  .field { margin-bottom: 9px; } .field:last-child { margin-bottom: 0; }
  .field label, .lh { display: block; font-size: 11.5px; color: var(--ink-soft); margin-bottom: 4px; }
  .field :global(input), .field :global(select) { width: 100%; height: 32px; border: 1px solid var(--line); border-radius: 6px; padding: 0 8px; background: var(--panel); font-size: 13px; }
  .field :global(input:focus) { outline: none; border-color: var(--amber); }
  .u { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); background: var(--panel-2); padding: 1px 5px; border-radius: 4px; margin-left: 2px; }
  .row2 { display: flex; gap: 8px; } .row2 .field { flex: 1; }
  .seg { display: flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; font-size: 11.5px; height: 32px; }
  .seg button { flex: 1; color: var(--ink-soft); background: none; border: 0; cursor: pointer; }
  .seg button.on { background: var(--ink); color: #fff; font-weight: 500; }
</style>
