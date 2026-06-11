<script>
  import { dimensionedSVG } from '../lib/draw.js';
  import { nf } from '../lib/engine.js';

  export let rows;
  export let h0;
  export let t;
  export let conv = 'ext';

  let svg = '';
  let dimText = '';

  $: {
    const d = dimensionedSVG(rows, h0, t, conv,
      { sheet: '#5FA8E0', dim: '#F4B740', text: '#dbe7f2' },
      { W: 380, H: 280, grid: 'rgba(255,255,255,.055)', scalebar: true, id: 'arb' });
    svg = d.svg;
    dimText = `larg. ${d.w} × alt. ${d.h} mm · esp. ${nf(t, 2)} mm`;
  }
</script>

<div class="bp">
  <span class="badge">{conv === 'int' ? 'INT' : 'EXT'}</span>
  {@html svg}
  <span class="meta">{dimText}</span>
</div>

<style>
  .bp { background: var(--canvas); border-radius: 0 0 var(--r) var(--r); position: relative; }
  .bp :global(svg) { display: block; width: 100%; }
  .meta { position: absolute; left: 12px; bottom: 10px; font-family: var(--mono); font-size: 11px; color: #8fa6bd; }
  .badge { position: absolute; right: 12px; top: 10px; font-family: var(--mono); font-size: 10px; color: #0e1722; background: var(--dim); padding: 2px 7px; border-radius: 4px; letter-spacing: .5px; }
</style>
