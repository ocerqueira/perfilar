# Arquitetura

## SPA shell

`App.svelte` é o shell fixo: header + sidebar colapsável + `<main>` com o `Router`.

O roteamento é **hash-based** simples (`#editor`, `#cutplan`, …). O `Router.svelte` recebe o array de rotas e monta o componente ativo via `<svelte:component>`. Não usa svelte-navigator nem qualquer biblioteca de rota — a simplicidade é intencional enquanto não há autenticação nem rotas aninhadas.

## Módulos

Cada módulo em `src/modules/<nome>/` é autossuficiente: tem sua página (`*Page.svelte`), seus subcomponentes e, quando necessário, seu store local. A comunicação entre módulos passa exclusivamente pelos stores globais em `src/lib/stores.js`.

| Módulo | Rota | Grupo | Descrição |
|--------|------|-------|-----------|
| `dashboard` | `#dashboard` | Trabalho | KPIs, metas, alertas, registro rápido |
| `editor` | `#editor` | Trabalho | Editor de perfis de aço, itens do pedido |
| `cutplan` | `#cutplan` | Trabalho | Plano de corte (nesting) |
| `analises` | `#analises` | Comercial | Análises por período, curva ABC, ranks |
| `orders` | `#orders` | Comercial | Gestão de orçamentos e pedidos (ciclo de vida) |
| `pricing` | `#pricing` | Comercial | Tabela de preços por região |
| `goals` | `#goals` | Comercial | Metas mensais (geral + por vendedor) e campanhas |
| `prospeccao` | `#prospeccao` | Comercial | Busca Receita Federal + enriquecimento + rota otimizada (planejado) |
| `clients` | `#clients` | Cadastros | Cadastro de clientes (PF/PJ, endereço estruturado) |
| `products` | `#products` | Cadastros | Produtos (placeholder) |
| `materials` | `#materials` | Cadastros | Configuração de materiais e revestimentos |
| `settings` | `#settings` | — | Empresa, descrição, integrações de API, usuário atual |
| `admin` | `#admin` | — | Usuários, perfis de acesso, matriz de permissões |

## Stores

Todos os stores persistidos ficam em `src/lib/stores.js`. O padrão de criação é:

```js
const _KEY = 'perf_<nome>'
const _DEF = { /* defaults */ }

function _load() {
  try { const v = JSON.parse(localStorage.getItem(_KEY)); return v ? { ..._DEF, ...v } : { ..._DEF } }
  catch { return { ..._DEF } }
}

export const meuStore = writable(_load())
meuStore.subscribe(v => { try { localStorage.setItem(_KEY, JSON.stringify(v)) } catch {} })
```

### Stores persistidos

| Store | Chave localStorage | Conteúdo |
|-------|--------------------|----------|
| `companyInfo` | `perf_company` | Razão social, CNPJ, IE, endereço estruturado, logo (base64) |
| `currentUser` | `perf_currentUser` | `{nome, email, role}` — role fixo `'admin'` até Fase 2 |
| `orders` | `perf_orders` | Orçamentos e pedidos com ciclo de vida completo |
| `orderHistory` | `perf_orderHistory` | Log imutável de pedidos fechados (analytics) |
| `clients` | `perf_clients` | Cadastro de clientes (PF/PJ, endereço estruturado) |
| `appUsers` | `perf_app_users` | Usuários do sistema (CRUD do Admin) |
| `metas` | `perf_metas` | Meta mensal global `{faturamento, volume, pedidos, positivacao}` |
| `goalHistory` | `perf_goals_history` | Histórico mensal de metas (append-only) |
| `vendedorGoals` | `perf_vendedor_goals` | Metas por vendedor `[{id, month, vendedorId, ...}]` |
| `campaigns` | `perf_campaigns` | Campanhas de vendas com período, tipo e prêmio |
| `apiConfig` | `perf_api_config` | Configuração das integrações de API (ViaCEP, CNPJ, email, WhatsApp, Maps) |
| `commissionRule` | `perfilar.commission.v1` | Regra de comissão |
| `printConfig` | `perf_print` | Layout de impressão (`one`\|`two`) |
| `descConfig` | `perf_descCfg` | Template e siglas de descrição padronizada |
| `editorDisplay` | `perf_editorDisplay` | Preferências de exibição do editor |
| `regions` | `perfilar.precos.v2` (via pricing.js) | Regiões e tabela de preços |
| `catalogMaterials` | `perfilar.catalog.mat.v1` | Materiais configurados |
| `catalogRevests` | `perfilar.catalog.rev.v1` | Revestimentos |
| `catalogGauges` | `perfilar.catalog.gau.v1` | Bitolas |
| `catalogPresets` | `perfilar.catalog.cust.v1` | Perfis personalizados |
| `catalogOverrides` | `perfilar.catalog.over.v1` | Overrides de built-ins |

### Stores transientes (não persistem, apenas em memória)

