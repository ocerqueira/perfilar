# Integrações de API

Configuradas em **Settings → Integrações**. Cada integração tem um card com toggle ativa/inativa, campos de credenciais e botão de teste. O store `apiConfig` (`perf_api_config`) persiste tudo no localStorage.

As chamadas reais às APIs (exceto ViaCEP, BrasilAPI e Evolution API self-hosted) devem ser feitas pelo **backend** para proteger credenciais.

---

## ViaCEP

Preenchimento automático de endereço a partir do CEP.

| Campo | Valor padrão |
|-------|-------------|
| URL base | `https://viacep.com.br/ws/` |
| Autenticação | Nenhuma |
| Testável direto | Sim (CORS aberto) |

**Uso previsto:** ao sair do campo CEP em Clientes, Admin e Config → Empresa, o sistema preenche logradouro, bairro, cidade e UF automaticamente.

---

## API de CNPJ (Receita Federal)

Preenchimento automático de razão social, endereço e dados cadastrais a partir do CNPJ.

| Provider | URL | Autenticação | Observação |
|----------|-----|--------------|-----------|
| **BrasilAPI** | `https://brasilapi.com.br/api/cnpj/v1/` | Livre | CORS aberto, testável direto |
| ReceitaWS | `https://www.receitaws.com.br/v1/cnpj/` | Token (Bearer) | Limite por minuto no plano gratuito |
| CNPJ.ws | `https://publica.cnpj.ws/cnpj/` | Livre | — |
| Personalizado | configurável | configurável | Para self-hosted ou outro provider |

---

## E-mail transacional

Envio de orçamentos, pedidos e notificações.

### SMTP

Campos: host, porta, TLS, usuário e senha.

**Autenticação:** dois modos:
- **Usuário e senha** — funciona para servidores que aceitam senha direta. Gmail e Outlook com 2FA exigem **senha de aplicativo** (gerada nas configurações de segurança da conta, não é a senha normal).
- **OAuth2** — requer Client ID, Client Secret e Refresh Token. A renovação automática do access token precisa de backend.

### Providers API

| Provider | Chave | Notas |
|----------|-------|-------|
| SendGrid | API Key (`SG.xxx`) | Suporte a templates dinâmicos |
| Mailgun | API Key + domínio (`mg.empresa.com.br`) | Domínio precisa ser verificado no painel |
| Resend | API Key (`re_xxx`) | Focado em DX, bom para transacional |
| Personalizado | URL + chave | Para provedores locais ou proxies |

**Campos comuns:** nome do remetente + e-mail do remetente (para todos os providers).

---

## WhatsApp

Envio de orçamentos e notificações de pedido via WhatsApp.

### Evolution API (self-hosted)

```
URL:      https://sua-instancia.com
API Key:  (global, no header apikey)
Instance: nome-da-instancia
```

Testável diretamente se a URL for acessível pelo frontend (verificar CORS do servidor).
Documentação: [doc.evolution-api.com](https://doc.evolution-api.com)

### Z-API

```
Instance ID: (do painel Z-API)
Token:       (do painel Z-API)
Número:      +55 11 99999-9999
```

Documentação: [developer.z-api.io](https://developer.z-api.io)

### WPPConnect (self-hosted)

```
URL:       https://sua-instancia.com
Secret Key: (gerado na inicialização)
Session:    nome-da-sessao
```

Documentação: [wppconnect.io/docs](https://wppconnect.io/docs)

### Twilio WhatsApp

```
Account SID:  ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Auth Token:   (do painel Twilio)
Número:       whatsapp:+5511999999999
```

Exige número aprovado pelo Twilio para WhatsApp Business.
Documentação: [twilio.com/docs/whatsapp](https://www.twilio.com/docs/whatsapp)

### WhatsApp Cloud API (Meta — API oficial)

```
Access Token:    EAAxxxx (System User permanente ou token temporário)
Phone Number ID: (do Meta for Developers)
WABA ID:         (WhatsApp Business Account ID)
Webhook Token:   (string aleatória, só se for receber mensagens)
```

Requer conta no Meta for Developers, aprovação do número e Business Verification.
Documentação: [developers.facebook.com/docs/whatsapp/cloud-api](https://developers.facebook.com/docs/whatsapp/cloud-api)

---

## Google Maps / Routes

Geocodificação de endereços e rota de visita otimizada. Usado principalmente pelo **Módulo de Prospecção**.

### APIs a ativar no Google Cloud Console

| API | Uso |
|-----|-----|
| Geocoding API | Endereço (texto) → lat/lng |
| Routes API | Rota otimizada com waypoints (nova geração) |
| Directions API | Rota ponto a ponto (geração anterior, mais suporte a SDKs) |
| Distance Matrix API | Distâncias e tempos entre múltiplos pontos |
| Maps JavaScript API | Mapa interativo renderizado no navegador |

### Configuração da chave

1. Criar projeto no [Google Cloud Console](https://console.cloud.google.com)
2. Ativar as APIs necessárias
3. Criar credencial → Chave de API
4. Restringir por **HTTP referrer** (domínio do app) para evitar uso não autorizado
5. Configurar alerta de faturamento (primeiros US$ 200/mês são gratuitos)

### Estimativa de custo

| API | Preço | Free tier mensal |
|-----|-------|-----------------|
| Geocoding | US$ 5 / 1.000 req | ~40.000 geocodificações |
| Routes | US$ 5–10 / 1.000 rotas | incluso no crédito de US$ 200 |
| Distance Matrix | US$ 5 / 1.000 elementos | incluso |

**Estratégia de cache:** geocodificar cada endereço uma vez e salvar lat/lng no banco. Re-geocodificar apenas se o endereço mudar (detectado no diff mensal da base Receita).

### Teste da chave

O botão "Testar chave" geocodifica "São Paulo" via Geocoding API e mostra o resultado. Retorna `REQUEST_DENIED` se a chave for inválida ou se a Geocoding API não estiver ativada no projeto.
