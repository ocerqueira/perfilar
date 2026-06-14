<script>
  import { catalogPresets, catalogOverrides } from '../../lib/stores.js';
  import {
    saveCustomPresets, savePresetOverrides,
    effectivePreset, DEFAULT_RESTRICTIONS, CAT_ORDER_DEFAULT,
  } from '../../lib/catalog.js';
  import { PRESETS, clone } from '../../lib/presets.js';
  import Blueprint from '../editor/Blueprint.svelte';

  // ── Estado do editor de preset ────────────────────────────────────────────
  let selKey  = null;
  let epType  = 'builtin'; // 'builtin' | 'custom'
  let epName  = '';
  let epH0    = 0;
  let epRows  = [];        // [{ label, mm, angle, dir }]
  let epRestr = { ...DEFAULT_RESTRICTIONS };
  let epDirty = false;

  let custPresets = $catalogPresets.map((p) => ({ ...p, rows: clone(p.rows) }));

  $: previewRows = epRows.map((r) => [r.label, r.mm, r.angle, r.dir]);
  $: previewT    = 0.65;

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
    const p = {
      key, name: 'Novo perfil', h0: 0,
      rows: [['Aba', 50, 90, 1], ['Alma', 100, 90, 1], ['Aba', 50, 0, 1]],
      icon: '', restrictions: { ...DEFAULT_RESTRICTIONS },
    };
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
    selectBuiltin(selKey);
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

  function addRow() {
    const last = epRows[epRows.length - 1] ?? { angle: 90, dir: 1 };
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
</script>

<div class="page">
  <div class="page-hd">
    <div class="page-title">Catálogo de Perfis</div>
  </div>

  <div class="split">

    <!-- Lista de presets -->
    <div class="cat-list">
      <div class="cl-section">
        <div class="eyebrow">Padrão</div>
        {#each CAT_ORDER_DEFAULT as k}
          {@const isModified = !!$catalogOverrides[k]}
          <button class="cl-item" class:on={selKey === k} on:click={() => selectBuiltin(k)}>
            <span class="cl-name">{PRESETS[k].name}</span>
            {#if isModified}
              <span class="cl-badge mod">✎</span>
            {:else}
              <span class="cl-badge">B</span>
            {/if}
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
          <div class="field">
            <label>Nome</label>
            <input class="inp" bind:value={epName} on:input={() => (epDirty = true)} />
          </div>
          <div class="field">
            <label>Ângulo inicial h0 <span class="u">°</span></label>
            <input class="inp num" type="number" step="5" bind:value={epH0} on:change={() => (epDirty = true)} />
          </div>
        </div>

        <!-- Preview + tabela -->
        <div class="ed-body">
          <div class="preview-wrap">
            <div class="preview-inner">
              {#key previewRows}
                <Blueprint rows={previewRows} h0={epH0} t={previewT} conv="ext" />
              {/key}
            </div>
          </div>

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
            <div class="field">
              <label>Aba mínima <span class="u">mm</span></label>
              <input class="inp num" type="number" step="1" min="0" bind:value={epRestr.minFlange} on:change={() => (epDirty = true)} />
            </div>
            <div class="field">
              <label>Aba máxima <span class="u">mm</span> <span class="opt">(opcional)</span></label>
              <input class="inp num" type="number" step="1" min="0"
                value={epRestr.maxFlange ?? ''}
                on:change={(e) => { epRestr.maxFlange = e.target.value ? parseFloat(e.target.value) : null; epDirty = true; }} />
            </div>
            <div class="field">
              <label>Raio mínimo <span class="u">mm</span> <span class="opt">(vazio = usar bitola)</span></label>
              <input class="inp num" type="number" step="0.1" min="0"
                value={epRestr.minRadius ?? ''}
                on:change={(e) => { epRestr.minRadius = e.target.value ? parseFloat(e.target.value) : null; epDirty = true; }} />
            </div>
            <div class="field check">
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
          <button class="btn amber" disabled={!epDirty} on:click={savePreset}>Salvar preset</button>
        </div>

      {:else}
        <div class="empty-state">
          Selecione um perfil na lista para editar a geometria e as restrições.
        </div>
      {/if}
    </div>

  </div>
</div>

<style>
  .page  { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .page-hd { display: flex; align-items: center; gap: 16px; padding: 14px 24px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .page-title { font-size: 16px; font-weight: 600; }

  /* Split layout: list | editor */
  .split { display: grid; grid-template-columns: 210px 1fr; flex: 1; overflow: hidden; min-height: 0; }

  /* Preset list */
  .cat-list { border-right: 1px solid var(--line); overflow-y: auto; padding: 12px 10px; display: flex; flex-direction: column; gap: 10px; background: var(--panel-2); }
  .cl-section { display: flex; flex-direction: column; gap: 2px; }
  .eyebrow { font-family: var(--mono); font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-faint); padding: 4px 6px 2px; }
  .cl-item { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 6px; background: none; border: 1px solid transparent; cursor: pointer; font-size: 13px; text-align: left; }
  .cl-item:hover { background: var(--panel-2); }
  .cl-item.on { background: var(--amber-soft); border-color: #f5d9b0; }
  .cl-name { flex: 1; }
  .cl-badge { font-family: var(--mono); font-size: 9px; padding: 1px 5px; border-radius: 3px; background: var(--panel-2); color: var(--ink-faint); border: 1px solid var(--line); }
  .cl-badge.mod  { background: #fff3e0; color: var(--amber-deep); border-color: #f5d9b0; }
  .cl-badge.cust { background: #e8f5e9; color: #2E7D32; border-color: #a5d6a7; }
  .cl-new { margin-top: 4px; }

  /* Editor */
  .cat-editor { overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; background: var(--panel); }
  .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--ink-faint); font-size: 13px; font-style: italic; }

  .ed-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .field { display: flex; flex-direction: column; gap: 4px; min-width: 160px; }
  .field label { font-size: 11.5px; color: var(--ink-soft); }
  .field.check { flex-direction: row; align-items: center; min-width: 0; }
  .field.check label { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink); cursor: pointer; }

  .u   { font-family: var(--mono); font-size: 9px; color: var(--ink-faint); background: var(--panel-2); padding: 1px 4px; border-radius: 3px; }
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

  /* Shared */
  .sec-label { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .8px; color: var(--ink-faint); margin-bottom: 8px; }
  .mt8 { margin-top: 8px; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tbl th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--ink-faint); text-align: left; padding: 5px 4px; font-weight: 500; }
  .tbl th.r { text-align: right; } .tbl th.c { text-align: center; }
  .tbl td { border-top: .5px solid var(--line); padding: 3px 4px; }
  .tbl td.c { text-align: center; } .tbl td.ix { color: var(--ink-faint); font-size: 11px; width: 24px; } .tbl td.muted { color: var(--ink-faint); }
  .inp { height: 30px; border: 1px solid var(--line); border-radius: 5px; padding: 0 7px; font-size: 13px; background: var(--panel); width: 100%; box-sizing: border-box; }
  .inp.num { text-align: right; font-family: var(--mono); }
  .inp.num.sm { width: 64px; }
  .inp.lbl { width: 100px; }
  .inp:focus { outline: none; border-color: var(--amber); }
  .btn { height: 32px; padding: 0 12px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; white-space: nowrap; }
  .btn.sm { height: 28px; font-size: 12px; padding: 0 10px; }
  .amber  { background: var(--amber); color: #fff; border-color: var(--amber); } .amber:hover:not(:disabled) { background: #d67d12; }
  .amber:disabled { opacity: .45; cursor: not-allowed; }
  .line   { background: var(--panel); border-color: var(--line); color: var(--ink); } .line:hover { background: var(--panel-2); }
  .danger { background: var(--panel); border-color: #e05252; color: #c0392b; } .danger:hover { background: #fff4f4; }
  .rm { background: none; border: 0; color: var(--ink-faint); cursor: pointer; font-size: 15px; padding: 2px 5px; }
  .rm:hover:not(:disabled) { color: var(--danger); } .rm:disabled { opacity: .3; cursor: not-allowed; }
</style>
