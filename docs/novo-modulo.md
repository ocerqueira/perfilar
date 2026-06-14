# Como adicionar um novo módulo

Um módulo é uma entrada na sidebar com rota própria. São 3 passos.

## 1. Criar a pasta e a página

```
src/modules/<nome>/
  <Nome>Page.svelte     ← componente raiz da rota
```

Estrutura mínima do `<Nome>Page.svelte`:

```svelte
<div class="page">
  <!-- conteúdo -->
</div>

<style>
  .page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
</style>
```

O `height: 100%` com `overflow: hidden` garante que a área de conteúdo ocupe o espaço disponível sem vazar o scroll para o shell.

## 2. Registrar a rota

Em `src/router/routes.js`, importe a página e adicione uma entrada no array `routes`:

```js
import FooPage from '../modules/foo/FooPage.svelte'; // [!code ++]

export const routes = [
  // ...
  { path: 'foo', label: 'Foo', component: FooPage, group: 'comercial' }, // [!code ++]
];
```

**`group`** controla em qual seção da sidebar o item aparece:

| Valor | Seção |
|-------|-------|
| `'work'` | Trabalho |
| `'comercial'` | Comercial |
| `'cadastros'` | Cadastros |
| `null` | Fixado no rodapé da sidebar (como Config) |

## 3. Adicionar o ícone

Em `src/App.svelte`, o objeto `ICONS` mapeia `path → SVG inner paths`. A chave deve ser idêntica ao `path` da rota.

```js
const ICONS = {
  // ...
  foo: `<rect x="3" y="3" width="14" height="14" rx="2"/>`, // [!code ++]
};
```

Os ícones usam viewport `20×20`, stroke `currentColor`, sem fill. Ficam melhor com traços simples e sem detalhes finos — a altura de exibição é 16 px.

---

Após os 3 passos o módulo já aparece na sidebar e é acessível via `#foo`.
