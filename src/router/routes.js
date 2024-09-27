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
        props: true, // 傳遞 groupName
      },
      {
        path: '/group/:groupName/analysis',
        name: 'analysis',
        component: () => import('pages/ExpenseAnalysis.vue'),
        meta: { requiresAuth: true },
        props: true, // 傳遞 groupName
      },
      {
        path: '/group/:groupName/settlement',
        name: 'settlement',
        component: () => import('src/pages/SpendingResults.vue'),
        meta: { requiresAuth: true },
        props: true, // 傳遞 groupName
      },
      {
        path: '/group/:groupName/members',
        name: 'members',
        component: () => import('src/pages/GroupMembers.vue'),
        meta: { requiresAuth: true },
        props: true, // 傳遞 groupName
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
