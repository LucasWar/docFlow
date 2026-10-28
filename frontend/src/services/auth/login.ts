import type { LoginData } from '@/types/login-data.type'
import { api } from '../api'
import type { LoginResponse } from '@/types/login-response'

export async function login(credentials: LoginData) {
  const { data } = await api.post<LoginResponse>('/auth/login', credentials)

  return data
}
