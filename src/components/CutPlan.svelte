<script>
  import { createEventDispatcher } from 'svelte';
  import { packSheets, PALETTE } from '../lib/cutplan.js';
  import { nf } from '../lib/engine.js';
  import { companyInfo, printConfig } from '../lib/stores.js';

  export let group;  // { label, entries: [{it, i}], totKg }
  export let ctx;    // { cliente, orc }

  const dispatch = createEventDispatcher();

  $: p0      = group.entries[0].it.params;
  $: isChapa = p0.forma === 'chapa';
  $: refilo  = p0.refilo || 0;
  $: espac   = p0.espac  || 0;
  $: sheet   = { w: p0.chapaL, h: p0.chapaC };

  $: pieces = group.entries.map((e, idx) => ({
    des:   e.it.C.des,
    C:     e.it.params.C,
    Q:     e.it.params.Q,
    label: e.it.label,
    pcKg:  e.it.C.pcLiq,
    totKg: e.it.C.totLiq,
    ...PALETTE[idx % PALETTE.length],
  }));

  $: result   = isChapa ? packSheets(sheet, refilo, espac, pieces) : null;
  $: labelMap = Object.fromEntries(pieces.map((p, i) => [p.label, i + 1]));

  // Dados por chapa (cortes, sobras, etc.)
  $: bySheet = result
    ? Array.from({ length: result.sheetCount }, (_, si) => {
        const placements = result.placements.filter(p => p.si === si);
        const shelves    = result.sheetShelves[si];
        const hCuts = shelves.slice(0, -1).map(s => s.y + s.height);
        const vCuts = shelves.flatMap(shelf => {
          const inShelf = placements.filter(p => p.y === shelf.y).sort((a, b) => a.x - b.x);
          return inShelf.map(p => ({ x: p.x + p.w, y1: shelf.y, y2: shelf.y + shelf.height }));
        });
        const wastes = shelves.map(shelf => {
          const lastX = placements
            .filter(p => p.y === shelf.y)
            .reduce((m, p) => Math.max(m, p.x + p.w), refilo);
          return { x: lastX, y: shelf.y, w: sheet.w - refilo - lastX, h: shelf.height };
        }).filter(w => w.w > 0);
        const bottomY = shelves.length
          ? shelves[shelves.length - 1].y + shelves[shelves.length - 1].height
          : refilo;
        const bottomH = sheet.h - refilo - bottomY;
        return { placements, shelves, hCuts, vCuts, wastes, bottomY, bottomH };
      })
    : [];

  // Agrupa chapas com layout idêntico para economizar páginas
  $: sheetGroups = (() => {
    const groups = [];
    bySheet.forEach((sd, si) => {
      const sig = JSON.stringify(
        sd.placements.map(p => `${p.x},${p.y},${p.w},${p.h},${p.label}`)
      );
      const existing = groups.find(g => g.sig === sig);
      if (existing) {
        existing.indices.push(si + 1);
      } else {
        groups.push({ sig, sd, indices: [si + 1] });
      }
    });
    return groups;
  })();

  // Totais
  $: usedMM2   = pieces.reduce((a, p) => a + p.des * p.C * p.Q, 0);
  $: totMM2    = result ? result.sheetCount * sheet.w * sheet.h : 0;
  $: aprPct    = totMM2 > 0 ? usedMM2 / totMM2 * 100 : 0;
  $: wasteM2   = (totMM2 - usedMM2) / 1e6;
  $: sheetM2   = totMM2 / 1e6;
  $: totalKg   = pieces.reduce((a, p) => a + p.totKg, 0);
  $: totalPcs  = pieces.reduce((a, p) => a + p.Q, 0);
  $: totalMlm  = pieces.reduce((a, p) => a + p.Q * p.C / 1000, 0);
  $: today     = new Date().toLocaleDateString('pt-BR');

  // Proporção para o SVG (escala de tela — no print usa 100% via CSS)
  const MAX_W = 640, MAX_H = 460;
  $: aspect  = sheet.h / sheet.w;
  $: svgMaxW = Math.min(MAX_W, MAX_H / aspect);   // px máximo na tela

  // Traços em unidades viewBox (mm)
  $: sw     = Math.max(sheet.w * 0.003, 1);
  $: cutSw  = Math.max(sheet.w * 0.002, 0.5);
  $: dimSw  = Math.max(sheet.w * 0.0015, 0.4);
  $: arrowH = sheet.h * 0.012;
  $: dimY   = refilo > 0 ? refilo * 0.5 : sheet.h * 0.015;
  $: dimFsz = sheet.h * 0.022;
  $: dimX   = refilo > 0 ? refilo * 0.5 : sheet.w * 0.015;

  function printModal() {
    document.body.classList.add('print-cutplan');
    if ($printConfig.layout === 'two') document.body.classList.add('layout-2');
    window.print();
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('print-cutplan', 'layout-2');
    }, { once: true });
  }
  function close() { dispatch('close'); }

  function groupLabel(g) {
    const n = g.indices.length;
    if (n === 1) return `Chapa ${g.indices[0]} de ${result.sheetCount}`;
    if (n === result.sheetCount) return `Todas as ${n} chapas — layout idêntico`;
    const range = g.indices[0] + '–' + g.indices[n - 1];
    return `Chapas ${range} (${n}× layout idêntico)`;
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && close()} />

