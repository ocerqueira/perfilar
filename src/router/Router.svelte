<script>
  export let routePath;
  export let routes;

  $: current = routes.find((r) => r.path === routePath) ?? routes[0];
</script>

<svelte:component this={current.component} />
