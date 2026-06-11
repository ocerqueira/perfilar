export const PRESETS = {
  calha: { name: 'Calha',       h0: 0,  rows: [['Aba esq.', 40, 90, 1], ['Parede esq.', 100, 90, -1], ['Fundo', 300, 90, -1], ['Parede dir.', 100, 90, 1], ['Aba dir.', 40, 0, 1]] },
  u:     { name: 'Perfil U',    h0: 90, rows: [['Aba', 75, 90, -1], ['Alma', 200, 90, -1], ['Aba', 75, 0, 1]] },
  ue:    { name: 'Perfil Ue',   h0: 0,  rows: [['Lábio', 20, 90, 1], ['Aba', 75, 90, -1], ['Alma', 200, 90, -1], ['Aba', 75, 90, 1], ['Lábio', 20, 0, 1]] },
  cant:  { name: 'Cantoneira',  h0: 90, rows: [['Aba', 50, 90, -1], ['Aba', 50, 0, 1]] },
  z:     { name: 'Perfil Z',    h0: 0,  rows: [['Aba', 50, 90, 1], ['Alma', 150, 90, 1], ['Aba', 50, 0, 1]] },
  rufo:  { name: 'Rufo',        h0: 0,  rows: [['Pestana', 30, 90, -1], ['Face', 150, 90, -1], ['Aba', 40, 0, 1]] },
  ping:  { name: 'Pingadeira',  h0: 0,  rows: [['Aba', 30, 90, 1], ['Face', 60, 90, -1], ['Pingo', 15, 0, 1]] },
};

export const CAT_ORDER = ['calha', 'u', 'ue', 'cant', 'z', 'rufo', 'ping'];

export const ICONS = {
  calha: 'M6 8 H14 V40 H56 V8 H64',
  u:     'M12 8 V40 H58 V8',
  ue:    'M8 20 V8 H16 M62 20 V8 H54 M16 8 V40 H54 V8',
  cant:  'M14 6 V42 H60',
  z:     'M10 8 H42 V40 H62',
  rufo:  'M8 10 H30 L52 30 H64',
  ping:  'M10 10 H46 V30 L36 38',
};

export const clone = (o) => JSON.parse(JSON.stringify(o));
