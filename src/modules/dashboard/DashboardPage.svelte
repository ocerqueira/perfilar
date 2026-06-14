<script>
  import {
    order, ctx, companyInfo, regions, regionId,
    commissionRule, orders, orderHistory, metas, currentUser,
  } from '../../lib/stores.js';
  import { nf, brl } from '../../lib/engine.js';
  import { priceFor } from '../../lib/pricing.js';
  import { commissionForItem, DEFAULT_RULE } from '../../lib/commission.js';

  // ── Período ───────────────────────────────────────────────────────────────
  let period = 'month';

  const PERIODS = [
    { key: 'today',      label: 'Hoje'       },
    { key: 'week',       label: 'Semana'     },
    { key: 'month',      label: 'Mês'        },
    { key: 'prev-month', label: 'Mês ant.'   },
    { key: 'quarter',    label: 'Trimestre'  },
  ];

  function getRange(p) {
    const now = new Date();
    switch (p) {
      case 'today':
        return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now };
      case 'week': {
        const s = new Date(now); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
        return { start: s, end: now };
      }
      case 'month':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
      case 'prev-month':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          end:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
        };
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3) * 3;
        return { start: new Date(now.getFullYear(), q, 1), end: now };
      }
      default: return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }
  }

  function getPrevRange(p) {
    const now = new Date();
    switch (p) {
      case 'today': {
        const s = new Date(now); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0);
        const e = new Date(s); e.setHours(23, 59, 59, 999);
        return { start: s, end: e };
      }
      case 'week': {
        const s = new Date(now); s.setDate(s.getDate() - 13); s.setHours(0, 0, 0, 0);
        const e = new Date(now); e.setDate(e.getDate() - 7);  e.setHours(23, 59, 59, 999);
        return { start: s, end: e };
      }
      case 'month':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          end:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
        };
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3) * 3;
        return {
          start: new Date(now.getFullYear(), q - 3, 1),
          end:   new Date(now.getFullYear(), q, 0, 23, 59, 59, 999),
        };
      }
      default: return null;
    }
  }

  function inRange(iso, r) {
    if (!r) return false;
    const d = new Date(iso);
    return d >= r.start && d <= r.end;
  }

  $: range       = getRange(period);
  $: prevRange   = getPrevRange(period);
  $: filtered    = $orderHistory.filter(o => inRange(o.date, range));
  $: prevFiltered = $orderHistory.filter(o => inRange(o.date, prevRange));

  // ── KPIs ──────────────────────────────────────────────────────────────────
  $: kpiFat    = filtered.reduce((a, o) => a + o.totV, 0);
  $: kpiVol    = filtered.reduce((a, o) => a + o.totW, 0);
  $: kpiPed    = filtered.length;
  $: kpiTicket = kpiPed > 0 ? kpiFat / kpiPed : 0;
  $: kpiComm   = filtered.reduce((a, o) => a + (o.comm || 0), 0);

  $: prevFat = prevFiltered.reduce((a, o) => a + o.totV, 0);
  $: prevVol = prevFiltered.reduce((a, o) => a + o.totW, 0);
  $: prevPed = prevFiltered.length;

  function delta(cur, prev) {
    if (prev === 0 || period === 'prev-month') return null;
    return ((cur - prev) / prev) * 100;
  }
  $: dFat = delta(kpiFat, prevFat);
  $: dVol = delta(kpiVol, prevVol);
  $: dPed = delta(kpiPed, prevPed);

  // ── Metas mensais ─────────────────────────────────────────────────────────
  $: monthRange  = getRange('month');
  $: monthOrders = $orderHistory.filter(o => inRange(o.date, monthRange));
  $: monthFat    = monthOrders.reduce((a, o) => a + o.totV, 0);
  $: monthVol    = monthOrders.reduce((a, o) => a + o.totW, 0);
  $: monthPed    = monthOrders.length;
  $: hasMetas    = $metas.faturamento > 0 || $metas.volume > 0 || $metas.pedidos > 0;

  function pctMeta(cur, meta) { return meta > 0 ? Math.min((cur / meta) * 100, 100) : 0; }
  $: pctFat = pctMeta(monthFat, $metas.faturamento);
  $: pctVol = pctMeta(monthVol, $metas.volume);
  $: pctPed = pctMeta(monthPed, $metas.pedidos);

  function metaColor(p, hasMeta) {
    if (!hasMeta) return 'var(--steel)';
    if (p >= 100) return 'var(--ok)';
    if (p >= 70)  return 'var(--amber)';
    return 'var(--danger)';
  }

  // ── Meta proporcional (dias úteis) ────────────────────────────────────────
  function countWorkingDays(from, to) {
    let count = 0;
    const cur = new Date(from); cur.setHours(0, 0, 0, 0);
    const end = new Date(to);   end.setHours(23, 59, 59, 999);
    while (cur <= end) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  $: _now        = new Date();
  $: _monthEnd   = new Date(_now.getFullYear(), _now.getMonth() + 1, 0);
  $: _monthStart = new Date(_now.getFullYear(), _now.getMonth(), 1);
  $: totalWD     = countWorkingDays(_monthStart, _monthEnd);
  $: remainingWD = countWorkingDays(_now, _monthEnd);    // inclui hoje se for dia útil

  $: dailyNeededFat = remainingWD > 0 ? Math.max(0, ($metas.faturamento - monthFat) / remainingWD) : 0;
  $: dailyNeededVol = remainingWD > 0 ? Math.max(0, ($metas.volume      - monthVol) / remainingWD) : 0;
  $: dailyNeededPed = remainingWD > 0 ? Math.max(0, ($metas.pedidos     - monthPed) / remainingWD) : 0;

  $: dailyBaseFat = totalWD > 0 ? $metas.faturamento / totalWD : 0;
  $: dailyBaseVol = totalWD > 0 ? $metas.volume      / totalWD : 0;
  $: dailyBasePed = totalWD > 0 ? $metas.pedidos     / totalWD : 0;

  function duLabel(n) { return n === 1 ? '1 dia útil restante' : `${n} dias úteis restantes`; }

  // ── Metas — edição inline ─────────────────────────────────────────────────
  let editingMetas = false;
  let md = { faturamento: '', volume: '', pedidos: '' };
  function openMetas() {
    md = {
      faturamento: $metas.faturamento || '',
      volume:      $metas.volume      || '',
      pedidos:     $metas.pedidos     || '',
    };
    editingMetas = true;
  }
  function saveMetas() {
    $metas = {
      faturamento: parseFloat(String(md.faturamento).replace(',', '.')) || 0,
      volume:      parseFloat(String(md.volume).replace(',', '.'))      || 0,
      pedidos:     parseInt(md.pedidos)                                  || 0,
    };
    editingMetas = false;
  }

  // ── Gráfico de faturamento ────────────────────────────────────────────────
  const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  function buildBars(p) {
    const now = new Date();
    const r   = getRange(p);
    const all = $orderHistory;

    if (p === 'today') {
      return Array.from({ length: 24 }, (_, h) => {
        const val = all.filter(o => inRange(o.date, r) && new Date(o.date).getHours() === h)
          .reduce((a, o) => a + o.totV, 0);
        return { label: h % 6 === 0 ? `${h}h` : '', val };
      });
    }
    if (p === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d  = new Date(now); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
        const de = new Date(d); de.setHours(23, 59, 59, 999);
        const val = all.filter(o => inRange(o.date, { start: d, end: de }))
          .reduce((a, o) => a + o.totV, 0);
        return { label: DAYS_PT[d.getDay()], val };
      });
    }
    if (p === 'month' || p === 'prev-month') {
      const { start } = r;
      const days = p === 'month'
        ? now.getDate()
        : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const d  = new Date(start.getFullYear(), start.getMonth(), i + 1);
        const de = new Date(start.getFullYear(), start.getMonth(), i + 1, 23, 59, 59, 999);
        const val = all.filter(o => inRange(o.date, { start: d, end: de }))
          .reduce((a, o) => a + o.totV, 0);
        return { label: (i + 1) % 5 === 1 ? String(i + 1) : '', val };
      });
    }
    if (p === 'quarter') {
      const { start } = r;
      const bars = [];
      let cur = new Date(start);
      let week = 1;
      while (cur <= now) {
        const ws = new Date(cur);
        const we = new Date(cur); we.setDate(we.getDate() + 6); we.setHours(23, 59, 59, 999);
        const val = all.filter(o => inRange(o.date, { start: ws, end: we }))
          .reduce((a, o) => a + o.totV, 0);
        bars.push({ label: `S${week}`, val });
        cur.setDate(cur.getDate() + 7);
        week++;
      }
      return bars;
    }
    return [];
  }

  $: bars     = buildBars(period);
  $: barMax   = Math.max(...bars.map(b => b.val), 1);
  $: svgW     = bars.length * 18;
  $: hasData  = $orderHistory.length > 0;

  // ── Pedido em andamento ───────────────────────────────────────────────────
  $: items    = $order.items;
  $: hasOrder = items.length > 0;
  $: orderTotW = items.reduce((a, it) => a + it.C.tot, 0);
  $: orderTotV = items.reduce((a, it) => {
    const p = priceFor($regions, $regionId, it.params.matName, it.params.revest);
    return a + it.C.tot * p.custo * (1 + it.params.mg / 100);
  }, 0);
  $: orderComm = items.reduce((a, it) => {
    const p = priceFor($regions, $regionId, it.params.matName, it.params.revest);
    const custoTotal = it.C.tot * p.custo;
    const precoTotal = custoTotal * (1 + it.params.mg / 100);
    return a + commissionForItem({ ...it, custoTotal, precoTotal }, $commissionRule);
  }, 0);

  // ── Registro com formulário ───────────────────────────────────────────────
  const TIPOS_CLIENTE = [
    { value: '',               label: 'Não informado'          },
    { value: 'construtora',   label: 'Construtora / Empreiteira' },
    { value: 'revendedor',    label: 'Revendedor / Distribuidor' },
    { value: 'industrial',    label: 'Industrial / Fabricante'   },
    { value: 'pessoa_fisica', label: 'Pessoa Física'             },
    { value: 'outro',         label: 'Outro'                     },
  ];
  const VALIDADE_OPTS = [7, 15, 30, 60];

  let registering = false;
  let regForm = { tipo: 'pedido', validadeDias: 30, tipoCliente: '', cidade: '' };

  function confirmarRegistro() {
    const dataValidade = regForm.tipo === 'orcamento'
      ? new Date(Date.now() + regForm.validadeDias * 86400000).toISOString()
      : null;
    const itemsDetalhe = items.map(it => {
      const p = priceFor($regions, $regionId, it.params.matName, it.params.revest);
      const custoTotal = it.C.tot * p.custo;
      const precoTotal = custoTotal * (1 + it.params.mg / 100);
      return {
        key:   it.key   || 'custom',
        label: it.label || it.key || 'Perfil',
        mat:   it.params.matName,
        totW:  it.C.tot,
        totV:  precoTotal,
        comm:  commissionForItem({ ...it, custoTotal, precoTotal }, $commissionRule),
      };
    });
    const now      = new Date().toISOString();
    const entry = {
      id:           Date.now(),
      createdAt:    now,
      updatedAt:    now,
      status:       regForm.tipo,
      dataValidade,
      dataPedido:   regForm.tipo === 'pedido' ? now : null,
      cliente:      $ctx.cliente  || '—',
      orc:          $ctx.orc      || '—',
      vendedor:     $ctx.vendedor || '—',
      obs:          $ctx.obs      || '',
      tipoCliente:  regForm.tipoCliente,
      cidade:       regForm.cidade,
      region:       $regionId,
      items:        items.length,
      totW:         orderTotW,
      totV:         orderTotV,
      comm:         orderComm,
      itemsDetalhe,
      orderItems: [...items],
    };
    orders.update(list => [entry, ...list]);
    if (regForm.tipo === 'pedido') {
      orderHistory.update(h => [{ ...entry, date: now }, ...h]);
    }
    order.set({ items: [], sel: -1 });
    ctx.set({ cliente: '', orc: '', vendedor: '', obs: '' });
    registering = false;
  }

  // ── Alertas ───────────────────────────────────────────────────────────────
  const _today = new Date();

  $: orcVencidos = $orders.filter(o =>
    o.status === 'orcamento' && o.dataValidade && new Date(o.dataValidade) < _today
  );
  $: orcAVencer = $orders.filter(o => {
    if (o.status !== 'orcamento' || !o.dataValidade) return false;
    const diff = (new Date(o.dataValidade) - _today) / 86400000;
    return diff >= 0 && diff <= 3;
  });
  $: metaEmRisco = (() => {
    const diasNoMes = new Date(_today.getFullYear(), _today.getMonth() + 1, 0).getDate();
    const ritmo = _today.getDate() / diasNoMes;
    if (ritmo < 0.4) return [];
    const r = [];
    if ($metas.faturamento > 0 && pctFat < ritmo * 100 * 0.75) r.push('Faturamento');
    if ($metas.volume > 0      && pctVol < ritmo * 100 * 0.75) r.push('Volume');
    if ($metas.pedidos > 0     && pctPed < ritmo * 100 * 0.75) r.push('Pedidos');
    return r;
  })();
  $: metasBatidas = [
    $metas.faturamento > 0 && pctFat >= 100 && 'Faturamento',
    $metas.volume > 0      && pctVol >= 100 && 'Volume',
    $metas.pedidos > 0     && pctPed >= 100 && 'Pedidos',
  ].filter(Boolean);
  $: hasAlerts = orcVencidos.length > 0 || orcAVencer.length > 0 || metaEmRisco.length > 0 || metasBatidas.length > 0;

  // ── Setup ─────────────────────────────────────────────────────────────────
  $: setupItems = [
    { label: 'Nome da empresa',                 ok: !!$companyInfo.nome,  href: '#settings' },
    { label: 'Logo para documentos',            ok: !!$companyInfo.logo,  href: '#settings' },
    { label: 'Regra de comissão personalizada', ok: JSON.stringify($commissionRule) !== JSON.stringify(DEFAULT_RULE), href: '#pricing' },
  ];
  $: setupDone    = setupItems.filter(s => s.ok).length;
  $: setupAllDone = setupDone === setupItems.length;

  // ── Utilitários ───────────────────────────────────────────────────────────
  function greet() {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }
  $: greetName = $currentUser.nome || $companyInfo.nome || '';

  const ROLE_LABEL = { admin: 'Admin', gerente: 'Gerente Comercial', gestor: 'Gestor', vendedor: 'Vendedor', assistente: 'Assistente' };
  function fmtDelta(d) {
    if (d === null) return null;
    return (d >= 0 ? '▲ ' : '▼ ') + nf(Math.abs(d), 1) + '%';
  }
  const dtFmt = iso => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
