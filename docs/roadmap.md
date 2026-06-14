# Roadmap

## Entregues ✅

### Fatia 1 — Matéria-prima
Bobina/chapa, refilo, folga entre peças, opção de cobrar sobra. Nesting inline em tempo real (bobina = faixas, chapa = grid 2D).

### Fatia 2 — Preço dual
Tabela de preços por região × material × revestimento. Custo, venda e concorrente. Comissão composicional com engine configurável e UI dedicada.

### Config
Empresa (nome, CNPJ, endereço estruturado + botões de API placeholders, logo), Materiais, Bitolas, Catálogo de Perfis (CRUD + editor visual + restrições geométricas), Descrição padronizada (template com tokens).

### CutPlan
Plano de corte visual para chapas: shell-packing, nesting colorido por tipo de peça, impressão/PDF, cabeçalho com dados da empresa.

### Validação
Restrições dimensionais (abas, folgas) e detecção de auto-interseção no blueprint.

### Fatia 3 — SPA modular
Shell fixa com sidebar colapsável + header + roteamento hash. Módulos: Editor, Plano de corte, Pedidos, Clientes, Metas, Produtos, Materiais, Preços, Configurações, Admin.

### Módulos CRM (frontend-only)

**Clientes** — cadastro PJ/PF com endereço estruturado (logradouro, CEP, bairro, cidade, UF), contato principal, segmento. Placeholder para busca de CNPJ e CEP via API.

**Metas** — metas mensais gerais (faturamento, peso, pedidos, positivação) com histórico de 12 meses. Metas por vendedor com card por colaborador e breakdown por família de perfil. Campanhas com tipos de incentivo, datas e progresso.

**Admin** — CRUD de usuários com perfis de acesso (admin, gerente, gestor, vendedor, assistente). Matriz de permissões por módulo. Campos: nome, sobrenome, e-mail, telefone, WhatsApp, código de vendedor, endereço estruturado.

### Integrações de API (UI de configuração)

Aba "Integrações" em Configurações com card por API, toggle ativa/inativa, campos de credenciais, botão de teste:

| API | Providers |
|-----|-----------|
| ViaCEP | viacep.com.br — sem autenticação, testável diretamente |
| CNPJ / Receita | BrasilAPI, ReceitaWS, CNPJ.ws, custom |
| E-mail transacional | SMTP (senha de app ou OAuth2), SendGrid, Mailgun, Resend, custom |
| WhatsApp | Evolution API, Z-API, WPPConnect, Twilio, **Meta Cloud API**, custom |
| Google Maps / Routes | Geocoding, Routes, Directions, Distance Matrix, Maps JS |

A chamada real das APIs fica no backend; o frontend só salva a configuração e permite testar a conectividade.

---

## Próximas fatias

### Fatia 4 — Ferramental (Punção + Matriz)
CRUD de punções e matrizes em Config → aba Ferramental. Seleção global de punção+matriz ativa por sessão. Validação integrada em `validateProfile()` (mais restritivo prevalece). Badge de raio sugerido (`R = V / 6`) em Params.svelte.

Ver [`adrs/001-tooling-ferramental-dobradeira.md`](../adrs/001-tooling-ferramental-dobradeira.md).

### Fatia 5 — Impostos de saída
`TaxConfig` em Preços & Impostos. Modelo: Lucro Presumido.

| Imposto | Regra |
|---------|-------|
| PIS | 0,65% sobre faturamento |
| COFINS | 3,00% sobre faturamento |
| ICMS interno | por UF (SP=18%, MG=18%, RS=12%…) |
| ICMS interestadual | 7% (S/SE/CO → N/NE/ES) ou 12% (entre S/SE/CO) |
| IPI | campo configurável, default 0% (NCM 7216.x = 0%) |
| DIFAL | venda interestadual para não-contribuinte — sai da margem |

Fórmula "por dentro":

```
carga = ICMS + PIS + COFINS + IPI
PV    = custo / (1 - carga - margem_desejada)
```

> Migrar de markup simples para "por dentro" vai subir o PV sugerido. Alinhar com o usuário antes de implantar.

### Fatia 6 — Telha e Composto
Telha convencional (trapezoidal/ondulada) e painel sanduíche. Cálculo por m² com sobreposição e perdas de corte.

---

## Fase 2 — Backend

Quando o SaaS precisar de multi-usuário real:

- Python FastAPI + Pydantic + SQLAlchemy 2 + Alembic
- PostgreSQL (SaaS) / SQLite (Tauri) — mesmo código, troca de driver
- Docker + docker-compose
- Começa por: clientes, impostos, pedidos, usuários/auth
- Geometria/física permanece no frontend; backend recebe snapshots calculados
- Ponto de integração: `src/lib/api.js` (hoje localStorage, amanhã fetch)
- Integrações de API (ViaCEP, CNPJ, e-mail, WhatsApp, Maps) passam a ser chamadas pelo backend

---

## Fase 3 — Módulo de Prospecção

Requer o backend da Fase 2 (cron de atualização da Receita, cache de enriquecimento, chamadas de API externas).

**4 camadas independentes:**

1. **Base Receita Federal** — Postgres com dump mensal (CNPJ, razão social, CNAE, endereço completo, porte, situação cadastral). Atualizado via cron job. Custo: ~R$ 80–150/mês de VPS.

2. **API de busca interna** (`GET /prospeccao/buscar`) — filtros por CNAE (autocomplete por descrição), UF/município/bairro/raio em km, porte, situação, data de abertura, texto livre. Sem custo por consulta.

3. **Enriquecimento sob demanda** — chama API externa (Speedio, Econodata, CNPJ.ws) só quando o usuário seleciona leads. Resultado cacheado no Postgres com `enriched_at`.

4. **Geolocalização + Rota (Google Maps):**
   - Geocoding API — endereço Receita → lat/lng, salvo no banco, recalculado só se o endereço mudar
   - Routes API com `optimizeWaypointOrder: true` — sequência otimizada de visitas + tempo + distância por parada + link "abrir no celular"

**Fluxo do usuário:**
```
Filtrar empresas → Selecionar leads → Enriquecer → Marcar para visita
→ Gerar rota otimizada → Abrir no GPS → Registrar resultado da visita
```

**Integrações com módulos existentes:** importar prospect direto para ClientsPage; conversão alimenta positivação no GoalsPage.

Ver [`adrs/002-modulo-prospeccao.md`](../adrs/002-modulo-prospeccao.md) para arquitetura completa.

---

## Fase 4 — Desktop offline (Tauri)

Mesmo frontend Svelte empacotado com Tauri. Persistência via SQLite local com o mesmo código de backend, trocando apenas o driver do banco. Requer Fase 2 concluída.
