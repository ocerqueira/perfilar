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

### Implantação

O Perfilar terá dois modos de entrega, com a mesma base de frontend:

| Modo | Stack | Armazenamento | Prioridade |
|---|---|---|---|
| **SaaS web** | Svelte SPA + Python FastAPI + PostgreSQL | Servidor | Principal |
| **Desktop offline** | Tauri + mesmo frontend | SQLite local | Secundário |

Enquanto o backend não existir, o frontend usa **localStorage** como persistência temporária. A camada `src/lib/api.js` isola essa dependência — trocar por fetch real não exige mudar os componentes.

### Frontend

- **Svelte 4 + Vite 5** — app reativo (planilha → desenho/peso/descrição via `$:`).
- **Maker.js** — geometria paramétrica da seção; export **DXF** e SVG.
- **svelte-spa-router** ou Router.svelte simples (hash-based: `/#/editor`, `/#/orders`…).
- Geometria/física (engine.js, geometry.js, draw.js, cutplan.js) fica **sempre no frontend** — nunca vai para o servidor.

### Backend (futuro — Python FastAPI)

- **Python 3.12 + FastAPI** — async, validação automática via Pydantic, OpenAPI gerado.
- **SQLAlchemy 2 + Alembic** — ORM + migrations.
- **PostgreSQL** (SaaS) / **SQLite** (Tauri) — mesmo código, troca de driver.
- **Docker + docker-compose** — frontend + backend + banco em um único `docker-compose up`.
- Auth: JWT (FastAPI-Users ou implementação própria), simples por ora.

### Dev local

```bash
# Frontend
npm install
npm run dev      # http://localhost:5173

# Backend (quando existir)
docker-compose up   # sobe frontend + API + banco
```

---

## 3. Modelo de domínio

Fluxo: **Material → Matéria-prima → Produto → Blank/aproveitamento → Item do pedido → Saídas**,
com **Preço**, **Impostos** e **Comissão** entrando no item.

| Entidade | Papel | Atributos principais |
|---|---|---|
| `Material` | liga do aço | nome, densidade (kg/m³) |
| `Revestimento` | proteção | Z275, Z350, AZ150, pré-pintado, sem |
| `Matéria-prima: Bobina` | tira contínua | largura (mm), bitola (mm), revestimento, material |
| `Matéria-prima: Chapa` | corte padrão | largura × comprimento (mm), bitola, revestimento, material |
| `Produto: Perfil dobrado` | dobras | sequência de abas + dobras |
| `Produto: Telha` | convencional / sanduíche | sanduíche = composto (2 chapas + núcleo) |
| `Produto: Chapa cortada` | plana | recorte simples |
| `Produto: Composto` | vários componentes | soma de componentes |
| `Blank` | retângulo plano consumido | largura = desenvolvimento, comprimento = peça |
| `Preço` | tabela | custo + preço de venda por região × material × revestimento; própria + concorrente |
| `TaxConfig` | perfil fiscal de venda | ICMS, PIS, COFINS, IPI, DIFAL por UF destino |
| `Comissão` | regra de comissão | 3 bases × 3 modos + modificadores |
| `Cliente` | entidade comprador | razão social, CNPJ, IE, UF, contribuinte ICMS |
| `Item do pedido` | produto + MP + preço + impostos + comissão | qtd, convenção, etc. |
| `Saídas` | documentos | Orçamento, Ordem de produção, DXF/CAD, Plano de corte |

**Regra de negócio — cobrar sobra:** o item tem um flag `cobrarSobra`. Define se o
**peso faturado** é o líquido (só o produto) ou o bruto consumido da matéria-prima.

**Unidades** explícitas em todo campo: `R$`, `kg`, `mm`, `m`, `m²`, `°`, `%`.

**Padrão de precificação:**
- Perfil, chapa, bobina, composto → **R$/kg**
- Telha → **R$/m²** (com toggle pra m linear)

---

## 4. Estado atual — o que está implementado

### 4.1 Editor de perfis ✅

- Catálogo com 7 perfis padrão (calha, U, Ue, cantoneira, Z, rufo, pingadeira) + modo livre
- Planilha de abas/dobras estilo Excel (Enter desce; Tab avança coluna; cria linha no fim; mínimo 2 linhas)
- Blueprint cotado em SVG com setas, barra de escala em mm, badge EXT/INT
- Convenção de medida externa/interna (afeta cota e desenvolvimento)
- Fator K (raio + K) ou desconto manual por dobra de 90°
- Comprimento (mm), quantidade (pç), margem (%)

