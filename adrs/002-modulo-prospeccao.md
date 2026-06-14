# ADR 002: Módulo de Prospecção — Arquitetura em 4 camadas

**Data:** 2026-06-14
**Status:** Planejado

---

## Contexto

O vendedor precisa identificar novos clientes na sua região de atuação. Hoje esse processo é manual (indicação, ligação fria, listagem em planilha). O objetivo do módulo de Prospecção é dar ao vendedor uma ferramenta para:

1. Filtrar empresas-alvo por segmento (CNAE), localização, porte e situação cadastral
2. Enriquecer leads selecionados com contato validado (e-mail, telefone, decisor)
3. Planejar a rota de visita do dia com waypoints otimizados

A arquitetura é dividida em **4 camadas independentes** de forma que cada peça pode ser trocada isoladamente (ex: mudar de Google Maps para outro provedor de mapas sem refazer a busca, ou trocar de API de enriquecimento sem mexer na base).

---

## Decisão

### Camada 1 — Base de dados local (Receita Federal)

Postgres atualizado mensalmente via cron com os dados abertos da Receita Federal (download direto do portal gov.br). Guarda tudo que é necessário para filtrar sem depender de API externa a cada busca:

```
Tabela: empresas
  cnpj             text PK
  razao_social     text
  nome_fantasia    text
  cnae_principal   text   -- código + descrição
  cnaes_secundarios jsonb
  situacao         text   -- ATIVA, BAIXADA, INAPTA, SUSPENSA
  porte            text   -- MEI, ME, EPP, DEMAIS
  capital_social   numeric
  data_abertura    date
  natureza_juridica text
  opcao_simples    boolean
  opcao_mei        boolean
  -- Endereço (já vem nos dados abertos)
  logradouro       text
  numero           text
  complemento      text
  bairro           text
  cep              text
  municipio        text
  uf               text(2)
  -- Enriquecimento (preenchido sob demanda)
  lat              numeric
  lng              numeric
  tel_validado     text
  email_validado   text
  contato_nome     text
  contato_cargo    text
  enriched_at      timestamptz
  -- Prospecção
  status_prospeccao text  -- NULL, 'prospectado', 'agendado', 'convertido', 'descartado'
  prospectado_em   timestamptz
  vendedor_id      uuid
```

**Atualização mensal:** cron job baixa o dump da Receita (arquivos .zip particionados por UF), processa com Python/pandas e faz upsert no Postgres. Processo roda fora do horário comercial.

**Infraestrutura:** VPS simples com PostgreSQL. Custo estimado: R$ 80–150/mês.

---

### Camada 2 — API de busca interna

Endpoint próprio do backend que recebe filtros e retorna lista paginada sem tocar API externa.

```
GET /prospeccao/buscar

Query params:
  cnae          string    -- código ou termo (ex: "padaria", "1091102")
  uf            string    -- UF de 2 letras
  municipio     string
  bairro        string
  raio_km       number    -- raio em km a partir de lat/lng
  lat, lng      number    -- ponto de referência para raio
  porte         string[]  -- ["MEI","ME","EPP","DEMAIS"]
  situacao      string    -- default "ATIVA"
  data_abertura_min date
  data_abertura_max date
  q             string    -- texto livre em razão social / nome fantasia
  page, limit   number    -- paginação

Response:
  { total, page, limit, items: [{ cnpj, razao_social, nome_fantasia, cnae_principal,
    porte, municipio, uf, bairro, logradouro, data_abertura, lat, lng }] }
```

**CNAE com autocomplete:** tabela auxiliar `cnaes` com código + descrição. Frontend faz debounce de 300ms e busca `/prospeccao/cnaes?q=padaria` para sugerir os códigos corretos.

---

### Camada 3 — Enriquecimento sob demanda

Chamado somente quando o usuário seleciona empresas da lista para trabalhar. Nunca chamado em lote no momento da busca (controlado por custo).

**Provedores suportados (configurável em Integrações):**
- CNPJ.ws (público, sem token — dados básicos)
- Speedio (pago — contatos qualificados)
- Econodata (pago — decisores)
- Campo customizado para outros provedores

**Fluxo:**
```
1. Usuário seleciona N empresas → clica "Enriquecer"
2. Backend verifica cache: se enriched_at < X dias, serve do banco
3. Para os não-cacheados: chama API de enriquecimento, persiste resultado
4. Frontend exibe telefone, e-mail, contato, cargo
```

**Cache:** resultado fica em `empresas.tel_validado / email_validado / contato_*` com `enriched_at`. Janela de expiração configurável (default: 30 dias). Evita re-cobrar consulta recente.

---

### Camada 4 — Geolocalização e Rota (Google Maps)

#### 4.1 Geocoding (endereço → lat/lng)

Os endereços da Receita chegam como texto puro. Para plotar no mapa e calcular rotas, precisam de coordenadas.

**Estratégia de custo:**
- Geocode sob demanda (quando o usuário clica em uma empresa pela primeira vez ou quando o endereço mudou na atualização mensal)
- `lat` e `lng` ficam salvos no Postgres — não são recalculados a cada consulta
- Re-geocode automático apenas se `logradouro` ou `cep` mudarem no diff mensal da Receita

**API usada:** Google Geocoding API (~US$ 5 / 1.000 requests). Primeiros US$ 200/mês gratuitos — cobre ~40.000 geocodificações por mês dentro do free tier.

