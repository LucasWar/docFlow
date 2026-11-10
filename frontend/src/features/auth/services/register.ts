import { api } from '@/services/api'
import type { RegisterPayload } from '../schemas/register'

export async function register(payload: RegisterPayload): Promise<void> {
  console.log(payload)
  await api.post('/auth/register', payload)
}
