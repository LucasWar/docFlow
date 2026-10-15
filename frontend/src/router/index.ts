import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/features/auth/view/Login.vue'
import MenuLayout from '@/layouts/MenuLayout.vue'
import Dashboard from '@/features/dashboard/Dashboard.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      component: Login,
    },
    {
      path: '/',
      component: MenuLayout,
      children: [
        {
          path: '/',
          component: Dashboard,
        },
      ],
    },
  ],
})

export default router
