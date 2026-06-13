<script>
  import { order, regions, regionId, commissionRule, saveCommRule } from '../../lib/stores.js';
  import { priceFor } from '../../lib/pricing.js';
  import { commissionForItem, ruleLabel, DEFAULT_RULE } from '../../lib/commission.js';
  import { brl } from '../../lib/engine.js';

  let rule    = JSON.parse(JSON.stringify($commissionRule));
  let showAdv = false;

  const PRESETS = [
    { id: 'pct-venda',  label: '% sobre venda',  base: 'venda',  tipo: 'percent', def: 3,    unit: '%'    },
    { id: 'pct-margem', label: '% sobre margem', base: 'margem', tipo: 'percent', def: 10,   unit: '%'    },
    { id: 'fixo-kg',    label: 'R$ fixo / kg',   base: 'peso',   tipo: 'fixo',    def: 0.15, unit: 'R$/kg'},
  ];

  $: activePreset = PRESETS.find(
    (p) => p.base === rule.base && p.tipo === rule.modo.tipo && !rule.faixas?.length
  ) ?? null;

  function selectPreset(p)        { rule = { base: p.base, modo: { tipo: p.tipo, valor: p.def } }; }
  function setPresetValue(p, raw) { const v = parseFloat(raw); if (!isNaN(v)) rule = { ...rule, base: p.base, modo: { tipo: p.tipo, valor: v } }; }

  function addFaixa()        { rule.faixas = [...(rule.faixas ?? []), { ate: 10000, valor: 2 }]; rule = rule; }
  function removeFaixa(i)    { rule.faixas = rule.faixas.filter((_, j) => j !== i); rule = rule; }
  function setFaixa(i, f, r) { const v = parseFloat(r); if (!isNaN(v)) { rule.faixas[i][f] = v; rule = rule; } }

  $: previewRows = $order.items.map((it) => {
    const { custo: custoKg } = priceFor($regions, $regionId, it.params.matName, it.params.revest);
    const custoTotal = it.C.tot * custoKg;
    const precoTotal = it.precoTotal ?? custoTotal * (1 + it.params.mg / 100);
    const comm = commissionForItem({ ...it, custoTotal, precoTotal }, rule);
    return { label: it.label ?? it.name, comm };
  });
  $: previewTotal = previewRows.reduce((a, r) => a + r.comm, 0);

  function save() { $commissionRule = rule; saveCommRule(rule); }
</script>

