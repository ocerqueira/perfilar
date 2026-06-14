<script>
  import { orderHistory, regions, metas } from '../../lib/stores.js';
  import { nf, brl } from '../../lib/engine.js';

  // ── Período ───────────────────────────────────────────────────────────────
  let period = 'month';
  const PERIODS = [
    { key: 'week',       label: 'Semana'   },
    { key: 'month',      label: 'Mês'      },
    { key: 'prev-month', label: 'Mês ant.' },
    { key: 'quarter',    label: 'Trimestre'},
    { key: 'all',        label: 'Tudo'     },
  ];

  function getRange(p) {
    const now = new Date();
    if (p === 'all')        return { start: new Date(0), end: now };
    if (p === 'week')       { const s = new Date(now); s.setDate(s.getDate()-6); s.setHours(0,0,0,0); return { start: s, end: now }; }
    if (p === 'month')      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    if (p === 'prev-month') return { start: new Date(now.getFullYear(), now.getMonth()-1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999) };
    if (p === 'quarter')    { const q = Math.floor(now.getMonth()/3)*3; return { start: new Date(now.getFullYear(), q, 1), end: now }; }
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }

  $: range    = getRange(period);
  $: filtered = $orderHistory.filter(o => { const d = new Date(o.date); return d >= range.start && d <= range.end; });
  $: isEmpty  = filtered.length === 0;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const regionName = id => $regions.find(r => r.id === id)?.nome ?? id ?? 'Sem região';
  const hpct       = (val, max) => max > 0 ? Math.max((val / max) * 100, 1.5) : 0;

  // ── Rank por Região ───────────────────────────────────────────────────────
  $: rankRegiao = (() => {
    const map = {};
    for (const o of filtered) {
      const k = o.region || '';
      if (!map[k]) map[k] = { id: k, nome: regionName(k), totV: 0, totW: 0, count: 0 };
      map[k].totV += o.totV; map[k].totW += o.totW; map[k].count++;
    }
    return Object.values(map).sort((a, b) => b.totV - a.totV);
  })();
  $: regiaoMax = rankRegiao[0]?.totV ?? 0;

  // ── Rank por Cidade ───────────────────────────────────────────────────────
  $: rankCidade = (() => {
    const map = {};
    for (const o of filtered) {
      const k = (o.cidade || '').trim() || 'Não informado';
      if (!map[k]) map[k] = { cidade: k, totV: 0, count: 0 };
      map[k].totV += o.totV; map[k].count++;
    }
    return Object.values(map).sort((a, b) => b.totV - a.totV).slice(0, 10);
  })();
  $: cidadeMax = rankCidade[0]?.totV ?? 0;

  // ── Vendas por Tipo de Perfil ─────────────────────────────────────────────
  $: rankPerfil = (() => {
    const map = {};
    for (const o of filtered) {
      if (o.itemsDetalhe?.length) {
        for (const it of o.itemsDetalhe) {
          const k = it.key || 'custom';
          if (!map[k]) map[k] = { label: it.label || k, totV: 0, totW: 0, count: 0 };
          map[k].totV += it.totV; map[k].totW += it.totW; map[k].count++;
        }
      } else {
        const k = '_legado';
        if (!map[k]) map[k] = { label: 'Sem detalhe', totV: 0, totW: 0, count: 0 };
        map[k].totV += o.totV; map[k].totW += o.totW; map[k].count += o.items || 1;
      }
    }
    return Object.values(map).sort((a, b) => b.totV - a.totV);
  })();
  $: perfilMax = rankPerfil[0]?.totV ?? 0;

  // ── Rank por Tipo de Cliente ──────────────────────────────────────────────
  const TIPO_LABEL = {
    construtora:  'Construtora / Empreiteira',
    revendedor:   'Revendedor / Distribuidor',
    industrial:   'Industrial / Fabricante',
    pessoa_fisica:'Pessoa Física',
    outro:        'Outro',
    '':           'Não informado',
  };
  $: rankTipoCliente = (() => {
    const map = {};
    for (const o of filtered) {
      const k = o.tipoCliente || '';
      if (!map[k]) map[k] = { label: TIPO_LABEL[k] ?? k, totV: 0, count: 0 };
      map[k].totV += o.totV; map[k].count++;
    }
    return Object.values(map).sort((a, b) => b.totV - a.totV);
  })();
  $: tipoMax = rankTipoCliente[0]?.totV ?? 0;

  // ── Curva ABC ─────────────────────────────────────────────────────────────
  function abcCurve(items, getVal, getLabel) {
    const sorted = [...items].sort((a, b) => getVal(b) - getVal(a));
    const total  = sorted.reduce((s, i) => s + getVal(i), 0);
    let cum = 0;
    return sorted.map(item => {
      cum += getVal(item);
      const pctAcum = total > 0 ? (cum / total) * 100 : 0;
      const pctProp = total > 0 ? (getVal(item) / total) * 100 : 0;
      return { label: getLabel(item), val: getVal(item), pctAcum, pctProp, cls: pctAcum <= 80 ? 'A' : pctAcum <= 95 ? 'B' : 'C' };
    });
  }
  $: abcProdutos = abcCurve(rankPerfil, i => i.totV, i => i.label);
  $: abcClientes = (() => {
    const map = {};
    for (const o of filtered) { const k = o.cliente || '—'; if (!map[k]) map[k] = { nome: k, totV: 0, count: 0 }; map[k].totV += o.totV; map[k].count++; }
    return abcCurve(Object.values(map), i => i.totV, i => i.nome);
  })();

  // ── Positivação ───────────────────────────────────────────────────────────
  $: novosClientes = (() => {
    const antes    = new Set($orderHistory.filter(o => new Date(o.date) < range.start).map(o => o.cliente));
    const noPer    = new Set(filtered.map(o => o.cliente).filter(c => c && c !== '—'));
    return [...noPer].filter(c => !antes.has(c));
  })();
  $: pctPositivacao = $metas.positivacao > 0
    ? Math.min((novosClientes.length / $metas.positivacao) * 100, 100)
    : null;
