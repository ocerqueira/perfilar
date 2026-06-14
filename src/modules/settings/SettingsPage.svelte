<script>
  import { descConfig, companyInfo, printConfig, editorDisplay, currentUser, apiConfig } from '../../lib/stores.js';
  import { PRESETS } from '../../lib/presets.js';
  import { PRESET_ABBREV_DEFAULT, DESC_TEMPLATE_DEFAULT } from '../../lib/engine.js';

  let tab = 'co'; // 'co' | 'desc' | 'editor' | 'api'

  // ── Usuário ───────────────────────────────────────────────────────────────
  let usr = { ...$currentUser };
  function saveUsr() { $currentUser = { ...usr }; }

  // ── Empresa ───────────────────────────────────────────────────────────────
  const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
               'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

  let co = { ...$companyInfo };
  function saveCo()  { $companyInfo = { ...co }; }
  function resetCo() {
    co = {
      nome: '', nomeFantasia: '', cnpj: '', ie: '',
      tel: '', whatsapp: '', email: '', site: '', logo: '',
      cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
      endereco: '',
    };
    $companyInfo = { ...co };
  }

  // ── Busca CNPJ (BrasilAPI / ReceitaWS) ────────────────────────────────────
  let cnpjLoading = false;
  async function buscarCnpj() {
    const cnpj = (co.cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14 || !api.cnpj.ativa) return;
    cnpjLoading = true;
    try {
      const prov = api.cnpj;
      let url = '';
      if (prov.provider === 'brasilapi')  url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
      else if (prov.provider === 'cnpjws') url = `https://publica.cnpj.ws/cnpj/${cnpj}`;
      else if (prov.url) url = prov.url.replace(/\/$/, '') + `/${cnpj}`;
      if (!url) { cnpjLoading = false; return; }

      const headers = prov.token ? { Authorization: `Bearer ${prov.token}` } : {};
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();

      const razao   = d.razao_social ?? d.razaoSocial ?? d.estabelecimento?.nome_fantasia ?? '';
      const fantasia = d.nome_fantasia ?? d.nomeFantasia ?? d.estabelecimento?.nome_fantasia ?? '';
      const ie       = d.inscricao_estadual?.[0]?.inscricao_estadual ?? d.ie ?? '';
      const end      = d.estabelecimento ?? d;
      const cepField      = end.cep ?? '';
      const logrField     = (end.tipo_logradouro ? `${end.tipo_logradouro} ${end.logradouro}` : end.logradouro) ?? '';
      const numField      = end.numero ?? '';
      const complField    = end.complemento ?? '';
      const bairroField   = end.bairro ?? '';
      const cidadeField   = end.cidade?.nome ?? end.municipio ?? '';
      const ufField       = end.estado?.sigla ?? end.uf ?? '';

      if (razao) {
        co.nome         = razao;
        co.nomeFantasia = fantasia || co.nomeFantasia;
        co.ie           = ie      || co.ie;
        if (cepField)     co.cep        = cepField;
        if (logrField)    co.logradouro = logrField;
        if (numField)     co.numero     = numField;
        if (complField)   co.complemento = complField;
        if (bairroField)  co.bairro     = bairroField;
        if (cidadeField)  co.cidade     = cidadeField;
        if (ufField)      co.uf         = ufField;
        co.endereco = [logrField, numField, complField, bairroField].filter(Boolean).join(', ');
        co = co; // trigger reactivity
      }
    } catch { /* ignora erros de rede */ }
    finally { cnpjLoading = false; }
  }

  // ── Busca CEP (ViaCEP) ────────────────────────────────────────────────────
  let cepLoading = false;
  async function buscarCep() {
    const cepVal = (co.cep || '').replace(/\D/g, '');
    if (cepVal.length !== 8 || !api.viacep.ativa) return;
    cepLoading = true;
    try {
      const base = (api.viacep.url || 'https://viacep.com.br/ws/').replace(/\/$/, '');
      const r = await fetch(`${base}/${cepVal}/json/`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!d.erro) {
        co.logradouro  = d.logradouro || '';
        co.bairro      = d.bairro    || '';
        co.cidade      = d.localidade || '';
        co.uf          = d.uf        || '';
        co = co; // trigger reactivity
      }
    } catch { /* ignora erros de rede */ }
    finally { cepLoading = false; }
  }

  function handleLogoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { co.logo = ev.target.result; };
    reader.readAsDataURL(file);
  }
  function clearLogo() { co.logo = ''; }

  // ── Descrição ─────────────────────────────────────────────────────────────
  const BUILTIN_KEYS = Object.keys(PRESETS);
  const TOKENS     = ['{tipo}', '{dims}', '{C}', '{t}', '{mat}', '{rev}', '{des}', '{Q}'];
  const TOKEN_DESC = { '{tipo}': 'sigla do perfil', '{dims}': 'dimensões (abas)', '{C}': 'comprimento', '{t}': 'espessura', '{mat}': 'sigla do material', '{rev}': 'revestimento', '{des}': 'desenvolvimento', '{Q}': 'quantidade' };
  const PREVIEW_VALS = { '{tipo}': 'PU', '{dims}': '75×200×75', '{C}': '3000', '{t}': '0,65', '{mat}': 'GAL', '{rev}': 'Z275', '{des}': '350', '{Q}': '10' };

  let descTemplate   = $descConfig.template     ?? DESC_TEMPLATE_DEFAULT;
  let descPresetAbbr = { ...PRESET_ABBREV_DEFAULT, ...($descConfig.presetAbbrev ?? {}) };

  $: descPreview = TOKENS.reduce(
    (s, t) => s.replace(new RegExp(t.replace(/[{}]/g, '\\$&'), 'g'), PREVIEW_VALS[t]),
    descTemplate
  ).trim().replace(/\s{2,}/g, ' ');

  // ── Integrações ───────────────────────────────────────────────────────────
  const CNPJ_PROVIDERS = [
    { id: 'brasilapi', label: 'BrasilAPI',     url: 'https://brasilapi.com.br/api/cnpj/v1/', auth: false },
    { id: 'receitaws', label: 'ReceitaWS',     url: 'https://www.receitaws.com.br/v1/cnpj/', auth: true  },
    { id: 'cnpjws',   label: 'CNPJ.ws',       url: 'https://publica.cnpj.ws/cnpj/',         auth: false },
    { id: 'custom',   label: 'Personalizado', url: '',                                       auth: true  },
  ];

  const EMAIL_PROVIDERS = [
    { id: 'smtp',     label: 'SMTP'           },
    { id: 'sendgrid', label: 'SendGrid'       },
    { id: 'mailgun',  label: 'Mailgun'        },
    { id: 'resend',   label: 'Resend'         },
    { id: 'custom',   label: 'Personalizado'  },
  ];

  const WA_PROVIDERS = [
    { id: 'evolution',  label: 'Evolution API',             selfHosted: true  },
    { id: 'zapi',       label: 'Z-API',                      selfHosted: false },
    { id: 'wppconnect', label: 'WPPConnect',                  selfHosted: true  },
    { id: 'twilio',     label: 'Twilio WhatsApp',            selfHosted: false },
    { id: 'meta',       label: 'WhatsApp Cloud API (Meta)',  selfHosted: false },
    { id: 'custom',     label: 'Personalizado',              selfHosted: true  },
  ];

  let api = JSON.parse(JSON.stringify($apiConfig));

  $: selectedCnpjProvider = CNPJ_PROVIDERS.find(p => p.id === api.cnpj.provider)   ?? CNPJ_PROVIDERS[0];
  $: selectedWaProvider   = WA_PROVIDERS.find(p => p.id === api.whatsapp?.provider) ?? WA_PROVIDERS[0];

  function onCnpjProviderChange() {
    const p = CNPJ_PROVIDERS.find(pr => pr.id === api.cnpj.provider);
    if (p && p.id !== 'custom') api.cnpj.url = p.url;
  }

  let apiTestState = { viacep: null, cnpj: null, email: null, whatsapp: null, maps: null };
  let apiTestMsg   = { viacep: '',   cnpj: '',   email: '',   whatsapp: '',   maps: '' };
  let savedOk = false;

  async function testViacep() {
    apiTestState.viacep = 'testing'; apiTestMsg.viacep = '';
    try {
      const url = (api.viacep.url || 'https://viacep.com.br/ws/').replace(/\/$/, '');
      const r   = await fetch(`${url}/01001000/json/`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      apiTestState.viacep = d.logradouro ? 'ok' : 'error';
      apiTestMsg.viacep   = d.logradouro ? `OK — ${d.logradouro}, ${d.localidade}` : 'Resposta inesperada';
    } catch (e) {
      apiTestState.viacep = 'error';
      apiTestMsg.viacep   = e.message ?? 'Erro de conexão';
    }
    apiTestState = { ...apiTestState }; apiTestMsg = { ...apiTestMsg };
  }

  async function testCnpj() {
    apiTestState.cnpj = 'testing'; apiTestMsg.cnpj = '';
    try {
      const base    = (api.cnpj.url || selectedCnpjProvider.url).replace(/\/$/, '');
      const headers = api.cnpj.token ? { Authorization: `Bearer ${api.cnpj.token}` } : {};
      const r = await fetch(`${base}/00000000000191`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const nome = d.razao_social ?? d.nome ?? d.company?.name ?? '';
      apiTestState.cnpj = nome ? 'ok' : 'error';
      apiTestMsg.cnpj   = nome ? `OK — ${nome}` : 'Resposta inesperada';
    } catch (e) {
      apiTestState.cnpj = 'error';
      apiTestMsg.cnpj   = e.message ?? 'Erro de conexão';
    }
    apiTestState = { ...apiTestState }; apiTestMsg = { ...apiTestMsg };
  }

  async function testEmail() {
    apiTestState.email = 'testing'; apiTestMsg.email = '';
    await new Promise(r => setTimeout(r, 300));
    const e  = api.email;
    const ok = e.provider === 'smtp'
      ? !!(e.host && e.port && e.user)
      : e.provider === 'mailgun'
        ? !!(e.apiKey && e.domain)
        : e.provider === 'custom'
          ? !!(e.url && e.apiKey)
          : !!(e.apiKey);
    apiTestState.email = ok ? 'ok' : 'error';
    apiTestMsg.email   = ok
      ? 'Configuração válida — envio de teste requer backend'
      : 'Preencha os campos obrigatórios';
    apiTestState = { ...apiTestState }; apiTestMsg = { ...apiTestMsg };
  }

  async function testWhatsapp() {
    apiTestState.whatsapp = 'testing'; apiTestMsg.whatsapp = '';
    if (selectedWaProvider.selfHosted && api.whatsapp.url) {
      try {
        const base = api.whatsapp.url.replace(/\/$/, '');
        const headers = api.whatsapp.apiKey ? { apikey: api.whatsapp.apiKey } : {};
        const r = await fetch(`${base}/`, { headers });
        apiTestState.whatsapp = r.ok || r.status < 500 ? 'ok' : 'error';
        apiTestMsg.whatsapp   = r.ok || r.status < 500
          ? `Servidor respondeu (HTTP ${r.status})`
          : `HTTP ${r.status}`;
      } catch (e) {
        apiTestState.whatsapp = 'error';
        apiTestMsg.whatsapp   = e.message ?? 'Erro de conexão';
      }
    } else {
      await new Promise(r => setTimeout(r, 300));
      const w  = api.whatsapp;
      const ok = w.provider === 'twilio'    ? !!(w.accountSid && w.authToken && w.number)
               : w.provider === 'zapi'       ? !!(w.instanceId && w.token)
               : w.provider === 'wppconnect' ? !!(w.url && w.secretKey)
               : !!(w.url || w.apiKey);
      apiTestState.whatsapp = ok ? 'ok' : 'error';
      apiTestMsg.whatsapp   = ok
        ? 'Configuração válida — teste real requer backend'
        : 'Preencha os campos obrigatórios';
    }
    apiTestState = { ...apiTestState }; apiTestMsg = { ...apiTestMsg };
  }

  async function testMaps() {
    apiTestState.maps = 'testing'; apiTestMsg.maps = '';
    try {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=S%C3%A3o+Paulo&key=${api.maps.apiKey}`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.status === 'OK') {
        apiTestState.maps = 'ok';
        apiTestMsg.maps   = `OK — ${d.results[0]?.formatted_address ?? 'geocoding funcionando'}`;
      } else {
        apiTestState.maps = 'error';
        apiTestMsg.maps   = d.status === 'REQUEST_DENIED' ? 'Chave inválida ou API não ativada no Console' : d.status;
      }
    } catch (e) {
      apiTestState.maps = 'error';
      apiTestMsg.maps   = e.message ?? 'Erro de conexão';
    }
    apiTestState = { ...apiTestState }; apiTestMsg = { ...apiTestMsg };
  }

  function saveApi() {
    $apiConfig = JSON.parse(JSON.stringify(api));
    savedOk = true;
    setTimeout(() => { savedOk = false; }, 2500);
  }

  function resetApi() {
    api = JSON.parse(JSON.stringify({
      viacep:   { ativa: false, url: 'https://viacep.com.br/ws/' },
      cnpj:     { ativa: false, provider: 'brasilapi', url: '', token: '' },
      email:    { ativa: false, provider: 'smtp', host: '', port: '587', tls: true, authType: 'password', user: '', password: '', oauthClientId: '', oauthClientSecret: '', oauthRefreshToken: '', apiKey: '', domain: '', url: '', fromName: '', fromEmail: '' },
      whatsapp: { ativa: false, provider: 'evolution', url: '', apiKey: '', instance: '', instanceId: '', token: '', secretKey: '', accountSid: '', authToken: '', phoneNumberId: '', wabaId: '', accessToken: '', webhookToken: '', number: '' },
      maps:     { ativa: false, apiKey: '' },
    }));
    $apiConfig = JSON.parse(JSON.stringify(api));
    apiTestState = { viacep: null, cnpj: null, email: null, whatsapp: null, maps: null };
    apiTestMsg   = { viacep: '',   cnpj: '',   email: '',   whatsapp: '',   maps: '' };
    savedOk = false;
  }

  function insertToken(tok) { descTemplate = (descTemplate ?? '') + tok; }
  function saveDesc() { $descConfig = { template: descTemplate, presetAbbrev: { ...descPresetAbbr } }; }
  function resetDesc() {
    descTemplate   = DESC_TEMPLATE_DEFAULT;
    descPresetAbbr = { ...PRESET_ABBREV_DEFAULT };
    $descConfig    = { template: descTemplate, presetAbbrev: { ...descPresetAbbr } };
  }
</script>

<div class="page">
  <div class="page-hd">
    <div class="page-title">Configurações</div>
    <div class="tabs">
      <button class="tab" class:on={tab === 'co'}     on:click={() => (tab = 'co')}>Empresa</button>
      <button class="tab" class:on={tab === 'desc'}   on:click={() => (tab = 'desc')}>Descrição</button>
      <button class="tab" class:on={tab === 'editor'} on:click={() => (tab = 'editor')}>Editor</button>
      <button class="tab" class:on={tab === 'api'}    on:click={() => (tab = 'api')}>Integrações</button>
    </div>
  </div>

  <div class="body">

    <!-- ── Empresa ──────────────────────────────────────────────────────── -->
    {#if tab === 'co'}
      <div class="card">
        <div class="sec-label">Identificação da empresa</div>

        <!-- Nome e CNPJ -->
        <div class="co-grid">
          <div class="field co-wide">
            <label>Razão social <span class="req">*</span></label>
            <input class="inp" bind:value={co.nome} placeholder="Ex.: Metalúrgica Exemplo Ltda." />
          </div>
          <div class="field co-wide">
            <label>Nome fantasia <span class="opt">(opcional)</span></label>
            <input class="inp" bind:value={co.nomeFantasia} placeholder="Ex.: Metalúrgica Exemplo" />
          </div>
        </div>

        <!-- CNPJ + API -->
        <div class="api-row">
          <div class="field field-cnpj">
            <label>CNPJ</label>
            <input class="inp" bind:value={co.cnpj} placeholder="00.000.000/0001-00" maxlength="18"
                   on:blur={buscarCnpj} />
          </div>
          <button class="btn-api" type="button"
                  class:loading={cnpjLoading}
                  disabled={cnpjLoading || !api.cnpj.ativa}
                  on:click={buscarCnpj}
                  title={!api.cnpj.ativa
                    ? 'Ative a API de CNPJ em Integrações'
                    : cnpjLoading ? 'Buscando…' : 'Buscar razão social, nome fantasia, endereço e IE pelo CNPJ'}>
            {#if cnpjLoading}
              <span class="spin"></span> Buscando…
            {:else}
              <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <circle cx="5.5" cy="5.5" r="3.5"/><path d="M9 9l3 3"/>
              </svg>
              Buscar dados da empresa
            {/if}
          </button>
          <div class="field field-ie">
            <label>IE <span class="opt">(opc.)</span></label>
            <input class="inp" bind:value={co.ie} placeholder="IE" />
          </div>
        </div>
        <p class="hint api-hint">
          Ative a API de CNPJ na aba <b>Integrações</b> para buscar razão social, nome fantasia,
          endereço e IE automaticamente. BrasilAPI e CNPJ.ws funcionam sem token.
        </p>

        <!-- Contato -->
        <div class="sec-label">Contato</div>
        <div class="co-grid">
          <div class="field">
            <label>Telefone</label>
            <input class="inp" bind:value={co.tel} placeholder="(11) 9999-9999" />
          </div>
          <div class="field">
            <label>WhatsApp</label>
            <input class="inp" bind:value={co.whatsapp} placeholder="(11) 99999-9999" />
          </div>
          <div class="field">
            <label>E-mail</label>
            <input class="inp" bind:value={co.email} placeholder="contato@empresa.com.br" type="email" />
          </div>
          <div class="field">
            <label>Site</label>
            <input class="inp" bind:value={co.site} placeholder="www.empresa.com.br" />
          </div>
        </div>

        <!-- Endereço -->
        <div class="sec-label">Endereço</div>
        <div class="api-row">
          <div class="field field-cep">
            <label>CEP</label>
            <input class="inp" bind:value={co.cep} placeholder="00000-000" maxlength="9"
                   on:blur={buscarCep} />
          </div>
          <button class="btn-api" type="button"
                  class:loading={cepLoading}
                  disabled={cepLoading || !api.viacep.ativa}
                  on:click={buscarCep}
                  title={!api.viacep.ativa
                    ? 'Ative o ViaCEP em Integrações'
                    : cepLoading ? 'Buscando…' : 'Buscar logradouro, bairro, cidade e UF pelo CEP'}>
            {#if cepLoading}
              <span class="spin"></span> Buscando…
            {:else}
              <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <circle cx="5.5" cy="5.5" r="3.5"/><path d="M9 9l3 3"/>
              </svg>
              Buscar endereço
            {/if}
          </button>
        </div>
        <div class="co-grid">
          <div class="field co-wide">
            <label>Logradouro</label>
            <input class="inp" bind:value={co.logradouro} placeholder="Rua, Avenida, Alameda…" />
          </div>
          <div class="field field-num">
            <label>Número</label>
            <input class="inp" bind:value={co.numero} placeholder="100" />
          </div>
          <div class="field">
            <label>Complemento <span class="opt">(opc.)</span></label>
            <input class="inp" bind:value={co.complemento} placeholder="Sala 1, Galpão B…" />
          </div>
          <div class="field">
            <label>Bairro</label>
            <input class="inp" bind:value={co.bairro} placeholder="Centro" />
          </div>
          <div class="field">
            <label>Cidade</label>
            <input class="inp" bind:value={co.cidade} placeholder="São Paulo" />
          </div>
          <div class="field field-uf">
            <label>UF</label>
            <select class="inp" bind:value={co.uf}>
              <option value="">—</option>
              {#each UFS as uf}<option value={uf}>{uf}</option>{/each}
            </select>
          </div>
        </div>
        <p class="hint api-hint">
          Ative o ViaCEP na aba <b>Integrações</b> para preencher logradouro, bairro, cidade e UF
          automaticamente pelo CEP. Serviço gratuito, sem autenticação.
        </p>

        <div class="sec-label">Logo da empresa</div>
        <div class="logo-row">
          {#if co.logo}
            <img class="logo-preview" src={co.logo} alt="logo" />
            <button class="btn line" on:click={clearLogo}>Remover logo</button>
          {:else}
            <label class="logo-upload">
              <input type="file" accept="image/*" on:change={handleLogoFile} />
              <span>Escolher imagem…</span>
            </label>
            <p class="hint">PNG ou SVG com fundo transparente ficam melhor. Altura máxima exibida: 48 px.</p>
          {/if}
        </div>
        <p class="hint">Essas informações aparecem no cabeçalho dos documentos (Plano de corte, Orçamento, Ordem de produção).</p>

        <div class="sec-label">Layout de impressão — Plano de corte</div>
        <div class="print-layout-opts">
          <label class="pl-opt" class:on={$printConfig.layout === 'one'}>
            <input type="radio" name="pl" value="one" bind:group={$printConfig.layout} />
            <div class="pl-preview pl-one">
              <div class="pl-page"><div class="pl-svg"></div></div>
            </div>
            <span>Uma chapa por página</span>
            <small>SVG escalado para caber na página inteira</small>
          </label>
          <label class="pl-opt" class:on={$printConfig.layout === 'two'}>
            <input type="radio" name="pl" value="two" bind:group={$printConfig.layout} />
            <div class="pl-preview pl-two">
              <div class="pl-page">
                <div class="pl-svg"></div>
                <div class="pl-svg"></div>
              </div>
            </div>
            <span>Duas chapas por página</span>
            <small>Lado a lado — economiza papel</small>
          </label>
        </div>

        <div class="sec-label">Usuário atual</div>
        <div class="co-grid">
          <div class="field">
            <label>Seu nome</label>
            <input class="inp" bind:value={usr.nome} placeholder="Como você quer ser chamado" />
          </div>
          <div class="field">
            <label>E-mail</label>
            <input class="inp" bind:value={usr.email} placeholder="seu@email.com" type="email" />
          </div>
          <div class="field">
            <label>Perfil</label>
            <input class="inp" value={usr.role === 'admin' ? 'Administrador' : usr.role} disabled />
          </div>
        </div>
        <p class="hint">Perfis e permissões serão configuráveis quando o sistema multi-usuário for implementado.</p>

        <div class="footer">
          <button class="btn line" on:click={resetCo}>Limpar empresa</button>
          <div style="flex:1"></div>
          <button class="btn line" on:click={saveUsr}>Salvar usuário</button>
          <button class="btn amber" on:click={saveCo}>Salvar empresa</button>
        </div>
      </div>

    <!-- ── Descrição ─────────────────────────────────────────────────────── -->
    {:else if tab === 'desc'}
      <div class="card">
        <div class="sec-label">Formato da descrição padronizada</div>
        <p class="hint">Clique nos tokens para inserir no formato. Cada token entre chaves é substituído pelo valor do item.</p>
        <div class="token-bar">
          {#each TOKENS as tok}
            <button class="tok-btn" title={TOKEN_DESC[tok]} on:click={() => insertToken(tok)}>{tok}</button>
          {/each}
        </div>
        <input class="inp full" bind:value={descTemplate} placeholder="ex: PU 75×200 · C3000 · t0,65 · GAL Z275" />
        <div class="preview-row">
          <span class="preview-lbl">Prévia:</span>
          <code class="preview-code">{descPreview}</code>
        </div>

        <div class="sec-label">Siglas dos perfis padrão</div>
        <table class="tbl abbr-tbl">
          <thead><tr><th>Perfil</th><th>Sigla</th></tr></thead>
          <tbody>
            {#each BUILTIN_KEYS as k}
              <tr>
                <td class="pname">{PRESETS[k].name}</td>
                <td><input class="inp abbr" bind:value={descPresetAbbr[k]} maxlength="8" /></td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="hint">Perfis personalizados usam as iniciais do nome quando não há sigla definida aqui. As siglas dos materiais ficam em <b>Matérias-primas → Materiais</b>.</p>

        <div class="footer">
          <button class="btn line" on:click={resetDesc}>Restaurar padrão</button>
          <div style="flex:1"></div>
          <button class="btn amber" on:click={saveDesc}>Salvar</button>
        </div>
      </div>

    <!-- ── Integrações ──────────────────────────────────────────────────── -->
    {:else if tab === 'api'}

      <!-- ViaCEP -->
      <div class="card api-card" class:api-on={api.viacep.ativa}>
        <div class="api-card-hd">
          <div class="api-icon api-icon-cep">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              <path d="M10 2C7.2 2 5 4.2 5 7c0 4 5 11 5 11s5-7 5-11c0-2.8-2.2-5-5-5z"/><circle cx="10" cy="7" r="1.8"/>
            </svg>
          </div>
          <div class="api-card-info">
            <div class="api-card-name">ViaCEP <span class="api-badge-free">gratuito</span></div>
            <div class="api-card-desc">Busca automática de endereço a partir do CEP. Sem autenticação necessária.</div>
          </div>
          <label class="api-toggle" title={api.viacep.ativa ? 'Desativar' : 'Ativar'}>
            <input type="checkbox" bind:checked={api.viacep.ativa} />
            <span class="api-toggle-track"></span>
          </label>
        </div>

        {#if api.viacep.ativa}
          <div class="api-body">
            <div class="field">
              <label>URL base</label>
              <input class="inp" bind:value={api.viacep.url} placeholder="https://viacep.com.br/ws/" />
              <span class="field-hint">Padrão: <code>https://viacep.com.br/ws/</code> — altere apenas se usar proxy próprio.</span>
            </div>

            <div class="api-test-row">
              <button class="btn line" on:click={testViacep} disabled={apiTestState.viacep === 'testing'}>
                {apiTestState.viacep === 'testing' ? 'Testando…' : 'Testar conexão'}
              </button>
              {#if apiTestState.viacep === 'ok'}
                <span class="api-test-ok">&#10003; {apiTestMsg.viacep}</span>
              {:else if apiTestState.viacep === 'error'}
                <span class="api-test-err">&#10007; {apiTestMsg.viacep}</span>
              {/if}
            </div>
          </div>
        {/if}

        <div class="api-card-ft">
          <span class="api-doc-link">
            Documentação: <a href="https://viacep.com.br" target="_blank" rel="noreferrer">viacep.com.br</a>
          </span>
          <span class="api-status-chip" class:chip-on={api.viacep.ativa} class:chip-off={!api.viacep.ativa}>
            {api.viacep.ativa ? 'Ativa' : 'Inativa'}
          </span>
        </div>
      </div>

      <!-- CNPJ / Receita Federal -->
      <div class="card api-card" class:api-on={api.cnpj.ativa}>
        <div class="api-card-hd">
          <div class="api-icon api-icon-cnpj">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              <rect x="3" y="5" width="14" height="11" rx="1.5"/><path d="M3 8h14"/><path d="M7 5V3m6 2V3"/>
            </svg>
          </div>
          <div class="api-card-info">
            <div class="api-card-name">API de CNPJ <span class="api-badge-prov">Receita Federal</span></div>
            <div class="api-card-desc">Busca razão social, endereço e dados cadastrais a partir do CNPJ.</div>
          </div>
          <label class="api-toggle" title={api.cnpj.ativa ? 'Desativar' : 'Ativar'}>
            <input type="checkbox" bind:checked={api.cnpj.ativa} />
            <span class="api-toggle-track"></span>
          </label>
        </div>

        {#if api.cnpj.ativa}
          <div class="api-body">
            <div class="field">
              <label>Provedor</label>
              <select class="inp" bind:value={api.cnpj.provider} on:change={onCnpjProviderChange}>
                {#each CNPJ_PROVIDERS as p}
                  <option value={p.id}>{p.label}{p.auth ? '' : ' — sem autenticação'}</option>
                {/each}
              </select>
            </div>

            <div class="field">
              <label>URL base {api.cnpj.provider !== 'custom' ? '(preenchida automaticamente)' : ''}</label>
              <input class="inp" bind:value={api.cnpj.url}
                     placeholder={selectedCnpjProvider.url || 'https://sua-api.com/cnpj/'}
                     readonly={api.cnpj.provider !== 'custom'} />
              {#if api.cnpj.provider !== 'custom'}
                <span class="field-hint">Para usar outra URL selecione "Personalizado".</span>
              {/if}
            </div>

            {#if selectedCnpjProvider.auth || api.cnpj.provider === 'custom'}
              <div class="field">
                <label>Token / Chave de API</label>
                <input class="inp" type="password" bind:value={api.cnpj.token} placeholder="Seu token de acesso" autocomplete="off" />
                <span class="field-hint">Enviado no header <code>Authorization: Bearer &lt;token&gt;</code>.</span>
              </div>
            {:else}
              <p class="hint"><strong>{selectedCnpjProvider.label}</strong> não requer autenticação para a rota pública.</p>
            {/if}

            <!-- Resumo dos provedores -->
            <div class="provider-table">
              <div class="provider-hd">Comparativo de provedores</div>
              {#each CNPJ_PROVIDERS.filter(p => p.id !== 'custom') as p}
                <div class="provider-row" class:provider-sel={p.id === api.cnpj.provider}>
                  <span class="provider-name">{p.label}</span>
                  <span class="provider-url">{p.url}</span>
                  <span class="provider-auth">{p.auth ? 'Token' : 'Livre'}</span>
                </div>
              {/each}
            </div>

            <div class="api-test-row">
              <button class="btn line" on:click={testCnpj} disabled={apiTestState.cnpj === 'testing' || !(api.cnpj.url || selectedCnpjProvider.url)}>
                {apiTestState.cnpj === 'testing' ? 'Testando…' : 'Testar conexão'}
              </button>
              <span class="field-hint">Usa o CNPJ da Petrobras (00.000.000/0001-91) como teste.</span>
              {#if apiTestState.cnpj === 'ok'}
                <span class="api-test-ok">&#10003; {apiTestMsg.cnpj}</span>
              {:else if apiTestState.cnpj === 'error'}
                <span class="api-test-err">&#10007; {apiTestMsg.cnpj}</span>
              {/if}
            </div>
          </div>
        {/if}

        <div class="api-card-ft">
          <span class="api-doc-link">
            {#if api.cnpj.provider === 'brasilapi'}
              Documentação: <a href="https://brasilapi.com.br/docs#tag/CNPJ" target="_blank" rel="noreferrer">brasilapi.com.br</a>
            {:else if api.cnpj.provider === 'receitaws'}
              Documentação: <a href="https://www.receitaws.com.br" target="_blank" rel="noreferrer">receitaws.com.br</a>
            {:else if api.cnpj.provider === 'cnpjws'}
              Documentação: <a href="https://cnpj.ws" target="_blank" rel="noreferrer">cnpj.ws</a>
            {:else}
              Provedor personalizado
            {/if}
          </span>
          <span class="api-status-chip" class:chip-on={api.cnpj.ativa} class:chip-off={!api.cnpj.ativa}>
            {api.cnpj.ativa ? 'Ativa' : 'Inativa'}
          </span>
        </div>
      </div>

      <!-- E-mail transacional -->
      <div class="card api-card" class:api-on={api.email.ativa}>
        <div class="api-card-hd">
          <div class="api-icon api-icon-email">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              <rect x="2" y="5" width="16" height="12" rx="1.5"/>
              <path d="M2 7l8 5 8-5"/>
            </svg>
          </div>
          <div class="api-card-info">
            <div class="api-card-name">E-mail transacional</div>
            <div class="api-card-desc">Envio de orçamentos, pedidos e notificações por e-mail. Suporte a SMTP, SendGrid, Mailgun e Resend.</div>
          </div>
          <label class="api-toggle" title={api.email.ativa ? 'Desativar' : 'Ativar'}>
            <input type="checkbox" bind:checked={api.email.ativa} />
            <span class="api-toggle-track"></span>
          </label>
        </div>

        {#if api.email.ativa}
          <div class="api-body">
            <div class="api-row-2">
              <div class="field">
                <label>Nome do remetente</label>
                <input class="inp" bind:value={api.email.fromName} placeholder="Perfilar Comercial" />
              </div>
              <div class="field">
                <label>E-mail do remetente</label>
                <input class="inp" bind:value={api.email.fromEmail} placeholder="nao-responda@empresa.com.br" type="email" />
              </div>
            </div>

            <div class="field">
              <label>Provedor</label>
              <select class="inp" bind:value={api.email.provider}>
                {#each EMAIL_PROVIDERS as p}<option value={p.id}>{p.label}</option>{/each}
              </select>
            </div>

            {#if api.email.provider === 'smtp'}
              <div class="api-row-2">
                <div class="field" style="flex:2">
                  <label>Host SMTP</label>
                  <input class="inp" bind:value={api.email.host} placeholder="smtp.gmail.com" />
                </div>
                <div class="field" style="flex:0 0 90px">
                  <label>Porta</label>
                  <input class="inp" bind:value={api.email.port} placeholder="587" />
                </div>
              </div>
              <label class="check-row">
                <input type="checkbox" bind:checked={api.email.tls} />
                <span>Usar TLS / STARTTLS</span>
              </label>

              <div class="field">
                <label>Autenticação</label>
                <div class="seg-ctrl">
                  <label class="seg-opt" class:seg-on={api.email.authType !== 'oauth2'}>
                    <input type="radio" name="email-auth" value="password" bind:group={api.email.authType} />
                    Usuário e senha
                  </label>
                  <label class="seg-opt" class:seg-on={api.email.authType === 'oauth2'}>
                    <input type="radio" name="email-auth" value="oauth2" bind:group={api.email.authType} />
                    OAuth2
                  </label>
                </div>
              </div>

              {#if api.email.authType !== 'oauth2'}
                <div class="api-row-2">
                  <div class="field">
                    <label>Usuário</label>
                    <input class="inp" bind:value={api.email.user} placeholder="usuario@empresa.com.br" />
                  </div>
                  <div class="field">
                    <label>Senha / Senha de app</label>
                    <input class="inp" type="password" bind:value={api.email.password} placeholder="••••••••" autocomplete="off" />
                  </div>
                </div>
                <p class="hint smtp-hint">
                  Gmail e Outlook com verificação em dois fatores exigem uma <strong>senha de aplicativo</strong> —
                  gere uma nas configurações de segurança da conta, não use a senha normal.
                </p>
              {:else}
                <div class="field">
                  <label>Client ID</label>
                  <input class="inp" bind:value={api.email.oauthClientId} placeholder="xxxxxx.apps.googleusercontent.com" />
                </div>
                <div class="field">
                  <label>Client Secret</label>
                  <input class="inp" type="password" bind:value={api.email.oauthClientSecret} placeholder="GOCSPX-..." autocomplete="off" />
                </div>
                <div class="field">
                  <label>Refresh Token</label>
                  <input class="inp" type="password" bind:value={api.email.oauthRefreshToken} placeholder="1//0gXxx..." autocomplete="off" />
                  <span class="field-hint">Obtenha o refresh token via Google OAuth Playground ou um fluxo OAuth2 de autorização. A renovação automática do access token requer backend.</span>
                </div>
              {/if}
            {:else if api.email.provider === 'mailgun'}
              <div class="field">
                <label>API Key</label>
                <input class="inp" type="password" bind:value={api.email.apiKey} placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autocomplete="off" />
              </div>
              <div class="field">
                <label>Domínio Mailgun</label>
                <input class="inp" bind:value={api.email.domain} placeholder="mg.empresa.com.br" />
                <span class="field-hint">Configure o domínio no painel do Mailgun antes de usar.</span>
              </div>
            {:else if api.email.provider === 'custom'}
              <div class="field">
                <label>URL do endpoint</label>
                <input class="inp" bind:value={api.email.url} placeholder="https://sua-api.com/send" />
              </div>
              <div class="field">
                <label>Chave de API</label>
                <input class="inp" type="password" bind:value={api.email.apiKey} placeholder="Chave de acesso" autocomplete="off" />
              </div>
            {:else}
              <div class="field">
                <label>API Key {api.email.provider === 'sendgrid' ? '(começa com SG.)' : api.email.provider === 'resend' ? '(começa com re_)' : ''}</label>
                <input class="inp" type="password" bind:value={api.email.apiKey}
                       placeholder={api.email.provider === 'sendgrid' ? 'SG.xxxxxxx' : api.email.provider === 'resend' ? 're_xxxxxxx' : 'Chave de API'}
                       autocomplete="off" />
              </div>
            {/if}

            <div class="api-test-row">
              <button class="btn line" on:click={testEmail} disabled={apiTestState.email === 'testing'}>
                {apiTestState.email === 'testing' ? 'Validando…' : 'Validar configuração'}
              </button>
              <span class="field-hint">Envio de e-mail de teste requer integração backend.</span>
              {#if apiTestState.email === 'ok'}
                <span class="api-test-ok">&#10003; {apiTestMsg.email}</span>
              {:else if apiTestState.email === 'error'}
                <span class="api-test-err">&#10007; {apiTestMsg.email}</span>
              {/if}
            </div>
          </div>
        {/if}

        <div class="api-card-ft">
          <span class="api-doc-link">
            {#if api.email.provider === 'sendgrid'}
              Documentação: <a href="https://sendgrid.com/docs" target="_blank" rel="noreferrer">sendgrid.com/docs</a>
            {:else if api.email.provider === 'mailgun'}
              Documentação: <a href="https://documentation.mailgun.com" target="_blank" rel="noreferrer">documentation.mailgun.com</a>
            {:else if api.email.provider === 'resend'}
              Documentação: <a href="https://resend.com/docs" target="_blank" rel="noreferrer">resend.com/docs</a>
            {:else if api.email.provider === 'smtp'}
              SMTP padrão — funciona com Gmail, Outlook, Zoho e outros
            {:else}
              Provedor personalizado
            {/if}
          </span>
          <span class="api-status-chip" class:chip-on={api.email.ativa} class:chip-off={!api.email.ativa}>
            {api.email.ativa ? 'Ativa' : 'Inativa'}
          </span>
        </div>
      </div>

      <!-- WhatsApp -->
      <div class="card api-card" class:api-on={api.whatsapp.ativa}>
        <div class="api-card-hd">
          <div class="api-icon api-icon-wa">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M10 2a8 8 0 0 0-6.93 11.98L2 18l4.18-1.06A8 8 0 1 0 10 2zm0 14.5a6.44 6.44 0 0 1-3.28-.9l-.24-.14-2.48.63.65-2.41-.16-.25A6.5 6.5 0 1 1 10 16.5zm3.56-4.87c-.19-.1-1.13-.56-1.31-.62-.17-.06-.3-.1-.42.1-.13.19-.49.62-.6.75-.11.13-.22.15-.41.05a5.23 5.23 0 0 1-1.54-.95 5.77 5.77 0 0 1-1.07-1.33c-.11-.19-.01-.3.09-.39l.28-.32c.09-.1.12-.19.18-.31.06-.13.03-.24-.02-.34-.05-.1-.42-1.01-.58-1.38-.15-.36-.3-.31-.42-.32h-.36c-.12 0-.32.05-.49.24-.17.19-.64.62-.64 1.52s.66 1.77.75 1.89c.1.13 1.29 1.97 3.13 2.76.44.19.78.3 1.05.38.44.14.84.12 1.16.07.35-.05 1.09-.44 1.24-.87.16-.43.16-.8.11-.87-.04-.08-.17-.13-.36-.22z"/>
            </svg>
          </div>
          <div class="api-card-info">
            <div class="api-card-name">WhatsApp</div>
            <div class="api-card-desc">Envio de orçamentos e pedidos via WhatsApp. Suporte a Evolution API, Z-API, WPPConnect e Twilio.</div>
          </div>
          <label class="api-toggle" title={api.whatsapp.ativa ? 'Desativar' : 'Ativar'}>
            <input type="checkbox" bind:checked={api.whatsapp.ativa} />
            <span class="api-toggle-track"></span>
          </label>
        </div>

        {#if api.whatsapp.ativa}
          <div class="api-body">
            <div class="field">
              <label>Provedor</label>
              <select class="inp" bind:value={api.whatsapp.provider}>
                {#each WA_PROVIDERS as p}
                  <option value={p.id}>{p.label}{p.selfHosted ? ' (auto-hospedado)' : ''}</option>
                {/each}
              </select>
            </div>

            {#if api.whatsapp.provider === 'evolution'}
              <div class="field">
                <label>URL do servidor</label>
                <input class="inp" bind:value={api.whatsapp.url} placeholder="https://sua-evolution.com" />
                <span class="field-hint">URL da sua instância self-hosted da Evolution API.</span>
              </div>
              <div class="api-row-2">
                <div class="field">
                  <label>API Key (global)</label>
                  <input class="inp" type="password" bind:value={api.whatsapp.apiKey} placeholder="sua-api-key" autocomplete="off" />
                </div>
                <div class="field">
                  <label>Nome da instância</label>
                  <input class="inp" bind:value={api.whatsapp.instance} placeholder="minha-instancia" />
                </div>
              </div>
            {:else if api.whatsapp.provider === 'zapi'}
              <div class="api-row-2">
                <div class="field">
                  <label>Instance ID</label>
                  <input class="inp" bind:value={api.whatsapp.instanceId} placeholder="ID da instância Z-API" />
                </div>
                <div class="field">
                  <label>Token</label>
                  <input class="inp" type="password" bind:value={api.whatsapp.token} placeholder="Token" autocomplete="off" />
                </div>
              </div>
              <div class="field">
                <label>Número (com DDI)</label>
                <input class="inp" bind:value={api.whatsapp.number} placeholder="+55 11 99999-9999" />
              </div>
            {:else if api.whatsapp.provider === 'wppconnect'}
              <div class="field">
                <label>URL do servidor WPPConnect</label>
                <input class="inp" bind:value={api.whatsapp.url} placeholder="https://sua-instancia.com" />
              </div>
              <div class="api-row-2">
                <div class="field">
                  <label>Secret Key</label>
                  <input class="inp" type="password" bind:value={api.whatsapp.secretKey} placeholder="secret-key" autocomplete="off" />
                </div>
                <div class="field">
                  <label>Nome da sessão</label>
                  <input class="inp" bind:value={api.whatsapp.instance} placeholder="minha-sessao" />
                </div>
              </div>
            {:else if api.whatsapp.provider === 'twilio'}
              <div class="api-row-2">
                <div class="field">
                  <label>Account SID</label>
                  <input class="inp" bind:value={api.whatsapp.accountSid} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
                <div class="field">
                  <label>Auth Token</label>
                  <input class="inp" type="password" bind:value={api.whatsapp.authToken} placeholder="••••" autocomplete="off" />
                </div>
              </div>
              <div class="field">
                <label>Número WhatsApp Business</label>
                <input class="inp" bind:value={api.whatsapp.number} placeholder="whatsapp:+5511999999999" />
                <span class="field-hint">Formato Twilio: <code>whatsapp:+5511999999999</code></span>
              </div>
            {:else if api.whatsapp.provider === 'meta'}
              <div class="api-badge-info">
                API oficial do WhatsApp Business gerenciada pela Meta. Requer conta no Meta for Developers e aprovação do número.
              </div>
              <div class="field">
                <label>Access Token</label>
                <input class="inp" type="password" bind:value={api.whatsapp.accessToken} placeholder="EAAxxxx..." autocomplete="off" />
                <span class="field-hint">Token permanente do System User no Meta Business Suite, ou token temporário para testes.</span>
              </div>
              <div class="api-row-2">
                <div class="field">
                  <label>Phone Number ID</label>
                  <input class="inp" bind:value={api.whatsapp.phoneNumberId} placeholder="1234567890" />
                  <span class="field-hint">ID do número no painel da API.</span>
                </div>
                <div class="field">
                  <label>WABA ID</label>
                  <input class="inp" bind:value={api.whatsapp.wabaId} placeholder="0987654321" />
                  <span class="field-hint">WhatsApp Business Account ID.</span>
                </div>
              </div>
              <div class="field">
                <label>Webhook Verify Token <span class="opt">(opc. — para receber mensagens)</span></label>
                <input class="inp" bind:value={api.whatsapp.webhookToken} placeholder="meu-token-secreto" />
                <span class="field-hint">String aleatória que você define para validar o webhook no painel da Meta.</span>
              </div>
            {:else}
              <div class="field">
                <label>URL da API</label>
                <input class="inp" bind:value={api.whatsapp.url} placeholder="https://sua-api.com/whatsapp/send" />
              </div>
              <div class="field">
                <label>Chave de API</label>
                <input class="inp" type="password" bind:value={api.whatsapp.apiKey} placeholder="Chave de acesso" autocomplete="off" />
              </div>
            {/if}

            <div class="api-test-row">
              <button class="btn line" on:click={testWhatsapp} disabled={apiTestState.whatsapp === 'testing'}>
                {apiTestState.whatsapp === 'testing' ? 'Testando…' : 'Testar conexão'}
              </button>
              <span class="field-hint">
                {selectedWaProvider.selfHosted && api.whatsapp.url ? 'Testa conexão direta com o servidor.' : 'Valida se os campos obrigatórios estão preenchidos.'}
              </span>
              {#if apiTestState.whatsapp === 'ok'}
                <span class="api-test-ok">&#10003; {apiTestMsg.whatsapp}</span>
              {:else if apiTestState.whatsapp === 'error'}
                <span class="api-test-err">&#10007; {apiTestMsg.whatsapp}</span>
              {/if}
            </div>
          </div>
        {/if}

        <div class="api-card-ft">
          <span class="api-doc-link">
            {#if api.whatsapp.provider === 'evolution'}
              Documentação: <a href="https://doc.evolution-api.com" target="_blank" rel="noreferrer">doc.evolution-api.com</a>
            {:else if api.whatsapp.provider === 'zapi'}
              Documentação: <a href="https://developer.z-api.io" target="_blank" rel="noreferrer">developer.z-api.io</a>
            {:else if api.whatsapp.provider === 'wppconnect'}
              Documentação: <a href="https://wppconnect.io/docs" target="_blank" rel="noreferrer">wppconnect.io/docs</a>
            {:else if api.whatsapp.provider === 'twilio'}
              Documentação: <a href="https://www.twilio.com/docs/whatsapp" target="_blank" rel="noreferrer">twilio.com/docs/whatsapp</a>
            {:else if api.whatsapp.provider === 'meta'}
              Documentação: <a href="https://developers.facebook.com/docs/whatsapp/cloud-api" target="_blank" rel="noreferrer">developers.facebook.com/docs/whatsapp</a>
            {:else}
              Provedor personalizado
            {/if}
          </span>
          <span class="api-status-chip" class:chip-on={api.whatsapp.ativa} class:chip-off={!api.whatsapp.ativa}>
            {api.whatsapp.ativa ? 'Ativa' : 'Inativa'}
          </span>
        </div>
      </div>

      <!-- Google Maps / Routes -->
      <div class="card api-card" class:api-on={api.maps.ativa}>
        <div class="api-card-hd">
          <div class="api-icon api-icon-maps">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 2C7.2 2 5 4.2 5 7c0 4 5 11 5 11s5-7 5-11c0-2.8-2.2-5-5-5z"/>
              <circle cx="10" cy="7" r="1.8"/>
              <path d="M3 16c2-1 4-1.5 7-1.5s5 .5 7 1.5" stroke-dasharray="2 2"/>
            </svg>
          </div>
          <div class="api-card-info">
            <div class="api-card-name">Google Maps / Routes</div>
            <div class="api-card-desc">Geocodificação, cálculo de rotas e distâncias entre clientes. Requer projeto no Google Cloud Console.</div>
          </div>
          <label class="api-toggle" title={api.maps.ativa ? 'Desativar' : 'Ativar'}>
            <input type="checkbox" bind:checked={api.maps.ativa} />
            <span class="api-toggle-track"></span>
          </label>
        </div>

        {#if api.maps.ativa}
          <div class="api-body">
            <div class="field">
              <label>Chave de API</label>
              <input class="inp" bind:value={api.maps.apiKey} placeholder="AIzaSyXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
              <span class="field-hint">Gere a chave no Google Cloud Console → APIs e serviços → Credenciais.</span>
            </div>

            <div class="provider-table maps-tbl">
              <div class="provider-hd">APIs a ativar no Google Cloud Console</div>
              {#each [
                { nome: 'Geocoding API',       uso: 'Converter endereços em coordenadas (lat/lng)' },
                { nome: 'Routes API',          uso: 'Rotas e waypoints otimizados (nova geração)' },
                { nome: 'Directions API',      uso: 'Rotas ponto a ponto (geração anterior)' },
                { nome: 'Distance Matrix API', uso: 'Distâncias entre múltiplos pontos' },
                { nome: 'Maps JavaScript API', uso: 'Mapa interativo no navegador' },
              ] as api_item}
                <div class="provider-row">
                  <span class="maps-api-nome">{api_item.nome}</span>
                  <span class="maps-api-uso">{api_item.uso}</span>
                </div>
              {/each}
            </div>

            <p class="hint" style="margin:0">
              Restrinja a chave por HTTP referrer (domínio do app) para evitar uso não autorizado.
              Faturamento é cobrado por requisição acima da cota gratuita mensal.
            </p>

            <div class="api-test-row">
              <button class="btn line" on:click={testMaps} disabled={apiTestState.maps === 'testing' || !api.maps.apiKey}>
                {apiTestState.maps === 'testing' ? 'Testando…' : 'Testar chave'}
              </button>
              <span class="field-hint">Geocodifica "São Paulo" para verificar a chave.</span>
              {#if apiTestState.maps === 'ok'}
                <span class="api-test-ok">&#10003; {apiTestMsg.maps}</span>
              {:else if apiTestState.maps === 'error'}
                <span class="api-test-err">&#10007; {apiTestMsg.maps}</span>
              {/if}
            </div>
          </div>
        {/if}

        <div class="api-card-ft">
          <span class="api-doc-link">
            Documentação: <a href="https://developers.google.com/maps/documentation" target="_blank" rel="noreferrer">developers.google.com/maps</a>
          </span>
          <span class="api-status-chip" class:chip-on={api.maps.ativa} class:chip-off={!api.maps.ativa}>
            {api.maps.ativa ? 'Ativa' : 'Inativa'}
          </span>
        </div>
      </div>

      <div class="footer">
        <button class="btn line" on:click={resetApi}>Restaurar padrão</button>
        <div style="flex:1"></div>
        {#if savedOk}
          <span class="save-ok-msg">&#10003; Configurações salvas</span>
        {/if}
        <button class="btn" class:amber={!savedOk} class:btn-saved={savedOk} on:click={saveApi} disabled={savedOk}>
          {savedOk ? '✓ Salvo!' : 'Salvar integrações'}
        </button>
      </div>

    <!-- ── Editor ────────────────────────────────────────────────────────── -->
    {:else if tab === 'editor'}
      <div class="card">
        <div class="sec-label">Exibição no Editor</div>
        <p class="hint">Controla quais informações ficam visíveis no painel de resultados do Editor.</p>

        <div class="toggle-row">
          <label class="toggle-label">
            <input type="checkbox" bind:checked={$editorDisplay.showCommission} />
            <span class="toggle-text">Mostrar comissão estimada nos resultados</span>
          </label>
          <p class="toggle-desc">
            Exibe a comissão do vendedor calculada com a regra atual (Preços → Comissão) e o preço da tabela.
            Útil para conferir na hora do orçamento sem sair do Editor.
          </p>
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  .page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

  .page-hd { display: flex; align-items: center; gap: 16px; padding: 14px 24px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .page-title { font-size: 16px; font-weight: 600; white-space: nowrap; }
  .tabs { display: flex; gap: 2px; }
  .tab  { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px; font-weight: 500; background: none; border: 1px solid transparent; cursor: pointer; color: var(--ink-soft); }
  .tab.on { background: var(--panel-2); border-color: var(--line); color: var(--ink); }
  .tab:hover:not(.on) { background: var(--panel-2); }

  .body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); padding: 20px; display: flex; flex-direction: column; gap: 14px; }

  .sec-label { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .8px; color: var(--ink-faint); }
  .hint { font-size: 12px; color: var(--ink-faint); line-height: 1.5; }

  /* Empresa */
  .co-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .co-wide { grid-column: 1 / -1; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label { font-size: 11.5px; color: var(--ink-soft); }
  .req { color: var(--danger, #ef4444); font-size: 11px; }
  .opt { color: var(--ink-faint); font-size: 10.5px; font-weight: 400; }

  /* API row + busca buttons */
  .api-row { display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap; }
  .btn-api {
    display: inline-flex; align-items: center; gap: 5px;
    height: 30px; padding: 0 10px; border-radius: 5px;
    border: 1px solid var(--line); background: var(--panel-2);
    color: var(--ink-soft); font-size: 12px; cursor: pointer;
    white-space: nowrap; flex-shrink: 0; margin-bottom: 0;
    align-self: flex-end; font-family: inherit;
    transition: background .12s, border-color .12s, color .12s;
  }
  .btn-api:hover:not(:disabled) { background: var(--panel-3); border-color: var(--amber); color: var(--amber-deep); }
  .btn-api:disabled { opacity: .55; cursor: not-allowed; color: var(--ink-faint); }
  .btn-api.loading { cursor: wait; opacity: .8; color: var(--amber-deep); }

  @keyframes api-spin { to { transform: rotate(360deg); } }
  .spin {
    display: inline-block; width: 12px; height: 12px;
    border: 2px solid var(--line); border-top-color: var(--amber);
    border-radius: 50%; animation: api-spin .6s linear infinite;
  }

  .api-hint { color: var(--ink-faint); font-size: 11.5px; line-height: 1.5; font-style: italic; }

  /* Field size helpers */
  .field-cnpj { min-width: 160px; flex: 0 0 180px; }
  .field-ie    { min-width: 120px; flex: 0 0 140px; }
  .field-cep   { min-width: 100px; flex: 0 0 110px; }
  .field-num   { min-width: 80px;  flex: 0 0 90px; }
  .field-uf    { min-width: 70px;  flex: 0 0 80px; }

  .print-layout-opts { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; }
  .pl-opt { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 12px 16px; border: 2px solid var(--line); border-radius: 8px; cursor: pointer; width: 160px; transition: border-color .15s; }
  .pl-opt input { display: none; }
  .pl-opt:hover { border-color: var(--ink-soft); }
  .pl-opt.on { border-color: var(--amber); background: var(--amber-soft); }
  .pl-opt span { font-size: 12.5px; font-weight: 500; text-align: center; }
  .pl-opt small { font-size: 10.5px; color: var(--ink-soft); text-align: center; }
  .pl-preview { width: 100px; height: 70px; display: flex; align-items: center; justify-content: center; background: var(--panel-2); border-radius: 4px; }
  .pl-one .pl-page { width: 70px; height: 60px; background: #fff; border: 1.5px solid #94a3b8; border-radius: 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px; gap: 3px; }
  .pl-two .pl-page { width: 90px; height: 60px; background: #fff; border: 1.5px solid #94a3b8; border-radius: 2px; display: flex; flex-direction: row; align-items: center; justify-content: center; padding: 4px; gap: 4px; }
  .pl-svg { background: #dbeafe; border: 1px solid #93c5fd; border-radius: 1px; }
  .pl-one .pl-svg { width: 100%; flex: 1; }
  .pl-two .pl-svg { width: 35px; height: 48px; }

  /* Logo */
  .logo-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 8px; }
  .logo-preview { max-height: 48px; max-width: 240px; border-radius: 4px; border: 1px solid var(--line); background: var(--panel-2); padding: 4px; object-fit: contain; }
  .logo-upload { display: inline-flex; align-items: center; cursor: pointer; }
  .logo-upload input { display: none; }
  .logo-upload span { height: 30px; padding: 0 12px; border-radius: 5px; background: var(--panel); border: 1px solid var(--line); font-size: 13px; color: var(--ink-soft); display: flex; align-items: center; }
  .logo-upload:hover span { background: var(--panel-2); color: var(--ink); }

  /* Descrição */
  .token-bar { display: flex; flex-wrap: wrap; gap: 5px; }
  .tok-btn   { height: 26px; padding: 0 10px; border-radius: 5px; background: var(--panel-2); border: 1px solid var(--line); color: var(--ink-soft); font-family: var(--mono); font-size: 11.5px; cursor: pointer; }
  .tok-btn:hover { background: var(--amber-soft); border-color: #f5d9b0; color: var(--amber-deep); }
  .preview-row  { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .preview-lbl  { font-size: 11.5px; color: var(--ink-soft); white-space: nowrap; }
  .preview-code { font-family: var(--mono); font-size: 13px; background: var(--ink); color: #e2f0ff; padding: 7px 12px; border-radius: 6px; flex: 1; overflow-x: auto; white-space: nowrap; }
  .abbr-tbl { max-width: 340px; }
  .abbr-tbl .pname { font-size: 13px; color: var(--ink); }

  /* Shared */
  .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tbl th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--ink-faint); text-align: left; padding: 5px 4px; font-weight: 500; }
  .tbl td { border-top: .5px solid var(--line); padding: 3px 4px; }
  .inp { height: 30px; border: 1px solid var(--line); border-radius: 5px; padding: 0 7px; font-size: 13px; background: var(--panel); width: 100%; box-sizing: border-box; }
  .inp:focus { outline: none; border-color: var(--amber); }
  .inp.abbr { width: 72px; font-family: var(--mono); font-size: 12px; text-transform: uppercase; }
  .inp.full { width: 100%; font-family: var(--mono); font-size: 13px; }

  /* Editor display toggles */
  .toggle-row { display: flex; flex-direction: column; gap: 6px; padding: 14px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; margin-top: 4px; }
  .toggle-label { display: flex; align-items: center; gap: 9px; cursor: pointer; }
  .toggle-label input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--amber); cursor: pointer; flex-shrink: 0; }
  .toggle-text { font-size: 13.5px; font-weight: 500; color: var(--ink); }
  .toggle-desc { font-size: 12px; color: var(--ink-faint); line-height: 1.5; margin: 0; padding-left: 25px; }

  .footer { display: flex; gap: 10px; padding-top: 16px; border-top: 1px solid var(--line); align-items: center; flex-shrink: 0; }
  .btn { height: 32px; padding: 0 12px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .amber { background: var(--amber); color: #fff; border-color: var(--amber); } .amber:hover:not(:disabled) { background: #d67d12; }
  .line  { background: var(--panel); border-color: var(--line); color: var(--ink); } .line:hover:not(:disabled) { background: var(--panel-2); }

  /* ── Integrações ─────────────────────────────────────────────────────── */
  /* overflow:hidden removido — causa sobreposição ao expandir; border-radius
     nos filhos garante o arredondamento sem afetar o layout do flex pai    */
  .api-card { gap: 0; padding: 0; transition: border-color .15s; }
  .api-card.api-on { border-color: var(--amber); }

  .api-card-hd {
    display: flex; align-items: center; gap: 14px; padding: 16px 20px;
    border-radius: calc(var(--r) - 1px) calc(var(--r) - 1px) 0 0;
  }
  .api-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .api-icon-cep    { background: #dbeafe; color: #2563eb; }
  .api-icon-cnpj   { background: #d1fae5; color: #059669; }
  .api-icon-email  { background: #fce7f3; color: #be185d; }
  .api-icon-wa     { background: #dcfce7; color: #15803d; }
  .api-icon-maps   { background: #fef9c3; color: #a16207; }

  .api-card-info { flex: 1; min-width: 0; }
  .api-card-name { font-size: 14px; font-weight: 600; color: var(--ink); display: flex; align-items: center; gap: 7px; }
  .api-card-desc { font-size: 12px; color: var(--ink-soft); margin-top: 2px; line-height: 1.4; }

  .api-badge-free { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; padding: 1px 6px; border-radius: 4px; background: #d1fae5; color: #065f46; }
  .api-badge-prov { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; padding: 1px 6px; border-radius: 4px; background: #dbeafe; color: #1e40af; }
  .api-badge-soon { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; padding: 1px 6px; border-radius: 4px; background: var(--panel-2); color: var(--ink-faint); border: 1px solid var(--line); }

  /* Toggle switch */
  .api-toggle { position: relative; width: 38px; height: 22px; flex-shrink: 0; cursor: pointer; }
  .api-toggle input { display: none; }
  .api-toggle-track { position: absolute; inset: 0; border-radius: 11px; background: var(--line); transition: background .2s; }
  .api-toggle-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .2s; }
  .api-toggle input:checked ~ .api-toggle-track { background: var(--amber); }
  .api-toggle input:checked ~ .api-toggle-track::after { transform: translateX(16px); }

  /* Body (expandido quando ativo) */
  .api-body { display: flex; flex-direction: column; gap: 12px; padding: 0 20px 16px; border-top: 1px solid var(--line); padding-top: 14px; }

  .field-hint { font-size: 11px; color: var(--ink-faint); margin-top: 3px; line-height: 1.4; }
  .field-hint code { font-family: var(--mono); font-size: 10.5px; background: var(--panel-2); padding: 1px 4px; border-radius: 3px; }

  .api-test-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
  .api-test-ok  { font-size: 12px; color: var(--ok, #16a34a); font-weight: 500; }
  .api-test-err { font-size: 12px; color: var(--danger, #dc2626); font-weight: 500; }

  /* Comparativo de provedores */
  .provider-table { border: 1px solid var(--line); border-radius: 6px; overflow: hidden; font-size: 12px; }
  .provider-hd { background: var(--panel-2); padding: 6px 10px; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: var(--ink-faint); }
  .provider-row { display: grid; grid-template-columns: 100px 1fr 56px; align-items: center; padding: 6px 10px; border-top: 1px solid var(--line); transition: background .1s; }
  .provider-row:first-of-type { border-top: none; }
  .provider-row.provider-sel { background: var(--amber-soft); }
  .provider-name { font-weight: 600; color: var(--ink); }
  .provider-url  { font-family: var(--mono); font-size: 11px; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .provider-auth { text-align: right; color: var(--ink-faint); }
  .provider-row.provider-sel .provider-auth { color: var(--amber-deep); font-weight: 500; }

  /* Maps — tabela de 2 colunas sem coluna de auth */
  .maps-tbl .provider-row { grid-template-columns: 160px 1fr; }
  .maps-api-nome { font-size: 12px; font-weight: 600; color: var(--ink); }
  .maps-api-uso  { font-size: 12px; color: var(--ink-soft); }

  /* Grid de 2 colunas dentro do api-body */
  .api-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* Checkbox inline */
  .check-row { display: flex; align-items: center; gap: 7px; cursor: pointer; font-size: 13px; color: var(--ink); user-select: none; }
  .check-row input { accent-color: var(--amber); width: 15px; height: 15px; flex-shrink: 0; }

  /* Segmented control (auth type) */
  .seg-ctrl { display: flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; width: fit-content; }
  .seg-opt { display: flex; align-items: center; gap: 5px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; color: var(--ink-soft); border-right: 1px solid var(--line); user-select: none; }
  .seg-opt:last-child { border-right: none; }
  .seg-opt input { display: none; }
  .seg-opt.seg-on { background: var(--amber-soft); color: var(--amber-deep); font-weight: 600; }
  .seg-opt:not(.seg-on):hover { background: var(--panel-2); }

  /* Info box Meta */
  .api-badge-info { font-size: 12px; color: var(--ink-soft); background: var(--panel-2); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; line-height: 1.5; }

  .smtp-hint { font-size: 12px; color: var(--ink-faint); line-height: 1.5; margin: 0; }

  /* Botão salvar com feedback */
  .btn-saved { background: var(--ok, #16a34a) !important; border-color: var(--ok, #16a34a) !important; color: #fff !important; }
  .save-ok-msg { font-size: 12.5px; color: var(--ok, #16a34a); font-weight: 500; }

  /* Footer de cada card */
  .api-card-ft {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 20px; background: var(--panel-2); border-top: 1px solid var(--line);
    border-radius: 0 0 calc(var(--r) - 1px) calc(var(--r) - 1px);
  }
  .api-doc-link { font-size: 11.5px; color: var(--ink-faint); }
  .api-doc-link a { color: var(--amber-deep); text-decoration: none; }
  .api-doc-link a:hover { text-decoration: underline; }

  .api-status-chip { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; padding: 2px 8px; border-radius: 20px; }
  .chip-on  { background: #d1fae5; color: #065f46; }
  .chip-off { background: var(--panel); border: 1px solid var(--line); color: var(--ink-faint); }

</style>
