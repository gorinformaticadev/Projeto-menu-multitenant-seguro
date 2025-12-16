import React from 'react';
import DemoListPage from './pages/index';
import DemoCreatePage from './pages/create';
import DemoDashboardPage from './pages/dashboard';
import DemoCategoriesPage from './pages/categories';
import DemoTagsPage from './pages/tags';
import DemoEditPage from './pages/edit/[id]';
import DemoViewPage from './pages/[id]/index';

export const ModuleRoutes = [
    { path: '/demo', component: DemoListPage },
    { path: '/demo/create', component: DemoCreatePage },
    { path: '/demo/dashboard', component: DemoDashboardPage },
    { path: '/demo/categories', component: DemoCategoriesPage },
    { path: '/demo/tags', component: DemoTagsPage },
    { path: '/demo/edit/:id', component: DemoEditPage },
    { path: '/demo/:id', component: DemoViewPage },
];
