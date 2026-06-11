import { writable } from 'svelte/store';
import { PRESETS, clone } from './presets.js';
import { loadRegions } from './pricing.js';
import { DEFAULT_RULE } from './commission.js';
import {
  loadMaterials, loadRevests, loadGauges,
  loadCustomPresets, loadPresetOverrides,
} from './catalog.js';

const COMM_KEY = 'perfilar.commission.v1';

export function freshEditor(key = 'calha') {
  const p = PRESETS[key];
  return {
    mode: 'cat', key, conv: 'ext', bd: 'auto', h0: p.h0,
    rows: clone(p.rows),
    params: { matName: 'Galvanizado', dens: 7850, revest: 'Z275', t: 0.65, forma: 'bobina', coil: 1200, chapaL: 1200, chapaC: 3000, cobrarSobra: false, C: 3000, Q: 10, R: 2, K: 0.44, manBD: 1.7, mg: 35 },
  };
}

function loadCommRule() {
  try {
    const raw = localStorage.getItem(COMM_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { ...DEFAULT_RULE };
}

export function saveCommRule(rule) {
  try { localStorage.setItem(COMM_KEY, JSON.stringify(rule)); } catch { /* ignore */ }
}

export const editor          = writable(freshEditor());
export const order           = writable({ items: [], sel: -1 });
export const ctx             = writable({ cliente: '', orc: '' });
export const regions         = writable(loadRegions());
export const regionId        = writable(loadRegions()[0].id);
export const commissionRule  = writable(loadCommRule());

// Catálogo configurável
export const catalogMaterials = writable(loadMaterials());
export const catalogRevests   = writable(loadRevests());
export const catalogGauges    = writable(loadGauges());
export const catalogPresets   = writable(loadCustomPresets());   // presets personalizados
export const catalogOverrides = writable(loadPresetOverrides()); // overrides de geometria/restrições para built-ins
