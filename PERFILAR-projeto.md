# Perfilar — Documento de projeto e roadmap

> Handoff para continuidade do desenvolvimento (Claude Code).
> Editor de perfil para o mercado de ferro & aço: vendedor/orçamentista monta
> perfis dobrados, telhas, chapas e compostos e obtém — em tempo real — desenho
> cotado, desenvolvimento da chapa, peso, aproveitamento da matéria-prima,
> descrição padronizada, export DXF, orçamento e ordem de produção.

---

## 1. Visão geral

- **Público:** vendedor / orçamentista de distribuidora ou perfiladeira de aço.
- **Dor que resolve:** erro de desenvolvimento, descrição ambígua do produto, peso
  errado no orçamento, retrabalho entre vendas e fábrica.
- **Princípio de design da UI:** bancada de engenharia. O desenho fica num
  "blueprint" escuro com cotas; a planilha (estilo Excel) é a entrada principal;
  tudo recalcula a cada tecla.
- **Princípio do modelo:** separar `Material` (liga + revestimento) de
  `Matéria-prima` (forma física: bobina ou chapa) de `Produto` (o que se compõe).
  Essa separação é o que deixa o app pronto para telha, composto e outros itens
  do mercado de aço sem refazer a base.

---

## 2. Stack e arquitetura

- **Svelte 4 + Vite 5** — app reativo (planilha → desenho/peso/descrição via `$:`).
- **Maker.js** — geometria paramétrica da seção; export **DXF** (com arcos de
  dobra reais via `fillet`) e SVG.
- **localStorage** — persistência da tabela de preços (e, no futuro, configs).
- **Empacotamento desktop:** alvo **Tauri** (ou Electron) reaproveitando 100% da
  lógica. Para uso offline, embutir as fontes (hoje vêm do Google Fonts).

