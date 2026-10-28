import type { UserData } from '@/types/UserData.type'
import { api } from '../api'

export async function me() {
  const { data } = await api.get<UserData>('/users/me')

  return data
}
