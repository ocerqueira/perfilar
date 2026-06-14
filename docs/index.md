# Perfilar

Editor de perfis dobrados de aço voltado para vendedores e orçamentistas de distribuidoras.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| UI | Svelte 4 |
| Build | Vite 5 |
| Geometria | Maker.js 0.18.1 |
| Persistência atual | `localStorage` via `src/lib/api.js` |
| Persistência futura | Python FastAPI + PostgreSQL (SaaS) / SQLite (Tauri) |

## Conceitos centrais

**Perfil** — seção transversal de aço formado a frio, definido por uma sequência de abas (`rows`) com dimensões e ângulos. O blueprint é gerado via Maker.js a partir dessas rows.

**Blank / desenvolvimento** — comprimento total de chapa plana necessário para dobrar o perfil. Calculado somando as abas mais os fatores de dobra (fator K, raio R).

**Matéria-prima** — pode ser **bobina** (comprimento contínuo, refilo lateral) ou **chapa** (dimensões fixas, refilo perimetral). O modo determina como o nesting e o custo são calculados.

**Plano de corte** — distribuição das peças na chapa (grid 2D) ou bobina (faixas), com visualização SVG e exportação para PDF.

## Estrutura de pastas

```
src/
  lib/           engine, pricing, commission, catalog, stores, draw, api
  modules/
    editor/      blueprint, planilha, matéria-prima, params, results
    cutplan/     plano de corte, nesting
    pricing/     preços, comissão
    orders/      pedidos, documentos (OP, orçamento)
    clients/     cadastro de clientes (PJ/PF, endereço estruturado)
    goals/       metas mensais, metas por vendedor, campanhas
    admin/       usuários, perfis de acesso, matriz de permissões
    products/    catálogo de perfis
    materials/   catálogo de materiais
    settings/    empresa, descrição, editor display, integrações de API
    prospeccao/  (planejado) busca Receita, enriquecimento, rota otimizada
  router/        roteamento hash-based
  components/    tooltip e utilitários compartilhados
docs/            esta documentação
adrs/            decisões de arquitetura (ADR 001: ferramental, ADR 002: prospecção)
```