Rodar:
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # /dist
npm run preview
```

---

## 3. Modelo de domínio

Fluxo: **Material → Matéria-prima → Produto → Blank/aproveitamento → Item do pedido → Saídas**,
com **Preço** e **Comissão** entrando no item.

| Entidade | Papel | Atributos principais |
|---|---|---|
| `Material` | liga do aço | nome, densidade (kg/m³) |
| `Revestimento` | proteção | Z275, Z350, AZ150, pré-pintado, sem |
| `Matéria-prima: Bobina` | tira contínua | largura (mm), bitola (mm), revestimento, material; pedida por comprimento |
| `Matéria-prima: Chapa` | corte padrão em estoque | largura × comprimento (mm), bitola, revestimento, material |
| `Produto: Perfil dobrado` | dobras | sequência de abas + dobras |
| `Produto: Telha` | convencional / sanduíche | sanduíche = composto (2 chapas + núcleo) |
| `Produto: Chapa cortada` | plana | recorte simples |
| `Produto: Composto` | vários componentes | soma de componentes (ex.: sanduíche) |
| `Blank` | retângulo plano consumido | largura = desenvolvimento, comprimento = peça |
| `Preço` | tabela | **custo** + **preço de venda** (ambos por região e por material/revestimento), própria + concorrente |
| `Comissão` | regra de comissão | 3 bases × 3 modos + modificadores |
| `Item do pedido` | produto + MP + preço + comissão | qtd, convenção, etc. |
| `Saídas` | documentos | Orçamento, Ordem de produção, DXF/CAD |

**Regra de negócio — cobrar sobra:** o item tem um flag `cobrarSobra`. Define se o
**peso faturado** é o líquido (só o produto) ou o bruto consumido da matéria-prima
(incluindo o retalho da tira/chapa).

**Unidades** explícitas em todo campo: `R$`, `kg`, `mm`, `m`, `m²`, `°` (grau), `%`.

**Padrão de precificação por tipo de produto:**

- Perfil, chapa, bobina, composto → **R$/kg**
- Telha → **R$/m²** (com toggle pra m linear, se a operação preferir)

---

## 4. Estado atual (o que já está construído)

App Svelte funcional, compilando. Implementado:

- **Editor**
  - Catálogo (7 perfis: calha, U, Ue, cantoneira, Z, rufo, pingadeira) + **modo livre**.
  - Planilha de abas/dobras estilo Excel (Enter desce célula; cria linha no fim).
  - **Blueprint cotado** em SVG, com setas, barra de escala em mm, e badge EXT/INT.
  - Convenção de medida **externa / interna** (afeta cota e desenvolvimento).
- **Parâmetros**
  - Dobra: **Fator K** (raio + K) **ou desconto manual** por dobra de 90°.
  - Peça: comprimento (mm), quantidade (pç), margem (%).
- **Matéria-prima (fatia 1 — concluída)**
  - Material (densidade) + **revestimento**.
  - Espessura/bitola (lista de bitolas + “Outra…”).
  - **Forma: bobina ou chapa**, com campos próprios (largura da bobina / chapa L×C).
  - **Cobrar sobra (Sim/Não)** → peso líquido vs faturado.
  - **Unidades explícitas** e **tooltips** “?” nos campos que confundem.
- **Pedido com vários itens** (bandeja lateral, totais de peso e R$).
- **Cálculo em tempo real:** desenvolvimento, peso líquido/faturado, aproveitamento
  (bobina: tiras/sobra; chapa: peças por chapa + orientação reta/girada + sobra em m²).
- **Descrição padronizada** (string canônica, copiável).
- **Export DXF** por item (Maker.js, com arcos de dobra reais).
- **Tabela de preço por região (PRÓPRIA, só custo R$/kg)** — editável, persistida em
  localStorage, com seletor de região no orçamento. *Vai ser refeita na fatia 2.*
- **Orçamento** (usa a região selecionada) e **Ordem de produção** (folha única ou
  uma por item) com croqui cotado, ambos imprimíveis em PDF pelo navegador.

> Observação: o encaixe na chapa hoje é o cálculo simples (quantos retângulos
> `desenvolvimento × comprimento` cabem, testando as duas orientações). A
> **visualização do nesting** de verdade é a fatia 3.

---

## 5. Lógica de cálculo (referência)

Arquivo: `src/lib/engine.js`. Variáveis em mm salvo indicação.

**Desenvolvimento (largura do blank):**
```
des = Σ(medidas das abas) − Σ(desconto por dobra)
```

**Desconto por dobra — Fator K (automático):**
```
A  = ângulo da dobra (rad)
BA = A · (R + K · t)                      // bend allowance
SB = (conv == 'int' ? R : R + t) · tan(A/2)   // setback
BD = 2 · SB − BA
```
**Desconto por dobra — manual:** `BD = manBD · (ângulo / 90)`

**Peso (líquido):**
```
kgm   = des · t · dens / 1e6              // kg por metro (des,t em mm; dens kg/m³)
pcLiq = kgm · (C / 1000)                  // kg por peça (C = comprimento em mm)
totLiq = pcLiq · Q
```

**Aproveitamento — Bobina:**
```
tiras = floor(largura_bobina / des)
sobra = largura_bobina − tiras · des            // mm
apr   = tiras · des / largura_bobina            // %
larguraFat = cobrarSobra ? largura_bobina / tiras : des
```

**Aproveitamento — Chapa (L × Cch):**
```
a1 = floor(L / des) · floor(Cch / C)
a2 = floor(L / C)   · floor(Cch / des)          // girada 90°
perSheet = max(a1, a2);  orient = a1 ≥ a2 ? 'reta' : 'girada 90°'
areaBlank = des · C;  areaSheet = L · Cch
apr   = perSheet · areaBlank / areaSheet        // %
sobra = areaSheet − perSheet · areaBlank        // mm²
larguraFat = cobrarSobra ? (areaSheet / perSheet) / C : des
```

**Peso faturado:**
```
kgmFat = larguraFat · t · dens / 1e6
pcFat  = kgmFat · (C / 1000)
totFat = pcFat · Q
tot_cobrado = cobrarSobra ? totFat : totLiq
```

**Objeto de parâmetros (`editor.params`):**
```js
{ matName, dens, revest, t,
  forma: 'bobina' | 'chapa', coil, chapaL, chapaC, cobrarSobra,
  C, Q, R, K, manBD, mg }
