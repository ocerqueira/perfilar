// Engine composicional de comissão.

export const DEFAULT_RULE = {
  base: 'venda',
  modo: { tipo: 'percent', valor: 3 },
};

export function commissionForItem(item, rule) {
  if (!rule) return 0;
  const linhaPct = rule.porLinha?.[item.tipoProduto];
  const effRule = linhaPct
    ? { ...rule, modo: { tipo: 'percent', valor: linhaPct } }
    : rule;

  const venda  = item.precoTotal ?? 0;
  const custo  = item.custoTotal ?? 0;
  const margem = venda - custo;
  const peso   = item.C?.tot    ?? 0;
  const area   = item.areaM2    ?? 0;
  const qtd    = item.params?.Q ?? 0;

  const bases = { venda, margem, peso, area, quantidade: qtd };
  const baseValor = bases[effRule.base] ?? 0;

  if (effRule.faixas?.length) return calcFaixas(baseValor, effRule.faixas);
  switch (effRule.modo.tipo) {
    case 'percent': return baseValor * (effRule.modo.valor / 100);
    case 'fixo':    return baseValor * effRule.modo.valor;
    case 'fator':   return baseValor * effRule.modo.valor;
    default:        return 0;
  }
}

function calcFaixas(valor, faixas) {
  let acc = 0, prev = 0;
  for (const f of faixas) {
    const fatia = Math.max(0, Math.min(valor, f.ate) - prev);
    acc += fatia * (f.valor / 100);
    prev = f.ate;
    if (valor <= f.ate) break;
  }
  return acc;
}

export function commissionForOrder(items, rule) {
  return items.reduce((sum, it) => sum + commissionForItem(it, rule), 0);
}

// Descrição legível da regra (ex.: "3% sobre venda")
export function ruleLabel(rule) {
  if (!rule) return '—';
  const base = { venda: 'venda', margem: 'margem', peso: 'kg', area: 'm²', quantidade: 'pç' }[rule.base] ?? rule.base;
  if (rule.faixas?.length) return `escalonada sobre ${base}`;
  const { tipo, valor } = rule.modo;
  if (tipo === 'percent') return `${valor}% sobre ${base}`;
  if (tipo === 'fixo')    return `R$ ${valor}/${base}`;
  if (tipo === 'fator')   return `fator ${valor} × ${base}`;
  return '—';
}
