# Decisões técnicas

## Svelte 4 (não 5)

Svelte 5 introduziu runes — uma mudança de paradigma que exigiria reescrever toda a reatividade. O projeto começou em Svelte 4 e vai migrar no momento certo, não por pressão de versão.

## Maker.js para geometria 2D

Maker.js gera SVG vetorial a partir de paths de linhas e arcos. É a única biblioteca disponível que resolve os dois problemas ao mesmo tempo: **render do blueprint** (seção transversal do perfil) e **dimensionamento automático** (cotas com setas). Alternativas (paper.js, Konva) são orientadas a canvas raster e não têm suporte nativo a cotas dimensionais.

## Roteamento hash-based manual

Nenhuma biblioteca de rotas. O `Router.svelte` é um `<svelte:component>` que lê `window.location.hash`. Razões:

1. Não há rotas aninhadas ainda
2. Não há autenticação — sem necessidade de guards
3. Zero dependência, zero bundle extra
4. Quando o backend chegar e precisar de rotas protegidas, entra uma lib própria (provavelmente `svelte-routing` ou similar)

## localStorage com `api.js` como abstração

Todo acesso a dados passa por `src/lib/api.js`. Hoje é localStorage puro. Quando o backend FastAPI estiver pronto, só esse arquivo muda — nenhum componente sabe se está falando com localStorage ou com a API.

## Geometria/física sempre no frontend

Engine, cutplan e draw rodam no navegador. O backend (quando existir) recebe snapshots já calculados. Isso mantém a latência zero para o usuário durante a edição e facilita o modo offline (Tauri).

## `companyInfo.logo` como data URL base64

O logo da empresa é armazenado diretamente no `localStorage` como data URL (base64). Simplicidade — sem precisar de endpoint de upload. Limitação prática: logos muito grandes podem estourar o limite de ~5 MB do localStorage; para uso real, PNG comprimido ou SVG resolvem.

## Dois modos de preço: kg e peça

O usuário pode definir o custo por kg (modo padrão) ou por peça (modo peça). O engine calcula os dois pesos e o módulo de pricing aplica o modo correto. Isso cobre distribuidoras que precificam por kg e fabricantes que precificam por peça.

## Usuário único com role `admin` até a Fase 4

O store `currentUser` (`perf_currentUser` no localStorage) existe desde o início com `role: 'admin'`. Enquanto não há multi-usuário, todas as permissões estão abertas — não há guards, não há validação de role no código.

Quando a Fase 4 (equipe comercial) chegar, esse store será substituído por um token/sessão vindo do backend. O shape `{ nome, email, role }` já é compatível com o modelo planejado (admin / gerente / gestor / vendedor / assistente), então nenhum componente que leia `currentUser` precisará mudar de interface.

## Fatores K e raio R configuráveis por peça

Em vez de fixar K=0,44 globalmente, cada peça pode ter seu próprio K e R. Isso cobre variações entre materiais (galvanizado dobra diferente de CRCA) e entre fornecedores de prensa. O valor padrão 0,44 é conservador e cobre a maioria dos casos de aço galvanizado fino.

## Configuração de APIs armazenada no frontend (sem credenciais hardcoded)

As credenciais de integrações externas (ViaCEP, CNPJ, e-mail, WhatsApp, Google Maps) ficam no store `apiConfig` no `localStorage`. A UI de configuração está em Settings → Integrações.

As **chamadas reais às APIs** ficam no backend — o frontend só salva a configuração e testa conectividade. Isso tem duas razões:

1. **Segurança:** chaves de API não devem ser expostas em código client-side (CORS permite interceptar, reverse-engineering é trivial).
2. **Flexibilidade:** o backend pode fazer cache, rate-limit, retry e auditoria das chamadas sem mudar o frontend.

O botão "Testar conexão" no frontend é uma exceção deliberada para ViaCEP e CNPJ (APIs públicas sem autenticação) e para Evolution API self-hosted quando a URL é acessível diretamente. Para e-mail SMTP e WhatsApp Twilio/Meta, o teste valida apenas se os campos obrigatórios estão preenchidos.

## `appUsers` como store local até multi-usuário real

O módulo Admin tem CRUD completo de usuários com perfis e permissões, mas tudo fica em `localStorage` (`perf_app_users`). Não há autenticação nem guards de rota implementados — qualquer usuário vê tudo.

A decisão de implementar o Admin agora (em vez de esperar o backend) foi pragmática: o usuário precisa cadastrar vendedores para que o módulo de Metas por Vendedor funcione. O shape dos usuários (`appUsers`) foi projetado para ser compatível com o modelo de usuários do backend futuro — a migração será substituir o store local por fetch à API, sem mudar a lógica dos componentes.

Quando o backend chegar: `appUsers` → tabela `users`, roles validados no JWT, guards de rota via `currentUser.role`.
