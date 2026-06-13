<script>
  import { editor, regions, regionId } from '../../lib/stores.js';
  import { priceFor } from '../../lib/pricing.js';
  import { nf } from '../../lib/engine.js';
  import Tooltip from '../../components/Tooltip.svelte';

  export let C;

  $: P = $editor.params;

  $: tablePrice = priceFor($regions, $regionId, P.matName, P.revest) ?? { custo: 0, venda: 0 };
  $: custoKg = tablePrice.custo;
  $: vendaKg = tablePrice.venda;

  // ── Modo R$/kg ─────────────────────────────────────────────────────────────
  $: computedEffective = P.precoKg > 0
    ? P.precoKg
    : (custoKg > 0 ? +(custoKg * (1 + P.mg / 100)).toFixed(2) : vendaKg);
  $: abaixoCusto = custoKg > 0 && computedEffective < custoKg;
  $: isManual    = P.precoKg > 0;

  // ── Modo R$/peça ───────────────────────────────────────────────────────────
  $: weightPc      = P.Q > 0 && C.tot > 0 ? C.tot / P.Q : 0;
  $: custoPc       = custoKg > 0 && weightPc > 0 ? +(custoKg * weightPc).toFixed(2) : 0;
  $: margemPc      = custoPc > 0 && P.precoPc > 0
    ? +((P.precoPc - custoPc) / custoPc * 100).toFixed(1) : 0;
  $: abaixoCustoPc = custoPc > 0 && P.precoPc > 0 && P.precoPc < custoPc;

  const num = (k) => (e) => { P[k] = parseFloat(e.target.value) || 0; $editor = $editor; };

  function setMode(mode) {
    if ((P.priceMode ?? 'kg') === mode) return;
    if (mode === 'pc' && !P.precoPc && weightPc > 0)
      P.precoPc = +(computedEffective * weightPc).toFixed(2);
    P.priceMode = mode;
    $editor = $editor;
  }

  function setPrecoKg(raw) {
    const v = parseFloat(raw);
    if (isNaN(v) || v < 0) { P.precoKg = 0; $editor = $editor; return; }
    P.precoKg = v;
    if (custoKg > 0 && v > 0) P.mg = +((v - custoKg) / custoKg * 100).toFixed(1);
    $editor = $editor;
  }

  function setMg(raw) {
    const v = parseFloat(raw);
    if (isNaN(v)) return;
    P.mg = v; P.precoKg = 0; $editor = $editor;
  }

  function setPrecoPc(raw) {
    const v = parseFloat(raw);
    if (isNaN(v) || v < 0) { P.precoPc = 0; $editor = $editor; return; }
    P.precoPc = v;
    $editor = $editor;
  }
</script>

