<script>
  import { appUsers, apiConfig } from '../../lib/stores.js';

  let tab = 'users'; // 'users' | 'roles'

  // ── Roles definition (static) ─────────────────────────────────────────────
  const ROLES = [
    { key: 'admin',      label: 'Administrador',
      desc: 'Acesso completo: gerencia usuários, configurações, preços e todos os módulos.' },
    { key: 'gerente',    label: 'Gerente',
      desc: 'Acessa análises, pedidos, metas e preços. Não pode gerenciar usuários.' },
    { key: 'vendedor',   label: 'Vendedor',
      desc: 'Editor de orçamentos, pedidos e clientes. Vê apenas seus próprios dados.' },
    { key: 'assistente', label: 'Assistente',
      desc: 'Editor de orçamentos e pedidos. Sem acesso a preços, comissão ou relatórios.' },
  ];

  const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.key, r.label]));

  const MODULE_ACCESS = [
    { module: 'Início (Dashboard)',   admin: true, gerente: true,  vendedor: true,  assistente: false },
    { module: 'Editor de orçamento',  admin: true, gerente: true,  vendedor: true,  assistente: true  },
    { module: 'Plano de corte',       admin: true, gerente: true,  vendedor: true,  assistente: true  },
    { module: 'Análises',             admin: true, gerente: true,  vendedor: false, assistente: false },
    { module: 'Pedidos',              admin: true, gerente: true,  vendedor: true,  assistente: true  },
    { module: 'Metas & Campanhas',    admin: true, gerente: true,  vendedor: false, assistente: false },
    { module: 'Preços e Comissão',    admin: true, gerente: true,  vendedor: false, assistente: false },
    { module: 'Clientes',             admin: true, gerente: true,  vendedor: true,  assistente: false },
    { module: 'Produtos / Materiais', admin: true, gerente: true,  vendedor: false, assistente: false },
    { module: 'Configuração',         admin: true, gerente: false, vendedor: false, assistente: false },
    { module: 'Admin (usuários)',     admin: true, gerente: false, vendedor: false, assistente: false },
  ];

  // ── Users CRUD ────────────────────────────────────────────────────────────
  const USER_DEF = {
    nome: '', sobrenome: '',
    email: '', telefone: '', whatsapp: '', codigo: '',
    role: 'vendedor', ativo: true,
    // Endereço
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  };

  const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
               'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
  let formMode = false; // false | 'new' | 'edit'
  let form = { ...USER_DEF };
  let editId = null;
  let selUser = null;
  let confirmDel = null;
  let formError = '';

  function openNew() {
    form = { ...USER_DEF };
    editId = null;
    formError = '';
    formMode = 'new';
    selUser = null;
  }

  function openEdit(u) {
    form = { ...u };
    editId = u.id;
    formError = '';
    formMode = 'edit';
    selUser = u;
  }

  function closeForm() { formMode = false; editId = null; formError = ''; }

  // ── Busca CEP (ViaCEP) ──────────────────────────────────────────────────────
  let cepLoading = false;
  async function buscarCep() {
    const cep = (form.cep || '').replace(/\D/g, '');
    if (cep.length !== 8 || !$apiConfig.viacep?.ativa) return;
    cepLoading = true;
    try {
      const base = ($apiConfig.viacep.url || 'https://viacep.com.br/ws/').replace(/\/$/, '');
      const r = await fetch(`${base}/${cep}/json/`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!d.erro) {
        form.logradouro  = d.logradouro || '';
        form.bairro      = d.bairro    || '';
        form.cidade      = d.localidade || '';
        form.uf          = d.uf        || '';
        form = form; // trigger reactivity
      }
    } catch { /* ignora erros de rede */ }
    finally { cepLoading = false; }
  }

  function saveUser() {
    if (!form.nome.trim()) { formError = 'Nome é obrigatório.'; return; }
    if (!form.email.trim() || !form.email.includes('@')) {
      formError = 'E-mail inválido.'; return;
    }
    if (form.role === 'vendedor' && !form.codigo.trim()) {
      formError = 'Código do vendedor é obrigatório.'; return;
    }
    const emailTaken = $appUsers.some(u =>
      u.email.toLowerCase() === form.email.toLowerCase() && u.id !== editId);
    if (emailTaken) { formError = 'Este e-mail já está em uso.'; return; }

    if (formMode === 'new') {
      const newUser = { ...form, id: Date.now(), createdAt: new Date().toISOString() };
      appUsers.update(list => [newUser, ...list]);
      selUser = newUser;
    } else {
      appUsers.update(list => list.map(u => u.id === editId ? { ...u, ...form } : u));
      selUser = { ...selUser, ...form };
    }
    closeForm();
  }

  function toggleActive(u) {
    appUsers.update(list => list.map(x => x.id === u.id ? { ...x, ativo: !x.ativo } : x));
  }

  function deleteUser(id) {
    appUsers.update(list => list.filter(u => u.id !== id));
    if (selUser?.id === id) selUser = null;
    confirmDel = null;
  }

  function roleColor(role) {
    if (role === 'admin')      return '#1d4ed8';
    if (role === 'gerente')    return '#7c3aed';
    if (role === 'vendedor')   return '#1a6b44';
    return 'var(--ink-soft)';
  }
  function roleBg(role) {
    if (role === 'admin')      return '#eff6ff';
    if (role === 'gerente')    return '#f5f3ff';
    if (role === 'vendedor')   return '#edfaf4';
    return 'var(--panel-2)';
  }
