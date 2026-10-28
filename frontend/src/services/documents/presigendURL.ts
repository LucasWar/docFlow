import { api } from '../api'

interface FileData {
  fileName: string
  type: string
  size: number
}

interface PresignedURLResponse {
  url: string
}
export async function presignedURL(file: FileData) {
  const { data } = await api.post<PresignedURLResponse>('/documents/upload', file)

  return data.url
}
