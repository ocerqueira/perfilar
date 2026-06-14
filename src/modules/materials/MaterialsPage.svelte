<script>
  import { catalogMaterials, catalogRevests, catalogGauges } from '../../lib/stores.js';
  import {
    saveMaterials, saveRevests, saveGauges,
    loadMaterials, loadRevests, loadGauges,
  } from '../../lib/catalog.js';

  let tab = 'mat'; // 'mat' | 'gau'

  // ── Materiais ─────────────────────────────────────────────────────────────
  let mats  = $catalogMaterials.map((m) => ({ ...m }));
  let revs  = [...$catalogRevests];
  let newRevInput = '';

  function addMat()     { mats = [...mats, { name: 'Novo material', dens: 7850 }]; }
  function removeMat(i) { mats = mats.filter((_, j) => j !== i); }
  function addRev()     { const v = newRevInput.trim(); if (v && !revs.includes(v)) revs = [...revs, v]; newRevInput = ''; }
  function removeRev(i) { revs = revs.filter((_, j) => j !== i); }
  function saveMat()    { $catalogMaterials = mats; $catalogRevests = revs; saveMaterials(mats); saveRevests(revs); }
  function resetMat()   { mats = loadMaterials(); revs = loadRevests(); $catalogMaterials = mats; $catalogRevests = revs; }

  // ── Bitolas ───────────────────────────────────────────────────────────────
  let gauges    = [...$catalogGauges].sort((a, b) => a - b);
  let newGauVal = '';

  function addGauge() {
    const v = parseFloat(newGauVal);
    if (!isNaN(v) && v > 0 && !gauges.includes(v)) gauges = [...gauges, v].sort((a, b) => a - b);
    newGauVal = '';
  }
  function removeGauge(i) { gauges = gauges.filter((_, j) => j !== i); }
  function saveGau()  { $catalogGauges = gauges; saveGauges(gauges); }
  function resetGau() { gauges = loadGauges().sort((a, b) => a - b); $catalogGauges = gauges; }
</script>