| Store | Conteúdo |
|-------|----------|
| `editor` | Estado atual do editor (perfil, rows, params) |
| `order` | Itens do pedido em andamento e índice selecionado |
| `ctx` | Cliente, Nº orçamento, vendedor, observação |
| `editingOrderId` | ID do pedido aberto para edição no editor (ou `null`) |
| `quotingClient` | Objeto completo do cliente vinculado ao orçamento em andamento (ou `null`) |

### Shape de um pedido (`orders`)

```js
{
  id: number,           // Date.now()
  createdAt: ISO,
  updatedAt: ISO,
  status: 'orcamento' | 'pedido' | 'perdido',
  dataValidade: ISO | null,   // só orçamentos
  dataPedido: ISO | null,     // preenchido ao fechar
  cliente: string,
  orc: string,                // Nº orçamento (manual, futuro: automático)
  vendedor: string,
  obs: string,
  tipoCliente: string,        // segmento do cliente
  cidade: string,
  region: string,             // ID da região de preço
  clientId: number | null,    // referência ao cadastro de clientes
  items: number,              // contagem de itens
  totW: number,               // peso total (kg)
  totV: number,               // valor total (R$)
  comm: number,               // comissão estimada (R$)
  itemsDetalhe: Array,        // resumo por item (tipo, peso, valor)
  orderItems: Array,          // snapshots completos dos itens do editor
  motivoPerda: { categoria, motivo, date } | undefined,
}
```

### Shape de um cliente (`clients`)

```js
{
  id: number,
  createdAt: ISO,
  updatedAt: ISO,
  tipo: 'pj' | 'pf',
  // PJ
  nome: string,           // razão social
  nomeFantasia: string,
  cnpj: string,
  ie: string,
  // PF
  sobrenome: string,
  cpf: string,
  // Contato
  email: string,
  tel: string,
  whatsapp: string,
  site: string,
  instagram: string,
  segmento: string,       // construtora | revendedor | industria | pessoa_fisica | outro
  // Endereço estruturado
  cep: string,
  logradouro: string,
  numero: string,
  complemento: string,
  bairro: string,
  cidade: string,
  uf: string,
  endereco: string,       // legado — fallback para dados antigos
  // Contato principal
  contatoNome: string,
  contatoSobrenome: string,
  contatoCargo: string,
  contatoTel: string,
  contatoEmail: string,
  obs: string,
}
```

### Shape de um usuário (`appUsers`)

```js
{
  id: number,           // Date.now()
  createdAt: ISO,
  nome: string,
  sobrenome: string,
  email: string,
  telefone: string,
  whatsapp: string,
  codigo: string,       // código de vendedor (obrigatório para role 'vendedor')
  role: 'admin' | 'gerente' | 'gestor' | 'vendedor' | 'assistente',
  ativo: boolean,
  // Endereço estruturado
  cep: string,
  logradouro: string,
  numero: string,
  complemento: string,
  bairro: string,
  cidade: string,
  uf: string,
}
```

## Isolamento da camada de persistência

`src/lib/api.js` é o único ponto de acesso ao backend futuro. Hoje todas as funções dele leem/escrevem no `localStorage`. Quando o backend FastAPI chegar, só esse arquivo muda — os módulos não precisam saber da diferença.

## Fluxo de dados no Editor

```
Params (t, C, Q, material…)
        │
        ▼
  engine.js → calcula blank, peso, custo, nesting
        │
        ├─▶ Blueprint.svelte  (Maker.js → SVG)
        ├─▶ Planilha.svelte   (tabela de abas)
        └─▶ Results.svelte    (resultados numéricos)
```

O `editor` store guarda o estado completo do perfil. Qualquer mudança nos params ou rows re-executa o engine reativamente via `$:` no `EditorPage.svelte`.

## Fluxo cliente → orçamento

```
ClientsPage
  └─▶ "Novo orçamento" (botão no card do cliente)
        │  ctx.cliente ← c.nome
        │  quotingClient ← c   (objeto completo)
        ▼
      EditorPage  (hash #editor)
        │  toolbar: campos Cliente/ORC/Vendedor/Obs
        │  usuário adiciona itens ao pedido
        ▼
      Modal "Salvar registro"
        │  tipoCliente ← qc.segmento  (pré-preenchido)
        │  cidade      ← qc.cidade    (pré-preenchido)
        │  badge azul mostra "do cadastro"
        ▼
      orders store
        │  entry.clientId = qc.id  (vínculo para futuras queries)
        │  quotingClient ← null
        └─▶ OrdersPage (pedido aparece na lista)
```

O `clientId` gravado no pedido permite, no futuro, buscar todos os pedidos de um cliente pelo ID sem depender da string do nome.

## Ciclo de vida de um pedido

```
[editor]
   │ Salvar → status: 'orcamento'
   ▼
[orders]
   ├─ Fechar pedido → status: 'pedido'  + log em orderHistory
   ├─ Marcar perdido → status: 'perdido' + motivoPerda { categoria, motivo }
   ├─ Reabrir → status: 'orcamento'
   └─ Editar → volta ao editor com orderItems restaurados
              editingOrderId ← entry.id
```

`orderHistory` é um log **append-only** de pedidos fechados — usado pelas análises e KPIs do Dashboard. Nunca é editado retroativamente.