```
**Linha da planilha (`editor.rows[i]`):** `[label, medida(mm), anguloDobra(°), sentido(+1|-1)]`.

---

## 6. Estrutura de arquivos

```
src/
  lib/
    engine.js     cálculo: desenvolvimento, peso líq/fat, aproveitamento, descrição, mpSummary
    geometry.js   Maker.js: buildModel, toDXF, toSVGString, download
    draw.js       renderizador SVG cotado (compartilhado editor + documentos)
    presets.js    catálogo de perfis (PRESETS, CAT_ORDER, ICONS)
    pricing.js    tabela de preço por região (localStorage) — refeita na fatia 2
    commission.js (a criar — fatia 2) regra composicional de comissão
    stores.js     estado: editor, order, ctx, regions, regionId
  components/
    Sidebar.svelte      catálogo + bandeja do pedido
    Blueprint.svelte    desenho cotado (usa draw.js)
    Planilha.svelte     abas e dobras (Excel-like)
    MateriaPrima.svelte forma bobina/chapa, revestimento, cobrar sobra, unidades, tooltips
    Params.svelte       dobra (K/manual) + peça (compr., qtd, margem)
    Results.svelte      desenvolvimento, peso líq/fat, corte, descrição, export DXF
    Docs.svelte         overlay: orçamento e ordem de produção (imprimível)
    Pricing.svelte      tabela de preço por região (modal) — refeita na fatia 2
    Commission.svelte   (a criar — fatia 2) configuração da regra de comissão
    Tooltip.svelte      “?” reutilizável
  App.svelte            layout, barra superior, wiring de itens/documentos/preços
  app.css               design tokens + base
```

---

## 7. Convenções e decisões tomadas

- **Coordenadas SVG sempre com ponto decimal** (`co()` em `draw.js`). Nunca usar a
  formatação pt-BR (`nf`, vírgula) em coordenadas — quebra o `points` do SVG.
- **`nf(n, casas)`** formata número pt-BR para exibição; **`brl(n)`** para R$.
- **ext/int:** convenção da medida muda o setback (`R` vs `R+t`) e o lado da cota.
- **K vs manual:** manual é o que a maioria confia (calibrar pela dobradeira).
- **DXF:** export sem `usePOLYLINE` para gerar entidades `ARC` explícitas.
- **Design tokens** (`app.css`): workbench `#E7EAEE`, painel `#FFF`, tinta `#16202B`,
  canvas blueprint `#182230`, aço (linha) `#5FA8E0`, cota `#F4B740`, âmbar `#EA8A1E`.
  Fontes: IBM Plex Sans (UI), IBM Plex Mono (números/medidas), Space Grotesk (marca).

---

## 8. Roadmap (fatias)

| # | Fatia | Status |
|---|---|---|
| 1 | Matéria-prima (bobina/chapa) + unidades + tooltips + **cobrar sobra** | ✅ feito |
| 2 | **Preço dual (custo+venda, própria+concorrente)** + **comissão composicional** | ⬜ a fazer |
| 3 | **Blank / aproveitamento** visual (nesting) com orientação por máquina | ⬜ a fazer |
| 4 | **Telha** (convencional/sanduíche) e **composto** | ⬜ a fazer |
| 5 | **Templates de descrição** configuráveis por tipo de produto | ⬜ a fazer |

**Extras (fase 2):**
- Preview **3D** do perfil extrudado (Threlte/Three.js, a partir do contorno 2D).
- Empacotamento **desktop (Tauri)** com fontes embutidas (offline).
- Preço por **cidade/UF** além de região; importação de tabela.
- **Estoque de bobina por lote** ligado ao corte.
- Detecção de auto-interseção no traçado do modo livre (dobras compostas).