### 4.2 Matéria-prima ✅

- Material (6 opções: galvanizado, galvalume, aço preto, alumínio, inox 304, cobre) + revestimento
- Espessura/bitola (lista configurável + campo "Outra…")
- Forma: bobina (largura) ou chapa (L × C)
- Cobrar sobra (Sim/Não) → peso líquido vs faturado
- **Refilo** (borda inaproveitável, mm) e **folga entre peças** (espaço de corte, mm)
- Cálculo em tempo real: desenvolvimento, peso líquido/faturado, aproveitamento, orientação reta/girada

### 4.3 Preço dual e comissão ✅

- Tabela de preço dual (custo + venda) por região × material × revestimento — própria + concorrente
- Margem editável: editar custo/venda/margem% recalcula os outros dois
- Motor de comissão composicional: 5 bases (venda, margem, peso, área, quantidade), 3 modos (%, fixo, fator), faixas escalonadas, override por tipo de produto
- 3 presets rápidos de comissão + modo avançado

### 4.4 Catálogo configurável ✅

- Config → Empresa: nome, CNPJ, endereço, tel, email, site (usado no cabeçalho do plano de corte)
- Config → Materiais: CRUD de materiais e revestimentos customizados
- Config → Bitolas: CRUD de espessuras
- Config → Catálogo de perfis: editor visual de presets customizados com preview de croqui, clonar, deletar, override de built-ins, restrições por preset (aba mín/máx, raio mín)
- Config → Descrição: template de SKU e abreviações de material

### 4.5 Validação de perfil ✅

- Nível 1: restrições dimensionais (aba mínima, aba máxima, raio mínimo)
- Nível 2: detecção de auto-interseção (segment intersection test)
- Exibido como badge + lista de avisos no Blueprint

### 4.6 Documentos ✅

- Pedido com vários itens (bandeja lateral)
- Orçamento com coluna concorrente e delta %
- Ordem de produção (folha única ou uma por item, com croqui cotado)
- Ambos imprimíveis em PDF pelo navegador

### 4.7 Plano de Corte para Chapas ✅

- Shell-packing 2D (guilhotina): ordena por área descrescente, encaixa em faixas horizontais
- Visualização SVG: blanks coloridos (paleta 8 cores), linhas de corte, sobras
- Agrupamento automático de chapas com layout idêntico
- Tabela de cortes, aproveitamento %, sobra em m², quantidade de chapas
- 2 layouts de impressão
- Cabeçalho com dados da empresa

### 4.8 Nesting visual inline ✅

- Bobina: faixas horizontais com sobra em vermelho
- Chapa: grid 2D com padrão de repetição + borda de refilo tracejada
- Renderizado em tempo real em MateriaPrima.svelte

### 4.9 Export ✅

- DXF por item (Maker.js, com arcos de dobra reais)
- Descrição SKU canônica (copiável)

---

## 5. Layout — SPA com sidebar

