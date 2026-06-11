// Catálogo configurável: materiais, revestimentos, bitolas, presets e suas restrições.
import { MATERIALS, REVESTIMENTOS, GAUGES } from './engine.js';
import { PRESETS, ICONS } from './presets.js';

export const DEFAULT_RESTRICTIONS = {
  minFlange:      10,     // mm — aba mínima
  maxFlange:      null,   // mm — sem limite por padrão
  minRadius:      null,   // mm — null = usa a bitola como mínimo
  checkCollision: true,   // detectar auto-interseção
};

const KEYS = {
  mat:  'perfilar.catalog.mat.v1',
  rev:  'perfilar.catalog.rev.v1',
  gau:  'perfilar.catalog.gau.v1',
  cust: 'perfilar.catalog.cust.v1',
  over: 'perfilar.catalog.over.v1',
};

function ls(key, def) {
  try { const r = localStorage.getItem(key); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return def;
}
function lss(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

export function loadMaterials()       { return ls(KEYS.mat,  MATERIALS.map((m) => ({ ...m }))); }
export function loadRevests()         { return ls(KEYS.rev,  [...REVESTIMENTOS]); }
export function loadGauges()          { return ls(KEYS.gau,  [...GAUGES]); }
export function loadCustomPresets()   { return ls(KEYS.cust, []); }
// overrides: { [presetKey]: { name?, h0?, rows?, restrictions? } }
export function loadPresetOverrides() { return ls(KEYS.over, {}); }

export function saveMaterials(d)       { lss(KEYS.mat,  d); }
export function saveRevests(d)         { lss(KEYS.rev,  d); }
export function saveGauges(d)          { lss(KEYS.gau,  d); }
export function saveCustomPresets(d)   { lss(KEYS.cust, d); }
export function savePresetOverrides(d) { lss(KEYS.over, d); }

// Retorna o preset efetivo (base + override) para uso no editor.
export function effectivePreset(key, overrides = {}) {
  const base = PRESETS[key];
  if (!base) return null;
  const ov = overrides[key] ?? {};
  return {
    key,
    name:         ov.name         ?? base.name,
    h0:           ov.h0           ?? base.h0,
    rows:         ov.rows         ? ov.rows.map((r) => [...r]) : base.rows.map((r) => [...r]),
    icon:         ICONS[key]      ?? '',
    restrictions: { ...DEFAULT_RESTRICTIONS, ...(ov.restrictions ?? {}) },
  };
}

export const CAT_ORDER_DEFAULT = ['calha', 'u', 'ue', 'cant', 'z', 'rufo', 'ping'];
