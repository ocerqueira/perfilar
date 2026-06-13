<script>
  import { regions, regionId, catalogMaterials, catalogRevests } from '../../lib/stores.js';
  import { saveRegions, defaultRegions, MAT_REVESTS } from '../../lib/pricing.js';

  let activeTab = 'propria'; // 'propria' | 'concorrente'
  let selId     = $regionId;

  $: selIdx    = $regions.findIndex((r) => r.id === selId);
  $: selRegion = $regions[selIdx] ?? $regions[0];

  $: tableRows = $catalogMaterials.flatMap((m) =>
    (MAT_REVESTS[m.name] || $catalogRevests).map((rev) => ({ mat: m.name, rev }))
  );

  function entry(mat, rev) {
    const tab = activeTab === 'propria' ? 'precos' : 'concorrente';
    return selRegion?.[tab]?.[mat]?.[rev] ?? { custo: 0, venda: 0 };
  }
  function margem(e) {
    return e.custo > 0 ? ((e.venda - e.custo) / e.custo) * 100 : 0;
  }

  function setField(mat, rev, field, raw) {
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    const tab = activeTab === 'propria' ? 'precos' : 'concorrente';
    const ri  = selIdx >= 0 ? selIdx : 0;
    if (!$regions[ri][tab][mat]) $regions[ri][tab][mat] = {};
    const e = $regions[ri][tab][mat][rev] ?? { custo: 0, venda: 0 };
    $regions[ri][tab][mat][rev] = e;
    if (field === 'custo')        e.custo = num;
    else if (field === 'venda')   e.venda = num;
    else /* margem */             e.venda = +(e.custo * (1 + num / 100)).toFixed(2);
    $regions = $regions;
  }

  function addRegion() {
    const src = $regions[selIdx] ?? $regions[0];
    const id  = 'reg-' + Date.now();
    $regions = [...$regions, {
      id, nome: 'Nova região',
      precos:      JSON.parse(JSON.stringify(src.precos ?? {})),
      concorrente: JSON.parse(JSON.stringify(src.concorrente ?? {})),
    }];
    selId = id;
  }

  function removeRegion() {
    if ($regions.length <= 1) return;
    const id = selId;
    $regions = $regions.filter((r) => r.id !== id);
    if ($regionId === id) $regionId = $regions[0].id;
    selId = $regions[0].id;
  }

  function renameRegion(e) {
    const ri = selIdx >= 0 ? selIdx : 0;
    $regions[ri].nome = e.target.value;
    $regions = $regions;
  }

  function reset() {
    $regions  = defaultRegions();
    $regionId = $regions[0].id;
    selId     = $regions[0].id;
  }

  function save() { saveRegions($regions); }
</script>

