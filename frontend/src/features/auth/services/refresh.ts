import { api } from '@/services/api'
import type { LoginResponse } from '@/types/login-response'

export async function refresh() {
  const { data } = await api.post<LoginResponse>('/auth/refresh')

  return data.accessToken
}
