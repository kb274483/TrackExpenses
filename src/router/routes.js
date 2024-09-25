const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'), // 主佈局只需要指定一次
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('pages/IndexPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: '/group/:groupName/records',
        name: 'records',
        component: () => import('pages/ExpenseRecords.vue'),
        meta: { requiresAuth: true },
        props: true, // 傳遞 groupName 給 ExpenseRecords.vue
      },
      {
        path: '/group/:groupName/analysis',
        name: 'analysis',
        component: () => import('pages/ExpenseAnalysis.vue'),
        meta: { requiresAuth: true },
        props: true, // 傳遞 groupName 給 ExpenseAnalysis.vue
      },
      {
        path: '/group/:groupName/settlement',
        name: 'settlement',
        component: () => import('pages/Settlement.vue'),
        meta: { requiresAuth: true },
        props: true, // 傳遞 groupName 給 Settlement.vue
      },
    ],
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/LogIn.vue') },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
