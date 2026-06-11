<script>
  export let P;
  export let C;

  $: refilo = C.refilo || 0;
  $: espac  = C.espac  || 0;

  // Bobina
  $: bStroke = Math.max(P.coil * 0.002, 0.5);
  $: sobraX  = refilo + C.tiras * C.des + Math.max(0, C.tiras - 1) * espac;
  $: sobraW  = (P.coil - refilo) - sobraX;
  $: tirasArr = Array.from({ length: C.tiras });
  $: gapsArr  = Array.from({ length: Math.max(0, C.tiras - 1) });

  // Chapa
  $: isGirada = C.orient === 'girada 90°';
  $: bw = isGirada ? P.C : C.des;
  $: bh = isGirada ? C.des : P.C;
  $: cStroke = Math.max(P.chapaL * 0.004, 0.5);
  $: gridW = C.sheetCols > 0 ? C.sheetCols * bw + Math.max(0, C.sheetCols - 1) * espac : 0;
  $: gridH = C.sheetRows > 0 ? C.sheetRows * bh + Math.max(0, C.sheetRows - 1) * espac : 0;
</script>

{#if P.forma === 'bobina' && C.des > 0}
  <svg viewBox="0 0 {P.coil} 60" preserveAspectRatio="none"
       style="display:block;width:100%;height:52px;border-radius:4px"
       xmlns="http://www.w3.org/2000/svg">
    <rect width={P.coil} height={60} fill="#f0f4f8" />
    {#if refilo > 0}
      <rect x={0}               y={0} width={refilo} height={60} fill="#dbe4ef" />
      <rect x={P.coil - refilo} y={0} width={refilo} height={60} fill="#dbe4ef" />
    {/if}
    {#if C.tiras === 0}
      <rect x={refilo} y={0} width={P.coil - 2 * refilo} height={60} fill="#fee2e2" />
    {:else if sobraW > 0}
      <rect x={sobraX} y={0} width={sobraW} height={60} fill="#fee2e2" />
    {/if}
    {#each tirasArr as _, i}
      {@const sx = refilo + i * (C.des + espac)}
      <rect x={sx} y={2} width={C.des} height={56}
            fill="#fef3c7" stroke="#f59e0b" stroke-width={bStroke} />
    {/each}
    {#each gapsArr as _, i}
      {@const gx = refilo + i * (C.des + espac) + C.des}
      <rect x={gx} y={0} width={espac} height={60} fill="#e0e8f0" />
    {/each}
  </svg>

{:else if P.forma === 'chapa' && C.des > 0 && C.sheetCols > 0 && C.sheetRows > 0}
  <svg viewBox="0 0 {P.chapaL} {P.chapaC}"
       style="display:block;aspect-ratio:{P.chapaL}/{P.chapaC};max-height:160px;max-width:100%;height:auto;width:auto;margin:0 auto"
       xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="blank-pat" x={refilo} y={refilo}
               width={bw + espac} height={bh + espac}
               patternUnits="userSpaceOnUse">
        <rect x={0} y={0} width={bw} height={bh}
              fill="#fef3c7" stroke="#f59e0b" stroke-width={cStroke} />
      </pattern>
    </defs>
    <rect width={P.chapaL} height={P.chapaC} fill="#dbe4ef" />
    <rect x={refilo} y={refilo}
          width={P.chapaL - 2 * refilo} height={P.chapaC - 2 * refilo}
          fill="#fee2e2" />
    <rect x={refilo} y={refilo} width={gridW} height={gridH} fill="url(#blank-pat)" />
    <rect width={P.chapaL} height={P.chapaC}
          fill="none" stroke="#64748b" stroke-width={cStroke * 2} />
    {#if refilo > 0}
      <rect x={refilo} y={refilo}
            width={P.chapaL - 2 * refilo} height={P.chapaC - 2 * refilo}
            fill="none" stroke="#94a3b8" stroke-width={cStroke}
            stroke-dasharray="{cStroke * 4} {cStroke * 2}" />
    {/if}
  </svg>
{/if}