---

## 9. Fatia 2 — Preço e comissão (especificação completa)

### 9.1 Tabela de preço

**Modelo dual:** cadastra **custo** e **preço de venda** — ambos por região e por
material/revestimento. A margem efetiva sai da divisão; quando o usuário edita
um dos três (custo, venda, margem), os outros se ajustam.

**Granularidade:** região × material × revestimento × forma. Bitola entra como
modificador opcional (a maioria das operações cobra por kg sem distinguir bitola,
mas quem quiser distinguir tem o campo).

**Concorrente:** mesma estrutura, em segunda coluna. **Não entra no cálculo de
venda** — serve só pro comparativo no orçamento, com delta % vs nosso preço.

**Estrutura sugerida** (`src/lib/pricing.js`, bump da chave para `perfilar.precos.v2`):

```js
// Region shape
{
  id: 'sp-capital',
  nome: 'SP — Capital',
  precos: {                                       // tabela própria
    'Galvanizado': {
      'Z275':         { custo: 8.50, venda: 11.48 },
      'Z350':         { custo: 8.90, venda: 12.01 },
    },
    'Aço preto': { 'Sem revestimento': { custo: 7.20, venda: 9.72 } },
  },
  concorrente: { /* mesma estrutura */ }
}

// API
priceFor(regions, regionId, material, revest, tipo='propria')
// → { custo, venda, margem } (margem calculada: (venda-custo)/custo)
```

**Unidade por tipo de produto:** o campo `unidade` do produto define se o preço
é R$/kg (perfil, chapa, composto), R$/m² ou R$/m (telha). Default no app:
R$/kg para tudo, exceto telha = R$/m².

**UI (`Pricing.svelte`):**

- Modal mais largo. Cabeçalho com seletor de região editável + abas “Própria”/“Concorrente”.
- Tabela: linhas = material+revestimento; colunas = `custo` / `venda` / `margem%`.
  Editar qualquer um dos três recalcula o terceiro.
- Botões: importar CSV, exportar CSV, duplicar de outra região, restaurar padrão.
- Validação: avisar quando `venda < custo` (margem negativa).

**No orçamento (`Docs.svelte`):**

- Adicionar coluna "Concorrente" com preço e delta % (verde se nosso < concorrente, amber se >).
- Manter o total faturado usando o preço próprio (concorrente é só referência).

### 9.2 Comissão composicional

**Modelo:** toda regra de comissão se descreve em **3 dimensões + modificadores**:

```js
{
  base: 'venda' | 'margem' | 'peso' | 'area' | 'quantidade',
  modo: { tipo: 'percent' | 'fixo' | 'fator', valor: Number },
  // Modificadores opcionais:
  faixas: [{ ate: Number, valor: Number }],   // escalonamento por base
  gatilho: 'faturamento' | 'recebimento',     // quando paga (padrão: faturamento)
  inadimplencia: { dias: Number, acao: 'desconta' | 'suspende' | 'ignora' },
  porLinha: { 'perfil': 0.03, 'telha': 0.05, 'chapa': 0.02 },
}
```

**Cobertura (todos esses cenários do mercado caem na mesma engine):**

| Cenário | base | modo | modificador |
|---|---|---|---|
| 3% sobre faturamento | `venda` | percent 3 | — |
| 10% sobre margem | `margem` | percent 10 | — |
| R$ 0,15 por kg | `peso` | fixo 0.15 | — |
| Escalonada por meta | `venda` | percent (em faixas) | `faixas` |
| Fator × peso × R$/kg | `peso` | fator 0.02 | — |
| Diferente por linha | `venda` | percent (default) | `porLinha` |
| Só com recebimento | qualquer | qualquer | `gatilho:'recebimento'` |

**Cálculo (`src/lib/commission.js`):**

