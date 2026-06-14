<script>
  import { goalHistory, vendedorGoals, campaigns, orderHistory, metas, appUsers } from '../../lib/stores.js';
  import { nf, brl } from '../../lib/engine.js';

  let tab = 'metas'; // 'metas' | 'vendedor' | 'campanhas'

  // ── Month navigation (shared across tabs) ─────────────────────────────────
  const NOW = new Date();
  let selYear  = NOW.getFullYear();
  let selMonth = NOW.getMonth(); // 0-indexed

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  $: selKey   = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;
  $: isNow    = selYear === NOW.getFullYear() && selMonth === NOW.getMonth();
  $: isFuture = selYear > NOW.getFullYear() || (selYear === NOW.getFullYear() && selMonth > NOW.getMonth());

  function prevMon() { if (selMonth === 0) { selMonth = 11; selYear--; } else selMonth--; }
  function nextMon() { if (selMonth === 11) { selMonth = 0; selYear++; } else selMonth++; }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function pct(cur, meta) { return meta > 0 ? Math.min(cur / meta * 100, 100) : 0; }

  function goColor(p) {
    if (p >= 100) return 'var(--ok)';
    if (p >= 70)  return 'var(--amber)';
    return 'var(--danger)';
  }
  function pctBg(p) {
    if (p >= 100) return '#edfaf4'; if (p >= 70) return '#fffbeb';
    if (p > 0)    return '#fef2f2'; return 'transparent';
  }
  function pctFg(p) {
    if (p >= 100) return '#1a6b44'; if (p >= 70) return '#7c5a00';
    if (p > 0)    return '#991b1b'; return 'var(--ink-faint)';
  }

  function ordersForMonth(year, month) {
    return $orderHistory.filter(o => {
      const d = new Date(o.date || o.createdAt);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB: METAS (geral)
  // ══════════════════════════════════════════════════════════════════════════
  $: selGoal   = $goalHistory.find(g => g.month === selKey) ?? null;
  $: hasGoal   = selGoal && (selGoal.faturamento || selGoal.volume || selGoal.pedidos);
  $: selOrders = ordersForMonth(selYear, selMonth);
  $: selFat = selOrders.reduce((a, o) => a + (o.totV || 0), 0);
  $: selVol = selOrders.reduce((a, o) => a + (o.totW || 0), 0);
  $: selPed = selOrders.length;
  $: pctFat = selGoal ? pct(selFat, selGoal.faturamento) : 0;
  $: pctVol = selGoal ? pct(selVol, selGoal.volume)      : 0;
  $: pctPed = selGoal ? pct(selPed, selGoal.pedidos)     : 0;

  let editing = false;
  let form = { faturamento: '', volume: '', pedidos: '', positivacao: '' };

  function openEdit() {
    form = { faturamento: selGoal?.faturamento || '', volume: selGoal?.volume || '',
             pedidos: selGoal?.pedidos || '', positivacao: selGoal?.positivacao || '' };
    editing = true;
  }

  function saveGoal() {
    const entry = { id: selGoal?.id ?? Date.now(), month: selKey,
      faturamento: parseFloat(String(form.faturamento).replace(',', '.')) || 0,
      volume:      parseFloat(String(form.volume).replace(',', '.'))      || 0,
      pedidos:     parseInt(String(form.pedidos))    || 0,
      positivacao: parseInt(String(form.positivacao)) || 0 };
    goalHistory.update(list => {
      const idx = list.findIndex(g => g.month === selKey);
      if (idx >= 0) { const l = [...list]; l[idx] = entry; return l; }
      return [...list, entry];
    });
    if (isNow) $metas = { faturamento: entry.faturamento, volume: entry.volume,
                          pedidos: entry.pedidos, positivacao: entry.positivacao };
    editing = false;
  }

  // History rows (last 12 months, most recent first)
  $: historyRows = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const goal = $goalHistory.find(g => g.month === key);
    const ords = ordersForMonth(d.getFullYear(), d.getMonth());
    const fat = ords.reduce((a, o) => a + (o.totV || 0), 0);
    const vol = ords.reduce((a, o) => a + (o.totW || 0), 0);
    const ped = ords.length;
    return { key, label: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`,
             goal, fat, vol, ped,
             isCurrent: key === `${NOW.getFullYear()}-${String(NOW.getMonth()+1).padStart(2,'0')}` };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TAB: POR VENDEDOR
  // ══════════════════════════════════════════════════════════════════════════
  const FAMILIA_NAMES = {
    calha: 'Calha', u: 'Perfil U', ue: 'Perfil UE', cant: 'Cantoneira',
    z: 'Perfil Z', rufo: 'Rufo', ping: 'Pingadeira',
  };

  $: vendedores = ($appUsers || []).filter(u => u.role === 'vendedor' && u.ativo !== false);

  // Actual por vendedor para o mês selecionado
  function vdActual(user) {
    const ords = selOrders.filter(o =>
      (o.vendedor || '').toLowerCase() === (user.nome || '').toLowerCase());
    const fat = ords.reduce((a, o) => a + (o.totV || 0), 0);
    const vol = ords.reduce((a, o) => a + (o.totW || 0), 0);
    const ped = ords.length;
    const posit = new Set(ords.map(o => (o.cliente || '').toLowerCase()).filter(Boolean)).size;
    return { fat, vol, ped, posit };
  }

  function vdGoal(userId) {
    return $vendedorGoals.find(g => g.month === selKey && g.vendedorId === userId) ?? null;
  }

  // Mapa de editing por vendedor
  let vdEditing = {}; // { [userId]: true }
  let vdForms   = {}; // { [userId]: { faturamento, volume, pedidos, positivacao } }

  function openVdEdit(u) {
    const g = vdGoal(u.id);
    vdForms[u.id] = {
      faturamento: g?.faturamento || '',
      volume:      g?.volume      || '',
      pedidos:     g?.pedidos     || '',
      positivacao: g?.positivacao || '',
    };
    vdEditing = { ...vdEditing, [u.id]: true };
  }

  function closeVdEdit(uid) {
    vdEditing = { ...vdEditing, [uid]: false };
  }

  function saveVdGoal(u) {
    const f = vdForms[u.id] ?? {};
    const entry = {
      id:          vdGoal(u.id)?.id ?? Date.now(),
      month:       selKey,
      vendedorId:  u.id,
      faturamento: parseFloat(String(f.faturamento || '').replace(',', '.')) || 0,
      volume:      parseFloat(String(f.volume      || '').replace(',', '.')) || 0,
      pedidos:     parseInt(String(f.pedidos     || '')) || 0,
      positivacao: parseInt(String(f.positivacao || '')) || 0,
    };
    vendedorGoals.update(list => {
      const idx = list.findIndex(g => g.month === selKey && g.vendedorId === u.id);
      if (idx >= 0) { const l = [...list]; l[idx] = entry; return l; }
      return [...list, entry];
    });
    closeVdEdit(u.id);
  }

  // Família de perfis — breakdown para o mês selecionado
  $: familiaRows = (() => {
    const map = new Map();
    selOrders.forEach(o => {
      (o.itemsDetalhe || []).forEach(it => {
        const fam  = it.tipo || 'outros';
        const nome = FAMILIA_NAMES[fam] ?? (fam === 'outros' ? 'Outros' : 'Customizado');
        const cur  = map.get(fam) ?? { nome, fam, peso: 0, fat: 0, ped: 0 };
        cur.peso += it.peso || 0;
        cur.fat  += it.valor || 0;
        cur.ped  += 1;
        map.set(fam, cur);
      });
    });
    return [...map.values()].sort((a, b) => b.peso - a.peso);
  })();

  function initials(nome) { return (nome || '?').trim()[0]?.toUpperCase() ?? '?'; }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB: CAMPANHAS
  // ══════════════════════════════════════════════════════════════════════════
  const TIPOS = [
    { value: 'faturamento', label: 'Faturamento (R$)' },
    { value: 'volume',      label: 'Volume (kg)'       },
    { value: 'pedidos',     label: 'Qtd. de pedidos'   },
  ];

  const CAMP_DEF = { nome: '', descricao: '', dataInicio: '', dataFim: '',
                     tipo: 'faturamento', meta: '', premio: '', ativa: true };
  let campMode = false;
  let campForm = { ...CAMP_DEF };
  let campEditId = null;
  let campConfirmDel = null;

  function openNewCamp() {
    campForm = { ...CAMP_DEF, dataInicio: new Date().toISOString().slice(0, 10) };
    campEditId = null; campMode = true;
  }
  function openEditCamp(c) {
    campForm = { ...c, meta: c.meta || '', dataInicio: c.dataInicio || '', dataFim: c.dataFim || '' };
    campEditId = c.id; campMode = true;
  }
  function closeCamp() { campMode = false; campEditId = null; }
  function saveCamp() {
    const entry = { ...campForm, meta: parseFloat(String(campForm.meta).replace(',', '.')) || 0 };
    if (!campEditId) {
      campaigns.update(list => [{ ...entry, id: Date.now(), createdAt: new Date().toISOString() }, ...list]);
    } else {
      campaigns.update(list => list.map(c => c.id === campEditId ? { ...c, ...entry } : c));
    }
    closeCamp();
  }
  function deleteCamp(id) { campaigns.update(list => list.filter(c => c.id !== id)); campConfirmDel = null; }

  function campStatus(c) {
    if (!c.ativa) return { label: 'Pausada', cls: 'st-paused' };
    const today = new Date();
    if (c.dataFim && new Date(c.dataFim + 'T23:59:59') < today) return { label: 'Encerrada', cls: 'st-ended' };
    if (c.dataInicio && new Date(c.dataInicio) > today) return { label: 'Futura', cls: 'st-future' };
    return { label: 'Ativa', cls: 'st-active' };
  }
  function campProgress(c) {
    if (!c.dataInicio || !c.dataFim || !c.meta) return null;
    const start = new Date(c.dataInicio); start.setHours(0, 0, 0, 0);
    const end   = new Date(c.dataFim);   end.setHours(23, 59, 59, 999);
    const ords = $orderHistory.filter(o => {
      const d = new Date(o.date || o.createdAt); return d >= start && d <= end;
    });
    let val = 0;
    if (c.tipo === 'faturamento') val = ords.reduce((a, o) => a + (o.totV || 0), 0);
    else if (c.tipo === 'volume') val = ords.reduce((a, o) => a + (o.totW || 0), 0);
    else val = ords.length;
    return { val, pct: c.meta > 0 ? Math.min(val / c.meta * 100, 100) : 0 };
  }
  function fmtVal(c, val) {
    if (c.tipo === 'faturamento') return brl(val);
    if (c.tipo === 'volume')      return nf(val, 0) + ' kg';
    return String(val);
  }
  function fmtDate(s) {
    if (!s) return '—';
    return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
</script>

<div class="page">
  <div class="page-hd">
    <div class="page-title">Metas &amp; Campanhas</div>
    <div class="tabs">
      <button class="tab" class:on={tab === 'metas'}     on:click={() => (tab = 'metas')}>Metas gerais</button>
      <button class="tab" class:on={tab === 'vendedor'}  on:click={() => (tab = 'vendedor')}>Por vendedor</button>
      <button class="tab" class:on={tab === 'campanhas'} on:click={() => (tab = 'campanhas')}>Campanhas</button>
    </div>
  </div>

  <div class="body">

    <!-- ══════════════════════════════════════════════════ METAS GERAIS ══ -->
    {#if tab === 'metas'}

      <div class="card">
        <div class="card-hd">
          <div class="month-nav">
            <button class="nav-btn" on:click={prevMon}>&#8249;</button>
            <span class="month-label">
              {MONTHS[selMonth]} {selYear}
              {#if isNow}<span class="now-chip">Mês atual</span>{/if}
            </span>
            <button class="nav-btn" on:click={nextMon}>&#8250;</button>
          </div>
          {#if !editing}
            <button class="icon-btn" on:click={openEdit} title="Editar meta">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none"
                   stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M11 2.5l2.5 2.5-8.5 8.5H2.5V11L11 2.5z"/>
              </svg>
            </button>
          {/if}
        </div>

        {#if editing}
          <div class="goal-form">
            <div class="gf-grid">
              <label class="gf-field"><span>Faturamento (R$)</span>
                <input class="inp" bind:value={form.faturamento} type="number" min="0" placeholder="ex: 80000" /></label>
              <label class="gf-field"><span>Volume / Peso (kg)</span>
                <input class="inp" bind:value={form.volume} type="number" min="0" placeholder="ex: 15000" /></label>
              <label class="gf-field"><span>Pedidos</span>
                <input class="inp" bind:value={form.pedidos} type="number" min="0" placeholder="ex: 30" /></label>
              <label class="gf-field"><span>Positivação (clientes)</span>
                <input class="inp" bind:value={form.positivacao} type="number" min="0" placeholder="ex: 20" /></label>
            </div>
            <div class="gf-actions">
              <button class="btn line" on:click={() => (editing = false)}>Cancelar</button>
              <button class="btn amber" on:click={saveGoal}>Salvar meta</button>
            </div>
          </div>
        {:else if hasGoal}
          <div class="goal-progress">
            {#if selGoal.faturamento > 0}
              <div class="gp-row">
                <span class="gp-label">Faturamento</span>
                <div class="gp-bar-wrap"><div class="gp-bar" style="width:{pctFat}%;background:{goColor(pctFat)}"></div></div>
                <span class="gp-pct" style="color:{goColor(pctFat)}">{nf(pctFat,0)}%</span>
                <span class="gp-vals">{brl(selFat)} / {brl(selGoal.faturamento)}</span>
              </div>
            {/if}
            {#if selGoal.volume > 0}
              <div class="gp-row">
                <span class="gp-label">Peso</span>
                <div class="gp-bar-wrap"><div class="gp-bar" style="width:{pctVol}%;background:{goColor(pctVol)}"></div></div>
                <span class="gp-pct" style="color:{goColor(pctVol)}">{nf(pctVol,0)}%</span>
                <span class="gp-vals">{nf(selVol,0)} / {nf(selGoal.volume,0)} kg</span>
              </div>
            {/if}
            {#if selGoal.pedidos > 0}
              <div class="gp-row">
                <span class="gp-label">Pedidos</span>
                <div class="gp-bar-wrap"><div class="gp-bar" style="width:{pctPed}%;background:{goColor(pctPed)}"></div></div>
                <span class="gp-pct" style="color:{goColor(pctPed)}">{nf(pctPed,0)}%</span>
                <span class="gp-vals">{selPed} / {selGoal.pedidos}</span>
              </div>
            {/if}
          </div>
        {:else}
          <p class="card-empty">
            {isFuture ? 'Meta não definida para' : 'Sem meta em'}
            {MONTHS[selMonth]} {selYear}.
            <button class="link-btn" on:click={openEdit}>Definir →</button>
          </p>
        {/if}
      </div>

      <!-- History table -->
      <div class="card">
        <div class="card-hd"><span class="card-title">Histórico — últimos 12 meses</span></div>
        <div class="tbl-wrap">
          <table class="hist-tbl">
            <thead>
              <tr>
                <th>Mês</th>
                <th class="r">Fat. real</th><th class="r">Meta fat.</th><th class="r pct-col">%</th>
                <th class="r">Peso real</th><th class="r">Meta peso</th><th class="r pct-col">%</th>
                <th class="r">Pedidos</th><th class="r">Meta ped.</th><th class="r pct-col">%</th>
              </tr>
            </thead>
            <tbody>
              {#each historyRows as row (row.key)}
                {@const pF = row.goal?.faturamento > 0 ? pct(row.fat, row.goal.faturamento) : null}
                {@const pV = row.goal?.volume > 0      ? pct(row.vol, row.goal.volume)      : null}
                {@const pP = row.goal?.pedidos > 0     ? pct(row.ped, row.goal.pedidos)     : null}
                <tr class:cur={row.isCurrent}>
                  <td class="row-month">{row.label}</td>
                  <td class="r mono">{brl(row.fat)}</td>
                  <td class="r mono muted">{row.goal?.faturamento > 0 ? brl(row.goal.faturamento) : '—'}</td>
                  <td class="r">{#if pF !== null}<span class="pct-chip" style="background:{pctBg(pF)};color:{pctFg(pF)}">{nf(pF,0)}%</span>{:else}—{/if}</td>
                  <td class="r mono">{nf(row.vol,0)}</td>
                  <td class="r mono muted">{row.goal?.volume > 0 ? nf(row.goal.volume,0) : '—'}</td>
                  <td class="r">{#if pV !== null}<span class="pct-chip" style="background:{pctBg(pV)};color:{pctFg(pV)}">{nf(pV,0)}%</span>{:else}—{/if}</td>
                  <td class="r mono">{row.ped}</td>
                  <td class="r mono muted">{row.goal?.pedidos > 0 ? row.goal.pedidos : '—'}</td>
                  <td class="r">{#if pP !== null}<span class="pct-chip" style="background:{pctBg(pP)};color:{pctFg(pP)}">{nf(pP,0)}%</span>{:else}—{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

    <!-- ════════════════════════════════════════════════ POR VENDEDOR ══ -->
    {:else if tab === 'vendedor'}

      <!-- Month nav -->
      <div class="month-bar">
        <button class="nav-btn" on:click={prevMon}>&#8249;</button>
        <span class="month-label">
          {MONTHS[selMonth]} {selYear}
          {#if isNow}<span class="now-chip">Mês atual</span>{/if}
        </span>
        <button class="nav-btn" on:click={nextMon}>&#8250;</button>
      </div>

      {#if vendedores.length === 0}
        <div class="card">
          <p class="card-empty">
            Nenhum vendedor cadastrado ainda.
            <a href="#admin" class="link-btn">Cadastrar em Admin →</a>
          </p>
        </div>
      {:else}
        <!-- Cards por vendedor -->
        {#each vendedores as u (u.id)}
          {@const actual = vdActual(u)}
          {@const goal   = vdGoal(u.id)}
          {@const isEditing = !!vdEditing[u.id]}
          {@const f = vdForms[u.id] ?? {}}
          <div class="card vd-card">
            <div class="card-hd">
              <div class="vd-identity">
                <div class="vd-avatar">{initials(u.nome)}</div>
                <div>
                  <div class="vd-nome">{u.nome}</div>
                  {#if u.codigo}<div class="vd-code">Cód. {u.codigo}</div>{/if}
                </div>
              </div>
              {#if !isEditing}
                <button class="icon-btn" on:click={() => openVdEdit(u)} title="Definir meta">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none"
                       stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <path d="M11 2.5l2.5 2.5-8.5 8.5H2.5V11L11 2.5z"/>
                  </svg>
                </button>
              {/if}
            </div>

            {#if isEditing}
              <div class="goal-form">
                <div class="gf-grid">
                  <label class="gf-field"><span>Faturamento (R$)</span>
                    <input class="inp" bind:value={vdForms[u.id].faturamento} type="number" min="0" placeholder="ex: 25000" /></label>
                  <label class="gf-field"><span>Peso / Volume (kg)</span>
                    <input class="inp" bind:value={vdForms[u.id].volume} type="number" min="0" placeholder="ex: 5000" /></label>
                  <label class="gf-field"><span>Pedidos</span>
                    <input class="inp" bind:value={vdForms[u.id].pedidos} type="number" min="0" placeholder="ex: 10" /></label>
                  <label class="gf-field"><span>Positivação (clientes únicos)</span>
                    <input class="inp" bind:value={vdForms[u.id].positivacao} type="number" min="0" placeholder="ex: 8" /></label>
                </div>
                <div class="gf-actions">
                  <button class="btn line" on:click={() => closeVdEdit(u.id)}>Cancelar</button>
                  <button class="btn amber" on:click={() => saveVdGoal(u)}>Salvar</button>
                </div>
              </div>
            {:else}
              <div class="goal-progress">
                <!-- Faturamento -->
                <div class="gp-row">
                  <span class="gp-label">Faturamento</span>
                  <div class="gp-bar-wrap">
                    {#if goal?.faturamento > 0}
                      <div class="gp-bar" style="width:{pct(actual.fat,goal.faturamento)}%;background:{goColor(pct(actual.fat,goal.faturamento))}"></div>
                    {:else}
                      <div class="gp-bar no-goal"></div>
                    {/if}
                  </div>
                  {#if goal?.faturamento > 0}
                    <span class="gp-pct" style="color:{goColor(pct(actual.fat,goal.faturamento))}">{nf(pct(actual.fat,goal.faturamento),0)}%</span>
                    <span class="gp-vals">{brl(actual.fat)} / {brl(goal.faturamento)}</span>
                  {:else}
                    <span class="gp-vals muted">{brl(actual.fat)}<span class="no-goal-lbl"> — sem meta</span></span>
                  {/if}
                </div>
                <!-- Peso -->
                <div class="gp-row">
                  <span class="gp-label">Peso</span>
                  <div class="gp-bar-wrap">
                    {#if goal?.volume > 0}
                      <div class="gp-bar" style="width:{pct(actual.vol,goal.volume)}%;background:{goColor(pct(actual.vol,goal.volume))}"></div>
                    {:else}
                      <div class="gp-bar no-goal"></div>
                    {/if}
                  </div>
                  {#if goal?.volume > 0}
                    <span class="gp-pct" style="color:{goColor(pct(actual.vol,goal.volume))}">{nf(pct(actual.vol,goal.volume),0)}%</span>
                    <span class="gp-vals">{nf(actual.vol,0)} / {nf(goal.volume,0)} kg</span>
                  {:else}
                    <span class="gp-vals muted">{nf(actual.vol,0)} kg<span class="no-goal-lbl"> — sem meta</span></span>
                  {/if}
                </div>
                <!-- Pedidos -->
                <div class="gp-row">
                  <span class="gp-label">Pedidos</span>
                  <div class="gp-bar-wrap">
                    {#if goal?.pedidos > 0}
                      <div class="gp-bar" style="width:{pct(actual.ped,goal.pedidos)}%;background:{goColor(pct(actual.ped,goal.pedidos))}"></div>
                    {:else}
                      <div class="gp-bar no-goal"></div>
                    {/if}
                  </div>
                  {#if goal?.pedidos > 0}
                    <span class="gp-pct" style="color:{goColor(pct(actual.ped,goal.pedidos))}">{nf(pct(actual.ped,goal.pedidos),0)}%</span>
                    <span class="gp-vals">{actual.ped} / {goal.pedidos}</span>
                  {:else}
                    <span class="gp-vals muted">{actual.ped} pedido{actual.ped !== 1 ? 's' : ''}<span class="no-goal-lbl"> — sem meta</span></span>
                  {/if}
                </div>
                <!-- Positivação -->
                <div class="gp-row">
                  <span class="gp-label">Positivação</span>
                  <div class="gp-bar-wrap">
                    {#if goal?.positivacao > 0}
                      <div class="gp-bar" style="width:{pct(actual.posit,goal.positivacao)}%;background:{goColor(pct(actual.posit,goal.positivacao))}"></div>
                    {:else}
                      <div class="gp-bar no-goal"></div>
                    {/if}
                  </div>
                  {#if goal?.positivacao > 0}
                    <span class="gp-pct" style="color:{goColor(pct(actual.posit,goal.positivacao))}">{nf(pct(actual.posit,goal.positivacao),0)}%</span>
                    <span class="gp-vals">{actual.posit} / {goal.positivacao} clientes</span>
                  {:else}
                    <span class="gp-vals muted">{actual.posit} cliente{actual.posit !== 1 ? 's' : ''}<span class="no-goal-lbl"> — sem meta</span></span>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/each}

        <!-- Família de perfis — breakdown real do mês -->
        {#if familiaRows.length > 0}
          <div class="card">
            <div class="card-hd">
              <span class="card-title">Resultado por família de perfis — {MONTHS[selMonth]}</span>
            </div>
            <div class="tbl-wrap">
              <table class="hist-tbl">
                <thead>
                  <tr>
                    <th>Família</th>
                    <th class="r">Peso (kg)</th>
                    <th class="r">Faturamento</th>
                    <th class="r">Itens</th>
                  </tr>
                </thead>
                <tbody>
                  {#each familiaRows as row}
                    <tr>
                      <td>{row.nome}</td>
                      <td class="r mono">{nf(row.peso, 0)}</td>
                      <td class="r mono">{brl(row.fat)}</td>
                      <td class="r mono">{row.ped}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else if !isFuture}
          <div class="card">
            <p class="card-empty">Nenhum pedido registrado em {MONTHS[selMonth]} {selYear}.</p>
          </div>
        {/if}
      {/if}

    <!-- ══════════════════════════════════════════════════ CAMPANHAS ══ -->
    {:else}

      <div class="camp-head">
        <span class="camp-count">
          {$campaigns.length === 0 ? 'Nenhuma campanha' :
           $campaigns.length === 1 ? '1 campanha' : `${$campaigns.length} campanhas`}
        </span>
        <button class="btn amber sm" on:click={openNewCamp}>+ Nova campanha</button>
      </div>

      {#if $campaigns.length === 0}
        <div class="card"><p class="card-empty">Nenhuma campanha criada ainda.</p></div>
      {:else}
        <div class="camp-list">
          {#each $campaigns as c (c.id)}
            {@const st   = campStatus(c)}
            {@const prog = campProgress(c)}
            <div class="camp-card">
              <div class="cc-hd">
                <div class="cc-info">
                  <span class="cc-name">{c.nome}</span>
                  {#if c.descricao}<span class="cc-desc">{c.descricao}</span>{/if}
                </div>
                <span class="st-badge {st.cls}">{st.label}</span>
              </div>
              <div class="cc-chips">
                <span class="chip">{c.tipo === 'faturamento' ? 'Fat.' : c.tipo === 'volume' ? 'Vol.' : 'Pedidos'} · meta {fmtVal(c, c.meta)}</span>
                <span class="chip">{fmtDate(c.dataInicio)} → {fmtDate(c.dataFim)}</span>
                {#if c.premio}<span class="chip chip-prize">Premio: {c.premio}</span>{/if}
              </div>
              {#if prog}
                <div class="cc-prog">
                  <div class="cp-track"><div class="cp-fill" style="width:{prog.pct}%;background:{goColor(prog.pct)}"></div></div>
                  <span class="cp-lbl">{fmtVal(c, prog.val)} · {nf(prog.pct,0)}%</span>
                </div>
              {/if}
              <div class="cc-foot">
                <button class="btn-sm" on:click={() => openEditCamp(c)}>Editar</button>
                {#if campConfirmDel === c.id}
                  <span class="del-confirm">Excluir?</span>
                  <button class="btn-sm btn-del" on:click={() => deleteCamp(c.id)}>Sim</button>
                  <button class="btn-sm" on:click={() => (campConfirmDel = null)}>Não</button>
                {:else}
                  <button class="btn-sm" on:click={() => (campConfirmDel = c.id)}>Excluir</button>
                {/if}
                <span style="flex:1"></span>
                <button class="btn-sm"
                  on:click={() => campaigns.update(list => list.map(x => x.id === c.id ? {...x,ativa:!x.ativa} : x))}>
                  {c.ativa ? 'Pausar' : 'Reativar'}
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Campaign modal -->
{#if campMode}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-back" on:click|self={closeCamp}>
    <div class="modal">
      <div class="modal-hd">
        <span class="modal-title">{campEditId ? 'Editar campanha' : 'Nova campanha'}</span>
        <button class="modal-close" on:click={closeCamp}>×</button>
      </div>
      <div class="modal-body">
        <label class="mf"><span>Nome da campanha *</span>
          <input class="inp" bind:value={campForm.nome} placeholder="Ex.: Sprint de Junho" /></label>
        <label class="mf"><span>Descrição <em>(opcional)</em></span>
          <input class="inp" bind:value={campForm.descricao} placeholder="Bata a meta e ganhe..." /></label>
        <div class="mf-row">
          <label class="mf"><span>Início</span>
            <input class="inp" type="date" bind:value={campForm.dataInicio} /></label>
          <label class="mf"><span>Término</span>
            <input class="inp" type="date" bind:value={campForm.dataFim} /></label>
        </div>
        <div class="mf-row">
          <label class="mf"><span>Tipo de meta</span>
            <select class="inp" bind:value={campForm.tipo}>
              {#each TIPOS as t}<option value={t.value}>{t.label}</option>{/each}
            </select></label>
          <label class="mf"><span>Valor da meta</span>
            <input class="inp" type="number" min="0" bind:value={campForm.meta} placeholder="ex: 50000" /></label>
        </div>
        <label class="mf"><span>Prêmio / recompensa <em>(opcional)</em></span>
          <input class="inp" bind:value={campForm.premio} placeholder="Ex.: Voucher R$ 500, viagem..." /></label>
      </div>
      <div class="modal-ft">
        <button class="btn line" on:click={closeCamp}>Cancelar</button>
        <button class="btn amber" on:click={saveCamp} disabled={!campForm.nome.trim()}>
          {campEditId ? 'Salvar alterações' : 'Criar campanha'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page    { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .page-hd { display: flex; align-items: center; gap: 16px; padding: 14px 24px;
             border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .page-title { font-size: 16px; font-weight: 600; }
  .tabs  { display: flex; gap: 2px; }
  .tab   { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px;
           font-weight: 500; background: none; border: 1px solid transparent;
           cursor: pointer; color: var(--ink-soft); }
  .tab.on { background: var(--panel-2); border-color: var(--line); color: var(--ink); }
  .tab:hover:not(.on) { background: var(--panel-2); }

  .body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }

  /* ── Card ─────────────────────────────────────────────────────────────── */
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r);
          padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .card-hd { display: flex; align-items: center; justify-content: space-between; }
  .card-title { font-size: 13px; font-weight: 600; }
  .card-empty { margin: 0; color: var(--ink-soft); font-size: 13.5px; }
  .link-btn { background: none; border: none; cursor: pointer; color: var(--amber-deep);
              font-size: 13.5px; font-weight: 500; padding: 0; text-decoration: none; }
  a.link-btn:visited { color: var(--amber-deep); }

  /* ── Month nav ───────────────────────────────────────────────────────────── */
  .month-nav, .month-bar { display: flex; align-items: center; gap: 10px; }
  .month-bar { padding: 4px 0; }
  .nav-btn   { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--line);
               background: var(--panel); cursor: pointer; font-size: 16px;
               color: var(--ink-soft); display: flex; align-items: center; justify-content: center; }
  .nav-btn:hover { background: var(--panel-2); color: var(--ink); }
  .month-label { font-size: 14px; font-weight: 600; min-width: 160px; display: flex;
                 align-items: center; gap: 8px; }
  .now-chip  { font-size: 10.5px; font-weight: 500; background: var(--amber-soft);
               color: var(--amber-deep); border-radius: 4px; padding: 2px 6px; }
  .icon-btn  { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--line);
               background: var(--panel); cursor: pointer; display: flex; align-items: center;
               justify-content: center; color: var(--ink-soft); }
  .icon-btn:hover { background: var(--panel-2); color: var(--ink); }

  /* ── Goal edit form ────────────────────────────────────────────────────── */
  .goal-form { display: flex; flex-direction: column; gap: 14px; }
  .gf-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .gf-field  { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px;
               font-weight: 500; color: var(--ink-soft); }
  .gf-actions { display: flex; gap: 8px; padding-top: 4px; }

  /* ── Goal progress bars ─────────────────────────────────────────────────── */
  .goal-progress { display: flex; flex-direction: column; gap: 12px; }
  .gp-row     { display: flex; align-items: center; gap: 10px; }
  .gp-label   { font-size: 12.5px; font-weight: 500; color: var(--ink-soft);
                width: 88px; flex-shrink: 0; }
  .gp-bar-wrap { flex: 1; height: 7px; background: var(--panel-3); border-radius: 4px; overflow: hidden; }
  .gp-bar      { height: 100%; border-radius: 4px; transition: width .3s; }
  .gp-bar.no-goal { width: 0; }
  .gp-pct      { font-size: 12px; font-weight: 600; font-family: var(--mono);
                 width: 34px; text-align: right; flex-shrink: 0; }
  .gp-vals     { font-size: 11.5px; color: var(--ink-soft); font-family: var(--mono); white-space: nowrap; }
  .gp-vals.muted { color: var(--ink-faint); }
  .no-goal-lbl { color: var(--ink-faint); font-style: italic; }

  /* ── Vendedor cards ─────────────────────────────────────────────────────── */
  .vd-card { }
  .vd-identity { display: flex; align-items: center; gap: 10px; }
  .vd-avatar   { width: 36px; height: 36px; border-radius: 50%; background: var(--panel-2);
                 border: 1px solid var(--line); display: flex; align-items: center;
                 justify-content: center; font-size: 14px; font-weight: 700;
                 color: var(--ink-soft); flex-shrink: 0; }
  .vd-nome     { font-size: 14px; font-weight: 600; }
  .vd-code     { font-size: 11.5px; color: var(--ink-faint); font-family: var(--mono); }

  /* ── History table ──────────────────────────────────────────────────────── */
  .tbl-wrap { overflow-x: auto; }
  .hist-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .hist-tbl th { font-family: var(--mono); font-size: 10px; text-transform: uppercase;
                 letter-spacing: .4px; color: var(--ink-faint); padding: 6px 8px;
                 font-weight: 500; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .hist-tbl td { padding: 7px 8px; border-top: 1px solid var(--line); white-space: nowrap; }
  .hist-tbl tr.cur td { background: var(--amber-soft); }
  .hist-tbl .r { text-align: right; }
  .row-month { font-weight: 500; }
  .mono  { font-family: var(--mono); font-size: 12px; }
  .muted { color: var(--ink-faint); }
  .pct-col { min-width: 54px; }
  .pct-chip { display: inline-block; border-radius: 4px; padding: 1px 6px;
              font-size: 11.5px; font-weight: 600; font-family: var(--mono); }

  /* ── Campaigns ──────────────────────────────────────────────────────────── */
  .camp-head { display: flex; align-items: center; justify-content: space-between; }
  .camp-count { font-size: 12.5px; color: var(--ink-soft); }
  .camp-list { display: flex; flex-direction: column; gap: 10px; }
  .camp-card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r);
               padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
  .cc-hd  { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .cc-info { display: flex; flex-direction: column; gap: 3px; }
  .cc-name { font-size: 14px; font-weight: 600; }
  .cc-desc { font-size: 12.5px; color: var(--ink-soft); }
  .st-badge  { font-size: 11px; font-weight: 600; border-radius: 4px; padding: 3px 8px; white-space: nowrap; flex-shrink: 0; }
  .st-active  { background: #edfaf4; color: #1a6b44; }
  .st-paused  { background: var(--panel-2); color: var(--ink-soft); }
  .st-ended   { background: var(--panel-2); color: var(--ink-faint); }
  .st-future  { background: #eff6ff; color: #1d4ed8; }
  .cc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip      { font-size: 11.5px; background: var(--panel-2); border: 1px solid var(--line);
               border-radius: 5px; padding: 2px 8px; color: var(--ink-soft); }
  .chip-prize { color: var(--amber-deep); background: var(--amber-soft); border-color: transparent; }
  .cc-prog  { display: flex; align-items: center; gap: 10px; }
  .cp-track { flex: 1; height: 6px; background: var(--panel-3); border-radius: 3px; overflow: hidden; }
  .cp-fill  { height: 100%; border-radius: 3px; }
  .cp-lbl   { font-size: 11.5px; color: var(--ink-soft); font-family: var(--mono); white-space: nowrap; }
  .cc-foot  { display: flex; align-items: center; gap: 6px; border-top: 1px solid var(--line); padding-top: 10px; }
  .del-confirm { font-size: 12px; color: var(--danger); font-weight: 500; }
  .btn-sm  { height: 28px; padding: 0 12px; border-radius: 6px; font-size: 12.5px; font-weight: 500;
             background: var(--panel); border: 1px solid var(--line); cursor: pointer; color: var(--ink); }
  .btn-sm:hover { background: var(--panel-2); }
  .btn-del { color: var(--danger); border-color: #e05252; }
  .btn-del:hover { background: #fff4f4; }

  /* ── Shared ──────────────────────────────────────────────────────────────── */
  .inp { height: 34px; border: 1px solid var(--line); border-radius: 6px;
         padding: 0 10px; font-size: 13px; background: var(--panel); width: 100%; box-sizing: border-box; }
  .inp:focus { outline: none; border-color: var(--amber); }
  .btn { height: 34px; padding: 0 16px; border-radius: 7px; font-weight: 500;
         font-size: 13px; border: 1px solid transparent; cursor: pointer; }
  .btn.sm { height: 30px; font-size: 12.5px; padding: 0 12px; }
  .amber { background: var(--amber); color: #fff; border-color: var(--amber); }
  .amber:hover { background: #d67d12; }
  .amber:disabled { opacity: .5; cursor: not-allowed; }
  .line  { background: var(--panel); border-color: var(--line); color: var(--ink); }
  .line:hover { background: var(--panel-2); }

  /* ── Modal ───────────────────────────────────────────────────────────────── */
  .modal-back { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex;
                align-items: center; justify-content: center; z-index: 100; }
  .modal { background: var(--panel); border-radius: 10px; width: 480px; max-width: 95vw;
           box-shadow: 0 8px 32px rgba(0,0,0,.18); display: flex; flex-direction: column;
           max-height: 90vh; overflow: hidden; }
  .modal-hd  { display: flex; align-items: center; justify-content: space-between;
               padding: 16px 20px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .modal-title { font-size: 15px; font-weight: 600; }
  .modal-close { width: 28px; height: 28px; border: none; background: none; cursor: pointer;
                 font-size: 18px; color: var(--ink-soft); border-radius: 6px; }
  .modal-close:hover { background: var(--panel-2); }
  .modal-body { flex: 1; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }
  .modal-ft  { display: flex; gap: 8px; justify-content: flex-end;
               padding: 14px 20px; border-top: 1px solid var(--line); flex-shrink: 0; }
  .mf  { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px;
         font-weight: 500; color: var(--ink-soft); flex: 1; }
  .mf em { font-style: normal; font-weight: 400; color: var(--ink-faint); }
  .mf-row { display: flex; gap: 12px; }
</style>
