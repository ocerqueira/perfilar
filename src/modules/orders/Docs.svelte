<script>
  import { order, ctx, regions, regionId, commissionRule } from '../../lib/stores.js';
  import { nf, brl } from '../../lib/engine.js';
  import { priceFor } from '../../lib/pricing.js';
  import { commissionForItem, commissionForOrder, ruleLabel } from '../../lib/commission.js';
  import { dimensionedSVG } from '../../lib/draw.js';
  import { createEventDispatcher } from 'svelte';

  export let kind; // 'op' | 'orc'
  const dispatch = createEventDispatcher();

  let opMode = null; // null = escolher, 'single' | 'peritem'

  $: items = $order.items;
  $: dt = new Date().toLocaleDateString('pt-BR');

  const paperColors = { sheet: '#1f6fb2', dim: '#9C5A0C', text: '#16202B' };
  function croqui(it, id) {
    return dimensionedSVG(it.rows, it.h0, it.params.t, it.conv, paperColors, { W: 340, H: 230, id });
  }

  // Linhas do orçamento — recalculadas ao vivo conforme região selecionada
  $: orcRows = items.map((it) => {
    const proprio    = priceFor($regions, $regionId, it.params.matName, it.params.revest);
    const concorr    = priceFor($regions, $regionId, it.params.matName, it.params.revest, 'concorrente');
    const custoTotal = it.C.tot * proprio.custo;
    const precoTotal = custoTotal * (1 + it.params.mg / 100);
    const cTotal     = it.C.tot * concorr.venda;
    // delta: quanto o concorrente está acima/abaixo do nosso preço (positivo = somos mais baratos)
    const delta      = (precoTotal > 0 && cTotal > 0)
      ? ((cTotal - precoTotal) / precoTotal) * 100
      : null;
    const comm = commissionForItem({ ...it, custoTotal, precoTotal }, $commissionRule);
    return { it, proprio, custoTotal, precoTotal, cTotal, concorr, delta, comm };
  });
  $: orcTotW    = items.reduce((a, it) => a + it.C.tot, 0);
  $: orcTotal   = orcRows.reduce((a, r) => a + r.precoTotal, 0);
  $: commTotal  = orcRows.reduce((a, r) => a + r.comm, 0);
  $: showConc   = orcRows.some((r) => r.concorr.venda > 0);
</script>

