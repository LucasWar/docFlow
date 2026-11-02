import { documentsService } from '@/features/documents/services'
import { useQuery } from '@tanstack/vue-query'

export function useDashboardController() {
  const { data: documents, isLoading: loadingDocumets } = useQuery({
    queryKey: ['listResumeDocuments'],
    queryFn: async () => {
      return await documentsService.listDocuments({
        limit: 6,
      })
    },
  })

  const { data, isLoading: loadingResume } = useQuery({
    queryKey: ['resumeDashboard'],
    queryFn: async () => {
      return await documentsService.resume()
    },
  })

  return { numRecords: data, loadingResume, documents, loadingDocumets }
}
