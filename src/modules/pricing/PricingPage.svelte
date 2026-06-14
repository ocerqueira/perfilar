<script>
  import Pricing    from './Pricing.svelte';
  import Commission from './Commission.svelte';

  let tab = 'pricing'; // 'pricing' | 'commission'
</script>

<div class="page">
  <div class="page-hd">
    <div class="page-title">Preços e Comissão</div>
    <div class="tabs">
      <button class="tab" class:on={tab === 'pricing'}    on:click={() => (tab = 'pricing')}>Tabela de preços</button>
      <button class="tab" class:on={tab === 'commission'} on:click={() => (tab = 'commission')}>Comissão do vendedor</button>
    </div>
  </div>

  <div class="body">
    {#if tab === 'pricing'}
      <div class="card card-pricing">
        <Pricing />
      </div>
    {:else}
      <div class="card card-commission">
        <Commission />
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

  .body { flex: 1; overflow: hidden; padding: 20px 24px; display: flex; flex-direction: column; }

  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); }

  /* Pricing: flex column so the inner table scroll fills remaining height */
  .card-pricing { flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 0 20px; }

  /* Commission: simple scrollable container */
  .card-commission { overflow-y: auto; padding: 20px; }
</style>
