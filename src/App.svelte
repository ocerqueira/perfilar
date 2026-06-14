<script>
  import Router from './router/Router.svelte';
  import { routes, navGroups } from './router/routes.js';

  function getRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return hash || 'dashboard';
  }

  let routePath = getRoute();
  window.addEventListener('hashchange', () => { routePath = getRoute(); });

  let collapsed = false;

  const grouped  = navGroups.map((g) => ({ ...g, routes: routes.filter((r) => r.group === g.key) }));
  const settings = routes.filter((r) => r.group === null);

  // SVG inner paths — 20×20 viewport, stroke, no fill
  const ICONS = {
    dashboard: `<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>`,
    analises:  `<path d="M3 14h2.5V8H3v6zM8.75 14h2.5V4h-2.5v10zM14.5 14H17V10h-2.5v4z"/>`,
    editor:    `<path d="M5 16.5 12.5 9l2 2L7 18.5H5v-2z"/><path d="M12.5 9l.5-.5a1.5 1.5 0 0 1 2.1 2.1l-.6.4"/><path d="M4 18h12"/>`,
    cutplan:   `<circle cx="5" cy="5" r="2.5"/><circle cx="5" cy="15" r="2.5"/><path d="M8.5 6.5 17 3m-5.5 9 5.5 5M8.5 13.5 12 10"/>`,
    orders:    `<rect x="5" y="2" width="10" height="16" rx="1.5"/><path d="M8.5 7h3M8.5 10h3M8.5 13h2"/>`,
    pricing:   `<path d="M10 2.5v15"/><path d="M13 6H8a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H7"/>`,
    clients:   `<circle cx="10" cy="7" r="3.5"/><path d="M3 19c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/>`,
    products:  `<path d="M10 2 18 6.5v7L10 18 2 13.5v-7L10 2z"/><path d="M2 6.5 10 11l8-4.5M10 11v7"/>`,
    materials: `<path d="M2 14 10 18l8-4M2 10l8 4 8-4M2 6l8 4 8-4"/>`,
    settings:  `<circle cx="10" cy="10" r="2.5"/><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8"/>`,
    goals:     `<path d="M4 3h12v7a6 6 0 0 1-12 0V3z"/><path d="M4 6H2a2 2 0 0 0 0 4h2"/><path d="M16 6h2a2 2 0 0 0 0 4h-2"/><path d="M10 16v3"/><path d="M7 19h6"/>`,
    admin:     `<path d="M10 2 3 5.5v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9v-5L10 2z"/><circle cx="10" cy="10" r="2.5"/>`,
  };
</script>

<div class="app">

  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <header class="bar">
    <div class="brand">
      <b>Perfilar</b>
      <span>ferro &amp; aço</span>
    </div>
  </header>

  <div class="body">

    <!-- ── Sidebar ────────────────────────────────────────────────────── -->
    <nav class="nav" class:collapsed>

      <!-- Toggle collapse -->
      <button
        class="nav-toggle"
        class:collapsed
        on:click={() => (collapsed = !collapsed)}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          {#if collapsed}
            <path d="M7 5l6 5-6 5"/>
          {:else}
            <path d="M13 5l-6 5 6 5"/>
          {/if}
        </svg>
        {#if !collapsed}<span>Recolher</span>{/if}
      </button>

      <!-- Main nav groups -->
      <div class="nav-scroll">
        {#each grouped as g}
          <div class="nav-group">
            {#if !collapsed}
              <div class="group-label">{g.label}</div>
            {:else}
              <div class="group-divider"></div>
            {/if}
            {#each g.routes as r}
              <a
                href="#{r.path}"
                class="nav-item"
                class:active={routePath === r.path}
                title={collapsed ? r.label : ''}
              >
                <svg class="nav-icon" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  {@html ICONS[r.path] ?? ''}
                </svg>
                {#if !collapsed}<span class="nav-label">{r.label}</span>{/if}
              </a>
            {/each}
          </div>
        {/each}
      </div>

      <!-- Config (bottom pinned) -->
      <div class="nav-foot">
        {#if !collapsed}<div class="group-divider"></div>{/if}
        {#each settings as r}
          <a
            href="#{r.path}"
            class="nav-item"
            class:active={routePath === r.path}
            title={collapsed ? r.label : ''}
          >
            <svg class="nav-icon" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              {@html ICONS[r.path] ?? ''}
            </svg>
            {#if !collapsed}<span class="nav-label">{r.label}</span>{/if}
          </a>
        {/each}
      </div>

    </nav>

    <!-- ── Content ────────────────────────────────────────────────────── -->
    <main class="content">
      <Router {routePath} {routes} />
    </main>

  </div>
</div>

<style>
  /* ── Layout shell ─────────────────────────────────────────────────────── */
  .app  { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .body { flex: 1; display: flex; overflow: hidden; min-height: 0; }

  /* ── Header ───────────────────────────────────────────────────────────── */
  .bar {
    flex-shrink: 0;
    height: 52px;
    display: flex;
    align-items: center;
    padding: 0 20px;
    background: var(--ink);
    color: #fff;
    border-bottom: 1px solid rgba(255,255,255,.07);
  }
  .brand { display: flex; align-items: baseline; gap: 9px; }
  .brand b    { font-family: var(--disp); font-weight: 600; font-size: 18px; letter-spacing: .3px; }
  .brand span { font-family: var(--mono); font-size: 11px; color: #7a92a8; }

  /* ── Sidebar ──────────────────────────────────────────────────────────── */
  .nav {
    flex-shrink: 0;
    width: 196px;
    transition: width 220ms cubic-bezier(.4, 0, .2, 1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border-right: 1px solid var(--line);
  }
  .nav.collapsed { width: 52px; }

  /* Toggle button */
  .nav-toggle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 40px;
    padding: 0 14px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    color: var(--ink-soft);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    width: 100%;
    text-align: left;
    transition: background .1s, color .1s;
  }
  .nav-toggle:hover { background: var(--panel-2); color: var(--ink); }
  .nav-toggle.collapsed { justify-content: center; padding: 0; }

  /* Scrollable middle section */
  .nav-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 6px 0; }

  /* Section groups */
  .nav-group { padding: 4px 0; }

  .group-label {
    padding: 8px 14px 4px;
    font-family: var(--mono);
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--ink-faint);
    white-space: nowrap;
    overflow: hidden;
  }

  .group-divider {
    height: 1px;
    background: var(--line);
    margin: 4px 10px;
  }

  /* Nav items */
  .nav-item {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 36px;
    padding: 0 12px 0 14px;
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    border-left: 2px solid transparent;
    transition: background .1s, color .1s, border-color .1s;
    position: relative;
  }
  .nav-item:hover { background: var(--panel-2); color: var(--ink); }
  .nav-item.active {
    border-left-color: var(--amber);
    background: var(--amber-soft);
    color: var(--amber-deep);
  }
  .nav-item.active .nav-icon { stroke: var(--amber-deep); }

  .nav-icon { flex-shrink: 0; opacity: .75; transition: opacity .1s; }
  .nav-item:hover .nav-icon  { opacity: 1; }
  .nav-item.active .nav-icon { opacity: 1; }

  .nav-label { overflow: hidden; text-overflow: ellipsis; }

  /* Collapsed: center icons */
  .nav.collapsed .nav-item { padding: 0; justify-content: center; border-left: none; border-right: 2px solid transparent; }
  .nav.collapsed .nav-item.active { border-right-color: var(--amber); }

  /* Bottom section */
  .nav-foot { flex-shrink: 0; padding: 4px 0 8px; }

  /* ── Content area ─────────────────────────────────────────────────────── */
  .content { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
</style>
