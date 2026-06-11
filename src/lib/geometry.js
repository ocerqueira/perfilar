// Geometria via Maker.js — fonte única do modelo para DXF e preview.
import makerjs from 'makerjs';
import { profilePoints } from './engine.js';

// Constrói o modelo da seção (linha de centro), com raios de dobra reais quando possível.
export function buildModel(rows, h0, R) {
  const pts = profilePoints(rows, h0);
  const m = new makerjs.models.ConnectTheDots(false, pts); // polilinha aberta
  m.units = makerjs.unitType.Millimeter;
  if (R > 0) {
    try {
      const chain = makerjs.model.findSingleChain(m);
      const fillets = makerjs.chain.fillet(chain, R);
      if (fillets) m.models = { fillets };
    } catch (e) {
      // se alguma aba for menor que o raio, mantém cantos vivos
      console.warn('fillet ignorado:', e.message);
    }
  }
  return m;
}

export function toDXF(rows, h0, R) {
  const m = buildModel(rows, h0, R);
  return makerjs.exporter.toDXF(m, { units: makerjs.unitType.Millimeter });
}

export function toSVGString(rows, h0, R, opts = {}) {
  const m = buildModel(rows, h0, R);
  return makerjs.exporter.toSVG(m, {
    stroke: opts.stroke || '#1f6fb2',
    strokeWidth: opts.strokeWidth || '1.5',
    units: makerjs.unitType.Millimeter,
    fill: 'none',
    scale: opts.scale || 1,
  });
}

export function download(filename, text, mime = 'application/dxf') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