</script>

<div class="page">
  <div class="page-hd">
    <div class="page-title">Administração</div>
    <div class="tabs">
      <button class="tab" class:on={tab === 'users'} on:click={() => (tab = 'users')}>Usuários</button>
      <button class="tab" class:on={tab === 'roles'} on:click={() => (tab = 'roles')}>Perfis de acesso</button>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════ USERS ══ -->
  {#if tab === 'users'}
    <div class="split">

      <!-- User list -->
      <div class="list-col">
        <div class="list-hd">
          <span class="list-count">
            {$appUsers.length === 0 ? 'Nenhum usuário' :
             $appUsers.length === 1 ? '1 usuário' : `${$appUsers.length} usuários`}
          </span>
          <button class="btn amber sm" on:click={openNew}>+ Novo</button>
        </div>

        {#if $appUsers.length === 0}
          <p class="list-empty">Nenhum usuário cadastrado.</p>
        {:else}
          {#each $appUsers as u (u.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="user-row" class:sel={selUser?.id === u.id}
                 class:inactive={!u.ativo}
                 on:click={() => (selUser = u)}>
              <div class="user-avatar"
                   style="background:{roleBg(u.role)};color:{roleColor(u.role)}">
                {u.nome.trim()[0]?.toUpperCase() ?? '?'}
              </div>
              <div class="user-info">
                <span class="user-nome">
                  {u.nome}{u.sobrenome ? ` ${u.sobrenome}` : ''}
                  {#if u.codigo && u.role === 'vendedor'}
                    <span class="user-code">{u.codigo}</span>
                  {/if}
                </span>
                <span class="user-email">{u.email}{#if u.telefone} · {u.telefone}{/if}</span>
              </div>
              <span class="role-badge"
                    style="background:{roleBg(u.role)};color:{roleColor(u.role)}">
                {ROLE_MAP[u.role] ?? u.role}
              </span>
              {#if !u.ativo}
                <span class="inactive-badge">Inativo</span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Detail / form panel -->
      <div class="detail-col">
        {#if formMode}
          <!-- Edit / New form -->
          <div class="form-hd">
            <span class="form-title">{formMode === 'new' ? 'Novo usuário' : 'Editar usuário'}</span>
            <button class="icon-close" on:click={closeForm}>×</button>
          </div>

          <div class="form-body">

            <!-- Identificação -->
            <p class="fsec">Identificação</p>
            <div class="field-row">
              <label class="field">
                <span>Nome *</span>
                <input class="inp" bind:value={form.nome} placeholder="João" />
              </label>
              <label class="field">
                <span>Sobrenome</span>
                <input class="inp" bind:value={form.sobrenome} placeholder="Silva" />
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>E-mail *</span>
                <input class="inp" type="email" bind:value={form.email} placeholder="joao@empresa.com" />
              </label>
              {#if form.role === 'vendedor'}
                <label class="field field-code">
                  <span>Código *</span>
                  <input class="inp" bind:value={form.codigo} placeholder="V01" maxlength="10" />
                </label>
              {:else}
                <label class="field field-code">
                  <span>Código <em>(opc.)</em></span>
                  <input class="inp" bind:value={form.codigo} placeholder="ADM01" maxlength="10" />
                </label>
              {/if}
            </div>
            <div class="field-row">
              <label class="field">
                <span>Telefone</span>
                <input class="inp" type="tel" bind:value={form.telefone} placeholder="(11) 9999-9999" />
              </label>
              <label class="field">
                <span>WhatsApp <em>(opc.)</em></span>
                <input class="inp" type="tel" bind:value={form.whatsapp} placeholder="(11) 9999-9999" />
              </label>
            </div>

            <!-- Perfil -->
            <p class="fsec">Perfil de acesso</p>
            <label class="field">
              <span>Perfil</span>
              <select class="inp" bind:value={form.role}>
                {#each ROLES as r}<option value={r.key}>{r.label}</option>{/each}
              </select>
            </label>
            <div class="role-preview" style="background:{roleBg(form.role)}">
              <span class="role-preview-name" style="color:{roleColor(form.role)}">{ROLE_MAP[form.role]}</span>
              <span class="role-preview-desc">{ROLES.find(r => r.key === form.role)?.desc ?? ''}</span>
            </div>

            <!-- Endereço -->
            <p class="fsec">Endereço <span class="fsec-opt">(opcional)</span></p>
            <div class="field-row">
              <label class="field field-cep">
                <span>CEP</span>
                <input class="inp" bind:value={form.cep} placeholder="00000-000" maxlength="9"
                       on:blur={buscarCep} />
              </label>
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
                  Buscar
                {/if}
              </button>
            </div>
            <label class="field">
              <span>Logradouro</span>
              <input class="inp" bind:value={form.logradouro} placeholder="Rua, Avenida…" />
            </label>
            <div class="field-row">
              <label class="field field-num">
                <span>Número</span>
                <input class="inp" bind:value={form.numero} placeholder="123" />
              </label>
              <label class="field">
                <span>Complemento</span>
                <input class="inp" bind:value={form.complemento} placeholder="Apto 4…" />
              </label>
            </div>
            <label class="field">
              <span>Bairro</span>
              <input class="inp" bind:value={form.bairro} placeholder="Centro" />
            </label>
            <div class="field-row">
              <label class="field">
                <span>Cidade</span>
                <input class="inp" bind:value={form.cidade} placeholder="São Paulo" />
              </label>
              <label class="field field-uf">
                <span>UF</span>
                <select class="inp" bind:value={form.uf}>
                  <option value="">—</option>
                  {#each UFS as uf}<option value={uf}>{uf}</option>{/each}
                </select>
              </label>
            </div>

            <!-- Status e ações -->
            <p class="fsec">Status</p>
            <label class="field field-check">
              <input type="checkbox" bind:checked={form.ativo} />
              <span>Usuário ativo</span>
            </label>
            {#if formError}
              <p class="form-error">{formError}</p>
            {/if}
            <div class="form-actions">
              <button class="btn line" on:click={closeForm}>Cancelar</button>
              <button class="btn amber" on:click={saveUser}>
                {formMode === 'new' ? 'Criar usuário' : 'Salvar alterações'}
              </button>
            </div>
            <p class="form-note">Autenticação por senha será habilitada em versão futura.</p>
          </div>

        {:else if selUser}
          <!-- User detail -->
          <div class="form-hd">
            <span class="form-title">Detalhes</span>
            <div style="display:flex;gap:6px">
              <button class="btn sm line" on:click={() => openEdit(selUser)}>Editar</button>
              <button class="icon-close" on:click={() => (selUser = null)}>×</button>
            </div>
          </div>

          <div class="form-body">
            <div class="detail-avatar"
                 style="background:{roleBg(selUser.role)};color:{roleColor(selUser.role)}">
              {selUser.nome.trim()[0]?.toUpperCase() ?? '?'}
            </div>
            <div class="detail-name">{selUser.nome}{selUser.sobrenome ? ` ${selUser.sobrenome}` : ''}</div>
            <div class="detail-contact">
              <span>{selUser.email}</span>
              {#if selUser.telefone}<span>{selUser.telefone}</span>{/if}
              {#if selUser.whatsapp}<span>WhatsApp: {selUser.whatsapp}</span>{/if}
              {#if selUser.codigo}<span class="detail-codigo">Cód. {selUser.codigo}</span>{/if}
            </div>

            <div class="detail-role"
                 style="background:{roleBg(selUser.role)};color:{roleColor(selUser.role)}">
              {ROLE_MAP[selUser.role] ?? selUser.role}
            </div>
            <p class="detail-role-desc">
              {ROLES.find(r => r.key === selUser.role)?.desc ?? ''}
            </p>

            <div class="detail-status">
              Status:
              <span class:ok={selUser.ativo} class:danger={!selUser.ativo}>
                {selUser.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div class="detail-actions">
              <button class="btn line sm" on:click={() => toggleActive(selUser)}>
                {selUser.ativo ? 'Desativar' : 'Reativar'}
              </button>
              {#if confirmDel === selUser.id}
                <span class="del-confirm">Excluir permanentemente?</span>
                <button class="btn danger sm" on:click={() => deleteUser(selUser.id)}>Sim</button>
                <button class="btn line sm" on:click={() => (confirmDel = null)}>Não</button>
              {:else}
                <button class="btn danger sm" on:click={() => (confirmDel = selUser.id)}>Excluir</button>
              {/if}
            </div>

            <p class="detail-created">
              Cadastrado em {new Date(selUser.createdAt).toLocaleDateString('pt-BR',
                { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>

        {:else}
          <div class="detail-placeholder">
            <svg viewBox="0 0 40 40" width="36" height="36" fill="none"
                 stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".3">
              <path d="M20 4 6 11v10c0 9 6 15 14 18 8-3 14-9 14-18V11L20 4z"/>
              <circle cx="20" cy="20" r="5"/>
            </svg>
            <p>Selecione um usuário ou crie um novo</p>
          </div>
        {/if}
      </div>
    </div>

  <!-- ══════════════════════════════════════════════════════════ ROLES ══ -->
  {:else}
    <div class="roles-body">

      <!-- Role cards -->
      <div class="roles-grid">
        {#each ROLES as r}
          <div class="role-card">
            <div class="rc-hd">
              <span class="rc-badge" style="background:{roleBg(r.key)};color:{roleColor(r.key)}">
                {r.label}
              </span>
            </div>
            <p class="rc-desc">{r.desc}</p>
            <div class="rc-count">
              {#if $appUsers.filter(u => u.role === r.key).length > 0}
                {@const n = $appUsers.filter(u => u.role === r.key).length}
                {n} usuário{n !== 1 ? 's' : ''} com este perfil
              {:else}
                Nenhum usuário
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Module access table -->
      <div class="card">
        <div class="card-hd"><span class="card-title">Matriz de acesso por módulo</span></div>
        <div class="tbl-wrap">
          <table class="access-tbl">
            <thead>
              <tr>
                <th>Módulo</th>
                {#each ROLES as r}
                  <th class="c" style="color:{roleColor(r.key)}">{r.label}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each MODULE_ACCESS as row}
                <tr>
                  <td>{row.module}</td>
                  <td class="c">{row.admin      ? '✓' : '—'}</td>
                  <td class="c">{row.gerente     ? '✓' : '—'}</td>
                  <td class="c">{row.vendedor    ? '✓' : '—'}</td>
                  <td class="c">{row.assistente  ? '✓' : '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="tbl-note">Controle de acesso por perfil será aplicado na versão multi-usuário.</p>
      </div>

    </div>
  {/if}
</div>

<style>
  /* ── Page shell ─────────────────────────────────────────────────────────── */
  .page    { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .page-hd { display: flex; align-items: center; gap: 16px; padding: 14px 24px;
             border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .page-title { font-size: 16px; font-weight: 600; }
  .tabs  { display: flex; gap: 2px; }
  .tab   { height: 32px; padding: 0 14px; border-radius: 6px; font-size: 13px;
           font-weight: 500; background: none; border: 1px solid transparent;
           cursor: pointer; color: var(--ink-soft); }
  .tab.on { background: var(--panel-2); border-color: var(--line); color: var(--ink); }
  .tab:hover:not(.on) { background: var(--panel-2); }

  /* ── Users split ─────────────────────────────────────────────────────────── */
  .split { flex: 1; display: flex; overflow: hidden; min-height: 0; }

  .list-col { width: 300px; flex-shrink: 0; border-right: 1px solid var(--line);
              overflow-y: auto; display: flex; flex-direction: column; background: var(--panel-2); }

  .list-hd { display: flex; align-items: center; justify-content: space-between;
             padding: 14px 16px; border-bottom: 1px solid var(--line);
             background: var(--panel); position: sticky; top: 0; z-index: 1; }
  .list-count { font-size: 12px; color: var(--ink-soft); }
  .list-empty { padding: 20px 16px; font-size: 13px; color: var(--ink-faint); margin: 0; }

  .user-row { display: flex; align-items: center; gap: 10px; padding: 10px 16px;
              cursor: pointer; border-bottom: 1px solid var(--line); background: var(--panel);
              transition: background .1s; }
  .user-row:hover { background: var(--panel-2); }
  .user-row.sel   { background: var(--amber-soft); }
  .user-row.inactive { opacity: .5; }

  .user-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex;
                 align-items: center; justify-content: center; font-size: 13px;
                 font-weight: 700; flex-shrink: 0; }
  .user-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .user-nome   { font-size: 13px; font-weight: 600; white-space: nowrap;
                 overflow: hidden; text-overflow: ellipsis; }
  .user-email  { font-size: 11.5px; color: var(--ink-soft); white-space: nowrap;
                 overflow: hidden; text-overflow: ellipsis; }

  .role-badge    { font-size: 10.5px; font-weight: 600; border-radius: 4px;
                   padding: 2px 6px; white-space: nowrap; flex-shrink: 0; }
  .inactive-badge { font-size: 10px; background: var(--panel-3); color: var(--ink-faint);
                    border-radius: 4px; padding: 2px 5px; }

  /* ── Detail column ──────────────────────────────────────────────────────── */
  .detail-col { flex: 1; overflow-y: auto; display: flex; flex-direction: column;
                background: var(--panel); }

  .form-hd { display: flex; align-items: center; justify-content: space-between;
             padding: 16px 20px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
  .form-title { font-size: 14px; font-weight: 600; }

  .icon-close { width: 28px; height: 28px; border: none; background: none; cursor: pointer;
                font-size: 18px; color: var(--ink-soft); border-radius: 6px; line-height: 1;
                display: flex; align-items: center; justify-content: center; }
  .icon-close:hover { background: var(--panel-2); color: var(--ink); }

  .form-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; flex: 1; }

  .field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px;
           font-weight: 500; color: var(--ink-soft); flex: 1; min-width: 0; }
  .field em { font-style: normal; font-weight: 400; color: var(--ink-faint); }
  .field-check { flex-direction: row; align-items: center; gap: 8px; flex: none; }
  .field-check span { font-size: 13px; font-weight: 400; color: var(--ink); }
  .field-row  { display: flex; gap: 10px; align-items: flex-end; }
  .field-code { flex: 0 0 80px; }
  .field-cep  { flex: 0 0 100px; }
  .field-num  { flex: 0 0 72px; }
  .field-uf   { flex: 0 0 68px; }

  .fsec { margin: 8px 0 2px; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .7px; color: var(--ink-faint); padding-top: 8px;
          border-top: 1px solid var(--line); }
  .fsec:first-child { border-top: none; margin-top: 0; padding-top: 0; }
  .fsec-opt { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--ink-faint); }

  .btn-api { height: 32px; padding: 0 10px; border-radius: 6px; font-size: 12px;
             font-weight: 500; background: var(--panel-2); border: 1px solid var(--line);
             color: var(--ink-soft); cursor: pointer; display: inline-flex;
             align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0;
             align-self: flex-end; font-family: inherit; margin-bottom: 0;
             transition: background .12s, border-color .12s, color .12s; }
  .btn-api:hover:not(:disabled) { background: var(--panel-3); border-color: var(--amber); color: var(--amber-deep); }
  .btn-api:disabled { cursor: not-allowed; opacity: .55; color: var(--ink-faint); }
  .btn-api.loading { cursor: wait; opacity: .8; color: var(--amber-deep); }

  @keyframes api-spin { to { transform: rotate(360deg); } }
  .spin {
    display: inline-block; width: 12px; height: 12px;
    border: 2px solid var(--line); border-top-color: var(--amber);
    border-radius: 50%; animation: api-spin .6s linear infinite;
  }

  .role-preview { border-radius: 7px; padding: 12px 14px; display: flex;
                  flex-direction: column; gap: 4px; }
  .role-preview-name { font-size: 13px; font-weight: 700; }
  .role-preview-desc { font-size: 12px; color: var(--ink-soft); line-height: 1.5; }

  .form-error  { margin: 0; font-size: 12.5px; color: var(--danger); }
  .form-actions { display: flex; gap: 8px; }
  .form-note { margin: 0; font-size: 11.5px; color: var(--ink-faint); font-style: italic; }

  .detail-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center;
                        justify-content: center; gap: 10px; color: var(--ink-faint); }
  .detail-placeholder p { font-size: 13px; margin: 0; }

  .detail-avatar { width: 56px; height: 56px; border-radius: 50%; display: flex;
                   align-items: center; justify-content: center; font-size: 22px;
                   font-weight: 700; align-self: flex-start; }
  .detail-name  { font-size: 17px; font-weight: 700; }
  .user-code { font-family: var(--mono); font-size: 10.5px; background: var(--panel-2);
               border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px;
               color: var(--ink-soft); margin-left: 5px; }

  .detail-contact { display: flex; flex-direction: column; gap: 3px; }
  .detail-contact span { font-size: 13px; color: var(--ink-soft); }
  .detail-codigo { font-family: var(--mono); font-size: 12px; font-weight: 600;
                   color: var(--ink) !important; }
  .detail-email { font-size: 13px; color: var(--ink-soft); }
  .detail-role  { font-size: 12px; font-weight: 700; border-radius: 5px;
                  padding: 3px 10px; display: inline-block; }
  .detail-role-desc { margin: 0; font-size: 13px; color: var(--ink-soft); line-height: 1.5; }
  .detail-status { font-size: 13px; color: var(--ink-soft); }
  .detail-status .ok     { color: var(--ok); font-weight: 600; }
  .detail-status .danger { color: var(--danger); font-weight: 600; }
  .detail-actions { display: flex; align-items: center; gap: 8px; }
  .del-confirm { font-size: 12.5px; color: var(--danger); font-weight: 500; }
  .detail-created { margin: 0; font-size: 11.5px; color: var(--ink-faint); }

  /* ── Roles tab ──────────────────────────────────────────────────────────── */
  .roles-body { flex: 1; overflow-y: auto; padding: 20px 24px;
                display: flex; flex-direction: column; gap: 16px; }

  .roles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }

  .role-card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r);
               padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .rc-hd    { display: flex; }
  .rc-badge { font-size: 12px; font-weight: 700; border-radius: 5px; padding: 3px 10px; }
  .rc-desc  { margin: 0; font-size: 12.5px; color: var(--ink-soft); line-height: 1.5; flex: 1; }
  .rc-count { font-size: 11.5px; color: var(--ink-faint); }

  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r);
          padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .card-hd    { display: flex; align-items: center; }
  .card-title { font-size: 13px; font-weight: 600; }

  .tbl-wrap { overflow-x: auto; }
  .access-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .access-tbl th { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase;
                   letter-spacing: .4px; padding: 7px 10px; font-weight: 600;
                   border-bottom: 1px solid var(--line); text-align: left; }
  .access-tbl td { padding: 8px 10px; border-top: 1px solid var(--line); }
  .access-tbl .c { text-align: center; font-size: 13px; color: var(--ok); }
  .access-tbl tbody tr:hover td { background: var(--panel-2); }
  .tbl-note { margin: 0; font-size: 11.5px; color: var(--ink-faint); font-style: italic; }

  /* ── Shared ─────────────────────────────────────────────────────────────── */
  .inp { height: 34px; border: 1px solid var(--line); border-radius: 6px;
         padding: 0 10px; font-size: 13px; background: var(--panel);
         width: 100%; box-sizing: border-box; }
  .inp:focus { outline: none; border-color: var(--amber); }

  .btn { height: 34px; padding: 0 16px; border-radius: 7px; font-weight: 500;
         font-size: 13px; border: 1px solid transparent; cursor: pointer; }
  .btn.sm { height: 30px; font-size: 12px; padding: 0 12px; }
  .amber  { background: var(--amber); color: #fff; border-color: var(--amber); }
  .amber:hover { background: #d67d12; }
  .line   { background: var(--panel); border-color: var(--line); color: var(--ink); }
  .line:hover { background: var(--panel-2); }
  .danger { background: var(--panel); border-color: #e05252; color: #c0392b; }
  .danger:hover { background: #fff4f4; }
</style>
