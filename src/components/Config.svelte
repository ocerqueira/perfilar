<script>
  import { createEventDispatcher } from 'svelte';
  import {
    catalogMaterials, catalogRevests, catalogGauges,
    catalogPresets, catalogOverrides,
  } from '../lib/stores.js';
  import {
    saveMaterials, saveRevests, saveGauges,
    saveCustomPresets, savePresetOverrides,
    loadMaterials, loadRevests, loadGauges,
    effectivePreset, DEFAULT_RESTRICTIONS, CAT_ORDER_DEFAULT,
  } from '../lib/catalog.js';
  import { PRESETS, ICONS, clone } from '../lib/presets.js';
  import Blueprint from './Blueprint.svelte';

  const dispatch = createEventDispatcher();

  let tab = 'mat'; // 'mat' | 'gau' | 'cat'

  // ── Tab 1: Materiais ─────────────────────────────────────────────────────────
  let mats  = $catalogMaterials.map((m) => ({ ...m }));
  let revs  = [...$catalogRevests];
  let newRevInput = '';

  function addMat()      { mats = [...mats, { name: 'Novo material', dens: 7850 }]; }
  function removeMat(i)  { mats = mats.filter((_, j) => j !== i); }
  function addRev()      { const v = newRevInput.trim(); if (v && !revs.includes(v)) { revs = [...revs, v]; } newRevInput = ''; }
  function removeRev(i)  { revs = revs.filter((_, j) => j !== i); }
  function saveMat()     { $catalogMaterials = mats; $catalogRevests = revs; saveMaterials(mats); saveRevests(revs); }
  function resetMat()    { mats = loadMaterials(); revs = loadRevests(); $catalogMaterials = mats; $catalogRevests = revs; }

  // ── Tab 2: Bitolas ───────────────────────────────────────────────────────────
  let gauges    = [...$catalogGauges].sort((a, b) => a - b);
  let newGauVal = '';

  function addGauge() {
    const v = parseFloat(newGauVal);
    if (!isNaN(v) && v > 0 && !gauges.includes(v)) { gauges = [...gauges, v].sort((a, b) => a - b); }
    newGauVal = '';
  }
  function removeGauge(i) { gauges = gauges.filter((_, j) => j !== i); }
  function saveGau()  { $catalogGauges = gauges; saveGauges(gauges); }
  function resetGau() { gauges = loadGauges().sort((a, b) => a - b); $catalogGauges = gauges; }

  // ── Tab 3: Catálogo de Perfis ────────────────────────────────────────────────
  // Estado do editor de preset
  let selKey     = null;   // key do preset selecionado
  let epType     = 'builtin'; // 'builtin' | 'custom'
  let epName     = '';
  let epH0       = 0;
  let epRows     = [];     // [{ label, mm, angle, dir }] — estado editável
  let epRestr    = { ...DEFAULT_RESTRICTIONS };
  let epDirty    = false;

  // Lista de presets customizados (cópia editável local)
  let custPresets = $catalogPresets.map((p) => ({ ...p, rows: clone(p.rows) }));

  $: previewRows = epRows.map((r) => [r.label, r.mm, r.angle, r.dir]);
  $: previewT    = 0.65; // preview com bitola padrão

  function selectBuiltin(key) {
    const p = effectivePreset(key, $catalogOverrides);
    if (!p) return;
    selKey = key; epType = 'builtin';
    epName = p.name; epH0 = p.h0;
    epRows = p.rows.map((r) => ({ label: r[0], mm: r[1], angle: r[2] ?? 90, dir: r[3] ?? 1 }));
    epRestr = { ...DEFAULT_RESTRICTIONS, ...(p.restrictions ?? {}) };
    epDirty = false;
  }

  function selectCustom(key) {
    const p = custPresets.find((x) => x.key === key);
    if (!p) return;
    selKey = key; epType = 'custom';
    epName = p.name; epH0 = p.h0;
    epRows = p.rows.map((r) => ({ label: r[0], mm: r[1], angle: r[2] ?? 90, dir: r[3] ?? 1 }));
    epRestr = { ...DEFAULT_RESTRICTIONS, ...(p.restrictions ?? {}) };
    epDirty = false;
  }

  function newCustom() {
    const key = 'custom-' + Date.now();
    const p = { key, name: 'Novo perfil', h0: 0, rows: [['Aba', 50, 90, 1], ['Alma', 100, 90, 1], ['Aba', 50, 0, 1]], icon: '', restrictions: { ...DEFAULT_RESTRICTIONS } };
    custPresets = [...custPresets, p];
    selectCustom(key);
    epDirty = true;
  }

  function deleteCustom() {
    custPresets = custPresets.filter((p) => p.key !== selKey);
    $catalogPresets = custPresets;
    saveCustomPresets(custPresets);
    selKey = null;
  }

  function restoreBuiltin() {
    const ov = { ...$catalogOverrides };
    delete ov[selKey];
    $catalogOverrides = ov;
    savePresetOverrides(ov);
    selectBuiltin(selKey); // recarrega da base
    epDirty = false;
  }

  function savePreset() {
    const rows = epRows.map((r) => [r.label, r.mm, r.angle, r.dir]);
    if (epType === 'builtin') {
      const base = PRESETS[selKey];
      const ov = { ...$catalogOverrides };
      ov[selKey] = {
        name: epName !== base.name ? epName : undefined,
        h0:   epH0 !== base.h0    ? epH0   : undefined,
        rows: JSON.stringify(rows) !== JSON.stringify(base.rows) ? rows : undefined,
        restrictions: { ...epRestr },
      };
      // Remove keys that weren't changed
      for (const k of Object.keys(ov[selKey])) {
        if (ov[selKey][k] === undefined) delete ov[selKey][k];
      }
      $catalogOverrides = ov;
      savePresetOverrides(ov);
    } else {
      const idx = custPresets.findIndex((p) => p.key === selKey);
      if (idx >= 0) {
        custPresets[idx] = { ...custPresets[idx], name: epName, h0: epH0, rows, restrictions: { ...epRestr } };
      }
      custPresets = [...custPresets];
      $catalogPresets = custPresets;
      saveCustomPresets(custPresets);
    }
    epDirty = false;
  }

  // Edição de linhas
  function addRow() {
    const last = epRows[epRows.length - 1] ?? { angle: 90, dir: 1 };
    // Insere antes da última aba
    epRows = [
      ...epRows.slice(0, -1),
      { label: 'Nova aba', mm: 50, angle: 90, dir: last.dir },
      epRows[epRows.length - 1],
    ];
    epDirty = true;
  }
  function removeRow(i) {
    if (epRows.length <= 2) return;
    epRows = epRows.filter((_, j) => j !== i);
    epDirty = true;
  }
  function rowChanged() { epDirty = true; epRows = epRows; }

  // Funções de save global por aba
  function saveTab() {
    if (tab === 'mat') saveMat();
    else if (tab === 'gau') saveGau();
  }
  function resetTab() {
    if (tab === 'mat') resetMat();
    else if (tab === 'gau') resetGau();
  }

  function close() { dispatch('close'); }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && close()} />
