import { documentsService } from '@/services/documents'
import { StatusDocument } from '@/shared/types/status-document'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'

interface FilterDocuments {
  fileName?: string
  status?: StatusDocument
  page?: number
  limit?: number
}

export function useDocumentController() {
  const currentPage = ref(1)
  const pageSize = ref(12)
  const search = ref('')
  const selectedStatus = ref<StatusDocument | 'all'>('all')

  const filter = computed<FilterDocuments>(() => ({
    fileName: search.value,
    limit: pageSize.value,
    page: currentPage.value,
    status: selectedStatus.value === 'all' ? undefined : selectedStatus.value,
  }))

  const { data, isLoading } = useQuery({
    queryKey: ['listDocuments', filter],
    queryFn: async () => {
      return await documentsService.listDocuments(filter.value)
    },
  })

  async function hanldedownloadDocument(documentId: string) {
    await documentsService.download(documentId)
  }

  const documents = computed(() => data.value?.documents ?? [])
  const pagination = computed(() => data.value?.pagination)

  return {
    documents,
    pagination,
    isLoading,
    currentPage,
    search,
    selectedStatus,
    pageSize,
    hanldedownloadDocument,
  }
}
