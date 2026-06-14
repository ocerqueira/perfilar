import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Perfilar — Dev Docs',
  description: 'Documentação técnica do sistema Perfilar',
  lang: 'pt-BR',

  themeConfig: {
    nav: [
      { text: 'Início', link: '/' },
      { text: 'Roadmap', link: '/roadmap' },
    ],

    sidebar: [
      { text: 'Visão geral', link: '/index' },
      { text: 'Arquitetura', link: '/arquitetura' },
      { text: 'Engine', link: '/engine' },
      { text: 'Decisões técnicas', link: '/decisoes' },
      { text: 'Roadmap', link: '/roadmap' },
      {
        text: 'Módulos',
        items: [
          { text: 'Integrações de API', link: '/integracoes' },
          { text: 'Módulo de Prospecção', link: '/prospeccao' },
        ],
      },
      {
        text: 'Guias',
        items: [
          { text: 'Adicionar um módulo', link: '/novo-modulo' },
        ],
      },
    ],

    socialLinks: [],
    search: { provider: 'local' },
  },

  vite: {
    server: { port: 5174 },
  },
})
