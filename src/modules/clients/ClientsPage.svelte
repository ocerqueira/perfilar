<script>
  import { clients, order, ctx, quotingClient, apiConfig } from '../../lib/stores.js';

  // ── Segmentos ─────────────────────────────────────────────────────────────
  const SEGMENTOS = [
    { value: '',               label: 'Não informado'           },
    { value: 'construtora',   label: 'Construtora / Empreiteira'},
    { value: 'revendedor',    label: 'Revendedor / Distribuidor'},
    { value: 'industria',     label: 'Indústria / Fabricante'  },
    { value: 'pessoa_fisica', label: 'Pessoa Física'           },
    { value: 'outro',         label: 'Outro'                   },
  ];

  const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
                'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

  // ── Busca e filtro ────────────────────────────────────────────────────────
  let search    = '';
  let filterSeg = '';

  function nomeCompleto(c) {
    if (c.tipo === 'pf' && c.sobrenome) return `${c.nome} ${c.sobrenome}`;
    return c.nome || '';
  }

  function enderecoResumido(c) {
    const partes = [c.logradouro || c.endereco, c.numero, c.bairro].filter(Boolean);
    const loc    = [c.cidade, c.uf].filter(Boolean).join(' · ');
    return { linha1: partes.join(', '), loc };
  }

  $: filtered = $clients
    .filter(c => {
      if (filterSeg && c.segmento !== filterSeg) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (c.nome          || '').toLowerCase().includes(q) ||
        (c.sobrenome     || '').toLowerCase().includes(q) ||
        (c.nomeFantasia  || '').toLowerCase().includes(q) ||
        (c.cidade        || '').toLowerCase().includes(q) ||
        (c.bairro        || '').toLowerCase().includes(q) ||
        (c.cnpj          || '').includes(q) ||
        (c.cpf           || '').includes(q) ||
        (c.email         || '').toLowerCase().includes(q) ||
        (c.tel           || '').includes(q)
      );
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  // ── Form state ────────────────────────────────────────────────────────────
  const FORM_DEF = {
    tipo: 'pj',
    // Identificação
    nome: '', sobrenome: '', nomeFantasia: '',
    cnpj: '', cpf: '', ie: '',
    segmento: '',
    // Contato
    email: '', tel: '', whatsapp: '', site: '', instagram: '',
    // Endereço estruturado
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
    // Contato principal (PJ)
    contatoNome: '', contatoSobrenome: '', contatoCargo: '', contatoTel: '', contatoEmail: '',
    // Legado e obs
    endereco: '', obs: '',
  };

  // ── Busca CEP (ViaCEP) ────────────────────────────────────────────────────
  let cepLoading = false;
  async function buscarCep() {
    const cep = (formData.cep || '').replace(/\D/g, '');
    if (cep.length !== 8 || !$apiConfig.viacep?.ativa) return;
    cepLoading = true;
    try {
      const base = ($apiConfig.viacep.url || 'https://viacep.com.br/ws/').replace(/\/$/, '');
      const r = await fetch(`${base}/${cep}/json/`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!d.erro) {
        formData.logradouro = d.logradouro || '';
        formData.bairro    = d.bairro    || '';
        formData.cidade    = d.localidade || '';
        formData.uf        = d.uf        || '';
        formData = formData; // trigger reactivity
      }
    } catch { /* ignora erros de rede */ }
    finally { cepLoading = false; }
  }

  // ── Busca CNPJ (BrasilAPI) ────────────────────────────────────────────────
  let cnpjLoading = false;
  async function buscarCnpj() {
    const cnpj = (formData.cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14 || !$apiConfig.cnpj?.ativa) return;
    cnpjLoading = true;
    try {
      const prov = $apiConfig.cnpj;
      let url = '';
      if (prov.provider === 'brasilapi')  url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
      else if (prov.provider === 'cnpjws') url = `https://publica.cnpj.ws/cnpj/${cnpj}`;
      else if (prov.url) url = prov.url.replace(/\/$/, '') + `/${cnpj}`;
      if (!url) { cnpjLoading = false; return; }

      const headers = prov.token ? { Authorization: `Bearer ${prov.token}` } : {};
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();

      // Normaliza entre providers (BrasilAPI, CNPJ.ws, ReceitaWS)
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
        formData.nome         = razao;
        formData.nomeFantasia = fantasia || formData.nomeFantasia;
        formData.ie           = ie      || formData.ie;
        if (cepField)     formData.cep        = cepField;
        if (logrField)    formData.logradouro = logrField;
        if (numField)     formData.numero     = numField;
        if (complField)   formData.complemento = complField;
        if (bairroField)  formData.bairro     = bairroField;
        if (cidadeField)  formData.cidade     = cidadeField;
        if (ufField)      formData.uf         = ufField;
        formData.endereco = [logrField, numField, complField, bairroField].filter(Boolean).join(', ');
        formData = formData; // trigger reactivity
      }
    } catch { /* ignora erros de rede */ }
    finally { cnpjLoading = false; }
  }

  let formMode   = '';    // '' | 'new' | 'edit'
  let formData   = { ...FORM_DEF };
  let editingId  = null;
  let expanded   = new Set();

  function openNew() {
    formData  = { ...FORM_DEF };
    editingId = null;
    formMode  = 'new';
  }

  function openEdit(c) {
    formData  = { ...FORM_DEF, ...c };
    editingId = c.id;
    formMode  = 'edit';
  }

  function closeForm() { formMode = ''; editingId = null; }

  function salvar() {
    const now = new Date().toISOString();
    if (formMode === 'new') {
      clients.update(list => [{ ...formData, id: Date.now(), createdAt: now, updatedAt: now }, ...list]);
    } else {
      clients.update(list => list.map(c =>
        c.id === editingId ? { ...c, ...formData, updatedAt: now } : c
      ));
    }
    closeForm();
  }

  function excluir(id) {
    clients.update(list => list.filter(c => c.id !== id));
    if (editingId === id) closeForm();
  }

  function toggleExpand(id) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    expanded = expanded;
  }

  // ── Atalho: novo orçamento com cliente ───────────────────────────────────
  function novoOrcamento(c) {
    order.set({ items: [], sel: -1 });
    ctx.set({ cliente: c.nome, orc: '', vendedor: '', obs: '' });
    quotingClient.set(c);
    window.location.hash = 'editor';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const SEG_LABEL = Object.fromEntries(SEGMENTOS.map(s => [s.value, s.label]));

  function fmtDoc(c) {
    if (c.tipo === 'pj' && c.cnpj) return `CNPJ ${c.cnpj}`;
    if (c.tipo === 'pf' && c.cpf)  return `CPF ${c.cpf}`;
    return '';
  }

  let confirmDel = null;
</script>

<div class="page" class:has-form={formMode}>

  <!-- ── Painel esquerdo: lista ─────────────────────────────────────────────── -->
  <div class="pane-list">

    <div class="list-head">
      <div class="list-title">
        <span class="title-text">Clientes</span>
        <span class="total-badge">{$clients.length}</span>
      </div>
      <button class="btn-new" on:click={openNew}>
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M8 3v10M3 8h10"/>
        </svg>
        Novo cliente
      </button>
    </div>

    <div class="list-filters">
      <div class="search-wrap">
        <svg class="s-icon" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="8.5" cy="8.5" r="5.5"/><path d="M15 15l-2.5-2.5"/>
        </svg>
        <input class="search-inp" bind:value={search} placeholder="Nome, cidade, CNPJ…" />
        {#if search}<button class="search-clear" on:click={() => search = ''}>×</button>{/if}
      </div>
      <select class="seg-sel" bind:value={filterSeg}>
        <option value="">Todos os segmentos</option>
        {#each SEGMENTOS.slice(1) as s}<option value={s.value}>{s.label}</option>{/each}
      </select>
    </div>

    <div class="list-body">
      {#if filtered.length === 0}
        <div class="empty">
          {#if $clients.length === 0}
            <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".3">
              <circle cx="24" cy="18" r="9"/><path d="M6 42c0-9.9 8.1-16 18-16s18 6.1 18 16"/>
            </svg>
            <p>Nenhum cliente cadastrado.</p>
            <button class="btn-link" on:click={openNew}>Cadastrar o primeiro →</button>
          {:else}
            <p>Nenhum resultado para "<strong>{search}</strong>".</p>
            <button class="btn-link" on:click={() => { search = ''; filterSeg = ''; }}>Limpar filtros</button>
          {/if}
        </div>
      {:else}
        {#each filtered as c (c.id)}
          <div class="card" class:is-editing={editingId === c.id}>

            <div class="card-main">
              <div class="card-info">
                <div class="card-nome">{nomeCompleto(c) || '—'}</div>
                {#if c.tipo === 'pj' && c.nomeFantasia}
                  <div class="card-fantasia">{c.nomeFantasia}</div>
                {/if}
                <div class="card-sub">
                  {#if c.segmento}<span class="seg-tag">{SEG_LABEL[c.segmento] ?? c.segmento}</span>{/if}
                  {#if c.cidade}<span class="card-loc">{c.cidade}{c.uf ? ` · ${c.uf}` : ''}</span>{/if}
                  {#if !c.cidade && c.bairro}<span class="card-loc">{c.bairro}</span>{/if}
                </div>
              </div>
              <div class="card-contacts">
                {#if c.tel}<span class="cc">{c.tel}</span>{/if}
                {#if c.email}<span class="cc">{c.email}</span>{/if}
              </div>
            </div>

            <div class="card-actions">
              <button class="btn-action btn-orc" on:click={() => novoOrcamento(c)} title="Novo orçamento para este cliente">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M6 6h4M6 9h2"/><path d="M10 9l2-2m0 0l-2-2m2 2H8" />
                </svg>
                Novo orçamento
              </button>
              <button class="btn-action btn-edit" on:click={() => openEdit(c)}>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z"/>
                </svg>
                Editar
              </button>
              <button
                class="btn-action btn-expand"
                class:is-open={expanded.has(c.id)}
                on:click={() => toggleExpand(c.id)}
              >
                Detalhes
                <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="chev">
                  <path d="M4 6l4 4 4-4"/>
                </svg>
              </button>
              <div class="spacer"></div>
              {#if confirmDel === c.id}
                <span class="confirm-lbl">Excluir?</span>
                <button class="btn-action btn-del-ok" on:click={() => { excluir(c.id); confirmDel = null; }}>Sim</button>
                <button class="btn-action" on:click={() => confirmDel = null}>Não</button>
              {:else}
                <button class="btn-action btn-del" on:click={() => confirmDel = c.id} title="Excluir">
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 4h10M6 4V2.5h4V4M5.5 4l.5 9h4l.5-9"/>
                  </svg>
                </button>
              {/if}
            </div>

            {#if expanded.has(c.id)}
              {@const end = enderecoResumido(c)}
              <div class="card-detail">
                {#if fmtDoc(c)}<div class="det-row"><span class="det-lbl">Documento</span><span>{fmtDoc(c)}</span></div>{/if}
                {#if c.ie}      <div class="det-row"><span class="det-lbl">IE</span><span>{c.ie}</span></div>{/if}
                {#if end.linha1}<div class="det-row"><span class="det-lbl">Endereço</span><span>{end.linha1}{#if c.complemento} · {c.complemento}{/if}</span></div>{/if}
                {#if c.cep}     <div class="det-row"><span class="det-lbl">CEP</span><span>{c.cep}</span></div>{/if}
                {#if end.loc}   <div class="det-row"><span class="det-lbl">Cidade</span><span>{end.loc}</span></div>{/if}
                {#if c.whatsapp}<div class="det-row"><span class="det-lbl">WhatsApp</span><span>{c.whatsapp}</span></div>{/if}
                {#if c.site}    <div class="det-row"><span class="det-lbl">Site</span><span>{c.site}</span></div>{/if}
                {#if c.instagram}<div class="det-row"><span class="det-lbl">Instagram</span><span>{c.instagram}</span></div>{/if}
                {#if c.contatoNome}
                  <div class="det-row">
                    <span class="det-lbl">Contato</span>
                    <span>
                      {c.contatoNome}{c.contatoSobrenome ? ` ${c.contatoSobrenome}` : ''}
                      {c.contatoCargo ? ` · ${c.contatoCargo}` : ''}
                      {c.contatoTel   ? ` · ${c.contatoTel}`   : ''}
                    </span>
                  </div>
                {/if}
                {#if c.obs}
                  <div class="det-row det-obs"><span class="det-lbl">Obs.</span><span>{c.obs}</span></div>
                {/if}
                {#if !fmtDoc(c) && !c.ie && !end.linha1 && !end.loc && !c.whatsapp && !c.site && !c.instagram && !c.contatoNome && !c.obs}
                  <span class="det-empty">Nenhum detalhe adicional cadastrado.</span>
                {/if}
              </div>
            {/if}

          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- ── Painel direito: formulário ────────────────────────────────────────── -->
  {#if formMode}
    <div class="pane-form">
      <div class="form-head">
        <span class="form-title">{formMode === 'new' ? 'Novo cliente' : 'Editar cliente'}</span>
        <button class="modal-close" on:click={closeForm}>×</button>
      </div>

      <div class="form-body">

        <!-- ── Identificação ──────────────────────────────────────────── -->
        <div class="form-section-title">Identificação</div>
        <div class="field-row">
          <label class="radio-opt" class:on={formData.tipo === 'pj'}>
            <input type="radio" bind:group={formData.tipo} value="pj" /> Pessoa Jurídica
          </label>
          <label class="radio-opt" class:on={formData.tipo === 'pf'}>
            <input type="radio" bind:group={formData.tipo} value="pf" /> Pessoa Física
          </label>
        </div>

        {#if formData.tipo === 'pj'}
          <div class="field field-full">
            <label class="field-lbl">Razão Social <span class="req">*</span></label>
            <input class="inp" bind:value={formData.nome} placeholder="Ex.: ABC Construtora Ltda" />
          </div>
          <div class="field field-full">
            <label class="field-lbl">Nome Fantasia <span class="opt">(opcional)</span></label>
            <input class="inp" bind:value={formData.nomeFantasia} placeholder="Ex.: ABC Construções" />
          </div>
          <div class="field-row field-row-api">
            <div class="field field-grow">
              <label class="field-lbl">CNPJ</label>
              <input class="inp" bind:value={formData.cnpj} placeholder="00.000.000/0000-00" maxlength="18" />
            </div>
            <button class="btn-api" type="button"
                    class:loading={cnpjLoading}
                    disabled={cnpjLoading || !$apiConfig.cnpj?.ativa || formData.tipo !== 'pj'}
                    on:click={buscarCnpj}
                    title={!$apiConfig.cnpj?.ativa
                      ? 'Ative a API de CNPJ em Config → Integrações'
                      : cnpjLoading ? 'Buscando…' : 'Buscar razão social e endereço pelo CNPJ'}>
              {#if cnpjLoading}
                <span class="spin"></span> Buscando…
              {:else}
                <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                  <circle cx="5.5" cy="5.5" r="3.5"/><path d="M9 9l3 3"/>
                </svg>
                Buscar dados
              {/if}
            </button>
            <div class="field field-uf">
              <label class="field-lbl">IE</label>
              <input class="inp" bind:value={formData.ie} placeholder="IE" />
            </div>
          </div>
        {:else}
          <div class="field-row">
            <div class="field field-grow">
              <label class="field-lbl">Nome <span class="req">*</span></label>
              <input class="inp" bind:value={formData.nome} placeholder="João" />
            </div>
            <div class="field field-grow">
              <label class="field-lbl">Sobrenome</label>
              <input class="inp" bind:value={formData.sobrenome} placeholder="Silva" />
            </div>
          </div>
          <div class="field">
            <label class="field-lbl">CPF</label>
            <input class="inp" bind:value={formData.cpf} placeholder="000.000.000-00" maxlength="14" />
          </div>
        {/if}

        <div class="field">
          <label class="field-lbl">Segmento</label>
          <select class="inp" bind:value={formData.segmento}>
            {#each SEGMENTOS as s}<option value={s.value}>{s.label}</option>{/each}
          </select>
        </div>

        <!-- ── Contato ─────────────────────────────────────────────────── -->
        <div class="form-section-title">Contato</div>
        <div class="field-row">
          <div class="field">
            <label class="field-lbl">Telefone</label>
            <input class="inp" bind:value={formData.tel} placeholder="(11) 9999-9999" />
          </div>
          <div class="field">
            <label class="field-lbl">WhatsApp</label>
            <input class="inp" bind:value={formData.whatsapp} placeholder="(11) 99999-9999" />
          </div>
        </div>
        <div class="field-row">
          <div class="field field-grow">
            <label class="field-lbl">E-mail</label>
            <input class="inp" bind:value={formData.email} type="email" placeholder="contato@empresa.com" />
          </div>
          <div class="field">
            <label class="field-lbl">Site</label>
            <input class="inp" bind:value={formData.site} placeholder="www.empresa.com" />
          </div>
        </div>
        <div class="field">
          <label class="field-lbl">Instagram</label>
          <input class="inp" bind:value={formData.instagram} placeholder="@empresa" />
        </div>

        <!-- ── Endereço ────────────────────────────────────────────────── -->
        <div class="form-section-title">Endereço</div>
        <div class="field-row field-row-api">
          <div class="field field-cep">
            <label class="field-lbl">CEP</label>
            <input class="inp" bind:value={formData.cep} placeholder="00000-000" maxlength="9"
                   on:blur={buscarCep} />
          </div>
          <button class="btn-api" type="button"
                  class:loading={cepLoading}
                  disabled={cepLoading || !$apiConfig.viacep?.ativa}
                  on:click={buscarCep}
                  title={!$apiConfig.viacep?.ativa
                    ? 'Ative o ViaCEP em Config → Integrações'
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
        <div class="field field-full">
          <label class="field-lbl">Logradouro</label>
          <input class="inp" bind:value={formData.logradouro} placeholder="Rua, Avenida, Alameda…" />
        </div>
        <div class="field-row">
          <div class="field field-num">
            <label class="field-lbl">Número</label>
            <input class="inp" bind:value={formData.numero} placeholder="123" />
          </div>
          <div class="field field-grow">
            <label class="field-lbl">Complemento <span class="opt">(opcional)</span></label>
            <input class="inp" bind:value={formData.complemento} placeholder="Sala 4, Bloco B…" />
          </div>
        </div>
        <div class="field field-full">
          <label class="field-lbl">Bairro</label>
          <input class="inp" bind:value={formData.bairro} placeholder="Centro" />
        </div>
        <div class="field-row">
          <div class="field field-grow">
            <label class="field-lbl">Cidade</label>
            <input class="inp" bind:value={formData.cidade} placeholder="São Paulo" />
          </div>
          <div class="field field-uf">
            <label class="field-lbl">UF</label>
            <select class="inp" bind:value={formData.uf}>
              <option value="">—</option>
              {#each UFS as uf}<option value={uf}>{uf}</option>{/each}
            </select>
          </div>
        </div>

        <!-- ── Contato principal (PJ) ─────────────────────────────────── -->
        {#if formData.tipo === 'pj'}
          <div class="form-section-title">Contato principal</div>
          <div class="field-row">
            <div class="field field-grow">
              <label class="field-lbl">Nome</label>
              <input class="inp" bind:value={formData.contatoNome} placeholder="João" />
            </div>
            <div class="field field-grow">
              <label class="field-lbl">Sobrenome</label>
              <input class="inp" bind:value={formData.contatoSobrenome} placeholder="Silva" />
            </div>
          </div>
          <div class="field">
            <label class="field-lbl">Cargo</label>
            <input class="inp" bind:value={formData.contatoCargo} placeholder="Comprador, Gerente…" />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-lbl">Telefone direto</label>
              <input class="inp" bind:value={formData.contatoTel} placeholder="(11) 99999-9999" />
            </div>
            <div class="field">
              <label class="field-lbl">E-mail direto</label>
              <input class="inp" bind:value={formData.contatoEmail} placeholder="joao@empresa.com" />
            </div>
          </div>
        {/if}

        <!-- ── Observações ─────────────────────────────────────────────── -->
        <div class="form-section-title">Observações</div>
        <div class="field field-full">
          <textarea class="inp inp-area" bind:value={formData.obs}
                    placeholder="Preferências, histórico, notas importantes…" rows="3"></textarea>
        </div>

      </div>

      <div class="form-foot">
        <button class="btn btn-ghost" on:click={closeForm}>Cancelar</button>
        <button class="btn btn-amber" on:click={salvar} disabled={!formData.nome.trim()}>
          {formMode === 'new' ? 'Cadastrar cliente' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  {/if}

</div>

<style>
  /* ── Layout master-detail ─────────────────────────────────────────────────── */
  .page {
    display: flex;
    height: 100%;
    overflow: hidden;
  }
  .pane-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }
  .pane-form {
    width: 420px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--line);
    background: var(--panel);
    overflow: hidden;
  }

  /* ── Cabeçalho da lista ──────────────────────────────────────────────────── */
  .list-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }
  .list-title { display: flex; align-items: center; gap: 8px; margin-right: auto; }
  .title-text  { font-size: 17px; font-weight: 700; color: var(--ink); }
  .total-badge {
    background: var(--panel-2);
    color: var(--ink-soft);
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 20px;
  }

  .btn-new {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--amber);
    border-radius: 6px;
    background: var(--amber-soft);
    color: var(--amber-deep);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background .12s;
  }
  .btn-new:hover { background: #f5dfc0; }

  /* ── Filtros ─────────────────────────────────────────────────────────────── */
  .list-filters {
    display: flex;
    gap: 8px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }
  .search-wrap { position: relative; display: flex; align-items: center; flex: 1; }
  .s-icon { position: absolute; left: 9px; pointer-events: none; color: var(--ink-faint); }
  .search-inp {
    width: 100%;
    height: 32px;
    padding: 0 28px 0 30px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel-2);
    color: var(--ink);
    font-size: 13px;
    outline: none;
    transition: border-color .15s;
  }
  .search-inp:focus { border-color: var(--amber); }
  .search-inp::placeholder { color: var(--ink-faint); }
  .search-clear {
    position: absolute; right: 8px;
    background: none; border: none; cursor: pointer;
    color: var(--ink-faint); font-size: 16px; line-height: 1; padding: 0;
  }
  .seg-sel {
    height: 32px;
    padding: 0 8px;
    font-size: 13px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel-2);
    color: var(--ink);
    cursor: pointer;
    outline: none;
    min-width: 160px;
    font-family: inherit;
  }

  /* ── Lista de cards ──────────────────────────────────────────────────────── */
  .list-body {
    flex: 1;
    overflow-y: auto;
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    color: var(--ink-soft);
    font-size: 14px;
    text-align: center;
  }
  .empty p { margin: 0; }
  .empty strong { color: var(--ink); }
  .btn-link {
    background: none; border: none; cursor: pointer;
    color: var(--amber-deep); font-size: 13px; font-weight: 600;
    text-decoration: underline; text-underline-offset: 2px;
  }

  /* ── Card do cliente ─────────────────────────────────────────────────────── */
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color .15s;
  }
  .card:hover { border-color: var(--line); }
  .card.is-editing { border-color: var(--amber); box-shadow: 0 0 0 2px var(--amber-soft); }

  .card-main {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .card-info { flex: 1; min-width: 0; }
  .card-nome    { font-size: 14px; font-weight: 600; color: var(--ink); }
  .card-fantasia { font-size: 11.5px; color: var(--ink-soft); margin-top: 1px; }
  .card-sub   { display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap; }
  .seg-tag {
    font-size: 10.5px;
    background: var(--panel-2);
    color: var(--ink-faint);
    border-radius: 3px;
    padding: 1px 6px;
    font-weight: 500;
  }
  .card-loc { font-size: 12px; color: var(--ink-soft); }

  .card-contacts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }
  .cc { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); }

  /* Card actions */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }
  .spacer { flex: 1; }

  .btn-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 9px;
    border-radius: 5px;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--ink-soft);
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background .12s, color .12s, border-color .12s;
    font-family: inherit;
  }
  .btn-action:hover { background: var(--panel-3); color: var(--ink); }

  .btn-orc  { color: var(--amber-deep); background: var(--amber-soft); border-color: #f5c89a; }
  .btn-orc:hover  { background: #f5dfc0; }
  .btn-edit:hover { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  .btn-del  { padding: 0 7px; }
  .btn-del:hover  { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
  .btn-del-ok { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
  .btn-del-ok:hover { background: #fecaca; }
  .confirm-lbl { font-size: 11.5px; color: #991b1b; font-weight: 600; }
  .btn-expand { gap: 3px; }
  .btn-expand.is-open { background: var(--panel-3); color: var(--ink); }
  .chev { transition: transform .2s ease; }
  .btn-expand.is-open .chev { transform: rotate(180deg); }

  /* Card detail */
  .card-detail {
    border-top: 1px solid var(--line);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .det-row {
    display: flex;
    gap: 8px;
    font-size: 12.5px;
    color: var(--ink);
  }
  .det-lbl {
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-faint);
    width: 80px;
    flex-shrink: 0;
    padding-top: 1px;
  }
  .det-obs { align-items: flex-start; }
  .det-empty { font-size: 12px; color: var(--ink-faint); }

  /* ── Formulário lateral ──────────────────────────────────────────────────── */
  .form-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }
  .form-title { font-size: 15px; font-weight: 700; color: var(--ink); }
  .modal-close {
    background: none; border: none; cursor: pointer;
    color: var(--ink-faint); font-size: 20px; line-height: 1; padding: 0 2px;
  }
  .modal-close:hover { color: var(--ink); }

  .form-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .form-section-title {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .8px;
    color: var(--ink-faint);
    padding-top: 6px;
    border-top: 1px solid var(--line);
    margin-top: 4px;
  }
  .form-body > .form-section-title:first-child { border-top: none; margin-top: 0; padding-top: 0; }

  .field { display: flex; flex-direction: column; gap: 4px; }
  .field-full  { width: 100%; }
  .field-grow  { flex: 1; min-width: 0; }
  .field-uf    { width: 68px; flex-shrink: 0; }
  .field-cep   { width: 110px; flex-shrink: 0; }
  .field-num   { width: 80px; flex-shrink: 0; }
  .field-lbl   { font-size: 11.5px; font-weight: 600; color: var(--ink-soft); }
  .req         { color: #dc2626; }
  .opt         { font-weight: 400; color: var(--ink-faint); }

  .field-row          { display: flex; gap: 8px; align-items: flex-end; }
  .field-row .field   { flex: 1; }
  .field-row-api      { align-items: flex-end; }

  /* Botão de integração API */
  .btn-api {
    height: 32px; padding: 0 10px; border-radius: 6px; font-size: 12px; font-weight: 500;
    background: var(--panel-2); border: 1px solid var(--line); color: var(--ink-soft);
    cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
    white-space: nowrap; flex-shrink: 0; margin-bottom: 0; align-self: flex-end;
    font-family: inherit; transition: background .12s, border-color .12s, color .12s;
  }
  .btn-api:hover:not(:disabled) { background: var(--panel-3); border-color: var(--amber); color: var(--amber-deep); }
  .btn-api:disabled { cursor: not-allowed; opacity: .55; color: var(--ink-faint); }
  .btn-api.loading { cursor: wait; opacity: .8; color: var(--amber-deep); }

  @keyframes api-spin { to { transform: rotate(360deg); } }
  .spin {
    display: inline-block; width: 12px; height: 12px;
    border: 2px solid var(--line); border-top-color: var(--amber);
    border-radius: 50%; animation: api-spin .6s linear infinite;
  }

  .inp {
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel-2);
    color: var(--ink);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color .15s;
    width: 100%;
  }
  .inp:focus { border-color: var(--amber); }
  select.inp { cursor: pointer; }
  .inp-area {
    height: auto;
    padding: 8px 10px;
    resize: vertical;
    min-height: 68px;
    line-height: 1.5;
  }

  /* Radio tipo pessoa */
  .radio-opt {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px;
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--ink-soft);
    background: var(--panel-2);
    transition: border-color .12s, background .12s, color .12s;
    font-family: inherit;
  }
  .radio-opt input { display: none; }
  .radio-opt.on { border-color: var(--amber); background: var(--amber-soft); color: var(--amber-deep); font-weight: 600; }

  .form-foot {
    display: flex;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid var(--line);
    flex-shrink: 0;
    background: var(--panel-2);
  }
  .btn {
    height: 34px;
    padding: 0 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
    font-family: inherit;
    transition: background .12s;
  }
  .btn-ghost { background: var(--panel-3); color: var(--ink-soft); border-color: var(--line); }
  .btn-ghost:hover { color: var(--ink); }
  .btn-amber { flex: 1; background: var(--amber); color: #fff; }
  .btn-amber:hover:not(:disabled) { background: #d67d12; }
  .btn-amber:disabled { opacity: .45; cursor: not-allowed; }
</style>