<div class="params">
  <div class="pgroup">
    <div class="lab">dobra e desenvolvimento</div>
    <div class="field">
      <div class="lh">Modo do desconto <Tooltip text="Fator K: calcula o desconto pela física da dobra (raio + fator). Manual: você informa quanto a dobradeira consome por dobra de 90°." /></div>
      <div class="seg">
        <button class:on={$editor.bd === 'auto'} on:click={() => { $editor.bd = 'auto'; $editor = $editor; }}>Fator K</button>
        <button class:on={$editor.bd === 'man'}  on:click={() => { $editor.bd = 'man';  $editor = $editor; }}>Desconto manual</button>
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

    <div class="field">
      <div class="lh">Precificação <Tooltip text="R$/kg: preço × peso total. R$/peça: valor fixo por unidade, independe do peso." /></div>
      <div class="seg">
        <button class:on={P.priceMode !== 'pc'} on:click={() => setMode('kg')}>R$/kg</button>
        <button class:on={P.priceMode === 'pc'} on:click={() => setMode('pc')}>R$/peça</button>
      </div>
    </div>

    {#if P.priceMode !== 'pc'}
      <div class="row2">
        <div class="field">
          <label>
            Preço venda <span class="u">R$/kg</span>
            <Tooltip text="Calculado pela margem; sobrescreva para fixar um valor específico." />
            {#if isManual}<span class="badge-manual">manual</span>{/if}
          </label>
          <input
            class="preco-inp"
            class:warn={abaixoCusto}
            class:custom={isManual && !abaixoCusto}
            type="number" step="0.01" min="0"
            value={computedEffective > 0 ? computedEffective.toFixed(2) : ''}
            placeholder="—"
            on:change={(e) => setPrecoKg(e.target.value)}
          />
          <div class="price-ref" class:warn={abaixoCusto}>
            {#if abaixoCusto}
              ⚠ abaixo do custo (mín. R$ {nf(custoKg, 2)}/kg)
            {:else if custoKg > 0}
              custo: R$ {nf(custoKg, 2)}/kg{vendaKg > 0 ? ` · tabela: R$ ${nf(vendaKg, 2)}/kg` : ''}
            {:else if vendaKg > 0}
              tabela: R$ {nf(vendaKg, 2)}/kg
            {:else}
              sem preço cadastrado
            {/if}
          </div>
        </div>
        <div class="field">
          <label>Margem <span class="u">%</span><Tooltip text="Margem sobre o custo. Alterar volta ao modo automático de preço." /></label>
          <input type="number" step="0.5" value={P.mg} on:input={(e) => setMg(e.target.value)} />
        </div>
      </div>
    {:else}
      <div class="row2">
        <div class="field">
          <label>
            Preço venda <span class="u">R$/peça</span>
            <Tooltip text="Preço fixo por unidade. Ao trocar o modo, preenchido automaticamente com o preço atual." />
          </label>
          <input
            class="preco-inp"
            class:warn={abaixoCustoPc}
            type="number" step="0.50" min="0"
            value={P.precoPc > 0 ? P.precoPc.toFixed(2) : ''}
            placeholder="—"
            on:change={(e) => setPrecoPc(e.target.value)}
          />
          <div class="price-ref" class:warn={abaixoCustoPc}>
            {#if abaixoCustoPc}
              ⚠ abaixo do custo (mín. R$ {nf(custoPc, 2)}/peça)
            {:else if custoPc > 0}
              custo: R$ {nf(custoPc, 2)}/peça
            {:else}
              sem custo cadastrado
            {/if}
          </div>
        </div>
        <div class="field">
          <label>Margem ref. <span class="u">%</span><Tooltip text="Margem implícita pelo custo/peça. Somente referência — não editável neste modo." /></label>
          <input class="readonly" type="number" readonly value={margemPc.toFixed(1)} tabindex="-1" />
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .params { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; background: var(--panel); margin-top: 14px; }
  .pgroup { padding: 12px 14px; border-bottom: 1px solid var(--line); }
  .pgroup:last-child { border-bottom: 0; }
  .lab { font-family: var(--mono); font-size: 10px; letter-spacing: .6px; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 10px; }
  .field { margin-bottom: 9px; } .field:last-child { margin-bottom: 0; }
  .field label, .lh { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--ink-soft); margin-bottom: 4px; flex-wrap: wrap; }
  .field :global(input), .field :global(select) { width: 100%; height: 32px; border: 1px solid var(--line); border-radius: 6px; padding: 0 8px; background: var(--panel); font-size: 13px; box-sizing: border-box; }
  .field :global(input:focus) { outline: none; border-color: var(--amber); }
  .u { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); background: var(--panel-2); padding: 1px 5px; border-radius: 4px; }
  .row2 { display: flex; gap: 8px; } .row2 .field { flex: 1; min-width: 0; }
  .seg { display: flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; font-size: 11.5px; height: 32px; }
  .seg button { flex: 1; color: var(--ink-soft); background: none; border: 0; cursor: pointer; }
  .seg button.on { background: var(--ink); color: #fff; font-weight: 500; }

  /* Preço/kg */
  .preco-inp { font-family: var(--mono); }
  .preco-inp.warn   { border-color: #e05252 !important; color: #c0392b; }
  .preco-inp.custom { border-color: var(--amber); }

  .price-ref { font-size: 10.5px; color: var(--ink-faint); margin-top: 3px; }
  .price-ref.warn { color: #c0392b; font-weight: 500; }

  .field :global(input.readonly) { color: var(--ink-faint); background: var(--panel-2); cursor: default; pointer-events: none; }

  .badge-manual {
    font-family: var(--mono); font-size: 9px; text-transform: uppercase; letter-spacing: .4px;
    background: var(--amber-soft); color: var(--amber-deep); border: 1px solid #f5d9b0;
    padding: 1px 5px; border-radius: 4px;
  }
</style>
