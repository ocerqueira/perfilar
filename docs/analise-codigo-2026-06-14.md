# Análise Completa — Perfilar (14/06/2026)

## Resumo

O projeto tem boa estrutura e arquitetura consistente para uma SPA Svelte 4 de cálculo de perfis. O maior problema é **código duplicado** entre módulos e **arquivos muito grandes** que dificultam manutenção.

---

## 1. Padronização & Nomenclatura

### ⚠️ Duplicação de código entre módulos (problema crítico)

| Item duplicado | Onde está | Vezes |
|---|---|---|
| `TIPOS_CLIENTE` / `SEGMENTOS` | `EditorPage`, `DashboardPage`, `ClientsPage` | 3× |
| `VALIDADE_OPTS` | `EditorPage`, `DashboardPage` | 2× |
| `UFS` (lista de estados) | `ClientsPage`, `SettingsPage`, `AdminPage` | 3× |
| Lógica de busca CEP | `ClientsPage`, `SettingsPage`, `AdminPage` | 3× |
| Lógica de busca CNPJ | `ClientsPage`, `SettingsPage` | 2× |
| Padrão de confirmação `confirmDel` | `OrdersPage`, `ClientsPage`, `AdminPage`, `GoalsPage` | 4× |
| Função `nf` redefinida localmente | `OrdersPage.svelte` (sombreia a importada de `engine.js`) | 1× |

**Solução:** Criar um `src/lib/constants.js` e `src/lib/api.js` para centralizar constantes e lógicas de API.

### ⚠️ Classes CSS duplicadas em todo componente

Classes como `.btn-amber`, `.btn-line`, `.inp`, `.tabs`, `.tab`, `.card`, `.card-hd`, `.card-title` são **redefinidas em praticamente todos os componentes** (15+ arquivos), com pequenas variações de altura, padding, border-radius. Isso fere o princípio DRY.

**Solução:** Mover para `app.css` como classes globais, ou criar componentes `<Button>`, `<Card>`, `<Tabs>`.

### ✅ Padrão consistente de stores

O padrão `_KEY` → `_DEF` → `_loadX()` → `writable()` → `subscribe(localStorage)` é replicado 14 vezes de forma consistente. É repetitivo mas previsível. Poderia ser abstraído em um helper `createPersistedStore(key, default)`.

### ✅ Separação de responsabilidades

- `lib/` → lógica pura de negócio (engine, pricing, commission, geometry)
- `modules/` → páginas Svelte com UI
- `components/` → componentes reutilizáveis
- `router/` → roteamento

Boa estrutura.

### ⚠️ Mistura de idiomas (Português + Inglês)

- **Domínio em português**: `custo`, `venda`, `orcamento`, `pedido`, `calha`, `refilo`, `espac`, `sobra`, `dobra`, `bitola`, `chapa`, `bobina`
- **Técnico em inglês**: `store`, `writable`, `compute`, `snapshot`, `rows`, `filter`
- **Híbridos**: `precoTotal`, `totLiq`, `pcFat`, `custoKg`

Regra implícita: domínio = PT, código = EN. É aceitável para um app brasileiro, mas os híbridos (`precoTotal`) poderiam ser uniformizados (ou `precoTotal` ou `totalPrice`, não ambos os padrões).

### ⚠️ Abreviações inconsistentes

- `C` = comprimento, `P` = params, `t` = espessura — muito curtos, perdem legibilidade
- `bd` = bend deduction mode, `mg` = margem, `orc` = orçamento
- `tot` vs `total` usados alternadamente (`totLiq` vs `totalKg`)

---

## 2. Código Morto / Lixo

### ❌ Import não utilizado

`OrdersPage.svelte` importa `nf` de `engine.js` mas redefine uma função local `nf` (linhas 104-106) que sombreia a importada. O import é inútil.

### ❌ `console.warn` em produção

`geometry.js:17`:
```js
console.warn('fillet ignorado:', e.message);
```

### ⚠️ Placeholder sem função real

`CutPlanPage.svelte` é só um placeholder que diz "acesse pelo botão no Editor". Não adiciona valor como rota independente. Ou remove a rota ou implementa acesso direto por pedido.

### ⚠️ Objeto `_USER_DEF` com campos não utilizados

`stores.js` define `_USER_DEF` com `nome`, `email`, `role`, mas `role` é fixo `'admin'` (comentário diz "até a Fase 4"). OK como preparação futura, mas o campo `nome` e `email` do usuário são editáveis em Settings.

### ✅ Sem imports completamente órfãos

Fora o caso do `nf` em `OrdersPage`, não encontrei imports 100% não usados.

---

## 3. Inteligência do Código

### ✅ Algoritmos bem implementados