<div class="back" role="presentation" on:click={close}>
  <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>

    <!-- Cabeçalho -->
    <div class="mh">
      <b>Configurações</b>
      <div class="tabs">
        <button class="tab" class:on={tab === 'mat'} on:click={() => (tab = 'mat')}>Materiais</button>
        <button class="tab" class:on={tab === 'gau'} on:click={() => (tab = 'gau')}>Bitolas</button>
        <button class="tab" class:on={tab === 'cat'} on:click={() => (tab = 'cat')}>Catálogo de Perfis</button>
      </div>
      <button class="btn ghost" on:click={close}>Fechar</button>
    </div>

    <!-- ── Tab 1: Materiais ───────────────────────────────────────────────── -->
    {#if tab === 'mat'}
      <div class="scroll">
        <div class="sec-label">Materiais (liga do aço)</div>
        <table class="tbl">
          <thead><tr><th>Nome</th><th class="r">Densidade <span class="u">kg/m³</span></th><th></th></tr></thead>
          <tbody>
            {#each mats as m, i}
              <tr>
                <td><input class="inp" bind:value={m.name} /></td>
                <td><input class="inp num" type="number" step="10" bind:value={m.dens} /></td>
                <td><button class="rm" on:click={() => removeMat(i)} title="Remover">×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
        <button class="btn line sm mt8" on:click={addMat}>+ Material</button>

        <div class="sec-label mt20">Revestimentos</div>
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
      </div>
      <div class="mf">
        <button class="btn line" on:click={resetTab}>Restaurar padrão</button>
        <div style="flex:1"></div>
        <button class="btn amber" on:click={saveTab}>Salvar</button>
      </div>

    <!-- ── Tab 2: Bitolas ─────────────────────────────────────────────────── -->
    {:else if tab === 'gau'}
      <div class="scroll">
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
        <p class="hint">Bitolas fora desta lista ficam disponíveis pelo campo "Outra…" na aba de Matéria-prima.</p>
      </div>
      <div class="mf">
        <button class="btn line" on:click={resetTab}>Restaurar padrão</button>
        <div style="flex:1"></div>
        <button class="btn amber" on:click={saveTab}>Salvar</button>
      </div>

    <!-- ── Tab 3: Catálogo ────────────────────────────────────────────────── -->
    {:else}
      <div class="cat-split">

        <!-- Lista de presets -->
        <div class="cat-list">
          <div class="cl-section">
            <div class="eyebrow">Padrão</div>
            {#each CAT_ORDER_DEFAULT as k}
              {@const isModified = !!$catalogOverrides[k]}
              <button class="cl-item" class:on={selKey === k} on:click={() => selectBuiltin(k)}>
                <span class="cl-name">{PRESETS[k].name}</span>
                {#if isModified}<span class="cl-badge mod">✎</span>{:else}<span class="cl-badge">B</span>{/if}
              </button>
            {/each}
          </div>
          <div class="cl-section">
            <div class="eyebrow">Personalizados</div>
            {#each custPresets as p}
              <button class="cl-item" class:on={selKey === p.key} on:click={() => selectCustom(p.key)}>
                <span class="cl-name">{p.name}</span>
                <span class="cl-badge cust">P</span>
              </button>
            {/each}
            <button class="btn line sm cl-new" on:click={newCustom}>+ Novo perfil</button>
          </div>
        </div>

        <!-- Editor -->
        <div class="cat-editor">
          {#if selKey}
            <!-- Identidade -->
            <div class="ed-row">
              <div class="field sm">
                <label>Nome</label>
                <input class="inp" bind:value={epName} on:input={() => (epDirty = true)} />
              </div>
              <div class="field sm">
                <label>Ângulo inicial h0 <span class="u">°</span></label>
                <input class="inp num" type="number" step="5" bind:value={epH0} on:change={() => (epDirty = true)} />
              </div>
            </div>

            <!-- Preview + tabela lado a lado -->
            <div class="ed-body">
              <!-- Preview Blueprint -->
              <div class="preview-wrap">
                <div class="preview-inner">
                  {#key previewRows}
                    <Blueprint rows={previewRows} h0={epH0} t={previewT} conv="ext" />
                  {/key}
                </div>
              </div>

              <!-- Tabela de linhas -->
              <div class="rows-wrap">
                <div class="sec-label">Abas e dobras</div>
                <table class="tbl rows-tbl">
                  <thead>
                    <tr>
                      <th>#</th><th>Rótulo</th><th class="r">mm</th>
                      <th class="c">°</th><th class="c">Sent.</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each epRows as r, i}
                      {@const last = i === epRows.length - 1}
                      <tr>
                        <td class="ix">{i + 1}</td>
                        <td><input class="inp lbl" bind:value={r.label} on:input={rowChanged} /></td>
                        <td><input class="inp num sm" type="number" step="1" min="1" bind:value={r.mm} on:change={rowChanged} /></td>
                        {#if last}
                          <td class="muted c">—</td><td class="muted c">—</td>
                        {:else}
                          <td><input class="inp num sm" type="number" step="5" min="1" max="180" bind:value={r.angle} on:change={rowChanged} /></td>
                          <td class="c">
                            <button class="dir-btn" on:click={() => { r.dir = r.dir > 0 ? -1 : 1; rowChanged(); }}>
                              {r.dir > 0 ? '↑' : '↓'}
                            </button>
                          </td>
                        {/if}
                        <td><button class="rm" on:click={() => removeRow(i)} disabled={epRows.length <= 2}>×</button></td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
                <button class="btn line sm mt8" on:click={addRow}>+ Aba</button>
              </div>
            </div>

            <!-- Restrições -->
            <div class="restr">
              <div class="sec-label">Restrições geométricas</div>
              <div class="restr-grid">
                <div class="field sm">
                  <label>Aba mínima <span class="u">mm</span></label>
                  <input class="inp num" type="number" step="1" min="0" bind:value={epRestr.minFlange} on:change={() => (epDirty = true)} />
                </div>
                <div class="field sm">
                  <label>Aba máxima <span class="u">mm</span> <span class="opt">(opcional)</span></label>
                  <input class="inp num" type="number" step="1" min="0"
                    value={epRestr.maxFlange ?? ''}
                    on:change={(e) => { epRestr.maxFlange = e.target.value ? parseFloat(e.target.value) : null; epDirty = true; }} />
                </div>
                <div class="field sm">
                  <label>Raio mínimo <span class="u">mm</span> <span class="opt">(vazio = usar bitola)</span></label>
                  <input class="inp num" type="number" step="0.1" min="0"
                    value={epRestr.minRadius ?? ''}
                    on:change={(e) => { epRestr.minRadius = e.target.value ? parseFloat(e.target.value) : null; epDirty = true; }} />
                </div>
                <div class="field sm check">
                  <label>
                    <input type="checkbox" bind:checked={epRestr.checkCollision} on:change={() => (epDirty = true)} />
                    Detectar auto-interseção (colisão)
                  </label>
                </div>
              </div>
            </div>

            <!-- Ações -->
            <div class="ed-actions">
              {#if epType === 'builtin' && $catalogOverrides[selKey]}
                <button class="btn line" on:click={restoreBuiltin}>Restaurar original</button>
              {/if}
              {#if epType === 'custom'}
                <button class="btn danger" on:click={deleteCustom}>Excluir perfil</button>
              {/if}
              <div style="flex:1"></div>
              <button class="btn amber" disabled={!epDirty} on:click={savePreset}>
                Salvar preset
              </button>
            </div>
          {:else}
            <div class="empty-state">
              Selecione um perfil na lista para editar a geometria e as restrições.
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .back  { position: fixed; inset: 0; background: rgba(16,24,33,.55); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 16px; }
  .modal { background: var(--panel); border-radius: 12px; width: 100%; max-width: 1020px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }

  /* Header */
  .mh   { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .mh b { font-size: 15px; margin-right: 4px; }
  .tabs { display: flex; gap: 2px; flex: 1; }
  .tab  { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px; font-weight: 500; background: none; border: 1px solid transparent; cursor: pointer; color: var(--ink-soft); }
  .tab.on { background: var(--panel-2); border-color: var(--line); color: var(--ink); }
  .tab:hover:not(.on) { background: var(--panel-2); }

  /* Shared scroll area */
  .scroll { flex: 1; overflow-y: auto; padding: 16px 20px; }

  /* Sections */
  .sec-label { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .8px; color: var(--ink-faint); margin-bottom: 8px; }
  .mt8  { margin-top: 8px; }
  .mt20 { margin-top: 20px; }
  .hint { font-size: 12px; color: var(--ink-faint); margin-top: 10px; }

  /* Tables */
  .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tbl th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--ink-faint); text-align: left; padding: 5px 4px; font-weight: 500; }
  .tbl th.r { text-align: right; } .tbl th.c { text-align: center; }
  .tbl td { border-top: .5px solid var(--line); padding: 3px 4px; }
  .tbl td.c { text-align: center; } .tbl td.r { text-align: right; }
  .tbl td.ix { color: var(--ink-faint); font-size: 11px; width: 24px; }
  .tbl td.muted { color: var(--ink-faint); }

  /* Inputs */
  .inp { height: 30px; border: 1px solid var(--line); border-radius: 5px; padding: 0 7px; font-size: 13px; background: var(--panel); width: 100%; }
  .inp.num { text-align: right; font-family: var(--mono); }
  .inp.num.sm { width: 64px; }
  .inp.lbl { width: 100px; }
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
  .amber  { background: var(--amber); color: #fff; border-color: var(--amber); } .amber:hover:not(:disabled) { background: #d67d12; }
  .amber:disabled { opacity: .45; cursor: not-allowed; }
  .line   { background: var(--panel); border-color: var(--line); color: var(--ink); } .line:hover { background: var(--panel-2); }
  .ghost  { background: var(--panel-2); border-color: var(--line); color: var(--ink); }
  .danger { background: var(--panel); border-color: #e05252; color: #c0392b; } .danger:hover { background: #fff4f4; }
  .rm { background: none; border: 0; color: var(--ink-faint); cursor: pointer; font-size: 15px; padding: 2px 5px; }
  .rm:hover:not(:disabled) { color: var(--danger); } .rm:disabled { opacity: .3; cursor: not-allowed; }

  /* Footer */
  .mf { display: flex; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--line); flex-shrink: 0; }

  /* ── Catálogo: split layout ───────────────────────────────────────── */
  .cat-split { display: grid; grid-template-columns: 200px 1fr; flex: 1; overflow: hidden; }

  /* Preset list */
  .cat-list { border-right: 1px solid var(--line); overflow-y: auto; padding: 12px 10px; display: flex; flex-direction: column; gap: 10px; }
  .cl-section { display: flex; flex-direction: column; gap: 2px; }
  .eyebrow { font-family: var(--mono); font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-faint); padding: 4px 6px 2px; }
  .cl-item { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 6px; background: none; border: 1px solid transparent; cursor: pointer; font-size: 13px; text-align: left; }
  .cl-item:hover { background: var(--panel-2); }
  .cl-item.on   { background: var(--amber-soft); border-color: #f5d9b0; }
  .cl-name { flex: 1; }
  .cl-badge { font-family: var(--mono); font-size: 9px; padding: 1px 5px; border-radius: 3px; background: var(--panel-2); color: var(--ink-faint); border: 1px solid var(--line); }
  .cl-badge.mod  { background: #fff3e0; color: var(--amber-deep); border-color: #f5d9b0; }
  .cl-badge.cust { background: #e8f5e9; color: #2E7D32; border-color: #a5d6a7; }
  .cl-new { margin-top: 4px; }

  /* Preset editor */
  .cat-editor { overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
  .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--ink-faint); font-size: 13px; font-style: italic; }
  .ed-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field.sm { min-width: 160px; }
  .field label { font-size: 11.5px; color: var(--ink-soft); }
  .field.check { flex-direction: row; align-items: center; }
  .field.check label { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink); cursor: pointer; }
  .u { font-family: var(--mono); font-size: 9px; color: var(--ink-faint); background: var(--panel-2); padding: 1px 4px; border-radius: 3px; }
  .opt { font-size: 10.5px; color: var(--ink-faint); font-style: italic; }

  .ed-body { display: grid; grid-template-columns: 280px 1fr; gap: 14px; align-items: start; }
  .preview-wrap { background: var(--canvas, #182230); border-radius: var(--r); overflow: hidden; }
  .preview-inner :global(.bp) { border-radius: 0; }

  .rows-wrap { display: flex; flex-direction: column; }
  .rows-tbl { font-size: 12px; }
  .dir-btn { background: var(--panel-2); border: 1px solid var(--line); border-radius: 4px; padding: 2px 7px; cursor: pointer; font-size: 14px; }
  .dir-btn:hover { background: var(--amber-soft); }

  .restr { background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
  .restr .sec-label { margin-bottom: 10px; }
  .restr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }

  .ed-actions { display: flex; gap: 8px; padding-top: 4px; border-top: 1px solid var(--line); align-items: center; }
</style>