<div class="wrap">
  <!-- Presets -->
  <div class="sec-label">Modelo rápido</div>
  <div class="presets">
    {#each PRESETS as p}
      {@const active = activePreset?.id === p.id}
      <button class="preset" class:on={active} on:click={() => selectPreset(p)}>
        <div class="pt">{p.label}</div>
        {#if active}
          <div class="pv">
            <input class="pval" type="number" step={p.tipo === 'fixo' ? '0.01' : '0.5'}
              value={rule.modo.valor}
              on:change={(e) => setPresetValue(p, e.target.value)} />
            <span class="pu">{p.unit}</span>
          </div>
        {:else}
          <div class="pdef">{p.def} {p.unit}</div>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Avançado -->
  <button class="adv-btn" on:click={() => (showAdv = !showAdv)}>
    {showAdv ? '▾' : '▸'} Avançado
  </button>

  {#if showAdv}
    <div class="adv">
      <div class="adv-row">
        <label>Base</label>
        <select bind:value={rule.base}>
          <option value="venda">Faturamento (R$)</option>
          <option value="margem">Margem bruta (R$)</option>
          <option value="peso">Peso (kg)</option>
          <option value="area">Área (m²)</option>
          <option value="quantidade">Quantidade (pç)</option>
        </select>
      </div>
      <div class="adv-row">
        <label>Modo</label>
        <select bind:value={rule.modo.tipo}>
          <option value="percent">Percentual (%)</option>
          <option value="fixo">Fixo por unidade (R$/un)</option>
          <option value="fator">Fator multiplicador</option>
        </select>
        <input class="adv-val" type="number" step="0.1" bind:value={rule.modo.valor} />
      </div>
      <div class="adv-row top">
        <label>Faixas escalonadas</label>
        <button class="btn line sm" on:click={addFaixa}>+ Faixa</button>
      </div>
      {#if rule.faixas?.length}
        <table class="faixas">
          <thead><tr><th>Até</th><th class="r">Taxa %</th><th></th></tr></thead>
          <tbody>
            {#each rule.faixas as f, i}
              <tr>
                <td><input class="fnum" type="number" step="100" value={f.ate}   on:change={(e) => setFaixa(i, 'ate',   e.target.value)} /></td>
                <td><input class="fnum" type="number" step="0.1" value={f.valor} on:change={(e) => setFaixa(i, 'valor', e.target.value)} /></td>
                <td><button class="rm" on:click={() => removeFaixa(i)}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="faixas-note">Quando faixas estão ativas, sobrescrevem base/modo acima.</div>
      {:else}
        <div class="empty-faixas">Sem faixas — use a regra base/modo acima.</div>
      {/if}
    </div>
  {/if}

  <!-- Preview -->
  {#if $order.items.length}
    <div class="preview">
      <div class="sec-label">Resultado no pedido atual</div>
      {#each previewRows as r, i}
        <div class="prev-row"><span class="prev-lbl">{i + 1}. {r.label}</span><span class="prev-val">{brl(r.comm)}</span></div>
      {/each}
      <div class="prev-tot"><span>Total comissão</span><b>{brl(previewTotal)}</b></div>
    </div>
  {:else}
    <div class="no-items">Adicione itens ao pedido para ver a prévia de comissão.</div>
  {/if}

  <!-- Rodapé -->
  <div class="foot">
    <div class="cur-rule">Regra atual: <b>{ruleLabel(rule)}</b></div>
    <div style="flex:1"></div>
    <button class="btn line" on:click={() => { rule = { ...DEFAULT_RULE }; }}>Padrão</button>
    <button class="btn amber" on:click={save}>Salvar regra</button>
  </div>
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 16px; max-width: 560px; }

  .sec-label { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .8px; color: var(--ink-faint); }

  .presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .preset  { border: 1.5px solid var(--line); border-radius: 8px; padding: 11px 12px; text-align: left; background: var(--panel); cursor: pointer; }
  .preset:hover { border-color: var(--amber); }
  .preset.on    { border-color: var(--amber); background: var(--amber-soft); }
  .pt   { font-size: 12.5px; font-weight: 500; margin-bottom: 6px; }
  .pdef { font-family: var(--mono); font-size: 13px; color: var(--ink-soft); }
  .pv   { display: flex; align-items: center; gap: 5px; }
  .pval { width: 60px; height: 28px; border: 1px solid var(--amber); border-radius: 5px; padding: 0 6px; text-align: right; font-family: var(--mono); font-size: 13px; background: var(--panel); }
  .pval:focus { outline: none; }
  .pu   { font-size: 11px; color: var(--ink-soft); white-space: nowrap; }

  .adv-btn { background: none; border: 0; font-size: 13px; color: var(--ink-soft); cursor: pointer; padding: 0; text-align: left; }
  .adv-btn:hover { color: var(--ink); }
  .adv  { background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .adv-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .adv-row.top { align-items: flex-start; }
  .adv-row label { font-size: 12px; color: var(--ink-soft); width: 60px; flex-shrink: 0; }
  .adv-row select { height: 30px; border: 1px solid var(--line); border-radius: 6px; padding: 0 6px; font-size: 12.5px; background: var(--panel); flex: 1; min-width: 0; }
  .adv-val { width: 72px; height: 30px; border: 1px solid var(--line); border-radius: 6px; padding: 0 6px; text-align: right; font-family: var(--mono); font-size: 12.5px; }
  .adv-val:focus, .adv-row select:focus { outline: none; border-color: var(--amber); }

  .faixas { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .faixas th { color: var(--ink-faint); font-size: 10px; text-align: left; padding: 3px 4px; font-weight: 500; }
  .faixas th.r { text-align: right; }
  .faixas td { padding: 3px 4px; border-top: .5px solid var(--line); }
  .fnum { width: 90px; height: 27px; border: 1px solid var(--line); border-radius: 5px; padding: 0 6px; text-align: right; font-family: var(--mono); font-size: 12px; }
  .fnum:focus { outline: none; border-color: var(--amber); }
  .rm { background: none; border: 0; color: var(--ink-faint); font-size: 15px; cursor: pointer; padding: 2px 4px; }
  .rm:hover { color: #c0392b; }
  .faixas-note { font-size: 11px; color: var(--ink-faint); }
  .empty-faixas { font-size: 12px; color: var(--ink-faint); font-style: italic; }

  .preview { background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
  .prev-row { display: flex; justify-content: space-between; font-size: 12.5px; }
  .prev-lbl { color: var(--ink); }
  .prev-val { font-family: var(--mono); }
  .prev-tot { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; padding-top: 6px; margin-top: 4px; border-top: 1px solid var(--line); }
  .prev-tot b { font-family: var(--mono); }
  .no-items { font-size: 12.5px; color: var(--ink-faint); font-style: italic; }

  .foot { display: flex; align-items: center; gap: 10px; padding-top: 4px; border-top: 1px solid var(--line); flex-wrap: wrap; }
  .cur-rule { font-size: 12.5px; color: var(--ink-soft); }
  .cur-rule b { color: var(--ink); }
  .btn { height: 32px; padding: 0 14px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; }
  .btn.sm { height: 28px; font-size: 12px; padding: 0 10px; }
  .amber { background: var(--amber); color: #fff; border-color: var(--amber); } .amber:hover { background: #d67d12; }
  .line  { background: var(--panel); border-color: var(--line); color: var(--ink); } .line:hover { background: var(--panel-2); }
</style>
