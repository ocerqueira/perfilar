<script>
  import { regions, regionId, catalogMaterials, catalogRevests } from '../lib/stores.js';
  import { saveRegions, defaultRegions, MAT_REVESTS } from '../lib/pricing.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let activeTab   = 'propria'; // 'propria' | 'concorrente'
  let selId       = $regionId;

  $: selIdx    = $regions.findIndex((r) => r.id === selId);
  $: selRegion = $regions[selIdx] ?? $regions[0];

  // Linhas da tabela: todos os combos material × revestimento (dinâmico)
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
    const e   = $regions[ri][tab][mat][rev] ?? { custo: 0, venda: 0 };
    $regions[ri][tab][mat][rev] = e;
    if (field === 'custo') {
      e.custo = num;
      // venda fica → margem recalcula automaticamente
    } else if (field === 'venda') {
      e.venda = num;
    } else {
      // margem → recalcula venda (custo fica)
      e.venda = +(e.custo * (1 + num / 100)).toFixed(2);
    }
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
    $regions = defaultRegions();
    $regionId = $regions[0].id;
    selId = $regions[0].id;
  }

  function save() { saveRegions($regions); dispatch('close'); }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />
<div class="back" role="presentation" on:click={() => dispatch('close')}>
  <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>

    <!-- Cabeçalho -->
    <div class="mh">
      <div>
        <b>Tabela de preço</b>
        <div class="sub">R$/kg · por região, material e revestimento</div>
      </div>
      <div class="rctrl">
        <select class="reg-sel" bind:value={selId}>
          {#each $regions as r}<option value={r.id}>{r.nome}</option>{/each}
        </select>
        <button class="btn line sm" on:click={addRegion}>+ Região</button>
        <button class="btn danger sm" disabled={$regions.length <= 1} on:click={removeRegion}>Remover</button>
      </div>
      <button class="btn ghost" on:click={() => dispatch('close')}>Fechar</button>
    </div>

    <!-- Nome da região -->
    <div class="rname-row">
      <span class="rname-lbl">Nome:</span>
      <input class="rname" value={selRegion?.nome ?? ''} on:input={renameRegion} />
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
              <td>
                <input class="num" type="number" step="0.01" min="0"
                  value={e.custo}
                  on:change={(ev) => setField(mat, rev, 'custo', ev.target.value)} />
              </td>
              <td>
                <input class="num" class:warn={neg} type="number" step="0.01" min="0"
                  value={e.venda}
                  on:change={(ev) => setField(mat, rev, 'venda', ev.target.value)} />
              </td>
              <td>
                <input class="num mg" type="number" step="0.1"
                  value={mg.toFixed(1)}
                  on:change={(ev) => setField(mat, rev, 'margem', ev.target.value)} />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Rodapé -->
    <div class="mf">
      <button class="btn line" on:click={reset}>Restaurar padrão</button>
      <div style="flex:1"></div>
      <button class="btn amber" on:click={save}>Salvar tabela</button>
    </div>

  </div>
</div>

<style>
  .back  { position: fixed; inset: 0; background: rgba(16,24,33,.55); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 20px; }
  .modal { background: var(--panel); border-radius: 12px; width: 100%; max-width: 780px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; }

  .mh  { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .mh b { font-size: 15px; }
  .sub { font-size: 11.5px; color: var(--ink-soft); }
  .rctrl { display: flex; gap: 6px; align-items: center; }
  .reg-sel { height: 32px; border: 1px solid var(--line); border-radius: 6px; padding: 0 8px; font-size: 13px; background: var(--panel); }

  .rname-row { display: flex; align-items: center; gap: 10px; padding: 8px 18px; border-bottom: 1px solid var(--line); }
  .rname-lbl { font-size: 12px; color: var(--ink-soft); white-space: nowrap; }
  .rname { height: 30px; border: 1px solid var(--line); border-radius: 6px; padding: 0 8px; font-size: 13px; width: 240px; }
  .rname:focus { outline: none; border-color: var(--amber); }

  .tabs { display: flex; align-items: center; gap: 2px; padding: 6px 18px 0; border-bottom: 1px solid var(--line); }
  .tab  { height: 34px; padding: 0 16px; border-radius: 7px 7px 0 0; font-size: 13px; font-weight: 500; background: none; border: 1px solid transparent; border-bottom: none; cursor: pointer; color: var(--ink-soft); }
  .tab.on  { background: var(--panel); border-color: var(--line); color: var(--ink); position: relative; top: 1px; }
  .tab-note { font-size: 11.5px; color: var(--ink-faint); margin-left: 10px; }

  .scroll { overflow: auto; padding: 14px 18px; flex: 1; }
  table   { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--ink-faint); text-align: left; padding: 6px; font-weight: 500; white-space: nowrap; }
  th.r, td:nth-child(n+3) { text-align: right; }
  td   { border-top: 1px solid var(--line); padding: 3px 4px; }
  .mat { font-weight: 500; white-space: nowrap; }
  .rev { color: var(--ink-soft); font-size: 12px; white-space: nowrap; }
  tr.neg { background: #fff4f4; }

  .num { width: 78px; height: 28px; border: 1px solid var(--line); border-radius: 5px; padding: 0 6px; text-align: right; font-family: var(--mono); font-size: 12.5px; background: var(--panel); }
  .num:focus { outline: none; border-color: var(--amber); }
  .num.warn { border-color: #e05252; color: #c0392b; }
  .num.mg { width: 62px; color: var(--ink-soft); }
  .u { font-family: var(--mono); font-size: 9px; color: var(--ink-faint); }

  .mf { display: flex; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--line); }
  .btn { height: 34px; padding: 0 14px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; }
  .btn.sm { height: 30px; font-size: 12px; padding: 0 10px; }
  .amber  { background: var(--amber); color: #fff; border-color: var(--amber); } .amber:hover { background: #d67d12; }
  .line   { background: var(--panel); border-color: var(--line); color: var(--ink); } .line:hover { background: var(--panel-2); }
  .ghost  { background: var(--panel-2); border-color: var(--line); color: var(--ink); } .ghost:hover { background: var(--panel-2); }
  .danger { background: var(--panel); border-color: #e05252; color: #c0392b; } .danger:hover:not(:disabled) { background: #fff4f4; }
  .danger:disabled { opacity: .4; cursor: not-allowed; }
</style>
