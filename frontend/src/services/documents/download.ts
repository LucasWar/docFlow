import { api } from '../api'

interface DownloadResponse {
  url: string
}

export async function download(documentId: string) {
  const { data } = await api.get<DownloadResponse>(`documents/${documentId}/download`)

  const a = document.createElement('a')
  a.href = data.url
  document.body.appendChild(a)
  a.click()
  a.remove()
}