<div class="page">
  <div class="page-hd">
    <div class="page-title">Matérias-primas</div>
    <div class="tabs">
      <button class="tab" class:on={tab === 'mat'} on:click={() => (tab = 'mat')}>Materiais</button>
      <button class="tab" class:on={tab === 'gau'} on:click={() => (tab = 'gau')}>Bitolas</button>
    </div>
  </div>

  <div class="body">

    <!-- ── Materiais ─────────────────────────────────────────────────────── -->
    {#if tab === 'mat'}
      <div class="card">
        <div class="sec-label">Materiais (liga do aço)</div>
        <table class="tbl">
          <thead>
            <tr>
              <th>Nome</th>
              <th class="r">Densidade <span class="u">kg/m³</span></th>
              <th>Sigla <span class="u">desc.</span></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each mats as m, i}
              <tr>
                <td><input class="inp" bind:value={m.name} /></td>
                <td><input class="inp num" type="number" step="10" bind:value={m.dens} /></td>
                <td><input class="inp abbr" bind:value={m.abbrev} placeholder="GAL…" maxlength="5" /></td>
                <td><button class="rm" on:click={() => removeMat(i)} title="Remover">×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
        <button class="btn line sm" on:click={addMat}>+ Material</button>

        <div class="sec-label">Revestimentos</div>
        <div class="tags">
          {#each revs as r, i}
            <span class="tag">{r}<button class="tag-rm" on:click={() => removeRev(i)}>×</button></span>
          {/each}
          <div class="tag-add">
            <input class="inp tag-in" placeholder="Novo revestimento…" bind:value={newRevInput}
              on:keydown={(e) => e.key === 'Enter' && addRev()} />
            <button class="btn line sm" on:click={addRev}>+</button>
          </div>
        </div>

        <div class="footer">
          <button class="btn line" on:click={resetMat}>Restaurar padrão</button>
          <div style="flex:1"></div>
          <button class="btn amber" on:click={saveMat}>Salvar</button>
        </div>
      </div>

    <!-- ── Bitolas ────────────────────────────────────────────────────────── -->
    {:else if tab === 'gau'}
      <div class="card">
        <div class="sec-label">Bitolas padrão <span class="u">mm</span></div>
        <div class="tags">
          {#each gauges as g, i}
            <span class="tag">{g.toFixed(2)}<button class="tag-rm" on:click={() => removeGauge(i)}>×</button></span>
          {/each}
          <div class="tag-add">
            <input class="inp tag-in" type="number" step="0.05" min="0" placeholder="mm…"
              bind:value={newGauVal}
              on:keydown={(e) => e.key === 'Enter' && addGauge()} />
            <button class="btn line sm" on:click={addGauge}>+</button>
          </div>
        </div>
        <p class="hint">Bitolas fora desta lista ficam disponíveis pelo campo "Outra…" na aba de Matéria-prima no Editor.</p>

        <div class="footer">
          <button class="btn line" on:click={resetGau}>Restaurar padrão</button>
          <div style="flex:1"></div>
          <button class="btn amber" on:click={saveGau}>Salvar</button>
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  .page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .page-hd { display: flex; align-items: center; gap: 16px; padding: 14px 24px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .page-title { font-size: 16px; font-weight: 600; white-space: nowrap; }
  .tabs { display: flex; gap: 2px; }
  .tab  { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px; font-weight: 500; background: none; border: 1px solid transparent; cursor: pointer; color: var(--ink-soft); }
  .tab.on { background: var(--panel-2); border-color: var(--line); color: var(--ink); }
  .tab:hover:not(.on) { background: var(--panel-2); }

  .body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); padding: 20px; display: flex; flex-direction: column; gap: 12px; }

  .sec-label { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .8px; color: var(--ink-faint); }
  .hint { font-size: 12px; color: var(--ink-faint); line-height: 1.5; }

  /* Tables */
  .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tbl th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--ink-faint); text-align: left; padding: 5px 4px; font-weight: 500; }
  .tbl th.r { text-align: right; }
  .tbl td { border-top: .5px solid var(--line); padding: 3px 4px; }
  .u { font-family: var(--mono); font-size: 9px; color: var(--ink-faint); background: var(--panel-2); padding: 1px 4px; border-radius: 3px; }

  /* Inputs */
  .inp { height: 30px; border: 1px solid var(--line); border-radius: 5px; padding: 0 7px; font-size: 13px; background: var(--panel); width: 100%; box-sizing: border-box; }
  .inp.num { text-align: right; font-family: var(--mono); }
  .inp.abbr { width: 72px; font-family: var(--mono); font-size: 12px; text-transform: uppercase; }
  .inp:focus { outline: none; border-color: var(--amber); }
  .inp.tag-in { width: 180px; }

  /* Tags */
  .tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tag  { display: inline-flex; align-items: center; gap: 4px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 5px; padding: 3px 8px; font-size: 12.5px; }
  .tag-rm { background: none; border: 0; color: var(--ink-faint); cursor: pointer; font-size: 13px; padding: 0 1px; }
  .tag-rm:hover { color: var(--danger); }
  .tag-add { display: flex; gap: 5px; align-items: center; }

  /* Buttons */
  .btn { height: 32px; padding: 0 12px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; white-space: nowrap; }
  .btn.sm { height: 28px; font-size: 12px; padding: 0 10px; }
  .amber { background: var(--amber); color: #fff; border-color: var(--amber); } .amber:hover { background: #d67d12; }
  .line  { background: var(--panel); border-color: var(--line); color: var(--ink); } .line:hover { background: var(--panel-2); }
  .rm { background: none; border: 0; color: var(--ink-faint); cursor: pointer; font-size: 15px; padding: 2px 5px; }
  .rm:hover { color: var(--danger); }

  .footer { display: flex; gap: 10px; padding-top: 16px; border-top: 1px solid var(--line); align-items: center; flex-shrink: 0; }
</style>
