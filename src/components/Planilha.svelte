<script>
  import { editor } from '../lib/stores.js';

  let rows, mode;
  $: rows = $editor.rows;
  $: mode = $editor.mode;

  function set(i, k, v) {
    $editor.rows[i][k] = k === 0 ? v : (parseFloat(v) || 0);
    $editor = $editor;
  }
  function flip(i) { $editor.rows[i][3] *= -1; $editor = $editor; }
  function remove(i) { $editor.rows.splice(i, 1); $editor = $editor; }
  function addRow() {
    if ($editor.rows.length) $editor.rows[$editor.rows.length - 1][2] = 90;
    $editor.rows.push(['Aba ' + ($editor.rows.length + 1), 30, 0, 1]);
    $editor = $editor;
  }
  function onKey(e, i, k) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const last = i === rows.length - 1;
    if (last && k === 1) {
      addRow();
      setTimeout(() => { const n = document.querySelector(`[data-cell="${i + 1}-1"]`); if (n) n.focus(); }, 0);
    } else {
      const n = document.querySelector(`[data-cell="${i + 1}-${k}"]`);
      if (n) n.focus();
    }
  }
</script>

<div class="card">
  <div class="card-h">
    <span class="t">Abas e dobras</span>
    <span class="hint">ENTER ↓ · TAB →</span>
  </div>
  <table class="grid">
    <thead><tr><th></th><th>Aba</th><th class="r">mm</th><th class="c">dobra</th><th class="c">sent.</th><th></th></tr></thead>
    <tbody>
      {#each rows as r, i}
        <tr>
          <td class="ix">{i + 1}</td>
          <td>
            {#if mode === 'liv'}
              <input class="cell" value={r[0]} on:input={(e) => set(i, 0, e.target.value)} />
            {:else}
              <span class="lbl">{r[0]}</span>
            {/if}
          </td>
          <td><input class="cell mm" type="number" value={r[1]} data-cell={`${i}-1`}
                     on:input={(e) => set(i, 1, e.target.value)} on:keydown={(e) => onKey(e, i, 1)} /></td>
          <td><input class="cell num" type="number" value={i === rows.length - 1 ? '' : r[2]}
                     disabled={i === rows.length - 1} data-cell={`${i}-2`}
                     on:input={(e) => set(i, 2, e.target.value)} on:keydown={(e) => onKey(e, i, 2)} /></td>
          <td>
            {#if i === rows.length - 1}<div class="flip off">—</div>
            {:else}<button class="flip" on:click={() => flip(i)}>{r[3] > 0 ? '↑' : '↓'}</button>{/if}
          </td>
          <td>{#if rows.length > 2}<button class="rm" on:click={() => remove(i)}>×</button>{/if}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <button class="addrow" on:click={addRow}>+ adicionar dobra</button>
</div>

<style>
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); }
  .card-h { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  .t { font-weight: 600; font-size: 13.5px; }
  .hint { font-family: var(--mono); font-size: 10.5px; color: var(--ink-faint); }
  table.grid { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { font-family: var(--mono); font-size: 10px; letter-spacing: .5px; text-transform: uppercase; color: var(--ink-faint); font-weight: 500; text-align: left; padding: 7px 6px; }
  th.r { text-align: right; } th.c { text-align: center; }
  td { padding: 0; border-top: 1px solid var(--line); }
  .ix { width: 26px; text-align: center; color: var(--ink-faint); font-family: var(--mono); font-size: 11px; }
  .lbl { padding: 0 8px; color: var(--ink-soft); font-size: 12.5px; }
  .cell { width: 100%; height: 34px; border: 0; background: transparent; padding: 0 8px; font-size: 13px; }
  .cell:focus { outline: 2px solid var(--amber); outline-offset: -2px; background: var(--amber-soft); border-radius: 4px; }
  .cell.num { text-align: right; font-family: var(--mono); }
  .cell.mm { background: #fbfdff; text-align: right; font-family: var(--mono); font-weight: 500; }
  .cell:disabled { opacity: .3; }
  .flip { width: 100%; height: 34px; color: var(--ink-soft); font-size: 15px; background: none; border: 0; cursor: pointer; }
  .flip:hover { color: var(--amber); } .flip.off { opacity: .3; }
  .rm { width: 30px; color: var(--ink-faint); font-size: 15px; background: none; border: 0; cursor: pointer; }
  .rm:hover { color: var(--danger); }
  .addrow { width: 100%; border: 0; border-top: 1px solid var(--line); padding: 8px; font-size: 12.5px; color: var(--ink-soft); background: none; cursor: pointer; }
  .addrow:hover { background: var(--panel-2); }
</style>