```js
export function commissionForItem(item, rule) {
  const linhaPct = rule.porLinha?.[item.tipoProduto];
  const effRule = linhaPct ? { ...rule, modo: { tipo: 'percent', valor: linhaPct } } : rule;

  const venda  = item.precoTotal;         // R$
  const custo  = item.custoTotal;         // R$
  const margem = venda - custo;           // R$
  const peso   = item.C.tot;              // kg
  const area   = item.areaM2 || 0;        // m²
  const qtd    = item.params.Q;

  const bases = { venda, margem, peso, area, quantidade: qtd };
  const baseValor = bases[effRule.base];

  if (effRule.faixas?.length) return faixasComissao(baseValor, effRule.faixas);
  switch (effRule.modo.tipo) {
    case 'percent': return baseValor * (effRule.modo.valor / 100);
    case 'fixo':    return baseValor * effRule.modo.valor;
    case 'fator':   return baseValor * effRule.modo.valor;
  }
}

function faixasComissao(valor, faixas) {
  let acc = 0, prev = 0;
  for (const f of faixas) {
    const fatia = Math.max(0, Math.min(valor, f.ate) - prev);
    acc += fatia * (f.valor / 100);
    prev = f.ate;
    if (valor <= f.ate) break;
  }
  return acc;
}
```

**Validar com exemplos** (testes node como em `calc_test.js`):

```
Pedido: peso 850 kg, custo R$ 7.225,00, venda R$ 9.753,75, margem R$ 2.528,75
- 3% venda      → R$ 292,61
- 10% margem    → R$ 252,88
- R$ 0,15/kg    → R$ 127,50
- Fator peso × 0.02 × (venda/peso=11,475) → R$ 195,07
- Escalonada (1.5% até 5k, 2.5% 5–15k, 4% acima):
    5000·0.015 + (9753.75-5000)·0.025 = 75 + 118,84 = R$ 193,84
```

**UI (`Commission.svelte`):**

- 3 presets rápidos como cards selecionáveis:
  - “% sobre venda” (default 3%)
  - “% sobre margem” (default 10%)
  - “R$ fixo por kg” (default 0,15)
- Botão “Avançado…” expande: seletor de base, modo, e os modificadores:
  - Editor de faixas (tabela: até R$ X → Y%).
  - Override por linha de produto (tabela: perfil/telha/chapa → %).
  - Gatilho (faturamento/recebimento) e regra de inadimplência.
- Persistência: regra default global em localStorage; cada item pode sobrescrever.
- Mostrar resultado ao lado: valor da comissão por item e total do pedido.

**No orçamento:**

- Bloco de comissão por item (compacto) + total no rodapé.
- Opção “gerar resumo do vendedor” (uma página com pedido × comissão).

### 9.3 Ordem de implementação sugerida

1. Refatorar `pricing.js` para o modelo dual (`custo` + `venda`, com `priceFor` retornando os três valores).
2. Atualizar `Pricing.svelte` (tabela com 3 colunas + abas Própria/Concorrente).
3. Atualizar `Docs.svelte` (orçamento) para mostrar coluna concorrente + delta.
4. Criar `commission.js` com a engine composicional + testes.
5. Criar `Commission.svelte` (3 presets + Avançado).
6. Ligar comissão no item e mostrar no orçamento.
7. Migrar localStorage da v1 para v2 (com fallback amigável).
8. Atualizar tooltips e unidades nos novos campos.

---

## 10. Itens em aberto / a validar com o cliente

- Telha: confirmar parâmetros (passo da onda, recobrimento, núcleo da sanduíche).
- Comissão: a base default no app começa em `venda` (mais comum); operações que
  preferem `margem` ajustam no Avançado.
- OP: confirmado “as duas” (folha única e uma por item) — vendedor escolhe.
- Nesting: regras específicas por máquina (largura útil, refilo, distância entre peças).
- Bitolas fora da tabela: campo “Outra” já existe; confirmar faixa usada.
- Preço por bitola dentro de um mesmo material/revestimento: deixado como
  modificador opcional na fatia 2 — usar só se a operação precisar.