</script>

<div class="page">
  <div class="page-hd">
    <span class="page-title">Análises</span>
    <div class="period-bar">
      {#each PERIODS as p}
        <button class="period-btn" class:on={period === p.key} on:click={() => (period = p.key)}>{p.label}</button>
      {/each}
    </div>
  </div>

  {#if isEmpty}
    <div class="empty-state">
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" stroke-linecap="round">
        <rect x="6" y="28" width="8" height="14" rx="1"/><rect x="20" y="18" width="8" height="24" rx="1"/><rect x="34" y="8" width="8" height="34" rx="1"/>
        <path d="M4 44h40"/>
      </svg>
      <p>Nenhum pedido registrado no período.</p>
      <span>Registre pedidos pelo <a href="#dashboard">Dashboard</a> para ver as análises.</span>
    </div>
  {:else}
    <div class="body">

      <!-- ── Duas colunas: Região + Cidade ──────────────────────────────── -->
      <div class="two-col">

        <div class="card">
          <div class="card-hd"><span class="card-title">Faturamento por Região</span></div>
          <div class="hbars">
            {#each rankRegiao as r}
              <div class="hbar-row">
                <span class="hbar-label" title={r.nome}>{r.nome}</span>
                <div class="hbar-track">
                  <div class="hbar-fill amber" style="width:{hpct(r.totV, regiaoMax)}%"></div>
                </div>
                <span class="hbar-val">{brl(r.totV)}</span>
                <span class="hbar-sub">{r.count}p</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="card">
          <div class="card-hd">
            <span class="card-title">Faturamento por Cidade</span>
            <span class="card-note">top 10</span>
          </div>
          {#if rankCidade.every(c => c.cidade === 'Não informado')}
            <p class="hint-note">Informe a cidade ao registrar pedidos para ver este rank.</p>
          {:else}
            <div class="hbars">
              {#each rankCidade as c}
                <div class="hbar-row">
                  <span class="hbar-label" title={c.cidade}>{c.cidade}</span>
                  <div class="hbar-track">
                    <div class="hbar-fill steel" style="width:{hpct(c.totV, cidadeMax)}%"></div>
                  </div>
                  <span class="hbar-val">{brl(c.totV)}</span>
                  <span class="hbar-sub">{c.count}p</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      </div>

      <!-- ── Duas colunas: Perfil + Tipo de cliente ─────────────────────── -->
      <div class="two-col">

        <div class="card">
          <div class="card-hd"><span class="card-title">Vendas por Tipo de Perfil</span></div>
          <div class="hbars">
            {#each rankPerfil as p}
              <div class="hbar-row">
                <span class="hbar-label" title={p.label}>{p.label}</span>
                <div class="hbar-track">
                  <div class="hbar-fill amber" style="width:{hpct(p.totV, perfilMax)}%"></div>
                </div>
                <span class="hbar-val">{brl(p.totV)}</span>
                <span class="hbar-sub">{nf(p.totW,0)}kg</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="card">
          <div class="card-hd"><span class="card-title">Faturamento por Tipo de Cliente</span></div>
          <div class="hbars">
            {#each rankTipoCliente as t}
              <div class="hbar-row">
                <span class="hbar-label" title={t.label}>{t.label}</span>
                <div class="hbar-track">
                  <div class="hbar-fill steel" style="width:{hpct(t.totV, tipoMax)}%"></div>
                </div>
                <span class="hbar-val">{brl(t.totV)}</span>
                <span class="hbar-sub">{t.count}p</span>
              </div>
            {/each}
          </div>
        </div>

      </div>

      <!-- ── Positivação ────────────────────────────────────────────────── -->
      <div class="card">
        <div class="card-hd">
          <span class="card-title">Positivação — Novos Clientes</span>
          <span class="card-note">proxy por nome · vínculo a cadastro na Fatia 5</span>
        </div>
        <div class="positiv-row">
          <div class="positiv-num">
            <span class="pv">{novosClientes.length}</span>
            <span class="pl">novos no período{$metas.positivacao > 0 ? ` · meta ${$metas.positivacao}` : ''}</span>
          </div>
          {#if pctPositivacao !== null}
            <div class="positiv-bar-wrap">
              <div class="positiv-bar"
                style="width:{pctPositivacao}%;background:{pctPositivacao>=100?'var(--ok)':pctPositivacao>=70?'var(--amber)':'var(--danger)'}">
              </div>
            </div>
            <span class="positiv-pct">{nf(pctPositivacao,0)}%</span>
          {/if}
        </div>
        {#if novosClientes.length > 0}
          <div class="chip-list">
            {#each novosClientes as c}<span class="chip">{c}</span>{/each}
          </div>
        {/if}
      </div>

      <!-- ── Curva ABC — duas tabelas lado a lado ───────────────────────── -->
      <div class="two-col">

        <div class="card">
          <div class="card-hd"><span class="card-title">Curva ABC — Produtos</span></div>
          <table class="abc-tbl">
            <thead>
              <tr><th>Perfil</th><th class="r">Faturamento</th><th class="r">Part.%</th><th class="r">Acum.%</th><th>Cl.</th></tr>
            </thead>
            <tbody>
              {#each abcProdutos as row}
                <tr class="cls-row-{row.cls}">
                  <td class="label-td">{row.label}</td>
                  <td class="r mono">{brl(row.val)}</td>
                  <td class="r mono">{nf(row.pctProp,1)}%</td>
                  <td class="r mono">{nf(row.pctAcum,1)}%</td>
                  <td><span class="abc-badge cls-{row.cls}">{row.cls}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-hd">
            <span class="card-title">Curva ABC — Clientes</span>
            <span class="card-note">vínculo a cadastro na Fatia 5</span>
          </div>
          <table class="abc-tbl">
            <thead>
              <tr><th>Cliente</th><th class="r">Faturamento</th><th class="r">Part.%</th><th class="r">Acum.%</th><th>Cl.</th></tr>
            </thead>
            <tbody>
              {#each abcClientes as row}
                <tr class="cls-row-{row.cls}">
                  <td class="label-td">{row.label}</td>
                  <td class="r mono">{brl(row.val)}</td>
                  <td class="r mono">{nf(row.pctProp,1)}%</td>
                  <td class="r mono">{nf(row.pctAcum,1)}%</td>
                  <td><span class="abc-badge cls-{row.cls}">{row.cls}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  {/if}
</div>

<style>
  .page    { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  /* Header */
  .page-hd { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 14px 24px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .page-title { font-size: 16px; font-weight: 600; }
  .period-bar { display: flex; gap: 2px; background: var(--panel-2); border-radius: 7px; padding: 3px; }
  .period-btn { height: 28px; padding: 0 12px; border-radius: 5px; font-size: 12.5px; font-weight: 500; border: none; background: none; cursor: pointer; color: var(--ink-soft); }
  .period-btn.on { background: var(--panel); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.08); }

  /* Empty global */
  .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--ink-faint); }
  .empty-state p { font-size: 15px; font-weight: 500; color: var(--ink-soft); }
  .empty-state span { font-size: 13px; }
  .empty-state a { color: var(--amber); text-decoration: none; }

  /* Body */
  .body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }

  /* Grid */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }

  /* Card */
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; }
  .card-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .card-title { font-size: 13px; font-weight: 600; flex: 1; }
  .card-note { font-size: 10.5px; color: var(--ink-faint); font-family: var(--mono); }
  .hint-note { font-size: 12px; color: var(--ink-faint); }

  /* Barras horizontais */
  .hbars { display: flex; flex-direction: column; gap: 9px; }
  .hbar-row { display: grid; grid-template-columns: 130px 1fr 76px 36px; align-items: center; gap: 8px; }
  .hbar-label { font-size: 12px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hbar-track { height: 8px; background: var(--panel-3); border-radius: 4px; overflow: hidden; }
  .hbar-fill  { height: 100%; border-radius: 4px; transition: width .35s ease; min-width: 2px; }
  .hbar-fill.amber { background: var(--amber); }
  .hbar-fill.steel { background: var(--steel); }
  .hbar-val { font-family: var(--mono); font-size: 11.5px; color: var(--ink); text-align: right; white-space: nowrap; }
  .hbar-sub { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); text-align: right; }

  /* Positivação */
  .positiv-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
  .positiv-num { display: flex; flex-direction: column; }
  .pv { font-size: 32px; font-weight: 700; line-height: 1; color: var(--ink); }
  .pl { font-size: 11.5px; color: var(--ink-faint); margin-top: 3px; }
  .positiv-bar-wrap { flex: 1; height: 8px; background: var(--panel-3); border-radius: 4px; overflow: hidden; min-width: 80px; }
  .positiv-bar { height: 100%; border-radius: 4px; transition: width .35s; }
  .positiv-pct { font-family: var(--mono); font-size: 14px; font-weight: 700; color: var(--ink); }
  .chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 12px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 5px; padding: 2px 9px; color: var(--ink-soft); }

  /* Tabelas ABC */
  .abc-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .abc-tbl thead tr { border-bottom: 1.5px solid var(--line); }
  .abc-tbl th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--ink-faint); padding: 4px 6px; text-align: left; font-weight: 500; }
  .abc-tbl td { padding: 6px 6px; border-bottom: .5px solid var(--line); }
  .abc-tbl tbody tr:last-child td { border-bottom: none; }
  .abc-tbl .r    { text-align: right; }
  .abc-tbl .mono { font-family: var(--mono); }
  .label-td { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Row highlight por classe */
  .cls-row-A { background: #f0fdf4; }
  .cls-row-B { background: #fefce8; }

  /* Badge ABC */
  .abc-badge { font-family: var(--mono); font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 4px; display: inline-block; }
  .cls-A { background: #dcfce7; color: #166534; }
  .cls-B { background: #fef9c3; color: #854d0e; }
  .cls-C { background: var(--panel-3); color: var(--ink-faint); }
</style>