<!-- Controles de região -->
<div class="ctrl-row">
  <select class="reg-sel" bind:value={selId}>
    {#each $regions as r}<option value={r.id}>{r.nome}</option>{/each}
  </select>
  <input class="rname" value={selRegion?.nome ?? ''} on:input={renameRegion} placeholder="Nome da região" />
  <button class="btn line sm" on:click={addRegion}>+ Região</button>
  <button class="btn danger sm" disabled={$regions.length <= 1} on:click={removeRegion}>Remover</button>
</div>

<!-- Abas Própria / Concorrente -->
<div class="tabs">
  <button class="tab" class:on={activeTab === 'propria'}     on:click={() => (activeTab = 'propria')}>Própria</button>
  <button class="tab" class:on={activeTab === 'concorrente'} on:click={() => (activeTab = 'concorrente')}>Concorrente</button>
  {#if activeTab === 'concorrente'}
    <span class="tab-note">Valores do concorrente — usados só como referência no orçamento.</span>
  {/if}
</div>

<!-- Tabela -->
<div class="scroll">
  <table>
    <thead>
      <tr>
        <th>Material</th>
        <th>Revestimento</th>
        <th class="r">Custo <span class="u">R$/kg</span></th>
        <th class="r">Venda <span class="u">R$/kg</span></th>
        <th class="r">Margem <span class="u">%</span></th>
      </tr>
    </thead>
    <tbody>
      {#each tableRows as { mat, rev }}
        {@const e   = entry(mat, rev)}
        {@const mg  = margem(e)}
        {@const neg = e.custo > 0 && e.venda < e.custo}
        <tr class:neg>
          <td class="mat">{mat}</td>
          <td class="rev">{rev}</td>
          <td><input class="num" type="number" step="0.01" min="0" value={e.custo}
              on:change={(ev) => setField(mat, rev, 'custo', ev.target.value)} /></td>
          <td><input class="num" class:warn={neg} type="number" step="0.01" min="0" value={e.venda}
              on:change={(ev) => setField(mat, rev, 'venda', ev.target.value)} /></td>
          <td><input class="num mg" type="number" step="0.1" value={mg.toFixed(1)}
              on:change={(ev) => setField(mat, rev, 'margem', ev.target.value)} /></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<!-- Rodapé -->
<div class="foot">
  <button class="btn line" on:click={reset}>Restaurar padrão</button>
  <div style="flex:1"></div>
  <button class="btn amber" on:click={save}>Salvar tabela</button>
</div>

<style>
  .ctrl-row { display: flex; align-items: center; gap: 8px; padding: 12px 0 10px; flex-wrap: wrap; }
  .reg-sel  { height: 32px; border: 1px solid var(--line); border-radius: 6px; padding: 0 8px; font-size: 13px; background: var(--panel); }
  .rname    { height: 32px; border: 1px solid var(--line); border-radius: 6px; padding: 0 8px; font-size: 13px; width: 200px; }
  .rname:focus { outline: none; border-color: var(--amber); }

  .tabs { display: flex; align-items: center; gap: 2px; border-bottom: 1px solid var(--line); margin-bottom: 0; }
  .tab  { height: 34px; padding: 0 16px; border-radius: 7px 7px 0 0; font-size: 13px; font-weight: 500; background: none; border: 1px solid transparent; border-bottom: none; cursor: pointer; color: var(--ink-soft); }
  .tab.on  { background: var(--panel); border-color: var(--line); color: var(--ink); position: relative; top: 1px; }
  .tab-note { font-size: 11.5px; color: var(--ink-faint); margin-left: 10px; }

  .scroll { overflow: auto; flex: 1; }
  table   { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--ink-faint); text-align: left; padding: 8px 6px 6px; font-weight: 500; white-space: nowrap; }
  th.r, td:nth-child(n+3) { text-align: right; }
  td   { border-top: 1px solid var(--line); padding: 3px 4px; }
  .mat { font-weight: 500; white-space: nowrap; }
  .rev { color: var(--ink-soft); font-size: 12px; white-space: nowrap; }
  tr.neg { background: #fff4f4; }
  .u { font-family: var(--mono); font-size: 9px; color: var(--ink-faint); }

  .num { width: 78px; height: 28px; border: 1px solid var(--line); border-radius: 5px; padding: 0 6px; text-align: right; font-family: var(--mono); font-size: 12.5px; background: var(--panel); }
  .num:focus { outline: none; border-color: var(--amber); }
  .num.warn { border-color: #e05252; color: #c0392b; }
  .num.mg   { width: 62px; color: var(--ink-soft); }

  .foot { display: flex; gap: 10px; padding: 12px 0 0; border-top: 1px solid var(--line); flex-shrink: 0; }
  .btn { height: 32px; padding: 0 14px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; }
  .btn.sm { height: 28px; font-size: 12px; padding: 0 10px; }
  .amber  { background: var(--amber); color: #fff; border-color: var(--amber); } .amber:hover { background: #d67d12; }
  .line   { background: var(--panel); border-color: var(--line); color: var(--ink); } .line:hover { background: var(--panel-2); }
  .danger { background: var(--panel); border-color: #e05252; color: #c0392b; } .danger:hover:not(:disabled) { background: #fff4f4; }
  .danger:disabled { opacity: .4; cursor: not-allowed; }
</style>
