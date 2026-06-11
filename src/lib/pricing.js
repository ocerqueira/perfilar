// Tabela de preço dual (custo + venda) por região × material × revestimento.
import { MATERIALS } from './engine.js';

const KEY_V2 = 'perfilar.precos.v2';
const KEY_V1 = 'perfilar.precos.v1';

// Revestimentos válidos por material
export const MAT_REVESTS = {
  'Galvanizado': ['Z275', 'Z350', 'Pré-pintado', 'Sem revestimento'],
  'Galvalume':   ['AZ150 (Galvalume)', 'Pré-pintado'],
  'Aço preto':   ['Sem revestimento'],
  'Alumínio':    ['Sem revestimento', 'Pré-pintado'],
  'Inox 304':    ['Sem revestimento'],
  'Cobre':       ['Sem revestimento'],
};

const REVEST_MULT = {
  'Z275':              1.00,
  'Z350':              1.05,
  'AZ150 (Galvalume)': 1.08,
  'Pré-pintado':       1.20,
  'Sem revestimento':  0.90,
};

const BASE_CUSTO = {
  'Galvanizado': 8.50,
  'Galvalume':   9.60,
  'Aço preto':   7.20,
  'Alumínio':   28.00,
  'Inox 304':   34.00,
  'Cobre':      78.00,
};

const REGION_DEFS = [
  { nome: 'SP — Capital',   id: 'sp-capital',     f: 1.00 },
  { nome: 'SP — Interior',  id: 'sp-interior',    f: 0.97 },
  { nome: 'Rio de Janeiro', id: 'rio-de-janeiro', f: 1.05 },
  { nome: 'Minas Gerais',   id: 'minas-gerais',   f: 1.02 },
  { nome: 'Sul (PR/SC/RS)', id: 'sul-pr-sc-rs',   f: 1.03 },
  { nome: 'Nordeste',       id: 'nordeste',        f: 1.12 },
  { nome: 'Centro-Oeste',   id: 'centro-oeste',    f: 1.08 },
  { nome: 'Norte',          id: 'norte',           f: 1.18 },
];

function buildPriceTable(factor = 1.0) {
  const precos = {}, concorrente = {};
  for (const mat of MATERIALS) {
    const revests = MAT_REVESTS[mat.name] || ['Sem revestimento'];
    const base = (BASE_CUSTO[mat.name] || 10) * factor;
    precos[mat.name] = {};
    concorrente[mat.name] = {};
    for (const rev of revests) {
      const m = REVEST_MULT[rev] ?? 1;
      const custo = +(base * m).toFixed(2);
      const venda = +(custo * 1.35).toFixed(2);
      precos[mat.name][rev]      = { custo, venda };
      concorrente[mat.name][rev] = { custo: +(custo * 1.02).toFixed(2), venda: +(venda * 0.97).toFixed(2) };
    }
  }
  return { precos, concorrente };
}

export function defaultRegions() {
  return REGION_DEFS.map(({ nome, id, f }) => ({ id, nome, ...buildPriceTable(f) }));
}

function migrateV1(v1Regions) {
  return v1Regions.map((r) => {
    const { precos, concorrente } = buildPriceTable(1.0);
    for (const mat of MATERIALS) {
      const v1Price = r.precos?.[mat.name];
      if (v1Price == null) continue;
      const revests = MAT_REVESTS[mat.name] || ['Sem revestimento'];
      for (const rev of revests) {
        const m = REVEST_MULT[rev] ?? 1;
        const custo = +(v1Price * m).toFixed(2);
        const venda = +(custo * 1.35).toFixed(2);
        precos[mat.name][rev]      = { custo, venda };
        concorrente[mat.name][rev] = { custo: +(custo * 1.02).toFixed(2), venda: +(venda * 0.97).toFixed(2) };
      }
    }
    return { id: r.id, nome: r.nome, precos, concorrente };
  });
}

export function loadRegions() {
  try {
    const raw = localStorage.getItem(KEY_V2);
    if (raw) return JSON.parse(raw);
    const rawV1 = localStorage.getItem(KEY_V1);
    if (rawV1) {
      const migrated = migrateV1(JSON.parse(rawV1));
      saveRegions(migrated);
      return migrated;
    }
  } catch { /* ignore */ }
  return defaultRegions();
}

export function saveRegions(regions) {
  try { localStorage.setItem(KEY_V2, JSON.stringify(regions)); } catch { /* ignore */ }
}

// Retorna { custo, venda, margem } para região × material × revestimento.
// tipo: 'propria' (default) | 'concorrente'
export function priceFor(regions, regionId, material, revest, tipo = 'propria') {
  const r = regions.find((x) => x.id === regionId) ?? regions[0];
  const tab = tipo === 'concorrente' ? r?.concorrente : r?.precos;
  const entry = tab?.[material]?.[revest];
  if (!entry || !entry.custo) return { custo: 0, venda: 0, margem: 0 };
  const margem = ((entry.venda - entry.custo) / entry.custo) * 100;
  return { custo: entry.custo, venda: entry.venda, margem };
}
