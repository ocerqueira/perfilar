// Motor de cálculo — perfis dobrados a frio + matéria-prima (bobina/chapa).

export const MATERIALS = [
  { name: 'Galvanizado', dens: 7850 },
  { name: 'Galvalume',   dens: 7700 },
  { name: 'Aço preto',   dens: 7850 },
  { name: 'Alumínio',    dens: 2710 },
  { name: 'Inox 304',    dens: 8000 },
  { name: 'Cobre',       dens: 8960 },
];

export const REVESTIMENTOS = ['Z275', 'Z350', 'AZ150 (Galvalume)', 'Pré-pintado', 'Sem revestimento'];

export const GAUGES = [0.43, 0.50, 0.65, 0.80, 0.95, 1.25, 1.55, 1.95, 2.25, 2.65, 3.00];

const rad = (d) => (d * Math.PI) / 180;

export function profilePoints(rows, h0) {
  const pts = [[0, 0]];
  let h = rad(h0);
  for (let i = 0; i < rows.length; i++) {
    const p = pts[pts.length - 1];
    pts.push([p[0] + rows[i][1] * Math.cos(h), p[1] + rows[i][1] * Math.sin(h)]);
    if (i < rows.length - 1) h += rows[i][3] * rad(rows[i][2]);
  }
  return pts;
}

export function bendDeduction(angleDeg, { R, t, K }, conv) {
  const A = rad(angleDeg);
  const BA = A * (R + K * t);
  const SB = (conv === 'int' ? R : R + t) * Math.tan(A / 2);
  return 2 * SB - BA;
}

// kg por metro de uma tira de largura W (mm)
const linearMass = (W, t, dens) => (W * t * dens) / 1e6;

export function compute(rows, P, conv, bdMode) {
  const sum = rows.reduce((a, r) => a + r[1], 0);
  let bd = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    bd += bdMode === 'man' ? P.manBD * (rows[i][2] / 90) : bendDeduction(rows[i][2], P, conv);
  }
  const des = sum - bd;                          // desenvolvimento (largura do blank), mm
  const Cm = P.C / 1000;                          // comprimento, m
  const kgm = linearMass(des, P.t, P.dens);       // peso líquido por metro
  const pcLiq = kgm * Cm;                          // peso líquido por peça
  const totLiq = pcLiq * P.Q;                      // peso líquido total

  // --- aproveitamento da matéria-prima ---
  const refilo = P.refilo || 0;
  const espac  = P.espac  || 0;

  let larguraFatMM = des;
  let tiras = 0, sobra = 0, apr = 100, perSheet = 0, orient = '—', sheetCols = 0, sheetRows = 0;

  if (P.forma === 'bobina') {
    const coilUtil = P.coil - 2 * refilo;
    tiras = des > 0 ? Math.floor((coilUtil + espac) / (des + espac)) : 0;
    sobra = coilUtil - tiras * des - Math.max(0, tiras - 1) * espac;
    apr = P.coil > 0 ? (tiras * des) / P.coil * 100 : 0;
    larguraFatMM = P.cobrarSobra && tiras > 0 ? P.coil / tiras : des;
  } else { // chapa
    const lUtil = P.chapaL - 2 * refilo;
    const cUtil = P.chapaC - 2 * refilo;
    const fit = (dim, slot) => (dim + espac) > 0 ? Math.floor((slot + espac) / (dim + espac)) : 0;
    const cols1 = fit(des, lUtil),  rows1 = fit(P.C, cUtil);
    const cols2 = fit(P.C, lUtil),  rows2 = fit(des, cUtil);
    const a1 = cols1 * rows1, a2 = cols2 * rows2;
    perSheet = Math.max(a1, a2);
    orient = a1 >= a2 ? 'reta' : 'girada 90°';
    sheetCols = a1 >= a2 ? cols1 : cols2;
    sheetRows = a1 >= a2 ? rows1 : rows2;
    const areaBlank = des * P.C, areaSheet = P.chapaL * P.chapaC;
    apr = areaSheet > 0 && perSheet > 0 ? (perSheet * areaBlank) / areaSheet * 100 : 0;
    sobra = areaSheet - perSheet * areaBlank;
    larguraFatMM = P.cobrarSobra && perSheet > 0 ? (areaSheet / perSheet) / P.C : des;
  }

  const kgmFat = linearMass(larguraFatMM, P.t, P.dens);
  const pcFat = kgmFat * Cm;
  const totFat = pcFat * P.Q;

  return {
    sum, des, kgm, pcLiq, totLiq, pcFat, totFat,
    tiras, sobra, apr, perSheet, orient, larguraFatMM,
    sheetCols, sheetRows, refilo, espac,
    pc: pcLiq, tot: P.cobrarSobra ? totFat : totLiq,
  };
}

export function describe(name, P, des, rows, conv) {
  const lens = rows.map((r) => r[1]).join('/');
  const rev = P.revest && P.revest !== 'Sem revestimento' ? ` ${P.revest}` : '';
  return `${name.toLowerCase().replace(/ /g, '-')} · ${P.matName.toLowerCase()}${rev.toLowerCase()} ${nf(P.t, 2)} · des ${nf(des, 0)} · c ${nf(P.C, 0)} · ${lens} · [${conv}]`;
}

export const nf = (n, d) =>
  (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const brl = (n) => 'R$ ' + nf(n, 2);

export function mpSummary(P, C) {
  if (P.forma === 'bobina') {
    return `Tira ${nf(C.des, 0)} mm da bobina ${nf(P.coil, 0)} mm → ${C.tiras} tira(s)/bobina · sobra ${nf(C.sobra, 0)} mm · aprov. ${nf(C.apr, 0)}%`;
  }
  return `${C.perSheet} peça(s) por chapa ${nf(P.chapaL, 0)}×${nf(P.chapaC, 0)} mm (${C.orient}) · sobra ${nf(C.sobra / 1e6, 2)} m² · aprov. ${nf(C.apr, 0)}%`;
}
