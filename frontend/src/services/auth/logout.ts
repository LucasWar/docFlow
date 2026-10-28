import { api } from '../api'
import type { LoginResponse } from '@/types/login-response'

export async function logout() {
  await api.post('/auth/logout')
}
