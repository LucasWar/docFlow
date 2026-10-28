import { api } from '../api'

interface ResumeResponse {
  numPages: number
  numChuncks: number
  numDocuments: number
}

export async function resume() {
  const { data } = await api.get<ResumeResponse>('/documents/resume')

  return data
}
