import { StatusDocument } from '@/shared/types/status-document'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { documentsService } from '../services'

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

  const queryClient = useQueryClient()

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

  const { mutate: deleteDocumentMutate } = useMutation({
    mutationFn: async (documentId: string) => {
      return await documentsService.deleteDocument(documentId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listDocuments'] })
      toast.success('Documento deletado com sucesso')
    },
    onError: (error) => {
      toast.warning('Error ao deletar documento')
    },
  })

  async function handleDeleteDocument(documentId: string) {
    await deleteDocumentMutate(documentId)
  }

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
    handleDeleteDocument,
  }
}