</script>

<div class="page">

  <!-- ── Header ──────────────────────────────────────────────────────────── -->
  <div class="page-hd">
    <div class="greeting-wrap">
      <span class="greeting">{greet()}{greetName ? `, ${greetName}` : ''}</span>
      <span class="role-badge">{ROLE_LABEL[$currentUser.role] ?? $currentUser.role}</span>
    </div>
    <div class="period-bar">
      {#each PERIODS as p}
        <button
          class="period-btn"
          class:on={period === p.key}
          on:click={() => (period = p.key)}
        >{p.label}</button>
      {/each}
    </div>
  </div>

  <div class="body">

    <!-- ── Alertas ──────────────────────────────────────────────────────── -->
    {#if hasAlerts}
      <div class="alerts">
        {#each metasBatidas as m}
          <div class="alert ok">✓ Meta de <b>{m}</b> atingida este mês!</div>
        {/each}
        {#each metaEmRisco as m}
          <div class="alert warn">Meta de <b>{m}</b> abaixo do ritmo esperado para o período.</div>
        {/each}
        {#each orcAVencer as o}
          <div class="alert warn">Orçamento <b>{o.orc}</b> — {o.cliente} vence em {dtFmt(o.dataValidade)}.</div>
        {/each}
        {#each orcVencidos as o}
          <div class="alert danger">Orçamento <b>{o.orc}</b> — {o.cliente} venceu em {dtFmt(o.dataValidade)}.</div>
        {/each}
      </div>
    {/if}

    <!-- ── KPI cards ───────────────────────────────────────────────────── -->
    <div class="kpi-grid">

      <div class="kpi-card">
        <span class="kpi-label">Faturamento</span>
        <span class="kpi-val">{brl(kpiFat)}</span>
        {#if fmtDelta(dFat) !== null}
          <span class="kpi-delta" class:pos={dFat >= 0} class:neg={dFat < 0}>{fmtDelta(dFat)}</span>
        {:else}
          <span class="kpi-delta-empty"> </span>
        {/if}
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Volume</span>
        <span class="kpi-val">{nf(kpiVol, 0)} <small>kg</small></span>
        {#if fmtDelta(dVol) !== null}
          <span class="kpi-delta" class:pos={dVol >= 0} class:neg={dVol < 0}>{fmtDelta(dVol)}</span>
        {:else}
          <span class="kpi-delta-empty"> </span>
        {/if}
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Pedidos</span>
        <span class="kpi-val">{kpiPed}</span>
        {#if fmtDelta(dPed) !== null}
          <span class="kpi-delta" class:pos={dPed >= 0} class:neg={dPed < 0}>{fmtDelta(dPed)}</span>
        {:else}
          <span class="kpi-delta-empty"> </span>
        {/if}
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Ticket médio</span>
        <span class="kpi-val">{kpiPed > 0 ? brl(kpiTicket) : '—'}</span>
        <span class="kpi-delta-empty"> </span>
      </div>

      <div class="kpi-card accent">
        <span class="kpi-label">Comissão estimada</span>
        <span class="kpi-val">{brl(kpiComm)}</span>
        <span class="kpi-delta-empty"> </span>
      </div>

    </div>

    <!-- ── Meta do mês ──────────────────────────────────────────────────── -->
    <div class="card">
      <div class="card-hd">
        <span class="card-title">Meta do mês</span>
        <button class="icon-btn" on:click={openMetas} title="Configurar metas">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42"/>
          </svg>
        </button>
      </div>

      {#if editingMetas}
        <div class="meta-form">
          <label class="meta-field">
            <span>Faturamento (R$)</span>
            <input class="inp" bind:value={md.faturamento} placeholder="ex: 80000" />
          </label>
          <label class="meta-field">
            <span>Volume (kg)</span>
            <input class="inp" bind:value={md.volume} placeholder="ex: 15000" />
          </label>
          <label class="meta-field">
            <span>Pedidos</span>
            <input class="inp" bind:value={md.pedidos} placeholder="ex: 30" />
          </label>
          <div class="meta-actions">
            <button class="btn line" on:click={() => (editingMetas = false)}>Cancelar</button>
            <button class="btn amber" on:click={saveMetas}>Salvar metas</button>
          </div>
        </div>
      {:else if hasMetas}
        <div class="meta-rows">
          {#if $metas.faturamento > 0}
            <div class="meta-item">
              <div class="meta-row">
                <span class="mr-label">Faturamento</span>
                <div class="mr-bar-wrap">
                  <div class="mr-bar" style="width:{pctFat}%;background:{metaColor(pctFat,true)}"></div>
                </div>
                <span class="mr-pct" style="color:{metaColor(pctFat,true)}">{nf(pctFat,0)}%</span>
                <span class="mr-vals">{brl(monthFat)} / {brl($metas.faturamento)}</span>
              </div>
              <div class="mr-sub">
                {#if pctFat >= 100}
                  <span class="mr-sub-ok">✓ Meta atingida</span>
                {:else if remainingWD > 0}
                  Precisa de <b>{brl(dailyNeededFat)}/dia útil</b>
                  <span class="mr-sub-base"> · base {brl(dailyBaseFat)}/dia · {duLabel(remainingWD)}</span>
                {:else}
                  <span class="mr-sub-risk">Sem dias úteis restantes neste mês</span>
                {/if}
              </div>
            </div>
          {/if}
          {#if $metas.volume > 0}
            <div class="meta-item">
              <div class="meta-row">
                <span class="mr-label">Volume</span>
                <div class="mr-bar-wrap">
                  <div class="mr-bar" style="width:{pctVol}%;background:{metaColor(pctVol,true)}"></div>
                </div>
                <span class="mr-pct" style="color:{metaColor(pctVol,true)}">{nf(pctVol,0)}%</span>
                <span class="mr-vals">{nf(monthVol,0)} / {nf($metas.volume,0)} kg</span>
              </div>
              <div class="mr-sub">
                {#if pctVol >= 100}
                  <span class="mr-sub-ok">✓ Meta atingida</span>
                {:else if remainingWD > 0}
                  Precisa de <b>{nf(dailyNeededVol, 0)} kg/dia útil</b>
                  <span class="mr-sub-base"> · base {nf(dailyBaseVol, 0)} kg/dia · {duLabel(remainingWD)}</span>
                {:else}
                  <span class="mr-sub-risk">Sem dias úteis restantes neste mês</span>
                {/if}
              </div>
            </div>
          {/if}
          {#if $metas.pedidos > 0}
            <div class="meta-item">
              <div class="meta-row">
                <span class="mr-label">Pedidos</span>
                <div class="mr-bar-wrap">
                  <div class="mr-bar" style="width:{pctPed}%;background:{metaColor(pctPed,true)}"></div>
                </div>
                <span class="mr-pct" style="color:{metaColor(pctPed,true)}">{nf(pctPed,0)}%</span>
                <span class="mr-vals">{monthPed} / {$metas.pedidos}</span>
              </div>
              <div class="mr-sub">
                {#if pctPed >= 100}
                  <span class="mr-sub-ok">✓ Meta atingida</span>
                {:else if remainingWD > 0}
                  Precisa de <b>{nf(dailyNeededPed, 1)} pedidos/dia útil</b>
                  <span class="mr-sub-base"> · base {nf(dailyBasePed, 1)}/dia · {duLabel(remainingWD)}</span>
                {:else}
                  <span class="mr-sub-risk">Sem dias úteis restantes neste mês</span>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <p class="card-empty">
          Sem metas configuradas. <button class="link-btn" on:click={openMetas}>Definir agora →</button>
        </p>
      {/if}
    </div>

    <!-- ── Gráfico de faturamento ───────────────────────────────────────── -->
    <div class="card">
      <div class="card-hd">
        <span class="card-title">Faturamento — {PERIODS.find(p => p.key === period)?.label}</span>
      </div>
      {#if hasData && bars.some(b => b.val > 0)}
        <div class="chart-wrap">
          <svg class="chart-svg" viewBox="0 0 {svgW} 60" preserveAspectRatio="none">
            {#each bars as bar, i}
              {@const bh = (bar.val / barMax) * 54}
              <rect
                x={i * 18 + 1}
                y={56 - bh}
                width="16"
                height={bh}
                fill={bar.val > 0 ? 'var(--amber)' : 'var(--panel-3)'}
                rx="2"
              />
            {/each}
          </svg>
          <div class="chart-labels" style="grid-template-columns:repeat({bars.length},1fr)">
            {#each bars as bar}
              <span>{bar.label}</span>
            {/each}
          </div>
        </div>
      {:else}
        <p class="card-empty">Nenhum pedido registrado no período.</p>
      {/if}
    </div>

    <!-- ── Pedidos recentes ─────────────────────────────────────────────── -->
    <div class="card">
      <div class="card-hd">
        <span class="card-title">Pedidos recentes</span>
        <span class="card-count">{filtered.length}</span>
      </div>
      {#if filtered.length > 0}
        <table class="orders-tbl">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Orç.</th>
              <th class="r">Itens</th>
              <th class="r">Peso kg</th>
              <th class="r">Valor</th>
              <th class="r">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {#each filtered.slice(0, 10) as o}
              <tr>
                <td class="mono">{dtFmt(o.date)}</td>
                <td><span class="status-tag" class:orc={o.status === 'orcamento'}>{o.status === 'orcamento' ? 'Orç.' : 'Ped.'}</span></td>
                <td>{o.cliente}</td>
                <td class="mono">{o.orc}</td>
                <td class="r">{o.items}</td>
                <td class="r mono">{nf(o.totW, 1)}</td>
                <td class="r mono">{brl(o.totV)}</td>
                <td class="r mono comm">{brl(o.comm || 0)}</td>
              </tr>
            {/each}
          </tbody>
          {#if filtered.length > 1}
            <tfoot>
              <tr>
                <td colspan="4" class="ft-label">Total do período</td>
                <td class="r mono">{nf(kpiVol, 1)}</td>
                <td class="r mono"><b>{brl(kpiFat)}</b></td>
                <td class="r mono comm"><b>{brl(kpiComm)}</b></td>
              </tr>
            </tfoot>
          {/if}
        </table>
        {#if filtered.length > 10}
          <p class="table-more">+{filtered.length - 10} pedidos não exibidos</p>
        {/if}
      {:else}
        <p class="card-empty">Nenhum pedido no período selecionado.</p>
      {/if}
    </div>

    <!-- ── Pedido em andamento ──────────────────────────────────────────── -->
    {#if hasOrder}
      <div class="card order-active">
        <div class="card-hd">
          <span class="card-title">Pedido em andamento</span>
          <div class="order-chips">
            {#if $ctx.cliente}<span class="chip"><b>Cliente</b> {$ctx.cliente}</span>{/if}
            {#if $ctx.orc}   <span class="chip"><b>Orç.</b> {$ctx.orc}</span>{/if}
          </div>
        </div>
        <div class="order-stats">
          <div class="ostat"><span class="osv">{items.length}</span><span class="osl">{items.length === 1 ? 'item' : 'itens'}</span></div>
          <div class="osdiv"></div>
          <div class="ostat"><span class="osv">{nf(orderTotW,1)}</span><span class="osl">kg</span></div>
          <div class="osdiv"></div>
          <div class="ostat"><span class="osv">{brl(orderTotV)}</span><span class="osl">valor estimado</span></div>
          <div class="osdiv"></div>
          <div class="ostat"><span class="osv comm">{brl(orderComm)}</span><span class="osl">comissão</span></div>
        </div>
        {#if registering}
          <div class="reg-form">
            <div class="reg-tipo">
              <label class="radio-opt" class:on={regForm.tipo === 'pedido'}>
                <input type="radio" bind:group={regForm.tipo} value="pedido" /> Pedido fechado
              </label>
              <label class="radio-opt" class:on={regForm.tipo === 'orcamento'}>
                <input type="radio" bind:group={regForm.tipo} value="orcamento" /> Orçamento
              </label>
            </div>
            {#if regForm.tipo === 'orcamento'}
              <div class="reg-validade">
                <span class="reg-lbl">Validade</span>
                {#each VALIDADE_OPTS as d}
                  <button class="val-btn" class:on={regForm.validadeDias === d} on:click={() => (regForm.validadeDias = d)}>{d}d</button>
                {/each}
                <input class="inp inp-sm" type="number" bind:value={regForm.validadeDias} min="1" style="width:52px" />
              </div>
            {/if}
            <div class="reg-row">
              <label class="reg-field">
                <span class="reg-lbl">Tipo de cliente</span>
                <select class="inp" bind:value={regForm.tipoCliente}>
                  {#each TIPOS_CLIENTE as t}<option value={t.value}>{t.label}</option>{/each}
                </select>
              </label>
              <label class="reg-field">
                <span class="reg-lbl">Cidade</span>
                <input class="inp" bind:value={regForm.cidade} placeholder="São Paulo" />
              </label>
            </div>
            <div class="order-actions">
              <button class="btn line" on:click={() => (registering = false)}>Cancelar</button>
              <button class="btn amber" on:click={confirmarRegistro}>Confirmar registro</button>
            </div>
          </div>
        {:else}
          <div class="order-actions">
            <a href="#editor" class="btn line">Continuar no editor</a>
            <button class="btn amber" on:click={() => (registering = true)}>Registrar →</button>
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── Setup ────────────────────────────────────────────────────────── -->
    {#if !setupAllDone}
      <div class="card">
        <div class="card-hd">
          <span class="card-title">Configuração</span>
          <span class="card-count">{setupDone}/{setupItems.length}</span>
        </div>
        <div class="setup-list">
          {#each setupItems as s}
            <a href={s.href} class="setup-row" class:ok={s.ok}>
              <span class="setup-icon">{s.ok ? '✓' : '○'}</span>
              <span class="setup-label">{s.label}</span>
              {#if !s.ok}<span class="setup-hint">{s.href === '#settings' ? 'Configurações' : 'Preços'} →</span>{/if}
            </a>
          {/each}
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  .page    { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  /* Header */
  .page-hd {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
    gap: 12px; padding: 14px 24px; border-bottom: 1px solid var(--line); flex-shrink: 0;
  }
  .greeting-wrap { display: flex; align-items: center; gap: 10px; }
  .greeting { font-size: 16px; font-weight: 600; }
  .role-badge {
    font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .5px;
    background: var(--amber-soft); color: var(--amber-deep); border: 1px solid #f5d9b0;
    border-radius: 5px; padding: 2px 8px;
  }
  .period-bar { display: flex; gap: 2px; background: var(--panel-2); border-radius: 7px; padding: 3px; }
  .period-btn {
    height: 28px; padding: 0 12px; border-radius: 5px; font-size: 12.5px; font-weight: 500;
    border: none; background: none; cursor: pointer; color: var(--ink-soft); white-space: nowrap;
  }
  .period-btn.on { background: var(--panel); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .period-btn:hover:not(.on) { color: var(--ink); }

  /* Scroll body */
  .body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }

  /* KPI grid */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .kpi-card {
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    padding: 16px 18px; display: flex; flex-direction: column; gap: 4px;
  }
  .kpi-card.accent { border-color: var(--amber); background: var(--amber-soft); }
  .kpi-label { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: var(--ink-faint); }
  .kpi-val   { font-size: 22px; font-weight: 700; color: var(--ink); line-height: 1.15; }
  .kpi-val small { font-size: 13px; font-weight: 500; }
  .kpi-delta { font-size: 11.5px; font-weight: 600; }
  .kpi-delta.pos { color: var(--ok); }
  .kpi-delta.neg { color: var(--danger); }
  .kpi-delta-empty { font-size: 11.5px; color: transparent; user-select: none; }

  /* Card genérico */
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; }
  .card-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .card-title { font-size: 13px; font-weight: 600; flex: 1; }
  .card-count {
    font-family: var(--mono); font-size: 11px; color: var(--ink-soft);
    background: var(--panel-2); border-radius: 10px; padding: 1px 8px;
  }
  .card-empty { font-size: 12.5px; color: var(--ink-faint); }
  .link-btn { background: none; border: none; cursor: pointer; color: var(--amber); font-size: inherit; padding: 0; }

  /* Ícone pequeno */
  .icon-btn { background: none; border: none; cursor: pointer; color: var(--ink-faint); padding: 2px; border-radius: 4px; display: flex; align-items: center; }
  .icon-btn:hover { color: var(--ink); background: var(--panel-2); }

  /* Meta form */
  .meta-form { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
  .meta-field { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--ink-soft); }
  .meta-field .inp { width: 140px; }
  .meta-actions { display: flex; gap: 8px; align-items: flex-end; padding-bottom: 0; }

  /* Meta progress */
  .meta-rows { display: flex; flex-direction: column; gap: 12px; }
  .meta-item { display: flex; flex-direction: column; gap: 5px; }
  .meta-row { display: grid; grid-template-columns: 90px 1fr 44px 140px; align-items: center; gap: 10px; }
  .mr-label { font-size: 12.5px; color: var(--ink-soft); }
  .mr-bar-wrap { height: 6px; background: var(--panel-2); border-radius: 3px; overflow: hidden; }
  .mr-bar { height: 100%; border-radius: 3px; transition: width .3s; }
  .mr-pct { font-size: 12px; font-weight: 700; text-align: right; font-family: var(--mono); }
  .mr-vals { font-size: 11.5px; color: var(--ink-faint); font-family: var(--mono); text-align: right; }
  .mr-sub { font-size: 11.5px; color: var(--ink-soft); padding-left: 100px; line-height: 1.4; }
  .mr-sub b { color: var(--ink); font-weight: 600; }
  .mr-sub-ok   { color: var(--ok); font-weight: 500; }
  .mr-sub-risk { color: var(--danger); }
  .mr-sub-base { color: var(--ink-faint); }

  /* Chart */
  .chart-wrap { display: flex; flex-direction: column; gap: 4px; }
  .chart-svg  { width: 100%; height: 60px; display: block; }
  .chart-labels {
    display: grid; font-family: var(--mono); font-size: 9px;
    color: var(--ink-faint); text-align: center;
  }

  /* Orders table */
  .orders-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .orders-tbl th {
    font-family: var(--mono); font-size: 10px; text-transform: uppercase;
    letter-spacing: .4px; color: var(--ink-faint); padding: 4px 6px;
    text-align: left; font-weight: 500; border-bottom: 1px solid var(--line);
  }
  .orders-tbl td { padding: 6px 6px; border-bottom: .5px solid var(--line); color: var(--ink); }
  .orders-tbl tbody tr:last-child td { border-bottom: none; }
  .orders-tbl tfoot td { padding: 8px 6px; font-size: 12px; color: var(--ink-soft); border-top: 1px solid var(--line); }
  .orders-tbl .ft-label { color: var(--ink-faint); font-size: 11px; }
  .orders-tbl .r { text-align: right; }
  .orders-tbl .mono { font-family: var(--mono); }
  .orders-tbl .comm { color: var(--amber-deep); }
  .table-more { font-size: 11.5px; color: var(--ink-faint); margin-top: 8px; text-align: center; }

  /* Pedido ativo */
  .order-active { border-left: 3px solid var(--amber); }
  .order-chips  { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    font-size: 12px; color: var(--ink-soft); background: var(--panel-2);
    border: 1px solid var(--line); border-radius: 5px; padding: 1px 7px;
  }
  .chip b { color: var(--ink); }
  .order-stats { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
  .ostat  { display: flex; flex-direction: column; }
  .osv    { font-size: 20px; font-weight: 700; line-height: 1.1; }
  .osv.comm { color: var(--amber-deep); }
  .osl    { font-size: 10.5px; color: var(--ink-faint); margin-top: 2px; }
  .osdiv  { width: 1px; height: 28px; background: var(--line); }
  .order-actions { display: flex; gap: 8px; }

  /* Setup */
  .setup-list { display: flex; flex-direction: column; gap: 2px; }
  .setup-row  {
    display: flex; align-items: center; gap: 10px; padding: 6px 10px;
    border-radius: 6px; text-decoration: none; transition: background .1s;
  }
  .setup-row:hover { background: var(--panel-2); }
  .setup-icon  { width: 16px; text-align: center; font-size: 12px; color: var(--ink-faint); flex-shrink: 0; }
  .setup-row.ok .setup-icon { color: var(--ok); }
  .setup-label { font-size: 13px; color: var(--ink); flex: 1; }
  .setup-row.ok .setup-label { color: var(--ink-soft); }
  .setup-hint  { font-size: 12px; color: var(--amber); }

  /* Alertas */
  .alerts { display: flex; flex-direction: column; gap: 6px; }
  .alert {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 14px; border-radius: 7px; font-size: 13px; border: 1px solid;
  }
  .alert.ok     { background: #edfaf4; border-color: #a3dfc0; color: #1a6b44; }
  .alert.warn   { background: #fffbeb; border-color: #fcd97a; color: #7c5a00; }
  .alert.danger { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }

  /* Status tag na tabela */
  .status-tag { font-family: var(--mono); font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--panel-2); color: var(--ink-soft); border: 1px solid var(--line); }
  .status-tag.orc { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }

  /* Formulário de registro */
  .reg-form { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
  .reg-tipo { display: flex; gap: 8px; }
  .radio-opt {
    display: flex; align-items: center; gap: 6px; padding: 7px 14px;
    border: 1px solid var(--line); border-radius: 7px; cursor: pointer; font-size: 13px;
    background: var(--panel); color: var(--ink-soft);
  }
  .radio-opt.on { border-color: var(--amber); background: var(--amber-soft); color: var(--amber-deep); font-weight: 500; }
  .radio-opt input { display: none; }
  .reg-validade { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .reg-lbl { font-size: 11.5px; color: var(--ink-soft); white-space: nowrap; }
  .val-btn { height: 28px; padding: 0 10px; border-radius: 5px; font-size: 12px; border: 1px solid var(--line); background: var(--panel); cursor: pointer; color: var(--ink-soft); }
  .val-btn.on { border-color: var(--amber); background: var(--amber-soft); color: var(--amber-deep); font-weight: 600; }
  .reg-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .reg-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 150px; }
  .inp-sm { padding: 0 6px; }

  /* Shared */
  .inp { height: 30px; border: 1px solid var(--line); border-radius: 5px; padding: 0 7px; font-size: 13px; background: var(--panel); box-sizing: border-box; }
  .inp:focus { outline: none; border-color: var(--amber); }
  .btn { height: 32px; padding: 0 14px; border-radius: 7px; font-size: 13px; font-weight: 500; border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; text-decoration: none; }
  .amber { background: var(--amber); color: #fff; border-color: var(--amber); }
  .amber:hover { background: #d67d12; }
  .line  { background: var(--panel); border-color: var(--line); color: var(--ink); }
  .line:hover { background: var(--panel-2); }
</style>
