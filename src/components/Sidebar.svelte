<script>
  import { editor, order, freshEditor, catalogPresets } from '../lib/stores.js';
  import { PRESETS, CAT_ORDER, ICONS, clone } from '../lib/presets.js';
  import { compute, nf, brl } from '../lib/engine.js';

  export let load;         // função do App para carregar preset built-in
  export let loadCustom;   // função do App para carregar preset personalizado
  export let loadItem;     // carregar item salvo

  $: items = $order.items;
  $: sel = $order.sel;
  $: ordTot = items.reduce((a, it) => a + it.C.tot, 0);
  $: ordTotR = items.reduce((a, it) => a + (it.total || 0), 0);

  function remove(i) {
    $order.items.splice(i, 1);
    if ($order.sel >= i) $order.sel -= 1;
    $order = $order;
  }
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

  <section class="tray">
    <div class="eyebrow">pedido</div>
    {#if !items.length}
      <div class="empty">Nenhum item ainda.<br>Monte o perfil e clique em “Adicionar item”.</div>
    {/if}
    {#each items as it, i}
      <div class="item" class:on={i === sel}>
        <div class="nm" on:click={() => loadItem(i)} on:keydown={(e) => e.key === 'Enter' && loadItem(i)} role="button" tabindex="0">
          <b>{it.label}</b>
          <small>des {nf(it.C.des, 0)} · {it.params.Q}pç · {nf(it.C.tot, 1)}kg</small>
        </div>
        <button class="rm" on:click={() => remove(i)}>×</button>
      </div>
    {/each}
    <div class="tot"><span>Total do pedido</span><b>{items.length ? `${nf(ordTot, 1)} kg · ${brl(ordTotR)}` : '—'}</b></div>
  </section>
</aside>

<style>
  .side { background: var(--panel); border-right: 1px solid var(--line); overflow-y: auto; display: flex; flex-direction: column; }
  section { padding: 14px; border-bottom: 1px solid var(--line); }
  .tray { flex: 1; }
  .eyebrow { font-family: var(--mono); font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 10px; }
  .modes { display: flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 7px; padding: 3px; gap: 3px; margin-bottom: 12px; }
  .modes button { flex: 1; height: 30px; border-radius: 5px; font-size: 13px; font-weight: 500; color: var(--ink-soft); background: none; border: 0; cursor: pointer; }
  .modes button.on { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(20,32,43,.08); }
  .cat { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .cat button { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 4px; border: 1px solid var(--line); border-radius: var(--r); background: var(--panel); font-size: 12px; color: var(--ink-soft); cursor: pointer; }
  .cat button:hover { border-color: var(--ink-faint); }
  .cat button.on { border-color: var(--amber); background: var(--amber-soft); color: var(--amber-deep); font-weight: 500; }
  .cat svg { width: 34px; height: 24px; }
  .empty { color: var(--ink-faint); font-size: 12.5px; text-align: center; padding: 14px 8px; border: 1px dashed var(--line); border-radius: var(--r); }
  .item { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: var(--r); margin-bottom: 7px; background: var(--panel); }
  .item.on { border-color: var(--amber); background: var(--amber-soft); }
  .nm { flex: 1; min-width: 0; cursor: pointer; }
  .nm b { font-weight: 500; font-size: 13px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm small { color: var(--ink-soft); font-family: var(--mono); font-size: 10.5px; }
  .rm { color: var(--ink-faint); font-size: 16px; padding: 2px 4px; border-radius: 4px; background: none; border: 0; cursor: pointer; }
  .rm:hover { color: var(--danger); }
  .tot { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 13px; }
  .tot b { font-family: var(--mono); font-weight: 500; }
</style>