**Alternativa gratuita:** Nominatim (OpenStreetMap) — acurácia menor em endereços brasileiros, mas zero custo. Usar como fallback configurável.

#### 4.2 Rota de visita otimizada (Routes API)

Chamada quando o usuário seleciona as empresas para visitar no dia e define o ponto de partida.

**Request:**
```json
POST https://routes.googleapis.com/directions/v2:computeRoutes
{
  "origin": { "location": { "latLng": { "latitude": -20.8, "longitude": -49.4 } } },
  "destination": { "location": { "latLng": { ... } } },
  "intermediates": [ { "location": { ... } }, ... ],
  "travelMode": "DRIVE",
  "optimizeWaypointOrder": true,
  "routingPreference": "TRAFFIC_AWARE"
}
```

**Response útil:**
- `optimizedIntermediateWaypointIndex[]` — ordem otimizada dos waypoints
- `legs[].duration` e `legs[].distanceMeters` — tempo e distância por parada
- `legs[].polyline` — para desenhar a rota no mapa
- `routes[0].routeToken` — pode ser passado direto para o Maps JS para renderizar

**Link "Abrir no Google Maps":**
```
https://www.google.com/maps/dir/?api=1
  &origin=LAT,LNG
  &destination=LAT,LNG
  &waypoints=LAT1,LNG1|LAT2,LNG2|...
  &travelmode=driving
```

Para casos com mais de 23 waypoints ou múltiplos vendedores com janelas de horário, usar a **Route Optimization API** do Google Cloud (Fleet Routing). Para o MVP, Routes API + `optimizeWaypointOrder` cobre 95% dos casos.

---

## Fluxo do usuário (ponta a ponta)

```
1. Filtros → "restaurantes" + "São José do Rio Preto" + "ME ou EPP" + "Ativas"
   → API interna devolve 340 empresas, mapa mostra pins

2. Vendedor seleciona 12 → clica "Enriquecer"
   → Cache miss → chama Speedio/Econodata → salva tel/e-mail/contato
   → Lista atualiza com dados de contato

3. Marca 8 pra visitar → define "Sair do escritório às 08:00"
   → Routes API → sequência otimizada + tempo total
   → Card de rota com link "Abrir no Google Maps"
   → Opcionalmente: criar compromissos na agenda do vendedor

4. Volta ao fim do dia → marca status de cada visita
   (sem retorno / agendado / convertido / descartado)
```

---

## Integrações com módulos existentes do Perfilar

| Ponto de integração | Mecanismo |
|---|---|
| **Cadastro de clientes** | Botão "Importar do prospect" preenche ClientForm com dados do CNPJ selecionado (razão social, endereço, CNAE → segmento) |
| **Histórico de prospecção** | Campo `status_prospeccao` no banco; filtro "já prospectados" na busca para evitar abordagem dupla |
| **Agenda / CRM** | Ao gerar rota, opção de criar compromissos com horário estimado de chegada por parada |
| **Metas de vendas** | Positivação: conversão de prospect → cliente alimenta o indicador de positivação do GoalsPage |

---

## Custos estimados

| Item | Custo estimado |
|---|---|
| VPS Postgres (base Receita) | R$ 80–150/mês |
| Google Geocoding | US$ 5 / 1.000 endereços ¹ |
| Google Routes API | US$ 5–10 / 1.000 rotas ¹ |
| Enriquecimento (ex: Speedio) | R$ 0,10–0,50 por lead enriquecido |

¹ Primeiros US$ 200/mês são gratuitos — cobre ~40k geocodificações ou ~20k–40k rotas calculadas.

---

## Alternativas consideradas

- **Usar apenas dados Receita sem mapa:** resolve o filtro, mas perde o planejamento de rota — o diferencial do módulo.
- **Nominatim (OSM) em vez de Google Geocoding:** zero custo de geocoding, mas acurácia menor em endereços brasileiros informais. Manter como opção de fallback configurável em Integrações.
- **Enriquecimento em batch proativo:** geocodar e enriquecer toda a base na importação mensal. Caro e desnecessário — a maioria dos CNPJs nunca será visitada. Abordagem sob demanda com cache é muito mais eficiente.
- **Route Optimization API (Fleet Routing):** cobre múltiplos vendedores com janelas de horário e restrições de capacidade. Over-engineering para o MVP; Routes API cobre 95% dos casos com custo menor.

---

## Consequências

**Positivas:**
- Vendedor sai do dia com rota otimizada em vez de improvisar no GPS
- Base Receita local elimina dependência de API externa para a busca principal (sem latência, sem custo por busca)
- Cache de enriquecimento evita re-cobrar o mesmo lead

**Trade-offs:**
- Cron mensal de atualização da Receita requer backend — não funciona em modo 100% frontend/localStorage
- Google Maps não funciona sem chave válida; Nominatim é o fallback mas com acurácia menor
- Enriquecimento depende de fornecedor externo pago (Speedio, Econodata) para dados de contato qualificados

**Riscos a monitorar:**
- Mudança de formato do dump da Receita Federal (acontece raramente)
- Limites de rate da Routes API para rotas com muitos waypoints (máx 25 intermediários na versão sem otimização de frota)
- Qualidade dos endereços da Receita em municípios pequenos (endereços desatualizados ou sem número)
