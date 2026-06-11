<script>
  import { createEventDispatcher } from 'svelte';
  import { packSheets, PALETTE } from '../lib/cutplan.js';
  import { nf } from '../lib/engine.js';

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

  // Por chapa: placements + shelves (para cortes)
  $: bySheet = result
    ? Array.from({ length: result.sheetCount }, (_, si) => {
        const placements = result.placements.filter(p => p.si === si);
        const shelves    = result.sheetShelves[si];
        // Linha de corte horizontal: entre cada faixa
        const hCuts = shelves.slice(0, -1).map(s => s.y + s.height);
        // Linhas de corte verticais: direita de cada peça dentro da faixa
        const vCuts = shelves.flatMap(shelf => {
          const inShelf = placements.filter(p => p.y === shelf.y).sort((a, b) => a.x - b.x);
          return inShelf.map(p => ({ x: p.x + p.w, y1: shelf.y, y2: shelf.y + shelf.height }));
        });
        // Área de sobra = faixa - largura usada (lado direito)
        const wastes = shelves.map(shelf => {
          const lastX = placements
            .filter(p => p.y === shelf.y)
            .reduce((m, p) => Math.max(m, p.x + p.w), refilo);
          return { x: lastX, y: shelf.y, w: sheet.w - refilo - lastX, h: shelf.height };
        }).filter(w => w.w > 0);
        // Sobra de fundo (abaixo da última faixa)
        const bottomY = shelves.length
          ? shelves[shelves.length - 1].y + shelves[shelves.length - 1].height
          : refilo;
        const bottomH = sheet.h - refilo - bottomY;
        return { placements, shelves, hCuts, vCuts, wastes, bottomY, bottomH };
      })
    : [];

  // Totais para o cabeçalho
  $: usedMM2   = pieces.reduce((a, p) => a + p.des * p.C * p.Q, 0);
  $: totMM2    = result ? result.sheetCount * sheet.w * sheet.h : 0;
  $: aprPct    = totMM2 > 0 ? usedMM2 / totMM2 * 100 : 0;
  $: wasteM2   = (totMM2 - usedMM2) / 1e6;
  $: sheetM2   = totMM2 / 1e6;
  $: totalKg   = pieces.reduce((a, p) => a + p.totKg, 0);
  $: totalPcs  = pieces.reduce((a, p) => a + p.Q, 0);
  $: totalMlm  = pieces.reduce((a, p) => a + p.Q * p.C / 1000, 0);
  $: today     = new Date().toLocaleDateString('pt-BR');

  // Escala de exibição
  const MAX_W = 560, MAX_H = 440;
  $: dScale = Math.min(MAX_W / sheet.w, MAX_H / sheet.h);
  $: svgW   = Math.round(sheet.w * dScale);
  $: svgH   = Math.round(sheet.h * dScale);

  // Espessuras de traço em unidades mm (viewBox)
  $: sw     = Math.max(sheet.w * 0.003, 1);
  $: cutSw  = Math.max(sheet.w * 0.002, 0.5);
  $: dimSw  = Math.max(sheet.w * 0.0015, 0.4);
  $: arrowH = sheet.h * 0.012;
  $: dimY   = refilo > 0 ? refilo * 0.5 : sheet.h * 0.015;
  $: dimFsz = sheet.h * 0.022;
  $: dimX   = refilo > 0 ? refilo * 0.5 : sheet.w * 0.015;

  function printModal() {
    document.body.classList.add('print-cutplan');
    window.print();
    window.addEventListener('afterprint', () => document.body.classList.remove('print-cutplan'), { once: true });
  }
  function close() { dispatch('close'); }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && close()} />

