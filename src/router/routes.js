import EditorPage    from '../modules/editor/EditorPage.svelte';
import OrdersPage    from '../modules/orders/OrdersPage.svelte';
import ClientsPage   from '../modules/clients/ClientsPage.svelte';
import ProductsPage  from '../modules/products/ProductsPage.svelte';
import MaterialsPage from '../modules/materials/MaterialsPage.svelte';
import PricingPage   from '../modules/pricing/PricingPage.svelte';
import CutPlanPage   from '../modules/cutplan/CutPlanPage.svelte';
import SettingsPage  from '../modules/settings/SettingsPage.svelte';

export const navGroups = [
  { key: 'work',      label: 'Trabalho'  },
  { key: 'comercial', label: 'Comercial' },
  { key: 'cadastros', label: 'Cadastros' },
];

export const routes = [
  { path: 'editor',    label: 'Editor',    component: EditorPage,    group: 'work'      },
  { path: 'cutplan',   label: 'Corte',     component: CutPlanPage,   group: 'work'      },
  { path: 'orders',    label: 'Pedidos',   component: OrdersPage,    group: 'comercial' },
  { path: 'pricing',   label: 'Preços',    component: PricingPage,   group: 'comercial' },
  { path: 'clients',   label: 'Clientes',  component: ClientsPage,   group: 'cadastros' },
  { path: 'products',  label: 'Produtos',  component: ProductsPage,  group: 'cadastros' },
  { path: 'materials', label: 'Materiais', component: MaterialsPage, group: 'cadastros' },
  { path: 'settings',  label: 'Config',    component: SettingsPage,  group: null        },
];