Layout fixo em todas as páginas. O conteúdo muda, a shell não.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Perfilar         [Orçamento #0042 — Construtora XYZ]    [Empresa]  │  ← Header
├────────────┬────────────────────────────────────────────────────────┤
│            │                                                         │
│  Editor    │                                                         │
│  Pedidos   │                                                         │
│  Clientes  │              ÁREA DE CONTEÚDO                          │
│  Produtos  │                                                         │
│  Materiais │              (módulo ativo)                             │
│  Preços &  │                                                         │
│  Impostos  │                                                         │
│  Plano de  │                                                         │
│  Corte     │                                                         │
│  ───────   │                                                         │
│  Config    │                                                         │
│            │                                                         │
└────────────┴────────────────────────────────────────────────────────┘
```

### Módulos / rotas

| Rota | Módulo | Descrição |
|---|---|---|
| `/#/editor` | Editor | Planilha + blueprint + matéria-prima + resultados (tela principal atual) |
| `/#/orders` | Pedidos | Lista de orçamentos/OPs; criar novo abre o editor vinculado |
| `/#/clients` | Clientes | Cadastro de clientes (razão social, CNPJ, IE, UF, região) |
| `/#/goals` | Metas | Metas mensais gerais + por vendedor + campanhas de vendas |
| `/#/prospeccao` | Prospecção | Busca de empresas (Receita), enriquecimento de leads, rota de visita otimizada |
| `/#/products` | Produtos | Catálogo de perfis (presets padrão + custom + restrições) |
| `/#/materials` | Matérias-primas | Materiais, revestimentos, bitolas, bobinas/chapas em estoque |
| `/#/pricing` | Preços & Impostos | Tabela de preços por região + TaxConfig por UF |
| `/#/cutplan` | Plano de Corte | Nesting visual para chapas, impressão |
| `/#/settings` | Configurações | Empresa, descrição, integrações de API (ViaCEP, CNPJ, e-mail, WhatsApp, Maps) |
| `/#/admin` | Admin | Usuários, perfis e permissões |

### Shell (App.svelte)

- **Header:** logo Perfilar, contexto do pedido ativo (número + cliente), botão empresa, ícone de ajuda.
- **Sidebar:** ícone + label por módulo, grupo separado para Config no rodapé. Estado ativo destacado.
- **Content area:** `<RouterView />` — cada módulo renderiza sua própria Page.svelte.

---

## 6. Estrutura de arquivos — estado atual e reorganização planejada

### 6.1 Estado atual (monolítico)

```
src/
  lib/
    engine.js      cálculo: desenvolvimento, peso líq/fat, aproveitamento, SKU
    geometry.js    Maker.js: buildModel, toDXF, toSVGString, download
    draw.js        renderizador SVG cotado
    presets.js     7 perfis padrão (PRESETS, CAT_ORDER, ICONS)
    pricing.js     tabela de preço dual v2 por região (localStorage)
    commission.js  engine composicional de comissão
    catalog.js     catálogo configurável (materiais, revestimentos, bitolas, presets, overrides)
    validation.js  restrições dimensionais + detecção de auto-interseção
    cutplan.js     shell-packing 2D (guilhotina, múltiplas chapas)
    stores.js      todos os stores do app (editor, order, ctx, regions, catalog*, companyInfo…)
  components/
    Sidebar.svelte        catálogo + bandeja do pedido
    Blueprint.svelte      desenho cotado
    Planilha.svelte       abas e dobras
    MateriaPrima.svelte   forma bobina/chapa, revestimento, refilo, folga
    Params.svelte         dobra (K/manual) + peça (compr., qtd, margem)
    Results.svelte        desenvolvimento, peso, corte, descrição, DXF
    Docs.svelte           orçamento + OP (imprimível)
    Pricing.svelte        tabela de preço por região (modal)
    Commission.svelte     regra de comissão (modal)
    Config.svelte         5 abas: empresa, materiais, bitolas, catálogo, descrição
    CutPlan.svelte        plano de corte com nesting visual
    Nesting.svelte        visualização inline de aproveitamento
    Tooltip.svelte        "?" reutilizável
  App.svelte              layout, barra superior, wiring (monolítico)
  app.css                 design tokens + base
```

### 6.2 Reorganização planejada (por módulos — próxima etapa)

A refatoração é puramente de organização de pastas. Sem mudança de comportamento.

```
src/
  router/
    routes.js             { path, component, label, icon }[]
    Router.svelte         roteamento hash-based simples
  modules/
    editor/
      EditorPage.svelte   orquestra painéis (atual App.svelte)
      Sidebar.svelte      catálogo + bandeja do pedido
      Blueprint.svelte
      Planilha.svelte
      MateriaPrima.svelte
      Params.svelte
      Results.svelte
      editor.store.js     editor + order (extrai de stores.js)
    orders/
      OrdersPage.svelte   lista de pedidos
      OrderDetail.svelte  edição + docs
      Docs.svelte
      orders.store.js
    clients/
      ClientsPage.svelte
      ClientForm.svelte
      clients.store.js
    products/
      ProductsPage.svelte
      PresetEditor.svelte (extrai de Config.svelte)
      products.store.js
    materials/
      MaterialsPage.svelte
      materials.store.js
    pricing/
      PricingPage.svelte
      Pricing.svelte
      Commission.svelte
      TaxConfig.svelte    NOVO — configuração de impostos por UF
      pricing.store.js
    cutplan/
      CutPlanPage.svelte
      CutPlan.svelte
      Nesting.svelte
    settings/
      SettingsPage.svelte
      Config.svelte (abas: empresa + descrição; materiais/bitolas/catálogo vão para os módulos)
      settings.store.js
  lib/                    lógica pura — sem dependência de Svelte
    engine.js
    geometry.js
    draw.js
    presets.js
    pricing.js
    commission.js
    catalog.js
    validation.js
    cutplan.js
    taxes.js              NOVO — fórmulas ICMS/PIS/COFINS/IPI/DIFAL
    api.js                NOVO — fetch wrapper (localStorage agora, API depois)
  components/             atoms/molecules usados em 2+ módulos
    Tooltip.svelte
    Modal.svelte
    Badge.svelte
  stores/
    app.store.js          companyInfo, printConfig, descConfig (extrai de stores.js)
    session.store.js      usuário logado (futuro)
  App.svelte              shell: header + sidebar + <RouterView />
  app.css
```

### 6.3 Backend — estrutura planejada (Python FastAPI)

```
backend/
  pyproject.toml           / requirements.txt
  Dockerfile
  alembic/
    env.py
    versions/
      0001_initial.py
  src/
    main.py                FastAPI app, registra routers
    config.py              Settings (env vars)
    database.py            engine SQLAlchemy, get_db()
    models/                SQLAlchemy ORM
      client.py
      order.py
      product.py
      material.py
      pricing.py
      tax.py
      settings.py
    schemas/               Pydantic (request/response)
      client.py
      order.py
      pricing.py
      tax.py
    routers/
      clients.py
      orders.py
      products.py
      materials.py
      pricing.py           tabela de preços por região
      taxes.py             TaxConfig + cálculo de impostos
      settings.py
    services/
      taxes.py             lógica de ICMS/PIS/COFINS/IPI/DIFAL
      pricing.py
docker-compose.yml         frontend (vite) + backend (fastapi) + postgres
```

---

## 7. Modelo de impostos (TaxConfig)

### 7.1 Impostos que afetam distribuidoras de aço (Lucro Presumido)

| Imposto | Aplicação | Alíquota típica | Observação |
|---|---|---|---|
| **ICMS interno** | Venda no mesmo estado | 12–18% (varia por UF) | "Por dentro" — incluso no preço de venda |
| **ICMS interestadual** | Venda B2B para outro estado | 7% (N/NE/ES) ou 12% (S/SE/CO) | O destino retém a alíquota interna dele |
| **DIFAL** | Venda para não-contribuinte em outro estado | aliq_destino − aliq_interestadual | Responsabilidade do remetente desde EC 87/2015 |
| **PIS** | Sobre faturamento bruto | 0,65% | Regime cumulativo (Lucro Presumido) |
| **COFINS** | Sobre faturamento bruto | 3,00% | Regime cumulativo |
| **IPI** | Produtos industrializados (NCM) | 0% para perfil de aço | Perfil dobrado formado a frio: NCM 7216.x → IPI 0%. Cobrar só se NCM do produto exigir |

**Total PIS+COFINS típico: 3,65%.**
**ICMS interno SP: 18% → carga total SP: 21,65%.**
**IPI incluir no modelo como campo configurável (default 0%).**

### 7.2 Fórmula "por dentro" — preço de venda

O padrão brasileiro para mercadorias é preço com impostos embutidos. A fórmula correta:

```
carga = ICMS + PIS + COFINS + IPI    (em decimal, ex: 0,2165)
PV = custo / (1 - carga - margem_desejada)
```

Isso é diferente do markup simples (`custo × (1 + margem)`), que ignora que os impostos saem da receita — não do custo. Com carga de 21,65% e margem de 35%:

```
markup simples: R$10 × 1,35 = R$13,50  → margem real = (13,50−10)/13,50 = 25,9% (não 35%)
por dentro:     R$10 / (1−0,2165−0,35) = R$10 / 0,4335 = R$23,07 → margem real = 35%
```

**Atenção ao implantar:** o `pricing.js` atual usa markup simples. A mudança para "por dentro" vai elevar o preço de venda sugerido. Documentar e alinhar com o usuário antes de implantar.

### 7.3 DIFAL (venda interestadual para não-contribuinte)

```
Base_DIFAL = PV / (1 - aliq_ICMS_destino)
DIFAL      = Base_DIFAL × (aliq_ICMS_destino - aliq_interestadual)
```

O DIFAL reduz a margem efetiva — não é adicionado ao preço visível. Modelar como custo adicional que diminui a margem calculada.

### 7.4 Struct TaxConfig

```js
// src/lib/taxes.js
{
  id: string,
  nome: string,               // ex: "SP → SP (interno)", "SP → MG (contribuinte)"
  uf_origem: string,          // UF da empresa
  uf_destino: string,         // UF do cliente
  contribuinte_icms: boolean, // se o cliente é contribuinte (muda tipo de ICMS)

  // Imposto sobre receita (por dentro — em %)
  icms: number,               // alíquota aplicável (interna ou interestadual)
  pis: number,                // default 0.65
  cofins: number,             // default 3.00
  ipi: number,                // default 0 (perfil de aço = NCM 7216.x → IPI 0%)

  // DIFAL — preencher só quando venda interestadual para não-contribuinte
  difal_ativo: boolean,
  icms_interestadual: number, // alíquota entre estados (7 ou 12)
  icms_uf_destino: number,    // alíquota interna do estado destino

  // Referência
  margem_minima: number,      // aviso se precificar abaixo disto (%)
}
```

### 7.5 Tabela ICMS interestadual (referência)

```
Origem S/SE/CO → destino N/NE/ES/AM:    7%
Origem S/SE/CO → destino S/SE/CO:      12%
Dentro do mesmo estado:                 alíquota interna (SP: 18%, MG: 18%, RS: 12%…)
Importados (>40% conteúdo importado):   4% (independente de destino)
```

---

## 8. Lógica de cálculo (referência)

Arquivo: `src/lib/engine.js`. Variáveis em mm salvo indicação.

**Desenvolvimento:**
```
des = Σ(medidas das abas) − Σ(desconto por dobra)
```

**Desconto por dobra — Fator K:**
```
A  = ângulo (rad)
BA = A · (R + K · t)
SB = (conv == 'int' ? R : R + t) · tan(A/2)
BD = 2 · SB − BA
```
**Desconto por dobra — manual:** `BD = manBD · (ângulo / 90)`

**Peso líquido:**
```
kgm   = des · t · dens / 1e6
pcLiq = kgm · (C / 1000)
totLiq = pcLiq · Q
```

**Aproveitamento — Bobina:**
```
larguraUtil = coil − 2·refilo
tiras = floor((larguraUtil + espac) / (des + espac))
sobra = larguraUtil − tiras·des − (tiras−1)·espac
apr   = tiras·des / coil
larguraFat = cobrarSobra ? coil / tiras : des
```

**Aproveitamento — Chapa (L × Cch):**
```
a1 = floor((L−2·refilo) / (des+espac)) · floor((Cch−2·refilo) / (C+espac))
a2 = (girado 90°)
perSheet = max(a1, a2)
apr = perSheet · des · C / (L · Cch)
```

**Peso faturado:**
```
kgmFat = larguraFat · t · dens / 1e6
totFat = kgmFat · (C / 1000) · Q
```

**Preço de venda (com impostos — a implementar):**
```
carga   = icms + pis + cofins + ipi          (decimal)
PV_kg   = custo_kg / (1 − carga − margem)
PV_item = PV_kg · tot_cobrado_kg
```

**Comissão (commission.js):**
```
bases = { venda, margem, peso, area, quantidade }
// modo percent: baseValor × (valor / 100)
// modo fixo:    baseValor × valor
// faixas escalonadas: Σ(fatia_i × taxa_i)
```

---

## 9. Convenções e decisões tomadas

- **Coordenadas SVG sempre com ponto decimal** (`co()` em `draw.js`). Nunca usar a
  formatação pt-BR (`nf`, vírgula) em coordenadas.
- **`nf(n, casas)`** formata número pt-BR para exibição; **`brl(n)`** para R$.
- **ext/int:** convenção da medida muda o setback (`R` vs `R+t`) e o lado da cota.
- **K vs manual:** manual é o que a maioria confia (calibrar pela dobradeira).
- **DXF:** export sem `usePOLYLINE` para gerar entidades `ARC` explícitas.
- **effectivePreset(key, $catalogOverrides):** sempre usar esta função ao carregar
  geometria — respeita overrides do usuário sem mutar o preset padrão.
- **Design tokens** (`app.css`): workbench `#E7EAEE`, painel `#FFF`, tinta `#16202B`,
  canvas blueprint `#182230`, aço (linha) `#5FA8E0`, cota `#F4B740`, âmbar `#EA8A1E`.
  Fontes: IBM Plex Sans (UI), IBM Plex Mono (números/medidas), Space Grotesk (marca).
- **Geometria/física sempre no frontend:** `engine.js`, `geometry.js`, `cutplan.js`
  nunca vão para o backend. O backend recebe snapshots calculados.
- **api.js como camada de isolamento:** qualquer acesso a dados passa por `api.js`.
  Hoje retorna localStorage; quando o backend existir, troca para fetch.

---

## 10. Ferramental de dobradeira (Tooling)

### 10.1 Entidades

#### Punção (`Punch`)

```js
{
  id: string,           // nanoid
  name: string,         // ex: "Promecam 88° R0.8"
  tipAngleDeg: number,  // ângulo incluso da ponta: 30, 60, 85, 88, 90
  tipRadius: number,    // raio da ponta em mm: 0.5, 0.8, 1.0
}
// Derivado: maxBendAngle = 180 - tipAngleDeg
// Ex: ponta 88° → dobra máxima 92°; ponta 30° → dobra máxima 150°
```

#### Matriz (`Die`)

```js
{
  id: string,
  name: string,           // ex: "V=8 ombro R1.0"
  vOpening: number,       // abertura V em mm: 6, 8, 10, 12, 16, 20, 25, 32, 40
  shoulderRadius: number, // raio dos ombros em mm: 0.8, 1.0, 1.5, 2.0
  openingAngleDeg: number // ângulo de abertura da matriz: 88 (padrão), 60, 30
}
// Derivados:
//   tMin         = vOpening / 8       (bitola mínima recomendada)
//   tMax         = vOpening / 6       (bitola máxima recomendada)
//   rSuggested   = vOpening / 6       (raio interno sugerido — air bending, aço)
//   minFlange    = (vOpening / 2) + 2*t  (aba mínima para apoio no ombro)
//   maxBendAngle = 180 - openingAngleDeg
```

#### Máquina (`Machine`) — v2, não implementada ainda

Agrupador de punções e matrizes disponíveis em uma dobradeira específica (tonelagem, comprimento útil). V1 usa punção e matriz diretamente sem agrupador.

### 10.2 Regras derivadas do ferramental

| Regra | Fórmula | Tipo |
|---|---|---|
| Bitola mínima | `t ≥ V / 8` | Aviso |
| Bitola máxima | `t ≤ V / 6` | Aviso |
| Raio sugerido (air bending) | `R = V / 6` (aço); `V / 7` (inox); `V / 5` (alumínio) | Sugestão |
| Raio mínimo absoluto | `R ≥ max(shoulderRadius, tipRadius, t × 0.5)` | Erro |
| Aba mínima por tooling | `(V / 2) + 2×t` | Erro (soma com restrição do catálogo — prevalece o mais restritivo) |
| Ângulo máximo por punção | `dobra ≤ 180 - tipAngleDeg` | Erro |
| Ângulo máximo por matriz | `dobra ≤ 180 - openingAngleDeg` | Erro |

**Merge de restrições (mais restritivo prevalece):**

```js
merged.minFlange = Math.max(catRestriction.minFlange, toolingRestriction.minFlange)
merged.minRadius = Math.max(catRestriction.minRadius, toolingRestriction.minRadius)
merged.maxBendAngle = toolingRestriction.maxBendAngle  // só vem do tooling
```

### 10.3 Impacto no cálculo

- **R padrão atual:** `R=2` fixo, sem relação com a matriz usada. Com tooling: sugestão `R = V/6` exibida em Params.svelte. Em V=16, o correto é R≈2.7 — diferença de ~0.5 mm por dobra, 2 mm no blank de 4 dobras.
- **Aproveitamento:** `params.t` já alimenta `compute()` corretamente. O tooling adiciona apenas a validação de compatibilidade da bitola com a matriz — o cálculo em si não muda.
- **Fator K:** aviso sugerido quando `R < 2×t` (zona plástica intensa → K ≈ 0.33, não 0.44 default).

### 10.4 Integração no código

**Novo arquivo:** `src/lib/tooling.js`

```js
export function toolingRestrictions(punch, die, t) {
  if (!punch || !die) return { minFlange: 0, minRadius: 0, maxBendAngle: 180 };
  return {
    minFlange:    (die.vOpening / 2) + 2 * t,
    minRadius:    Math.max(die.shoulderRadius, punch.tipRadius, t * 0.5),
    maxBendAngle: Math.min(180 - punch.tipAngleDeg, 180 - die.openingAngleDeg),
    rSuggested:   die.vOpening / 6,
    tMin:         die.vOpening / 8,
    tMax:         die.vOpening / 6,
  };
}
```

**Onde plugar:**
- `stores.js` — adicionar `activePunchId`, `activeDieId`, `catalogPunches`, `catalogDies` (localStorage)
- `validation.js` — merge de tooling com catálogo no `validateProfile()`; checar ângulo por dobra
- `Params.svelte` — badge de R sugerido; aviso de bitola fora da faixa da matriz
- `Config.svelte` — nova aba "Ferramental" com CRUD de punções e matrizes

**Novo componente:** `Tooling.svelte` — seletor de punção+matriz ativa (global por sessão).

### 10.5 Escopo das versões

**v1 (implementar agora):**
- CRUD de Punções e Matrizes em Config → aba Ferramental
- Seleção global de punção+matriz ativa (por sessão, não por dobra)
- Validação integrada em `validateProfile()` (mais restritivo prevalece)
- Badge de R sugerido em Params.svelte
- Aviso de compatibilidade de bitola com matriz

**v2 (deixar para depois):**
- Entidade Máquina (agrupamento de ferramentas, filtra lista de punções/matrizes disponíveis)
- Seleção de tooling por dobra individual
- Cálculo de força: `F = (C × t² × Rm) / V` — validar tonelagem da máquina
- Coeficiente `vRatioK` por material para R sugerido mais preciso
- Biblioteca pré-cadastrada (Amada, Trumpf, Promecam)

---

## 11. Roadmap

### Fatias de produto

| # | Fatia | Status |
|---|---|---|
| 1 | Matéria-prima (bobina/chapa) + unidades + cobrar sobra + refilo/folga | ✅ feito |
| 2 | Preço dual (custo+venda, própria+concorrente) + comissão composicional | ✅ feito |
| Config | Catálogo configurável (materiais, bitolas, presets, empresa, descrição) | ✅ feito |
| CutPlan | Plano de corte visual para chapas (shell-packing, nesting, impressão) | ✅ feito |
| 3 | SPA modular (sidebar + header + rotas por módulo) | ✅ feito |
| — | Módulos CRM: Clientes, Metas, Campanhas, Admin (usuários + permissões) | ✅ feito |
| — | Integrações de API: ViaCEP, CNPJ, E-mail, WhatsApp, Google Maps (config UI) | ✅ feito |
| 4 | Ferramental (Punção + Matriz): CRUD + restrições + sugestão de R | ⬜ próximo |
| 5 | Impostos de saída (TaxConfig: ICMS × UF, PIS/COFINS, IPI, DIFAL) | ⬜ a fazer |
| 6 | Telha (convencional/sanduíche) e Composto | ⬜ a fazer |
| 7 | Templates de descrição configuráveis por tipo de produto | ⬜ a fazer |
| 8 | **Módulo de Prospecção** — busca Receita + enriquecimento + rota otimizada | ⬜ planejado (ver ADR 002) |

### Arquitetura (fases)

| Fase | O que muda | Quando |
|---|---|---|
| **Fase 1** | Reorganizar frontend em módulos (`src/modules/`) + SPA com sidebar/rotas | ✅ concluída |
| **Fase 2** | Backend Python FastAPI + Docker + PostgreSQL (clients, pricing, orders, admin) | Próxima — multi-usuário |
| **Fase 3** | Módulo de Prospecção: cron Receita + base Postgres + Routes API + enriquecimento | Requer backend (Fase 2+) |
| **Fase 4** | Tauri (desktop offline) usando o mesmo frontend | Pós-backend |

### Extras (fase 2+)

- Máquina como agrupador de ferramentas; cálculo de força de dobra vs tonelagem.
- Biblioteca pré-cadastrada de punções/matrizes (Amada, Trumpf, Promecam).
- Preview 3D do perfil extrudado (Threlte/Three.js).
- Estoque de bobina por lote ligado ao plano de corte.
- Preço por cidade/UF além de região; importação de tabela CSV.
- Nesting avançado para bobina (múltiplos SKUs na mesma largura).
- Agrupamento de itens por matéria-prima no pedido.
- Prospecção Fase 2: múltiplos vendedores com janelas de horário (Route Optimization API).

---

## 12. Integrações de API (configuráveis em Settings → Integrações)

O frontend já tem a UI de configuração e os stores. A chamada real das APIs fica no backend (evita expor chaves e permite cache/proxy).

| API | Provider(s) suportados | Uso no sistema |
|---|---|---|
| **ViaCEP** | viacep.com.br | Preenchimento de endereço por CEP em Clientes, Admin, Config |
| **CNPJ / Receita** | BrasilAPI, ReceitaWS, CNPJ.ws, custom | Preenchimento de dados da empresa por CNPJ |
| **E-mail transacional** | SMTP (senha/OAuth2), SendGrid, Mailgun, Resend, custom | Envio de orçamentos, pedidos e notificações |
| **WhatsApp** | Evolution API, Z-API, WPPConnect, Twilio, Meta Cloud API, custom | Envio de orçamentos e atualizações de pedido |
| **Google Maps / Routes** | Geocoding API, Routes API, Directions API, Distance Matrix API | Módulo de Prospecção — geocoding de endereços e rota otimizada |

Store: `apiConfig` em `src/lib/stores.js` (key `perf_api_config`). Cada integração tem flag `ativa`, provider e credenciais. O backend lê essas configurações por tenant e usa nos jobs/endpoints correspondentes.

---

## 13. Módulo de Prospecção

> Arquitetura detalhada em [`adrs/002-modulo-prospeccao.md`](adrs/002-modulo-prospeccao.md).

### Visão resumida

4 camadas independentes — cada uma substituível sem refazer as outras:

1. **Base local (Postgres + Receita Federal):** cron mensal que baixa o dump público da Receita e faz upsert. Guarda CNPJ, razão social, CNAE, endereço completo, porte, situação. É o motor de filtro — sem custo de API por busca.

2. **API de busca interna** (`GET /prospeccao/buscar`): filtros por CNAE (com autocomplete), UF/município/bairro/raio, porte, situação, data de abertura, texto livre. Retorna lista paginada com endereço.

3. **Enriquecimento sob demanda:** só chama API externa (Speedio, Econodata, CNPJ.ws) quando o usuário seleciona leads para trabalhar. Resultado fica cacheado no Postgres com `enriched_at` — evita re-cobrar o mesmo CNPJ dentro da janela de validade.

4. **Geolocalização + Rota (Google Maps):**
   - Geocoding: endereço Receita → lat/lng, salvo no banco, nunca recalculado sem mudança de endereço
   - Routes API com `optimizeWaypointOrder: true` → sequência otimizada de visitas + tempo + distância por parada + link "abrir no celular"

### Integrações com módulos existentes

- **Clientes:** botão "Importar do prospect" → preenche ClientForm com dados do CNPJ
- **Metas:** conversão prospect → cliente alimenta indicador de Positivação no GoalsPage
- **Histórico:** campo `status_prospeccao` (prospectado / agendado / convertido / descartado) evita abordar a mesma empresa duas vezes

### Pré-requisito

Requer **backend (Fase 2)** — cron de atualização Receita e chamadas de enriquecimento não rodam no frontend puro.

---

## 14. Itens em aberto / a validar

- **Impostos "por dentro":** mudar pricing.js de markup simples para fórmula com carga tributária vai subir o PV sugerido — alinhar com usuário antes de implantar.
- **IPI:** perfil de aço formado a frio (NCM 7216.x) → IPI 0%. Confirmar se a operação trabalha com NCMs que tenham IPI > 0 antes de simplificar o campo.
- **DIFAL:** alíquotas por convênio mudam — a tabela de ICMS por UF deve ser editável pelo usuário, não hardcoded.
- **Comissão por item:** hoje usa regra global. Salvar override de comissão por item do pedido é pendente.
- **Tooling — coeficiente R por material:** hoje `R = V / 6` para todos. Aço carbono/galvanizado = V/6; inox = V/7; alumínio = V/5. Confirmar se é relevante para a operação antes de adicionar `vRatioK` aos materiais.
- **Telha:** confirmar parâmetros (passo da onda, recobrimento, núcleo da sanduíche).
- **Nesting de bobina com múltiplos SKUs:** algoritmo atual assume 1 SKU por bobina.
- **OP:** confirmado "as duas" (folha única e uma por item).
