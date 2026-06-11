// Validação de perfil: restrições dimensionais (N1) + auto-interseção (N2).
import { profilePoints } from './engine.js';
import { DEFAULT_RESTRICTIONS } from './catalog.js';

export function validateProfile(rows, params, h0, restrictions = {}) {
  const { minFlange, maxFlange, minRadius, checkCollision } = {
    ...DEFAULT_RESTRICTIONS,
    ...restrictions,
  };
  const minR = minRadius ?? params.t;
  const warnings = [];

  rows.forEach((r, i) => {
    const label = r[0] || `Aba ${i + 1}`;
    if (r[1] < minFlange) {
      warnings.push({
        type: 'flange-min', row: i,
        msg: `${label}: ${r[1]} mm — mínimo é ${minFlange} mm`,
      });
    }
    if (maxFlange != null && r[1] > maxFlange) {
      warnings.push({
        type: 'flange-max', row: i,
        msg: `${label}: ${r[1]} mm — máximo é ${maxFlange} mm`,
      });
    }
  });

  if (params.R < minR) {
    warnings.push({
      type: 'radius',
      msg: `Raio ${params.R.toFixed(1)} mm < mínimo de ${minR.toFixed(1)} mm (bitola ${params.t} mm)`,
    });
  }

  if (checkCollision && rows.length >= 3) {
    if (hasCollision(rows, h0)) {
      warnings.push({ type: 'collision', msg: 'Colisão: o traçado do perfil se cruza.' });
    }
  }

  return warnings;
}

// Nível 2: detecta se dois segmentos não-adjacentes do traçado se intersectam.
export function hasCollision(rows, h0) {
  const pts = profilePoints(rows, h0);
  if (pts.length < 4) return false; // precisa de ≥ 3 segmentos
  for (let i = 0; i < pts.length - 3; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      if (segsIntersect(pts[i], pts[i + 1], pts[j], pts[j + 1])) return true;
    }
  }
  return false;
}

function cross2d(ax, ay, bx, by) { return ax * by - ay * bx; }

function segsIntersect([x1, y1], [x2, y2], [x3, y3], [x4, y4]) {
  const dx1 = x2 - x1, dy1 = y2 - y1;
  const dx2 = x4 - x3, dy2 = y4 - y3;
  const d   = cross2d(dx1, dy1, dx2, dy2);
  if (Math.abs(d) < 1e-9) return false; // paralelos
  const t = cross2d(x3 - x1, y3 - y1, dx2, dy2) / d;
  const u = cross2d(x3 - x1, y3 - y1, dx1, dy1) / d;
  return t > 0 && t < 1 && u > 0 && u < 1;
}
