import type { UserData } from '@/types/UserData.type'
import { api } from '../api'
import type { StatusDocument } from '@/shared/types/status-document'

interface ListDocumentsResponse {
  pagination: Pagination
  documents: ListDocumentsData[]
}

interface ListDocumentsData {
  id: string
  fileName: string
  size: number
  pageCount: number
  status: StatusDocument
  createdAt: string
}

interface Pagination {
  totalPage: number
  total: number
  perPage: number
  page: number
  hasNext: boolean
  hasPrev: boolean
}

interface FilterDocuments {
  fileName?: string
  status?: StatusDocument
  page?: number
  limit?: number
}

export async function listDocuments(filter?: FilterDocuments) {
  const { data } = await api.get<ListDocumentsResponse>('/documents', {
    params: {
      ...filter,
    },
  })

  return data
}
