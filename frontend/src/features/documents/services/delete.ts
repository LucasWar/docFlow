import { api } from '@/services/api'

export async function deleteDocument(documentId: string) {
  await api.delete(`documents/${documentId}`)
}
