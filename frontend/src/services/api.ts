import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { authService } from './auth'
import { useRouter } from 'vue-router'

const router = useRouter()

export const api = axios.create({
  baseURL: 'http://localhost:3000/',
  timeout: 5000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('accessToken')

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    } else {
      delete config.headers.Authorization
    }

    return config
  },
  (error) => Promise.reject(error),
)

let refreshPromise: Promise<string> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const auth = useAuthStore()

    const isAuthRoute =
      original.url?.includes('/auth/refresh') || original.url?.includes('/auth/login')

    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true

      try {
        refreshPromise ??= authService.refresh().finally(() => (refreshPromise = null))
        const newToken = await refreshPromise

        auth.setToken(newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original) // repete a requisição original
      } catch {
        auth.logout()
        router.push('/login')
      }
    }

    return Promise.reject(error)
  },
)
