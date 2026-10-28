import { createRouter, createWebHistory } from 'vue-router'

import Login from '@/features/auth/view/Login.vue'
import MenuLayout from '@/layouts/MenuLayout.vue'
import Dashboard from '@/features/dashboard/Dashboard.vue'
import Documents from '@/features/documents/Documents.vue'
import SearchLN from '@/features/search/SearchLN.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login,
    },
    {
      path: '/',
      component: MenuLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: Dashboard,
        },
        {
          path: 'documents',
          name: 'documents',
          component: Documents,
        },
        {
          path: 'search',
          name: 'search',
          component: SearchLN,
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Restaura o user se houver token (reload, aba reaberta)
  if (auth.accessToken && !auth.user) {
    await auth.fetchUser() // faz logout() internamente se a sessão for inválida
  }

  const isAuthenticated = !!auth.user
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (requiresAuth && !isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.name === 'login' && isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router
