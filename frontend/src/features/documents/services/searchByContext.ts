import { api } from '@/services/api'

interface SearchByContextResponse {
  id: string
  documentId: string
  fileName: string
  content: string
  pageNumber: number
}

export async function searchByContext(searchText: string) {
  const { data } = await api.post<SearchByContextResponse[]>('/documents/search', { searchText })

  return data
}
