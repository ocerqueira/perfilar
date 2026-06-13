<script>
  import { descConfig, companyInfo, printConfig, editorDisplay } from '../../lib/stores.js';
  import { PRESETS } from '../../lib/presets.js';
  import { PRESET_ABBREV_DEFAULT, DESC_TEMPLATE_DEFAULT } from '../../lib/engine.js';

  let tab = 'co'; // 'co' | 'desc' | 'editor'

  // ── Empresa ───────────────────────────────────────────────────────────────
  let co = { ...$companyInfo };
  function saveCo()  { $companyInfo = { ...co }; }
  function resetCo() { co = { nome: '', cnpj: '', tel: '', email: '', endereco: '', site: '' }; $companyInfo = { ...co }; }

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
    </div>
  </div>

  <div class="body">

    <!-- ── Empresa ──────────────────────────────────────────────────────── -->
    {#if tab === 'co'}
      <div class="sec-label">Identificação da empresa</div>
      <div class="co-grid">
        <div class="field co-wide">
          <label>Nome / razão social</label>
          <input class="inp" bind:value={co.nome} placeholder="Ex.: Metalúrgica Exemplo Ltda." />
        </div>
        <div class="field">
          <label>CNPJ</label>
          <input class="inp" bind:value={co.cnpj} placeholder="00.000.000/0001-00" />
        </div>
        <div class="field">
          <label>Telefone / WhatsApp</label>
          <input class="inp" bind:value={co.tel} placeholder="(11) 9 9999-9999" />
        </div>
        <div class="field">
          <label>E-mail</label>
          <input class="inp" bind:value={co.email} placeholder="contato@empresa.com.br" type="email" />
        </div>
        <div class="field">
          <label>Site</label>
          <input class="inp" bind:value={co.site} placeholder="www.empresa.com.br" />
        </div>
        <div class="field co-wide">
          <label>Endereço</label>
          <input class="inp" bind:value={co.endereco} placeholder="Rua das Chapas, 100 — Bairro — Cidade / UF" />
        </div>
      </div>
      <p class="hint mt8">Essas informações aparecem no cabeçalho dos documentos (Plano de corte, Orçamento, Ordem de produção).</p>

      <div class="sec-label mt20">Layout de impressão — Plano de corte</div>
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

      <div class="footer">
        <button class="btn line" on:click={resetCo}>Limpar empresa</button>
        <div style="flex:1"></div>
        <button class="btn amber" on:click={saveCo}>Salvar empresa</button>
      </div>

    <!-- ── Descrição ─────────────────────────────────────────────────────── -->
    {:else if tab === 'desc'}
      <div class="sec-label">Formato da descrição padronizada</div>
      <p class="hint">Clique nos tokens para inserir no formato. Cada token entre chaves é substituído pelo valor do item.</p>
      <div class="token-bar">
        {#each TOKENS as tok}
          <button class="tok-btn" title={TOKEN_DESC[tok]} on:click={() => insertToken(tok)}>{tok}</button>
        {/each}
      </div>
      <input class="inp full mt8" bind:value={descTemplate} placeholder="ex: PU 75×200 · C3000 · t0,65 · GAL Z275" />
      <div class="preview-row">
        <span class="preview-lbl">Prévia:</span>
        <code class="preview-code">{descPreview}</code>
      </div>

      <div class="sec-label mt20">Siglas dos perfis padrão</div>
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
      <p class="hint mt8">Perfis personalizados usam as iniciais do nome quando não há sigla definida aqui. As siglas dos materiais ficam em <b>Matérias-primas → Materiais</b>.</p>

      <div class="footer">
        <button class="btn line" on:click={resetDesc}>Restaurar padrão</button>
        <div style="flex:1"></div>
        <button class="btn amber" on:click={saveDesc}>Salvar</button>
      </div>

    <!-- ── Editor ────────────────────────────────────────────────────────── -->
    {:else if tab === 'editor'}
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

  .body { flex: 1; overflow-y: auto; padding: 24px; max-width: 720px; display: flex; flex-direction: column; gap: 0; }

  .sec-label { font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .8px; color: var(--ink-faint); margin-bottom: 8px; }
  .mt8  { margin-top: 8px; }
  .mt20 { margin-top: 20px; }
  .hint { font-size: 12px; color: var(--ink-faint); margin-top: 6px; line-height: 1.5; }

  /* Empresa */
  .co-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .co-wide { grid-column: 1 / -1; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label { font-size: 11.5px; color: var(--ink-soft); }

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

  .footer { display: flex; gap: 10px; padding-top: 20px; margin-top: auto; border-top: 1px solid var(--line); align-items: center; flex-shrink: 0; }
  .btn { height: 32px; padding: 0 12px; border-radius: 7px; font-weight: 500; font-size: 13px; border: 1px solid transparent; cursor: pointer; }
  .amber { background: var(--amber); color: #fff; border-color: var(--amber); } .amber:hover { background: #d67d12; }
  .line  { background: var(--panel); border-color: var(--line); color: var(--ink); } .line:hover { background: var(--panel-2); }
</style>
