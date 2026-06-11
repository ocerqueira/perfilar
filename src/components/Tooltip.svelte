<script>
  export let text = '';
  let show = false;
</script>

<span class="tt" on:mouseenter={() => (show = true)} on:mouseleave={() => (show = false)}
      on:focus={() => (show = true)} on:blur={() => (show = false)} tabindex="0" role="img" aria-label={text}>
  <span class="q">?</span>
  {#if show}<span class="pop">{text}</span>{/if}
</span>

<style>
  .tt { position: relative; display: inline-flex; vertical-align: middle; margin-left: 4px; cursor: help; }
  .q { width: 14px; height: 14px; border-radius: 50%; background: var(--panel-3); color: var(--ink-soft);
       font-size: 10px; font-weight: 600; display: flex; align-items: center; justify-content: center; font-family: var(--mono); }
  .tt:hover .q, .tt:focus .q { background: var(--amber); color: #fff; }
  .pop { position: absolute; bottom: 130%; left: 50%; transform: translateX(-50%); width: 210px;
         background: var(--ink); color: #fff; font-size: 11.5px; line-height: 1.4; font-weight: 400;
         padding: 8px 10px; border-radius: 6px; z-index: 30; box-shadow: 0 4px 14px rgba(16,24,33,.3); }
  .pop::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
                border: 5px solid transparent; border-top-color: var(--ink); }
</style>
