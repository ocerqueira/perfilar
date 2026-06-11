<script>
  import { editor, catalogPresets } from '../lib/stores.js';
  import { PRESETS, CAT_ORDER, ICONS } from '../lib/presets.js';

  export let load;
  export let loadCustom;
</script>

<aside class="side">
  <section>
    <div class="eyebrow">modo de entrada</div>
    <div class="modes">
      <button class:on={$editor.mode === 'cat'} on:click={() => { $editor.mode = 'cat'; $editor = $editor; }}>Catálogo</button>
      <button class:on={$editor.mode === 'liv'} on:click={() => { $editor.mode = 'liv'; $editor = $editor; }}>Livre</button>
    </div>
    <div class="eyebrow" style:opacity={$editor.mode === 'liv' ? .4 : 1}>perfis padrão</div>
    <div class="cat" style:opacity={$editor.mode === 'liv' ? .4 : 1}>
      {#each CAT_ORDER as k}
        <button class:on={$editor.key === k && $editor.mode === 'cat'} on:click={() => load(k)}>
          <svg viewBox="0 0 70 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d={ICONS[k]} /></svg>
          <span>{PRESETS[k].name}</span>
        </button>
      {/each}
    </div>
    {#if $catalogPresets.length}
      <div class="eyebrow" style="margin-top:10px">personalizados</div>
      <div class="cat">
        {#each $catalogPresets as p}
          <button class:on={$editor.key === p.key && $editor.mode === 'cat'} on:click={() => loadCustom(p)}>
            <svg viewBox="0 0 70 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              {#if p.icon}<path d={p.icon} />{:else}<circle cx="35" cy="24" r="14" />{/if}
            </svg>
            <span>{p.name}</span>
          </button>
        {/each}
      </div>
    {/if}
  </section>
</aside>

<style>
  .side { background: var(--panel); border-right: 1px solid var(--line); overflow-y: auto; display: flex; flex-direction: column; }
  section { padding: 14px; }
  .eyebrow { font-family: var(--mono); font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 10px; }
  .modes { display: flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 7px; padding: 3px; gap: 3px; margin-bottom: 12px; }
  .modes button { flex: 1; height: 30px; border-radius: 5px; font-size: 13px; font-weight: 500; color: var(--ink-soft); background: none; border: 0; cursor: pointer; }
  .modes button.on { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(20,32,43,.08); }
  .cat { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .cat button { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 4px; border: 1px solid var(--line); border-radius: var(--r); background: var(--panel); font-size: 12px; color: var(--ink-soft); cursor: pointer; }
  .cat button:hover { border-color: var(--ink-faint); }
  .cat button.on { border-color: var(--amber); background: var(--amber-soft); color: var(--amber-deep); font-weight: 500; }
  .cat svg { width: 34px; height: 24px; }
</style>
