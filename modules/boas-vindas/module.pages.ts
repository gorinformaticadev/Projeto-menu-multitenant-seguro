/**
 * PÁGINAS DO MÓDULO BOAS-VINDAS
 * 
 * Define as páginas disponíveis no módulo
 */

export const modulePages = [
  {
    id: 'boas-vindas.tutorial',
    path: '/boas-vindas/frontend/pages/',
    component: 'TutorialPage',
    protected: false,
    permissions: [],
    title: 'Tutorial',
    description: 'Tutorial de introdução ao sistema'
  }
] as const;