<div class="back" role="presentation" on:click={close}>
  <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown|stopPropagation>

    <!-- Cabeçalho (tela) -->
    <div class="mhead no-print">
      <div>
        <span class="t">Plano de corte</span>
        <span class="sub">{group.label}</span>
      </div>
      <div class="mhead-actions">
        <button class="btn amber" on:click={printModal}>Imprimir / PDF</button>
        <button class="btn ghost" on:click={close}>Fechar</button>
      </div>
    </div>

    <!-- ── CABEÇALHO DO DOCUMENTO (tela + impressão) ── -->
    <div class="doc-header">
      <div class="doc-brand">
        <span class="brand-name">Perfilar</span>
        <span class="brand-tag">ferro &amp; aço — plano de corte</span>
      </div>
      <div class="doc-meta">
        {#if ctx.cliente}<div><span>Cliente</span><b>{ctx.cliente}</b></div>{/if}
        {#if ctx.orc}<div><span>Orçamento</span><b>{ctx.orc}</b></div>{/if}
        <div><span>Data</span><b>{today}</b></div>
      </div>
    </div>

    <!-- ── FICHA TÉCNICA ── -->
    <div class="ficha">
      <!-- Matéria-prima -->
      <div class="ficha-block">
        <div class="fb-title">Matéria-prima</div>
        <div class="fb-row"><span>Material</span><b>{p0.matName}{p0.revest !== 'Sem revestimento' ? ' ' + p0.revest : ''}</b></div>
        <div class="fb-row"><span>Espessura</span><b>{nf(p0.t, 2)} mm</b></div>
        {#if isChapa}
          <div class="fb-row"><span>Chapa</span><b>{nf(p0.chapaL, 0)} × {nf(p0.chapaC, 0)} mm</b></div>
        {:else}
          <div class="fb-row"><span>Bobina</span><b>{nf(p0.coil, 0)} mm larg.</b></div>
        {/if}
        {#if refilo > 0}<div class="fb-row"><span>Refilo</span><b>{nf(refilo, 0)} mm</b></div>{/if}
        {#if espac  > 0}<div class="fb-row"><span>Folga entre peças</span><b>{nf(espac, 0)} mm</b></div>{/if}
      </div>

      <!-- Itens -->
      <div class="ficha-block wide">
        <div class="fb-title">Itens do grupo</div>
        <table class="items-tbl">
          <thead>
            <tr>
              <th></th><th>Item</th>
              <th class="r">Des <small>mm</small></th>
              <th class="r">Compr <small>mm</small></th>
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

      <!-- Resumo -->
      <div class="ficha-block">
        <div class="fb-title">Resumo de aproveitamento</div>
        {#if isChapa && result}
          <div class="fb-row"><span>Chapas necessárias</span><b>{result.sheetCount} chapa(s)</b></div>
          <div class="fb-row"><span>Área total de MP</span><b>{nf(sheetM2, 3)} m²</b></div>
          <div class="fb-row"><span>Aproveitamento</span><b class:good={aprPct >= 80} class:warn={aprPct < 60}>{nf(aprPct, 1)}%</b></div>
          <div class="fb-row"><span>Desperdício</span><b>{nf(wasteM2, 3)} m²</b></div>
        {/if}
        <div class="fb-row"><span>Total de peças</span><b>{totalPcs} pç</b></div>
        <div class="fb-row"><span>Peso líquido total</span><b>{nf(totalKg, 2)} kg</b></div>
        <div class="fb-row"><span>Comprimento total</span><b>{nf(totalMlm, 2)} m</b></div>
        {#if result?.unplaced.length > 0}
          <div class="fb-warn">⚠ {result.unplaced.length} peça(s) não cabem na chapa</div>
        {/if}
      </div>
    </div>

    <!-- ── CHAPAS (chapa) ── -->
    {#if isChapa && result}
      <div class="sheets-wrap">
        {#each bySheet as sd, si}
          <div class="sheet-page">
            <div class="sheet-lbl">Chapa {si + 1} de {result.sheetCount} — {nf(sheet.w, 0)} × {nf(sheet.h, 0)} mm</div>

            <svg width={svgW} height={svgH}
                 viewBox="0 0 {sheet.w} {sheet.h}"
                 style="display:block"
                 xmlns="http://www.w3.org/2000/svg">

              <!-- Fundo branco da chapa -->
              <rect width={sheet.w} height={sheet.h} fill="#fff" />

              <!-- Zona de refilo (borda) -->
              {#if refilo > 0}
                <!-- bordas superior/inferior/esquerda/direita -->
                <rect x="0" y="0"                   width={sheet.w}  height={refilo}              fill="#e2e8f0" />
                <rect x="0" y={sheet.h - refilo}    width={sheet.w}  height={refilo}              fill="#e2e8f0" />
                <rect x="0" y="0"                   width={refilo}   height={sheet.h}             fill="#e2e8f0" />
                <rect x={sheet.w - refilo} y="0"    width={refilo}   height={sheet.h}             fill="#e2e8f0" />
              {/if}

              <!-- Faixas de sobra (strip backgrounds) -->
              {#each sd.shelves as shelf}
                <rect x={refilo} y={shelf.y}
                      width={sheet.w - 2 * refilo} height={shelf.height}
                      fill="#f1f5f9" />
              {/each}

              <!-- Sobra de fundo -->
              {#if sd.bottomH > 0}
                <rect x={refilo} y={sd.bottomY}
                      width={sheet.w - 2 * refilo} height={sd.bottomH}
                      fill="#f1f5f9" />
              {/if}

              <!-- Padrão de hachura para as sobras (lado direito de cada faixa) -->
              <defs>
                <pattern id="hatch-{si}" patternUnits="userSpaceOnUse"
                         width={sheet.w * 0.015} height={sheet.w * 0.015}
                         patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2={sheet.w * 0.015}
                        stroke="#cbd5e1" stroke-width={sheet.w * 0.003} />
                </pattern>
              </defs>

              <!-- Sobras laterais hachuradas -->
              {#each sd.wastes as w}
                <rect x={w.x} y={w.y} width={w.w} height={w.h} fill="url(#hatch-{si})" />
              {/each}
              {#if sd.bottomH > 0}
                <rect x={refilo} y={sd.bottomY}
                      width={sheet.w - 2 * refilo} height={sd.bottomH}
                      fill="url(#hatch-{si})" />
              {/if}

              <!-- Peças (coloridas) -->
              {#each sd.placements as p}
                {@const fs  = Math.min(p.w, p.h) * 0.18}
                {@const fs2 = Math.min(p.w, p.h) * 0.10}
                <rect x={p.x} y={p.y} width={p.w} height={p.h}
                      fill={p.fill} stroke={p.stroke} stroke-width={sw} />
                {#if Math.min(p.w, p.h) > sw * 12}
                  <!-- Número do item -->
                  <text x={p.x + p.w / 2} y={p.y + p.h / 2 - fs * 0.3}
                        font-size={fs} text-anchor="middle" dominant-baseline="middle"
                        fill={p.stroke} font-family="sans-serif" font-weight="700">{labelMap[p.label]}</text>
                  <!-- Dimensões -->
                  {#if Math.min(p.w, p.h) > sw * 22}
                    <text x={p.x + p.w / 2} y={p.y + p.h / 2 + fs * 0.9}
                          font-size={fs2} text-anchor="middle" dominant-baseline="middle"
                          fill={p.stroke} font-family="monospace" opacity="0.85">
                      {nf(p.w, 0)}×{nf(p.h, 0)}
                    </text>
                  {/if}
                {/if}
              {/each}

              <!-- Linhas de corte horizontais -->
              {#each sd.hCuts as cy}
                <line x1={refilo} y1={cy} x2={sheet.w - refilo} y2={cy}
                      stroke="#334155" stroke-width={cutSw}
                      stroke-dasharray="{cutSw * 8} {cutSw * 3}" />
              {/each}

              <!-- Linhas de corte verticais -->
              {#each sd.vCuts as vc}
                <line x1={vc.x} y1={vc.y1} x2={vc.x} y2={vc.y2}
                      stroke="#334155" stroke-width={cutSw}
                      stroke-dasharray="{cutSw * 6} {cutSw * 3}" />
              {/each}

              <!-- Borda da chapa -->
              <rect width={sheet.w} height={sheet.h}
                    fill="none" stroke="#1e293b" stroke-width={sw * 1.8} />

              <!-- Cota: largura (topo) -->
              <line x1={0} y1={dimY} x2={sheet.w} y2={dimY} stroke="#64748b" stroke-width={dimSw} />
              <text x={sheet.w / 2} y={dimY - arrowH}
                    font-size={dimFsz} text-anchor="middle" fill="#475569" font-family="monospace">
                {nf(sheet.w, 0)} mm
              </text>

              <!-- Cota: altura (lateral) -->
              <line x1={dimX} y1={0} x2={dimX} y2={sheet.h} stroke="#64748b" stroke-width={dimSw} />
              <text x={dimX - arrowH} y={sheet.h / 2}
                    font-size={dimFsz} text-anchor="middle" fill="#475569" font-family="monospace"
                    transform="rotate(-90 {dimX - arrowH} {sheet.h / 2})">
                {nf(sheet.h, 0)} mm
              </text>
            </svg>

            <!-- Legenda do aproveitamento desta chapa -->
            <div class="sheet-stats">
              <span>Faixas: {sd.shelves.length}</span>
              <span>Peças: {sd.placements.length}</span>
              {#if sd.bottomH > 0}<span class="waste-tag">Sobra inferior: {nf(sd.bottomH, 0)} mm</span>{/if}
            </div>
          </div>
        {/each}
      </div>

    {:else if !isChapa}
      <!-- Bobina: lista de tiras -->
      <div class="bobina-body">
        <p class="bob-note">Bobina {nf(p0.coil, 0)} mm — tiras a cortar:</p>
        <table class="ctbl">
          <thead><tr><th></th><th>Item</th><th class="r">Blank (des)</th><th class="r">Compr.</th><th class="r">Qtd</th><th class="r">Total kg</th></tr></thead>
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

  </div><!-- .modal -->
</div><!-- .back -->

<style>
  .back  { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: flex-start; justify-content: center; padding: 24px 16px 40px; z-index: 200; overflow-y: auto; }
  .modal { background: var(--panel); border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,.22); width: 100%; max-width: 800px; }

  /* Cabeçalho tela */
  .mhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--line); }
  .t { font-weight: 600; font-size: 15px; display: block; }
  .sub { font-size: 11px; color: var(--ink-soft); font-family: var(--mono); margin-top: 2px; display: block; }
  .mhead-actions { display: flex; gap: 8px; flex-shrink: 0; }
  .btn { height: 34px; padding: 0 14px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; white-space: nowrap; }
  .btn.amber { background: var(--amber); color: #fff; } .btn.amber:hover { background: #d67d12; }
  .btn.ghost { background: var(--panel-2); color: var(--ink); border-color: var(--line); } .btn.ghost:hover { border-color: var(--ink-faint); }

  /* Cabeçalho do documento */
  .doc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 14px 20px; border-bottom: 1px solid var(--line); background: var(--ink); color: #fff; }
  .brand-name { font-family: var(--disp); font-weight: 600; font-size: 17px; display: block; }
  .brand-tag  { font-family: var(--mono); font-size: 10px; color: #9fb0c2; display: block; margin-top: 2px; }
  .doc-meta   { display: flex; gap: 20px; align-items: flex-end; flex-wrap: wrap; }
  .doc-meta div { display: flex; flex-direction: column; align-items: flex-end; }
  .doc-meta span { font-size: 10px; color: #9fb0c2; text-transform: uppercase; letter-spacing: .5px; }
  .doc-meta b { font-size: 12.5px; color: #fff; }

  /* Ficha técnica */
  .ficha { display: flex; flex-wrap: wrap; gap: 0; border-bottom: 1px solid var(--line); }
  .ficha-block { padding: 14px 18px; border-right: 1px solid var(--line); flex: 1; min-width: 180px; }
  .ficha-block.wide { flex: 2; min-width: 300px; }
  .ficha-block:last-child { border-right: none; }
  .fb-title { font-family: var(--mono); font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 8px; }
  .fb-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding: 2px 0; }
  .fb-row span { color: var(--ink-soft); }
  .fb-row b { font-weight: 500; text-align: right; }
  .fb-row b.good { color: #16a34a; }
  .fb-row b.warn { color: var(--amber-deep); }
  .fb-warn { margin-top: 6px; padding: 5px 8px; background: #fff4e6; border: 1px solid #f5d9b0; border-radius: 4px; font-size: 11px; color: var(--amber-deep); }

  /* Tabela de itens */
  .items-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
  .items-tbl th { text-align: left; font-size: 10px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: .3px; padding: 3px 6px; border-bottom: 1px solid var(--line); }
  .items-tbl td { padding: 5px 6px; border-bottom: 1px solid var(--line); }
  .items-tbl tr:last-child td { border-bottom: none; }
  .item-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .swatch { display: inline-block; width: 12px; height: 12px; border: 2px solid; border-radius: 2px; flex-shrink: 0; }
  .r { text-align: right; }
  .mono { font-family: var(--mono); }

  /* Chapas */
  .sheets-wrap { padding: 16px 20px; display: flex; flex-direction: column; gap: 20px; }
  .sheet-page  { display: flex; flex-direction: column; gap: 6px; }
  .sheet-lbl   { font-size: 11px; font-family: var(--mono); color: var(--ink-soft); text-transform: uppercase; letter-spacing: .5px; }
  .sheet-page svg { border: 1px solid var(--line); border-radius: 4px; }
  .sheet-stats { display: flex; gap: 14px; font-size: 11px; color: var(--ink-soft); font-family: var(--mono); }
  .waste-tag { color: var(--amber-deep); }

  /* Bobina */
  .bobina-body { padding: 16px 20px; }
  .bob-note { font-size: 12.5px; color: var(--ink-soft); margin-bottom: 10px; }
  .ctbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ctbl th { text-align: left; font-size: 10.5px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: .5px; padding: 4px 8px; border-bottom: 1px solid var(--line); }
  .ctbl td { padding: 7px 8px; border-bottom: 1px solid var(--line); }

  .no-print { }
  .print-only { display: none; }

  @media print {
    :global(body.print-cutplan .app) { display: none !important; }
    .back  { position: fixed; top: 0; left: 0; width: 100%; background: none !important; padding: 0 !important; overflow: visible !important; display: block !important; }
    .modal { box-shadow: none !important; border-radius: 0 !important; max-width: none !important; width: 100% !important; }
    .no-print   { display: none !important; }
    .print-only { display: block !important; }
    .ficha { page-break-inside: avoid; }
    .sheet-page { page-break-before: always; break-before: page; }
    .sheet-page svg { border: 1px solid #94a3b8 !important; width: 100% !important; height: auto !important; max-height: 90vh; }
    .sheets-wrap { padding: 8px 12px !important; }
    .sheet-stats { display: none; }
  }
</style>