- **`cutplan.js` (shelf-packing)**: Algoritmo de empacotamento guilhotina bem escrito, com rotação de peças e agrupamento por faixas.
- **`engine.js` (cálculo de perfil)**: Cálculo de desenvolvimento com bend deduction, fator K, e modos bobina/chapa bem estruturados.
- **`validation.js` (detecção de colisão)**: Interseção de segmentos 2D com cross product — implementação correta.
- **`commission.js` (comissão escalonada)**: Cálculo por faixas progressivas bem feito.
- **`pricing.js` (tabela de preços dual)**: Tabela própria + concorrente com migração V1→V2.

### ✅ Boas práticas Svelte

- Uso correto de `$:` para declarações reativas
- `createEventDispatcher` para eventos de componentes
- `context="module"` em `Docs.svelte` para exportar `itemBlock` como função estática
- `{#key}` para forçar re-render quando necessário (`ProductsPage.svelte:171`)

### ❌ Anti-padrão: `$store = $store` para forçar reatividade

Presente em **dezenas de lugares**:
```js
$editor = $editor;
$order = $order;
$regions = $regions;
```
Isso é necessário porque o Svelte 4 não detecta mutações profundas em objetos. Em Svelte 5 com runes, isso desaparece. Enquanto estiver no Svelte 4, o ideal seria usar `store.update()` com padrão imutável, ou aceitar como débito técnico documentado.

### ⚠️ Arquivos muito grandes

| Arquivo | Linhas |
|---|---|
| `SettingsPage.svelte` | 1322 |
| `ClientsPage.svelte` | 936 |
| `OrdersPage.svelte` | 909 |
| `DashboardPage.svelte` | 896 |
| `EditorPage.svelte` | 869 |
| `GoalsPage.svelte` | 798 |
| `CutPlan.svelte` | 614 |

Vários componentes que poderiam ser extraídos:
- `EditorPage` → extrair modal de salvar, modal de busca de cliente, modal de novo cliente
- `DashboardPage` → extrair KPI cards, gráfico de barras, formulário de registro
- `SettingsPage` → extrair cada aba para seu próprio componente
- `OrdersPage` → extrair card de pedido, modal de perda

### ⚠️ Tratamento de erros silencioso

Em toda a base, erros de rede e parsing são silenciados:
```js
try { ... } catch { /* ignore */ }
```
Para `localStorage` isso é aceitável. Para chamadas de API (ViaCEP, BrasilAPI), seria melhor mostrar feedback ao usuário (já existe `apiTestState` em Settings, mas não em ClientsPage/AdminPage).

### ⚠️ Sem TypeScript

Para um app de cálculo comercial (preços, pesos, comissões), types evitariam bugs como:
- Confundir `C.des` (desenvolvimento) com `C.tot` (peso total)
- Passar parâmetros errados para `compute()` ou `priceFor()`
- Acessar propriedades inexistentes em objetos aninhados

---

## 4. Resumo de Ações Recomendadas

### 🔴 Crítico (corrigir agora)

1. **Remover `nf` local de `OrdersPage.svelte`** — usar a importada de `engine.js`
2. **Centralizar `TIPOS_CLIENTE`, `VALIDADE_OPTS`, `UFS`** em `src/lib/constants.js`
3. **Centralizar lógica de CEP/CNPJ** em `src/lib/api.js` (3 cópias → 1)
4. **Remover `console.warn`** de `geometry.js` ou colocar atrás de flag de debug

### 🟡 Importante (próxima iteração)

5. **Extrair classes CSS comuns** (`.btn-amber`, `.btn-line`, `.inp`, `.card`, etc.) para `app.css`
6. **Dividir componentes grandes**: `SettingsPage` → 4 sub-componentes, `EditorPage` → extrair modais
7. **Padronizar nomes**: decidir PT ou EN para híbridos como `precoTotal` → `precoTotal` (manter PT) ou `totalPrice`
8. **Avaliar migração para Svelte 5** (runes eliminariam o `$store = $store`)

### 🟢 Desejável (médio prazo)

9. **Adicionar TypeScript** progressivamente (começar por `engine.js` e `pricing.js`)
10. **Criar helper `createPersistedStore()`** para eliminar boilerplate de 14 stores
11. **Implementar `CutPlanPage`** ou remover a rota
12. **Melhorar feedback de erro** nas chamadas de API (substituir `catch { /* ignore */ }` por toast/notificação)
13. **Criar componentes compartilhados** para modal de confirmação de exclusão (padrão `confirmDel` usado 4×)

---

## 5. Estatísticas do Projeto

| Métrica | Valor |
|---|---|
| Total de arquivos fonte | 37 |
| Total de linhas (~) | ~9.500 |
| Stores (writable) | 19 |
| Módulos/páginas | 12 |
| Bibliotecas (lib/) | 8 |
| Componentes reutilizáveis | 1 (Tooltip) |
| Dependências npm | 3 (makerjs, svelte, vite) |
| Maior arquivo | SettingsPage.svelte (1322 linhas) |
