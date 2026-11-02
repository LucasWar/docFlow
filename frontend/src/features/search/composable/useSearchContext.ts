import { documentsService } from '@/features/documents/services'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'

export function useSearchContextController() {
  const search = ref('')
  const debouncedSearch = ref('')
  let timeout: ReturnType<typeof setTimeout>

  watch(search, (newValue) => {
    clearTimeout(timeout)

    timeout = setTimeout(() => {
      debouncedSearch.value = newValue
    }, 500)
  })

  const { data, isPending, isFetching, isError } = useQuery({
    queryKey: ['records', debouncedSearch],

    queryFn: async () => {
      return await documentsService.searchByContext(debouncedSearch.value)
    },

    enabled: () => debouncedSearch.value.length >= 3,
  })

  const records = computed(() => data.value ?? [])

  return {
    records,
    isPending,
    search,
  }
}
