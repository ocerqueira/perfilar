# Módulo de Prospecção

> **Status:** planejado — requer backend (Fase 2). Ver [`adrs/002-modulo-prospeccao.md`](../adrs/002-modulo-prospeccao.md) para a arquitetura completa.

Módulo para o vendedor identificar, qualificar e roteirizar visitas a novos clientes. Estruturado em 4 camadas independentes que podem ser trocadas sem refazer o resto.

---

## 4 camadas

### 1. Base de dados local (Receita Federal)

Postgres atualizado mensalmente via cron com os dados abertos da Receita Federal. Não depende de API externa para filtragem — a busca principal é 100% local.

**O que guarda:** CNPJ, razão social, nome fantasia, CNAE (principal + secundários), situação cadastral, porte, capital social, data de abertura, opção pelo Simples/MEI, **endereço completo** (logradouro, número, complemento, bairro, CEP, município, UF) e coordenadas geocodificadas (lat/lng, calculadas sob demanda).

**Por que o endereço da Receita é suficiente para o mapa:** o cadastro oficial já tem logradouro, CEP e município. Não é necessário pedir endereço a nenhuma API externa para geocodificar — o dado já está na base.

**Custo:** ~R$ 80–150/mês de VPS com Postgres.

### 2. API de busca interna

Endpoint `GET /prospeccao/buscar` que aceita filtros e retorna lista paginada sem nenhum custo de API externa.

```
Filtros disponíveis:
  cnae          → código ou termo de busca ("padaria" → sugere 1091102)
  uf, municipio, bairro
  raio_km + lat/lng  → raio em km a partir de um ponto
  porte         → MEI, ME, EPP, DEMAIS
  situacao      → ATIVA (padrão), BAIXADA, INAPTA, SUSPENSA
  data_abertura_min / max
  q             → texto livre em razão social ou nome fantasia
```

**CNAE com autocomplete:** o usuário digita "restaurante" e o sistema sugere os códigos CNAE corretos. Sem depender de API externa.

### 3. Enriquecimento sob demanda

Chamado apenas quando o usuário **seleciona** empresas para trabalhar — nunca em lote na busca inicial.

**Provedores configuráveis** (em Settings → Integrações):
- CNPJ.ws — dados básicos (gratuito)
- Speedio — telefone e e-mail validados + decisores (pago)
- Econodata — decisores qualificados (pago)

**Cache:** resultado fica salvo no Postgres com `enriched_at`. Próxima consulta da mesma empresa dentro da janela de validade (padrão: 30 dias) não gera novo custo.

**Custo:** R$ 0,10–0,50 por lead enriquecido (varia por provider).

### 4. Geolocalização + Rota (Google Maps)

#### Geocoding

Converte endereço da Receita em lat/lng para colocar no mapa. Salvo no banco — não recalculado a cada consulta.

- **API:** Google Geocoding API (~US$ 5 / 1.000 requests, ~40k/mês no free tier)
- **Fallback:** Nominatim (OpenStreetMap) — gratuito, acurácia menor em endereços brasileiros

#### Rota otimizada (Routes API)

O usuário seleciona as empresas que vai visitar e define o ponto de partida. O Google reordena os waypoints para minimizar o tempo total.

```http
POST https://routes.googleapis.com/directions/v2:computeRoutes
{
  "origin": { "location": { "latLng": { "latitude": -20.8, "longitude": -49.4 } } },
  "destination": { ... },
  "intermediates": [ { "location": { ... } }, ... ],
  "travelMode": "DRIVE",
  "optimizeWaypointOrder": true
}
```

**O que a API devolve:**
- Sequência otimizada dos waypoints
- Tempo e distância entre cada parada
- Polyline para desenhar a rota no mapa
- Link direto para abrir no Google Maps (celular do vendedor)

Para rotas com mais de 23 waypoints ou múltiplos vendedores com janelas de horário, usar a **Route Optimization API** (Fleet Routing). Para o MVP, Routes API cobre 95% dos casos.

---

## Fluxo do usuário

```
1. Digitar "restaurantes" + "São José do Rio Preto" + "ME/EPP" + "Ativas"
   → 340 empresas na lista, pins no mapa

2. Selecionar 12 que parecem promissoras → "Enriquecer"
   → Sistema chama Speedio/Econodata para as 12
   → Lista mostra telefone, e-mail e decisor de cada uma

3. Marcar 8 para visitar amanhã → definir ponto de partida → "Gerar rota"
   → Google devolve sequência otimizada + tempo total + link para o GPS

4. Sair para campo → voltar e registrar resultado de cada visita
   (sem retorno / agendado / convertido / descartado)
```

---

## Integrações com outros módulos

| Módulo | Integração |
|--------|-----------|
| **Clientes** | Botão "Importar do prospect" preenche o formulário de cadastro com dados do CNPJ (razão social, endereço, CNAE → segmento) |
| **Metas** | Conversão de prospect → cliente alimenta o indicador de Positivação no GoalsPage |
| **Histórico** | `status_prospeccao` (prospectado / agendado / convertido / descartado) evita o vendedor abordar a mesma empresa duas vezes |

---

## Pré-requisitos

- **Backend (Fase 2)** para o cron de atualização mensal da Receita e para as chamadas de enriquecimento
- **Google Maps API Key** configurada em Settings → Integrações
- **Provider de enriquecimento** configurado (CNPJ.ws para dados básicos gratuitos; Speedio/Econodata para contatos qualificados)

---

## Custos estimados

| Item | Custo |
|------|-------|
| VPS Postgres (base Receita) | R$ 80–150/mês |
| Google Geocoding | US$ 5 / 1.000 endereços ¹ |
| Google Routes API | US$ 5–10 / 1.000 rotas ¹ |
| Enriquecimento | R$ 0,10–0,50 / lead |

¹ Primeiros US$ 200/mês são gratuitos.
