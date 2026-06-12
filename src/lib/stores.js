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
    params: { matName: 'Galvanizado', dens: 7850, revest: 'Z275', t: 0.65, forma: 'bobina', coil: 1200, chapaL: 1200, chapaC: 3000, cobrarSobra: false, C: 3000, Q: 10, R: 2, K: 0.44, manBD: 1.7, mg: 35, refilo: 0, espac: 0 },
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

// Dados da empresa (persistidos)
const _CO_KEY = 'perf_company';
const _CO_DEF = { nome: '', cnpj: '', tel: '', email: '', endereco: '', site: '' };
function _loadCo() {
  try { const v = JSON.parse(localStorage.getItem(_CO_KEY)); return v ? { ..._CO_DEF, ...v } : { ..._CO_DEF }; }
  catch { return { ..._CO_DEF }; }
}
export const companyInfo = writable(_loadCo());
companyInfo.subscribe(v => { try { localStorage.setItem(_CO_KEY, JSON.stringify(v)); } catch {} });

export const editor = writable(freshEditor());
export const order  = writable({ items: [], sel: -1 });
export const ctx    = writable({ cliente: '', orc: '', vendedor: '', obs: '' });
export const regions         = writable(loadRegions());
export const regionId        = writable(loadRegions()[0].id);
export const commissionRule  = writable(loadCommRule());

// Configuração de impressão
const _PR_KEY = 'perf_print';
const _PR_DEF = { layout: 'one' }; // 'one' | 'two'
function _loadPr() {
  try { const v = JSON.parse(localStorage.getItem(_PR_KEY)); return v ? { ..._PR_DEF, ...v } : { ..._PR_DEF }; }
  catch { return { ..._PR_DEF }; }
}
export const printConfig = writable(_loadPr());
printConfig.subscribe(v => { try { localStorage.setItem(_PR_KEY, JSON.stringify(v)); } catch {} });

// Configuração da descrição padronizada
const _DESC_CFG_KEY = 'perf_descCfg';
const _DESC_CFG_DEF = {
  template:     '{tipo} {dims} · C{C} · t{t} · {mat} {rev}',
  presetAbbrev: { calha: 'CAL', u: 'PU', ue: 'PUE', cant: 'CANT', z: 'PZ', rufo: 'RUFO', ping: 'PING' },
};
function _loadDescCfg() {
  try {
    const v = JSON.parse(localStorage.getItem(_DESC_CFG_KEY));
    return v ? { ..._DESC_CFG_DEF, ...v, presetAbbrev: { ..._DESC_CFG_DEF.presetAbbrev, ...(v.presetAbbrev ?? {}) } } : { ..._DESC_CFG_DEF };
  } catch { return { ..._DESC_CFG_DEF }; }
}
export const descConfig = writable(_loadDescCfg());
descConfig.subscribe(v => { try { localStorage.setItem(_DESC_CFG_KEY, JSON.stringify(v)); } catch {} });

// Catálogo configurável
export const catalogMaterials = writable(loadMaterials());
export const catalogRevests   = writable(loadRevests());
export const catalogGauges    = writable(loadGauges());
export const catalogPresets   = writable(loadCustomPresets());   // presets personalizados
export const catalogOverrides = writable(loadPresetOverrides()); // overrides de geometria/restrições para built-ins