<div class="overlay">
  <div class="ov-bar">
    <span class="ttl">{kind === 'orc' ? 'Orçamento' : 'Ordem de produção'}</span>
    {#if kind === 'orc'}
      <select class="reg" bind:value={$regionId}>
        {#each $regions as r}<option value={r.id}>{r.nome}</option>{/each}
      </select>
    {/if}
    <div style="flex:1"></div>
    {#if kind !== 'op' || opMode}
      <button class="btn ghost" on:click={() => window.print()}>Imprimir / salvar PDF</button>
    {/if}
    <button class="btn ghost" on:click={() => dispatch('close')}>Fechar</button>
  </div>

  <div class="ov-scroll">
    {#if kind === 'op' && !opMode}
      <div class="choose">
        <div class="ct">Como gerar a ordem de produção?</div>
        <div class="cs">{items.length} item(ns) no pedido</div>
        <div class="cbtns">
          <button class="opt" on:click={() => (opMode = 'single')}><b>Folha única</b><span>todos os itens juntos</span></button>
          <button class="opt amber" on:click={() => (opMode = 'peritem')}><b>Uma por item</b><span>1 perfil por página</span></button>
        </div>
      </div>
    {/if}

    {#if kind === 'op' && opMode === 'peritem'}
      {#each items as it, i}
        <div class="paper">
          <div class="ph">
            <div><div class="logo">Perfilar</div><div class="tag">ferro &amp; aço · perfilação</div></div>
            <div class="pr">
              <b>Ordem de produção · OP-{i + 1}/{items.length}</b><br>
              Cliente: {$ctx.cliente || '—'} · Orç.: {$ctx.orc || '—'} · {dt}
            </div>
          </div>
          <div class="itemhead"><span>Item {i + 1} · {it.label}</span><span>{it.params.Q} peças</span></div>
          {@html itemBlock(it, 'op' + i)}
        </div>
      {/each}
    {/if}

    {#if kind === 'op' && opMode === 'single'}
      <div class="paper">
        <div class="ph">
          <div><div class="logo">Perfilar</div><div class="tag">ferro &amp; aço · perfilação</div></div>
          <div class="pr"><b>Ordem de produção</b><br>Cliente: {$ctx.cliente || '—'} · Orç.: {$ctx.orc || '—'} · {dt}</div>
        </div>
        <div class="muted">{items.length} itens · {items.reduce((a, it) => a + it.params.Q, 0)} peças · {nf(orcTotW, 1)} kg</div>
        {#each items as it, i}
          <div class="block">
            <div class="itemhead sm"><span>Item {i + 1} · {it.label}</span><span>{it.params.Q} peças</span></div>
            {@html itemBlock(it, 'ops' + i)}
          </div>
        {/each}
        <div class="optot"><span>Total da ordem</span><span>{items.reduce((a, it) => a + it.params.Q, 0)} peças · {nf(orcTotW, 1)} kg</span></div>
      </div>
    {/if}

    {#if kind === 'orc'}
      <div class="paper">
        <div class="ph">
          <div><div class="logo">Perfilar</div><div class="tag">ferro &amp; aço · perfilação</div></div>
          <div class="pr"><b>Orçamento</b><br>Cliente: {$ctx.cliente || '—'} · Orç.: {$ctx.orc || '—'} · {dt}<br>Região: {$regions.find((r) => r.id === $regionId)?.nome}</div>
        </div>

        <!-- Tabela de itens -->
        <table class="otab">
          <thead>
            <tr>
              <th>It.</th>
              <th>Perfil</th>
              <th class="r">Des.</th>
              <th class="r">Compr.</th>
              <th class="r">Qtd</th>
              <th class="r">Peso kg</th>
              <th class="r">Custo R$/kg</th>
              <th class="r">Venda R$/kg</th>
              <th class="r">Total</th>
              {#if showConc}<th class="r">Conc.</th><th class="r">Δ%</th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each orcRows as r, i}
              <tr>
                <td>{i + 1}</td>
                <td class="sans">{r.it.label}</td>
                <td class="r">{nf(r.it.C.des, 0)}</td>
                <td class="r">{nf(r.it.params.C, 0)}</td>
                <td class="r">{r.it.params.Q}</td>
                <td class="r">
                  {nf(r.it.C.tot, 1)}
                  {#if r.it.params.cobrarSobra && r.it.C.totFat > r.it.C.totLiq + 0.001}
                    <br><span class="sob-note">líq. {nf(r.it.C.totLiq, 1)}</span>
                  {/if}
                </td>
                <td class="r">{r.proprio.custo > 0 ? nf(r.proprio.custo, 2) : '—'}</td>
                <td class="r">{r.proprio.custo > 0 ? nf(r.proprio.custo * (1 + r.it.params.mg / 100), 2) : '—'}</td>
                <td class="r">{brl(r.precoTotal)}</td>
                {#if showConc}
                  <td class="r">{r.concorr.venda > 0 ? brl(r.cTotal) : '—'}</td>
                  <td class="r" class:verde={r.delta > 0} class:amber={r.delta !== null && r.delta < 0}>
                    {#if r.delta !== null}{r.delta > 0 ? '+' : ''}{nf(r.delta, 1)}%{:else}—{/if}
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>

        <!-- Totais -->
        <div class="totbox">
          <div><span>Peso total</span><b>{nf(orcTotW, 1)} kg</b></div>
          <div class="grand"><span>Total do orçamento</span><b>{brl(orcTotal)}</b></div>
        </div>

        <!-- Bloco de comissão -->
        {#if $commissionRule}
          <div class="comm">
            <div class="comm-h">Comissão <span class="comm-rule">({ruleLabel($commissionRule)})</span></div>
            <div class="comm-rows">
              {#each orcRows as r, i}
                <div class="comm-item">
                  <span>{i + 1}. {r.it.name ?? r.it.label}</span>
                  <span>{brl(r.comm)}</span>
                </div>
              {/each}
            </div>
            <div class="comm-tot"><span>Total comissão</span><b>{brl(commTotal)}</b></div>
          </div>
        {/if}

        <div class="fine">Valores estimados pela tabela de preço da região selecionada e margem por item. Impostos e fretes não inclusos.</div>
      </div>
    {/if}
  </div>
</div>

<script context="module">
  import { dimensionedSVG as _dim } from '../../lib/draw.js';
  import { nf as _nf, mpSummary as _mp } from '../../lib/engine.js';
  const _pc = { sheet: '#1f6fb2', dim: '#9C5A0C', text: '#16202B' };
  export function itemBlock(it, id) {
    const d = _dim(it.rows, it.h0, it.params.t, it.conv, _pc, { W: 340, H: 230, id });
    const rowsHtml = it.rows.map((r, i) => {
      const last = i === it.rows.length - 1;
      return `<tr><td class="ix">${i + 1}</td><td>${r[0]}</td><td class="r mono">${r[1]}</td><td class="c mono">${last ? '—' : r[2] + '°'}</td><td class="c">${last ? '—' : (r[3] > 0 ? '↑' : '↓')}</td></tr>`;
    }).join('');
    const sobDiv = (it.params.cobrarSobra && it.C.totFat > it.C.totLiq + 0.001)
      ? `<div class="sob-bar">Sobra cobrada — peso líquido: <b>${_nf(it.C.totLiq, 1)} kg</b> · faturado: <b>${_nf(it.C.totFat, 1)} kg</b></div>`
      : '';
    return `<div class="ig">
      <div><div class="croqui">${d.svg}</div><div class="cap">larg. ${d.w} × alt. ${d.h} mm · esp. ${_nf(it.params.t, 2)} mm · ${it.conv === 'int' ? 'internas' : 'externas'}</div></div>
      <div><table class="dt"><thead><tr><th>#</th><th>Aba</th><th class="r">mm</th><th class="c">dobra</th><th class="c">sent.</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="code">${it.code}</div></div>
    </div>
    <div class="kv">
      <span>Desenv.: <b>${_nf(it.C.des, 0)} mm</b></span><span>Compr.: <b>${_nf(it.params.C, 0)} mm</b></span>
      <span>Qtd: <b>${it.params.Q}</b></span><span>Peso/pç: <b>${_nf(it.C.pc, 2)} kg</b></span><span>Peso total: <b>${_nf(it.C.tot, 1)} kg</b></span>
    </div>
    ${sobDiv}
    <div class="mp">Matéria-prima: ${_mp(it.params, it.C)}</div>`;
  }
</script>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(16,24,33,.55); display: flex; flex-direction: column; z-index: 50; }
  .ov-bar  { height: 52px; background: var(--ink); display: flex; align-items: center; gap: 10px; padding: 0 16px; color: #fff; flex-shrink: 0; }
  .ttl { font-weight: 600; }
  .reg { height: 32px; background: #222e3b; border: 1px solid #33414f; border-radius: 6px; color: #fff; padding: 0 8px; font-size: 13px; }
  .btn { height: 34px; padding: 0 14px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid #33414f; cursor: pointer; }
  .ghost { background: #222e3b; color: #dfe7ef; } .ghost:hover { background: #2a3543; }
  .ov-scroll { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 20px; }

  .choose { background: #fff; border-radius: 12px; padding: 26px; max-width: 460px; text-align: center; }
  .ct { font-weight: 600; font-size: 16px; margin-bottom: 6px; }
  .cs { color: var(--ink-soft); font-size: 13px; margin-bottom: 18px; }
  .cbtns { display: flex; gap: 10px; }
  .opt { flex: 1; height: 64px; display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); cursor: pointer; }
  .opt span { font-size: 11px; color: var(--ink-soft); }
  .opt.amber { background: var(--amber); border-color: var(--amber); color: #fff; } .opt.amber span { color: #ffe; }

  .paper { background: #fff; width: 800px; max-width: 100%; padding: 34px 38px; border-radius: 4px; box-shadow: 0 8px 30px rgba(16,24,33,.25); color: #16202B; }
  .ph { display: flex; justify-content: space-between; border-bottom: 1.5px solid #16202B; padding-bottom: 10px; margin-bottom: 14px; }
  .logo { font-family: var(--disp); font-weight: 600; font-size: 17px; }
  .tag  { font-size: 11px; color: var(--ink-soft); }
  .pr   { text-align: right; font-size: 12px; }
  .muted { font-size: 12px; color: var(--ink-soft); margin-bottom: 10px; }
  .itemhead { background: var(--panel-2); border-radius: 6px; padding: 7px 11px; font-weight: 600; font-size: 13px; margin-bottom: 10px; display: flex; justify-content: space-between; }
  .itemhead.sm { font-size: 12.5px; padding: 6px 10px; margin-bottom: 8px; }
  .block { margin-bottom: 18px; padding-bottom: 14px; border-bottom: .5px solid var(--line); }
  .optot { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; padding-top: 6px; }

  :global(.ig) { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
  :global(.croqui) { border: .5px solid var(--line); border-radius: 6px; }
  :global(.croqui svg) { width: 100%; display: block; }
  :global(.cap) { font-size: 10.5px; color: var(--ink-faint); text-align: center; margin-top: 4px; font-family: var(--mono); }
  :global(.dt) { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  :global(.dt th) { color: var(--ink-faint); text-align: left; font-size: 10px; padding: 3px 4px; font-weight: 500; }
  :global(.dt td) { padding: 3px 4px; border-top: .5px solid var(--line); }
  :global(.dt .ix) { color: var(--ink-faint); } :global(.dt .r), :global(.otab .r) { text-align: right; } :global(.dt .c) { text-align: center; }
  :global(.dt .mono) { font-family: var(--mono); }
  :global(.code) { font-family: var(--mono); font-size: 10.5px; background: var(--panel-2); padding: 6px 8px; border-radius: 5px; margin-top: 8px; word-break: break-all; }
  :global(.kv) { display: flex; gap: 18px; margin-top: 10px; font-size: 12px; flex-wrap: wrap; }
  :global(.kv b) { font-family: var(--mono); }
  :global(.mp) { font-size: 11px; color: var(--ink-soft); border-left: 2px solid var(--amber); padding-left: 8px; margin-top: 8px; }
  :global(.sob-bar) { font-size: 11px; color: #9C5A0C; border-left: 2px solid #EA8A1E; padding-left: 8px; margin-top: 6px; }
  .sob-note { font-size: 9.5px; color: var(--ink-faint); }

  .otab { width: 100%; border-collapse: collapse; font-size: 12px; }
  .otab th { color: var(--ink-faint); text-align: left; font-size: 10px; border-bottom: 1px solid #16202B; padding: 6px 4px; font-weight: 500; white-space: nowrap; }
  .otab td { padding: 5px 4px; border-top: .5px solid var(--line); font-family: var(--mono); }
  .otab td.sans { font-family: var(--sans); }
  .verde { color: #1a7a40; font-weight: 500; }
  .amber { color: #c07000; font-weight: 500; }

  .totbox { display: flex; flex-direction: column; align-items: flex-end; margin-top: 14px; gap: 4px; font-size: 13px; }
  .totbox div { display: flex; gap: 18px; } .totbox b { font-family: var(--mono); }
  .grand { border-top: 1px solid #16202B; padding-top: 6px; font-weight: 600; font-size: 15px; }

  .comm { margin-top: 16px; border-top: 1px dashed #bbb; padding-top: 12px; }
  .comm-h { font-size: 12px; font-weight: 600; color: var(--ink-soft); margin-bottom: 6px; }
  .comm-rule { font-weight: 400; color: var(--ink-faint); }
  .comm-rows { display: flex; flex-direction: column; gap: 2px; }
  .comm-item { display: flex; justify-content: space-between; font-size: 12px; }
  .comm-item span:last-child { font-family: var(--mono); }
  .comm-tot { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-top: 6px; padding-top: 6px; border-top: .5px solid var(--line); }
  .comm-tot b { font-family: var(--mono); }

  .fine { font-size: 10.5px; color: var(--ink-faint); margin-top: 20px; }

  @media print {
    .ov-bar { display: none; }
    .overlay { position: static; background: #fff; }
    .ov-scroll { padding: 0; display: block; }
    .paper { box-shadow: none; width: auto; border-radius: 0; padding: 0; page-break-after: always; }
  }
</style>
