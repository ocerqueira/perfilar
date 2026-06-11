// SVG cotado compartilhado — usado no editor (tema escuro) e nos documentos (tema claro).
import { profilePoints } from './engine.js';

const co = (n) => Math.round(n * 100) / 100;

export function dimensionedSVG(rows, h0, t, conv, colors, opts = {}) {
  const W = opts.W || 360, H = opts.H || 250, pad = opts.pad || 40;
  const grid = opts.grid;
  const scalebar = opts.scalebar;
  const markerId = opts.id || 'ar';

  const pts = profilePoints(rows, h0);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);
  const sc = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh);
  const ox = pad + (W - 2 * pad - bw * sc) / 2 - minX * sc;
  const oy = pad + (H - 2 * pad - bh * sc) / 2 - minY * sc;
  const S = pts.map((p) => [ox + p[0] * sc, oy + p[1] * sc]);
  const cx = S.reduce((a, p) => a + p[0], 0) / S.length;
  const cy = S.reduce((a, p) => a + p[1], 0) / S.length;
  const sw = Math.max(2.5, Math.min(13, t * sc));

  let g = '';
  if (grid) {
    for (let x = 0; x < W; x += 20) g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${grid}" stroke-width="1"/>`;
    for (let y = 0; y < H; y += 20) g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${grid}" stroke-width="1"/>`;
  }

  const poly = S.map((p) => `${co(p[0])},${co(p[1])}`).join(' ');
  const line = `<polyline points="${poly}" fill="none" stroke="${colors.sheet}" stroke-width="${co(sw)}" stroke-linejoin="round" stroke-linecap="round"/>`;

  const inner = conv === 'int';
  const sysLabels = !!opts.sysLabels;
  let dim = '';
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (((mx - cx) * nx + (my - cy) * ny < 0) !== inner) { nx = -nx; ny = -ny; }
    const d = 20;
    const a2 = [a[0] + nx * d, a[1] + ny * d], b2 = [b[0] + nx * d, b[1] + ny * d];
    dim += `<line x1="${co(a[0] + nx * 4)}" y1="${co(a[1] + ny * 4)}" x2="${co(a2[0] + nx * 4)}" y2="${co(a2[1] + ny * 4)}" stroke="${colors.dim}" stroke-width="0.6"/>`;
    dim += `<line x1="${co(b[0] + nx * 4)}" y1="${co(b[1] + ny * 4)}" x2="${co(b2[0] + nx * 4)}" y2="${co(b2[1] + ny * 4)}" stroke="${colors.dim}" stroke-width="0.6"/>`;
    dim += `<line x1="${co(a2[0])}" y1="${co(a2[1])}" x2="${co(b2[0])}" y2="${co(b2[1])}" stroke="${colors.dim}" stroke-width="1" marker-start="url(#${markerId})" marker-end="url(#${markerId})"/>`;
    if (sysLabels) {
      const tx = co(mx + nx * (d + 10)), ty = co(my + ny * (d + 10));
      dim += `<text text-anchor="middle" font-family="IBM Plex Mono,monospace" fill="${colors.text}">` +
        `<tspan x="${tx}" y="${co(my + ny * (d + 4))}" font-size="8.5" opacity="0.65">A${i + 1}</tspan>` +
        `<tspan x="${tx}" dy="11" font-size="11">${rows[i][1]}</tspan></text>`;
    } else {
      dim += `<text x="${co(mx + nx * (d + 9))}" y="${co(my + ny * (d + 9) + 3)}" font-size="11" font-family="IBM Plex Mono,monospace" fill="${colors.text}" text-anchor="middle">${rows[i][1]}</text>`;
    }
  }
  // Anotações de ângulo nas dobras (apenas modo sysLabels)
  if (sysLabels) {
    for (let i = 0; i < S.length - 2; i++) {
      const bp = S[i + 1];
      const ddx = cx - bp[0], ddy = cy - bp[1], dl = Math.hypot(ddx, ddy) || 1;
      const ax = co(bp[0] + (ddx / dl) * 15), ay = co(bp[1] + (ddy / dl) * 15 + 3);
      dim += `<text x="${ax}" y="${ay}" font-size="8.5" font-family="IBM Plex Mono,monospace" fill="${colors.dim}" text-anchor="middle" opacity="0.8">α${i + 1}: ${rows[i][2]}°</text>`;
    }
  }

  let bar = '';
  if (scalebar) {
    const raw = 58 / sc, pw = 10 ** Math.floor(Math.log10(raw)), f = raw / pw;
    const nm = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pw;
    const bl = nm * sc, bx = 14, by = H - 16;
    bar = `<g stroke="${colors.text}" stroke-width="1" opacity="0.7"><line x1="${co(bx)}" y1="${co(by)}" x2="${co(bx + bl)}" y2="${co(by)}"/><line x1="${co(bx)}" y1="${co(by - 4)}" x2="${co(bx)}" y2="${co(by + 4)}"/><line x1="${co(bx + bl)}" y1="${co(by - 4)}" x2="${co(bx + bl)}" y2="${co(by + 4)}"/></g><text x="${co(bx + bl + 6)}" y="${co(by + 3.5)}" font-size="10" font-family="IBM Plex Mono,monospace" fill="${colors.text}" opacity="0.8">${nm} mm</text>`;
  }

  const defs = `<defs><marker id="${markerId}" markerWidth="9" markerHeight="9" refX="5" refY="4" orient="auto"><path d="M1,1 L6,4 L1,7" fill="none" stroke="${colors.dim}" stroke-width="1.1"/></marker></defs>`;
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" role="img"><title>Croqui cotado</title>${defs}${g}${line}${dim}${bar}</svg>`,
    w: Math.round(maxX - minX), h: Math.round(maxY - minY),
  };
}