<!-- Overlay de tela (some na impressão) -->
<div class="screen-overlay no-print" role="presentation" on:click={close}></div>

<!-- Documento — fluxo normal tanto na tela quanto na impressão -->
<div class="doc-root" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>

  <!-- Barra de ações (só tela) -->
  <div class="action-bar no-print">
    <div>
      <span class="t">Plano de corte</span>
      <span class="sub">{group.label}</span>
    </div>
    <div class="action-bar-btns">
      <button class="btn amber" on:click={printModal}>Imprimir / PDF</button>
      <button class="btn ghost" on:click={close}>Fechar</button>
    </div>
  </div>

  <!-- ── CABEÇALHO DO DOCUMENTO ── -->
  <div class="doc-header">
    <!-- Coluna esquerda: empresa -->
    <div class="dh-company">
      <div class="dh-co-name">{$companyInfo.nome || 'Perfilar'}</div>
      {#if $companyInfo.cnpj}    <div class="dh-co-row">CNPJ {$companyInfo.cnpj}</div>{/if}
      {#if $companyInfo.endereco}<div class="dh-co-row">{$companyInfo.endereco}</div>{/if}
      <div class="dh-co-contacts">
        {#if $companyInfo.tel}  <span>{$companyInfo.tel}</span>{/if}
        {#if $companyInfo.email}<span>{$companyInfo.email}</span>{/if}
        {#if $companyInfo.site} <span>{$companyInfo.site}</span>{/if}
      </div>
    </div>

    <!-- Divisor vertical -->
    <div class="dh-div"></div>

    <!-- Coluna direita: dados do documento -->
    <div class="dh-doc">
      <div class="dh-doc-title">Plano de corte</div>
      <div class="dh-kv-grid">
        {#if ctx.orc}      <span class="dk">Orçamento</span><span class="dv">{ctx.orc}</span>{/if}
        <span class="dk">Data</span><span class="dv">{today}</span>
        {#if ctx.cliente}  <span class="dk">Cliente</span><span class="dv">{ctx.cliente}</span>{/if}
        {#if ctx.vendedor} <span class="dk">Vendedor</span><span class="dv">{ctx.vendedor}</span>{/if}
      </div>
      {#if ctx.obs}
        <div class="dh-obs"><em>Obs:</em> {ctx.obs}</div>
      {/if}
    </div>
  </div>

  <!-- ── FICHA TÉCNICA ── -->
  <div class="ficha">

    <!-- Faixa 1 — specs da matéria-prima em linha -->
    <div class="ficha-mp">
      <span class="fmp-label">MP</span>
      <span class="fmp-chip">
        <em>{p0.matName}{p0.revest !== 'Sem revestimento' ? ' ' + p0.revest : ''}</em>
      </span>
      <span class="fmp-sep">·</span>
      <span class="fmp-chip"><em>esp.</em> {nf(p0.t, 2)} mm</span>
      <span class="fmp-sep">·</span>
      {#if isChapa}
        <span class="fmp-chip"><em>chapa</em> {nf(p0.chapaL, 0)} × {nf(p0.chapaC, 0)} mm</span>
      {:else}
        <span class="fmp-chip"><em>bobina</em> {nf(p0.coil, 0)} mm</span>
      {/if}
      {#if refilo > 0}
        <span class="fmp-sep">·</span>
        <span class="fmp-chip"><em>refilo</em> {nf(refilo, 0)} mm</span>
      {/if}
      {#if espac > 0}
        <span class="fmp-sep">·</span>
        <span class="fmp-chip"><em>folga</em> {nf(espac, 0)} mm</span>
      {/if}
    </div>

    <!-- Faixa 2 — tabela de itens (largura total) -->
    <div class="ficha-items">
      <div class="fi-scroll">
        <table class="items-tbl">
          <thead>
            <tr>
              <th class="th-sw"></th>
              <th>Item</th>
              <th class="r">Des <span class="thunit">mm</span></th>
              <th class="r">Compr <span class="thunit">mm</span></th>
              <th class="r">Qtd</th>
              <th class="r">kg/pç</th>
              <th class="r">Total kg</th>
            </tr>
          </thead>
          <tbody>
            {#each pieces as p, i}
              <tr>
                <td><span class="swatch" style="background:{p.fill};border-color:{p.stroke}"></span></td>
                <td class="item-name">{i + 1}. {p.label}</td>
                <td class="r mono">{nf(p.des, 0)}</td>
                <td class="r mono">{nf(p.C, 0)}</td>
                <td class="r mono">{p.Q}</td>
                <td class="r mono">{nf(p.pcKg, 3)}</td>
                <td class="r mono">{nf(p.totKg, 2)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Faixa 3 — barra de stats -->
    <div class="ficha-stats">
      {#if isChapa && result}
        <div class="fstat">
          <span>Chapas</span>
          <b>{result.sheetCount}</b>
        </div>
        <div class="fstat">
          <span>Aproveitamento</span>
          <b class:good={aprPct >= 80} class:warn={aprPct < 60}>{nf(aprPct, 1)}%</b>
        </div>
        <div class="fstat">
          <span>Desperdício</span>
          <b>{nf(wasteM2, 3)} m²</b>
        </div>
        <div class="fstat">
          <span>Área total MP</span>
          <b>{nf(sheetM2, 3)} m²</b>
        </div>
      {/if}
      <div class="fstat">
        <span>Total peças</span>
        <b>{totalPcs} pç</b>
      </div>
      <div class="fstat">
        <span>Peso líquido</span>
        <b>{nf(totalKg, 2)} kg</b>
      </div>
      <div class="fstat">
        <span>Comprimento</span>
        <b>{nf(totalMlm, 2)} m</b>
      </div>
      {#if result?.unplaced.length > 0}
        <div class="fstat warn-stat">
          <span>Atenção</span>
          <b>⚠ {result.unplaced.length} peça(s) não cabem</b>
        </div>
      {/if}
    </div>

  </div>

  <!-- ── CHAPAS ── -->
  {#if isChapa && result}
    <div class="sheets-wrap">
      {#each sheetGroups as g, gi}
        <div class="sheet-page">
          <div class="sheet-lbl">
            {groupLabel(g)} — {nf(sheet.w, 0)} × {nf(sheet.h, 0)} mm
            {#if g.indices.length > 1}
              <span class="rep-badge">{g.indices.length}×</span>
            {/if}
          </div>

          <svg
            viewBox="0 0 {sheet.w} {sheet.h}"
            preserveAspectRatio="xMidYMid meet"
            style="display:block; width:100%; max-width:{svgMaxW}px; height:auto;"
            xmlns="http://www.w3.org/2000/svg">

            <rect width={sheet.w} height={sheet.h} fill="#fff" />

            {#if refilo > 0}
              <rect x="0"              y="0"                width={sheet.w}  height={refilo}   fill="#e2e8f0" />
              <rect x="0"              y={sheet.h - refilo} width={sheet.w}  height={refilo}   fill="#e2e8f0" />
              <rect x="0"              y="0"                width={refilo}   height={sheet.h}  fill="#e2e8f0" />
              <rect x={sheet.w-refilo} y="0"                width={refilo}   height={sheet.h}  fill="#e2e8f0" />
            {/if}

            {#each g.sd.shelves as shelf}
              <rect x={refilo} y={shelf.y} width={sheet.w - 2*refilo} height={shelf.height} fill="#f1f5f9" />
            {/each}
            {#if g.sd.bottomH > 0}
              <rect x={refilo} y={g.sd.bottomY} width={sheet.w - 2*refilo} height={g.sd.bottomH} fill="#f1f5f9" />
            {/if}

            <defs>
              <pattern id="hatch-{gi}" patternUnits="userSpaceOnUse"
                       width={sheet.w * 0.015} height={sheet.w * 0.015}
                       patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2={sheet.w * 0.015}
                      stroke="#cbd5e1" stroke-width={sheet.w * 0.003} />
              </pattern>
            </defs>

            {#each g.sd.wastes as w}
              <rect x={w.x} y={w.y} width={w.w} height={w.h} fill="url(#hatch-{gi})" />
            {/each}
            {#if g.sd.bottomH > 0}
              <rect x={refilo} y={g.sd.bottomY} width={sheet.w-2*refilo} height={g.sd.bottomH} fill="url(#hatch-{gi})" />
            {/if}

            {#each g.sd.placements as p}
              {@const fs  = Math.min(p.w, p.h) * 0.18}
              {@const fs2 = Math.min(p.w, p.h) * 0.10}
              <rect x={p.x} y={p.y} width={p.w} height={p.h}
                    fill={p.fill} stroke={p.stroke} stroke-width={sw} />
              {#if Math.min(p.w, p.h) > sw * 12}
                <text x={p.x + p.w/2} y={p.y + p.h/2 - fs * 0.3}
                      font-size={fs} text-anchor="middle" dominant-baseline="middle"
                      fill={p.stroke} font-family="sans-serif" font-weight="700">{labelMap[p.label]}</text>
                {#if Math.min(p.w, p.h) > sw * 22}
                  <text x={p.x + p.w/2} y={p.y + p.h/2 + fs * 0.9}
                        font-size={fs2} text-anchor="middle" dominant-baseline="middle"
                        fill={p.stroke} font-family="monospace" opacity="0.85">{nf(p.w,0)}×{nf(p.h,0)}</text>
                {/if}
              {/if}
            {/each}

            {#each g.sd.hCuts as cy}
              <line x1={refilo} y1={cy} x2={sheet.w-refilo} y2={cy}
                    stroke="#334155" stroke-width={cutSw}
                    stroke-dasharray="{cutSw*8} {cutSw*3}" />
            {/each}
            {#each g.sd.vCuts as vc}
              <line x1={vc.x} y1={vc.y1} x2={vc.x} y2={vc.y2}
                    stroke="#334155" stroke-width={cutSw}
                    stroke-dasharray="{cutSw*6} {cutSw*3}" />
            {/each}

            <rect width={sheet.w} height={sheet.h} fill="none" stroke="#1e293b" stroke-width={sw*1.8} />

            <line x1={0} y1={dimY} x2={sheet.w} y2={dimY} stroke="#64748b" stroke-width={dimSw} />
            <text x={sheet.w/2} y={dimY - arrowH} font-size={dimFsz} text-anchor="middle"
                  fill="#475569" font-family="monospace">{nf(sheet.w,0)} mm</text>

            <line x1={dimX} y1={0} x2={dimX} y2={sheet.h} stroke="#64748b" stroke-width={dimSw} />
            <text x={dimX - arrowH} y={sheet.h/2} font-size={dimFsz} text-anchor="middle"
                  fill="#475569" font-family="monospace"
                  transform="rotate(-90 {dimX - arrowH} {sheet.h/2})">{nf(sheet.h,0)} mm</text>
          </svg>

          <div class="sheet-stats no-print">
            <span>Faixas: {g.sd.shelves.length}</span>
            <span>Peças: {g.sd.placements.length}</span>
            {#if g.sd.bottomH > 0}<span class="waste-tag">Sobra inferior: {nf(g.sd.bottomH, 0)} mm</span>{/if}
          </div>

          <!-- Rodapé de página (só na impressão) -->
          <div class="page-footer print-only">
            <span class="pf-co">{$companyInfo.nome || 'Perfilar'}</span>
            <span class="pf-sep">·</span>
            {#if ctx.orc}<span>ORC {ctx.orc}</span><span class="pf-sep">·</span>{/if}
            {#if ctx.cliente}<span>Cliente: {ctx.cliente}</span><span class="pf-sep">·</span>{/if}
            {#if ctx.vendedor}<span>Vendedor: {ctx.vendedor}</span><span class="pf-sep">·</span>{/if}
            <span>{today}</span>
            <span class="pf-sep">·</span>
            <span>{groupLabel(g)}</span>
          </div>
        </div>
      {/each}
    </div>

  {:else if !isChapa}
    <div class="bobina-body">
      <p class="bob-note">Bobina {nf(p0.coil, 0)} mm — tiras a cortar:</p>
      <table class="ctbl">
        <thead><tr><th></th><th>Item</th><th class="r">Blank</th><th class="r">Compr.</th><th class="r">Qtd</th><th class="r">Total kg</th></tr></thead>
        <tbody>
          {#each pieces as p, i}
            <tr>
              <td><span class="swatch" style="background:{p.fill};border-color:{p.stroke}"></span></td>
              <td>{i + 1}. {p.label}</td>
              <td class="r mono">{nf(p.des, 0)} mm</td>
              <td class="r mono">{nf(p.C, 0)} mm</td>
              <td class="r mono">{p.Q} pç</td>
              <td class="r mono">{nf(p.totKg, 2)} kg</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

</div><!-- .doc-root -->

<style>
  /* ── Tela: overlay + centralização ──────────────────────────────────── */
  .screen-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.45);
    z-index: 200;
  }
  .doc-root {
    position: fixed; inset: 0;
    z-index: 201;
    overflow-y: auto;
    /* centra o documento na tela */
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px 48px;
    pointer-events: none;   /* deixa o overlay capturar clicks fora */
  }
  /* O conteúdo real bloqueia os clicks */
  .doc-root > * {
    pointer-events: all;
    width: 100%;
    max-width: 780px;
  }

  /* Cabeçalho de ações (tela) */
  .action-bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 20px; background: var(--panel); border-radius: 10px 10px 0 0; border: 1px solid var(--line); border-bottom: none; }
  .t   { font-weight: 600; font-size: 15px; display: block; }
  .sub { font-size: 11px; color: var(--ink-soft); font-family: var(--mono); margin-top: 2px; display: block; }
  .action-bar-btns { display: flex; gap: 8px; flex-shrink: 0; }
  .btn { height: 34px; padding: 0 14px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; white-space: nowrap; }
  .btn.amber { background: var(--amber); color: #fff; } .btn.amber:hover { background: #d67d12; }
  .btn.ghost { background: var(--panel-2); color: var(--ink); border-color: var(--line); }

  /* ── Cabeçalho do documento ─────────────────────────────────────────── */
  .doc-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 0;
    background: var(--ink);
    color: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Empresa (coluna esquerda) */
  .dh-company { padding: 14px 18px; }
  .dh-co-name { font-family: var(--disp); font-weight: 700; font-size: 16px; letter-spacing: .2px; margin-bottom: 4px; }
  .dh-co-row  { font-size: 11px; color: #9fb0c2; margin-top: 2px; }
  .dh-co-contacts { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 5px; }
  .dh-co-contacts span { font-size: 11px; color: #b8c8d8; }

  /* Divisor */
  .dh-div { width: 1px; background: #2f3d4d; margin: 14px 0; }

  /* Documento (coluna direita) */
  .dh-doc { padding: 14px 18px; display: flex; flex-direction: column; gap: 6px; }
  .dh-doc-title { font-family: var(--mono); font-size: 9.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #9fb0c2; margin-bottom: 2px; }
  .dh-kv-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: baseline; }
  .dk { font-size: 10px; color: #9fb0c2; text-transform: uppercase; letter-spacing: .5px; white-space: nowrap; }
  .dv { font-size: 13px; font-weight: 500; color: #fff; }
  .dh-obs { margin-top: 4px; font-size: 11.5px; color: #b8c8d8; border-top: 1px solid #2f3d4d; padding-top: 6px; }
  .dh-obs em { font-style: normal; color: #9fb0c2; margin-right: 3px; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }

  /* Rodapé de página (só print) */
  .page-footer { display: none; }
  .print-only  { display: none; }

  /* ── Ficha técnica (3 faixas empilhadas) ───────────────────────────── */
  .ficha { display: flex; flex-direction: column; background: var(--panel); border-bottom: 1px solid var(--line); }

  /* Faixa 1 — MP em linha */
  .ficha-mp { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 6px; padding: 9px 16px; border-bottom: 1px solid var(--line); font-size: 12px; }
  .fmp-label { font-family: var(--mono); font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-faint); background: var(--panel-2); border: 1px solid var(--line); border-radius: 3px; padding: 1px 5px; margin-right: 2px; flex-shrink: 0; }
  .fmp-chip { color: var(--ink); white-space: nowrap; }
  .fmp-chip em { font-style: normal; color: var(--ink-soft); font-size: 11px; margin-right: 2px; }
  .fmp-sep { color: var(--ink-faint); user-select: none; }

  /* Faixa 2 — tabela de itens */
  .ficha-items { border-bottom: 1px solid var(--line); }
  .fi-scroll   { overflow-x: auto; }
  .items-tbl   { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
  .items-tbl thead tr { background: var(--panel-2); }
  .items-tbl th { text-align: left; font-family: var(--mono); font-size: 9px; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; color: var(--ink-faint); padding: 6px 10px; border-bottom: 1px solid var(--line); }
  .items-tbl th.th-sw { width: 18px; }
  .thunit { font-family: var(--mono); font-size: 8px; color: var(--ink-faint); background: var(--panel); border: 1px solid var(--line); border-radius: 2px; padding: 0 3px; margin-left: 2px; }
  .items-tbl td { padding: 6px 10px; border-bottom: 1px solid var(--line); color: var(--ink); }
  .items-tbl tr:last-child td { border-bottom: none; }
  .items-tbl tbody tr:hover { background: var(--panel-2); }
  .item-name { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .swatch { display: inline-block; width: 11px; height: 11px; border: 2px solid; border-radius: 2px; vertical-align: middle; }
  .r    { text-align: right; }
  .mono { font-family: var(--mono); }

  /* Faixa 3 — stats bar */
  .ficha-stats { display: flex; flex-wrap: wrap; }
  .fstat { flex: 1; min-width: 90px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 10px 8px; border-right: 1px solid var(--line); }
  .fstat:last-child { border-right: none; }
  .fstat span { font-family: var(--mono); font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: var(--ink-faint); text-align: center; }
  .fstat b { font-family: var(--mono); font-size: 16px; font-weight: 600; color: var(--ink); }
  .fstat b.good { color: #16a34a; }
  .fstat b.warn { color: var(--amber-deep); }
  .warn-stat { background: #fff9f0; }
  .warn-stat span { color: var(--amber-deep); }
  .warn-stat b { font-size: 12px; color: var(--amber-deep); }

  /* Área de chapas */
  .sheets-wrap { background: var(--panel); padding: 14px 16px; display: flex; flex-direction: column; gap: 20px; border-top: 1px solid var(--line); }
  .sheet-page  { display: flex; flex-direction: column; gap: 6px; }
  .sheet-lbl   { display: flex; align-items: center; gap: 8px; font-size: 11px; font-family: var(--mono); color: var(--ink-soft); text-transform: uppercase; letter-spacing: .5px; }
  .rep-badge   { background: var(--amber-soft); border: 1px solid #f5d9b0; color: var(--amber-deep); font-family: var(--mono); font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 4px; }
  .sheet-page svg { border: 1px solid var(--line); border-radius: 4px; }
  .sheet-stats { display: flex; gap: 14px; font-size: 11px; color: var(--ink-soft); font-family: var(--mono); }
  .waste-tag   { color: var(--amber-deep); }

  /* Bobina */
  .bobina-body { background: var(--panel); padding: 16px 20px; }
  .bob-note    { font-size: 12.5px; color: var(--ink-soft); margin-bottom: 10px; }
  .ctbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ctbl th { text-align: left; font-size: 10.5px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: .5px; padding: 4px 8px; border-bottom: 1px solid var(--line); }
  .ctbl td { padding: 7px 8px; border-bottom: 1px solid var(--line); }

  /* ── Impressão ───────────────────────────────────────────────────────── */
  @media print {
    @page { size: A4 portrait; margin: 10mm; }

    /* Esconde tudo que não é o documento */
    :global(body.print-cutplan .app)           { display: none !important; }
    :global(body.print-cutplan .screen-overlay){ display: none !important; }

    /* Tira o posicionamento fixo — o doc-root vira fluxo normal */
    :global(body.print-cutplan .doc-root) {
      position: static !important;
      display: block !important;
      overflow: visible !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: none !important;
    }
    :global(body.print-cutplan .doc-root > *) {
      max-width: none !important;
    }

    .no-print { display: none !important; }

    /* Cabeçalho + ficha ficam juntos na 1ª página */
    .doc-header  { break-inside: avoid; grid-template-columns: 1fr auto 1fr; }
    .ficha       { break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ficha-stats { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* Rodapé de página */
    .print-only  { display: block !important; }
    .page-footer {
      display: flex !important;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 8px;
      margin-top: 6pt;
      padding-top: 5pt;
      border-top: 1px solid #94a3b8;
      font-size: 8pt;
      font-family: var(--mono, monospace);
      color: #475569;
    }
    .pf-co  { font-weight: 700; color: #1e293b; }
    .pf-sep { color: #94a3b8; }
    .fi-scroll   { overflow-x: visible !important; }
    .items-tbl   { white-space: normal; font-size: 10pt; }
    .fstat b     { font-size: 13pt !important; }

    /* ── Layout: uma chapa por página (padrão) ──────────────────────────── */
    .sheets-wrap { padding: 0 !important; gap: 0 !important; }
    .sheet-page  { break-before: page; padding: 8px 0; }

    /* SVG ocupa a largura da página, altura proporcional */
    .sheet-page svg {
      display: block !important;
      width: auto !important;
      height: 200mm !important;
      max-width: 100% !important;
      border: 1px solid #94a3b8 !important;
      border-radius: 0 !important;
    }
    .sheet-lbl { font-size: 10pt !important; margin-bottom: 4pt; }

    /* ── Layout: duas chapas por página ─────────────────────────────────── */
    :global(body.print-cutplan.layout-2 .sheets-wrap) {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 6mm 8mm !important;
      padding: 0 !important;
    }
    :global(body.print-cutplan.layout-2 .sheet-page) {
      break-before: auto !important;
      break-inside: avoid !important;
      padding: 0 !important;
    }
    :global(body.print-cutplan.layout-2 .sheet-page svg) {
      height: 120mm !important;
      width: auto !important;
      max-width: 100% !important;
    }
    :global(body.print-cutplan.layout-2 .page-footer) {
      font-size: 7pt !important;
    }
  }
</style>
