import { writable } from 'svelte/store';
import { PRESETS, clone } from './presets.js';
import { loadRegions } from './pricing.js';
import { DEFAULT_RULE } from './commission.js';
import {
  loadMaterials, loadRevests, loadGauges,
  loadCustomPresets, loadPresetOverrides,
} from './catalog.js';

const COMM_KEY = 'perfilar.commission.v1';

// Usuário atual — role fixo 'admin' até a Fase 4 (multi-usuário)
const _USER_KEY = 'perf_currentUser';
const _USER_DEF = { nome: '', email: '', role: 'admin' };
function _loadUser() {
  try { const v = JSON.parse(localStorage.getItem(_USER_KEY)); return v ? { ..._USER_DEF, ...v } : { ..._USER_DEF }; }
  catch { return { ..._USER_DEF }; }
}
export const currentUser = writable(_loadUser());
currentUser.subscribe(v => { try { localStorage.setItem(_USER_KEY, JSON.stringify(v)); } catch {} });

export function freshEditor(key = 'calha') {
  const p = PRESETS[key];
  return {
    mode: 'cat', key, conv: 'ext', bd: 'auto', h0: p.h0,
    rows: clone(p.rows),
    params: { matName: 'Galvanizado', dens: 7850, revest: 'Z275', t: 0.65, forma: 'bobina', coil: 1200, chapaL: 1200, chapaC: 3000, cobrarSobra: false, C: 3000, Q: 10, R: 2, K: 0.44, manBD: 1.7, mg: 35, precoKg: 0, precoPc: 0, priceMode: 'kg', refilo: 0, espac: 0 },
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
const _CO_DEF = {
  nome: '', nomeFantasia: '', cnpj: '', ie: '',
  tel: '', whatsapp: '', email: '', site: '', logo: '',
  // Endereço estruturado
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  // Legado
  endereco: '',
};
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

// Preferências de exibição do editor
const _ED_DISP_KEY = 'perf_editorDisplay';
const _ED_DISP_DEF = { showCommission: false };
function _loadEditorDisplay() {
  try { const v = JSON.parse(localStorage.getItem(_ED_DISP_KEY)); return v ? { ..._ED_DISP_DEF, ...v } : { ..._ED_DISP_DEF }; }
  catch { return { ..._ED_DISP_DEF }; }
}
export const editorDisplay = writable(_loadEditorDisplay());
editorDisplay.subscribe(v => { try { localStorage.setItem(_ED_DISP_KEY, JSON.stringify(v)); } catch {} });

// Stores transientes (não persistem)
export const editingOrderId = writable(null);  // ID do pedido sendo editado
export const quotingClient  = writable(null);  // cliente vinculado ao orçamento em andamento

// Pedidos gerenciados (ciclo de vida: orcamento → pedido | perdido)
const _ORDERS_KEY = 'perf_orders';
function _loadOrders() {
  try { const v = JSON.parse(localStorage.getItem(_ORDERS_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export const orders = writable(_loadOrders());
orders.subscribe(v => { try { localStorage.setItem(_ORDERS_KEY, JSON.stringify(v)); } catch {} });

// Histórico de pedidos registrados
const _ORD_HIST_KEY = 'perf_orderHistory';
function _loadOrderHistory() {
  try { const v = JSON.parse(localStorage.getItem(_ORD_HIST_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export const orderHistory = writable(_loadOrderHistory());
orderHistory.subscribe(v => { try { localStorage.setItem(_ORD_HIST_KEY, JSON.stringify(v)); } catch {} });

// Metas mensais
const _METAS_KEY = 'perf_metas';
const _METAS_DEF = { faturamento: 0, volume: 0, pedidos: 0, positivacao: 0 };
function _loadMetas() {
  try { const v = JSON.parse(localStorage.getItem(_METAS_KEY)); return v ? { ..._METAS_DEF, ...v } : { ..._METAS_DEF }; }
  catch { return { ..._METAS_DEF }; }
}
export const metas = writable(_loadMetas());
metas.subscribe(v => { try { localStorage.setItem(_METAS_KEY, JSON.stringify(v)); } catch {} });

// Metas por vendedor (por mês)
const _VD_GOALS_KEY = 'perf_vendedor_goals';
function _loadVdGoals() {
  try { const v = JSON.parse(localStorage.getItem(_VD_GOALS_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export const vendedorGoals = writable(_loadVdGoals());
vendedorGoals.subscribe(v => { try { localStorage.setItem(_VD_GOALS_KEY, JSON.stringify(v)); } catch {} });

// Histórico de metas mensais
const _GOALS_KEY = 'perf_goals_history';
function _loadGoals() {
  try { const v = JSON.parse(localStorage.getItem(_GOALS_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export const goalHistory = writable(_loadGoals());
goalHistory.subscribe(v => { try { localStorage.setItem(_GOALS_KEY, JSON.stringify(v)); } catch {} });

// Campanhas de vendas
const _CAMP_KEY = 'perf_campaigns';
function _loadCampaigns() {
  try { const v = JSON.parse(localStorage.getItem(_CAMP_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export const campaigns = writable(_loadCampaigns());
campaigns.subscribe(v => { try { localStorage.setItem(_CAMP_KEY, JSON.stringify(v)); } catch {} });

// Usuários da aplicação (gerenciados pelo admin)
const _USERS_KEY = 'perf_app_users';
function _loadAppUsers() {
  try { const v = JSON.parse(localStorage.getItem(_USERS_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export const appUsers = writable(_loadAppUsers());
appUsers.subscribe(v => { try { localStorage.setItem(_USERS_KEY, JSON.stringify(v)); } catch {} });

// Configuração das integrações de API
const _API_CFG_KEY = 'perf_api_config';
const _API_CFG_DEF = {
  viacep: {
    ativa: false,
    url: 'https://viacep.com.br/ws/',
  },
  cnpj: {
    ativa: false,
    provider: 'brasilapi', // 'brasilapi' | 'receitaws' | 'cnpjws' | 'custom'
    url: '', token: '',
  },
  email: {
    ativa: false,
    provider: 'smtp', // 'smtp' | 'sendgrid' | 'mailgun' | 'resend' | 'custom'
    // SMTP
    host: '', port: '587', tls: true,
    authType: 'password', // 'password' | 'oauth2'
    user: '', password: '',
    // OAuth2 (Gmail / Outlook via OAuth2)
    oauthClientId: '', oauthClientSecret: '', oauthRefreshToken: '',
    // API-based providers
    apiKey: '', domain: '', url: '',
    // Comum
    fromName: '', fromEmail: '',
  },
  whatsapp: {
    ativa: false,
    provider: 'evolution', // 'evolution' | 'zapi' | 'wppconnect' | 'twilio' | 'meta' | 'custom'
    // Self-hosted (Evolution, WPPConnect, Custom)
    url: '', apiKey: '', instance: '',
    // Z-API
    instanceId: '', token: '',
    // WPPConnect
    secretKey: '',
    // Twilio
    accountSid: '', authToken: '',
    // Meta Cloud API (WhatsApp Business API oficial)
    phoneNumberId: '', wabaId: '', accessToken: '', webhookToken: '',
    // Comum
    number: '',
  },
  maps: {
    ativa: false,
    apiKey: '',
  },
};
function _loadApiCfg() {
  try {
    const v = JSON.parse(localStorage.getItem(_API_CFG_KEY));
    if (!v) return JSON.parse(JSON.stringify(_API_CFG_DEF));
    return {
      viacep:   { ..._API_CFG_DEF.viacep,   ...(v.viacep   ?? {}) },
      cnpj:     { ..._API_CFG_DEF.cnpj,     ...(v.cnpj     ?? {}) },
      email:    { ..._API_CFG_DEF.email,    ...(v.email    ?? {}) },
      whatsapp: { ..._API_CFG_DEF.whatsapp, ...(v.whatsapp ?? {}) },
      maps:     { ..._API_CFG_DEF.maps,     ...(v.maps     ?? {}) },
    };
  } catch { return JSON.parse(JSON.stringify(_API_CFG_DEF)); }
}
export const apiConfig = writable(_loadApiCfg());
apiConfig.subscribe(v => { try { localStorage.setItem(_API_CFG_KEY, JSON.stringify(v)); } catch {} });

// Clientes cadastrados
const _CLI_KEY = 'perf_clients';
function _loadClients() {
  try { const v = JSON.parse(localStorage.getItem(_CLI_KEY)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export const clients = writable(_loadClients());
clients.subscribe(v => { try { localStorage.setItem(_CLI_KEY, JSON.stringify(v)); } catch {} });

// Catálogo configurável
export const catalogMaterials = writable(loadMaterials());
export const catalogRevests   = writable(loadRevests());
export const catalogGauges    = writable(loadGauges());
export const catalogPresets   = writable(loadCustomPresets());   // presets personalizados
export const catalogOverrides = writable(loadPresetOverrides()); // overrides de geometria/restrições para built-ins
