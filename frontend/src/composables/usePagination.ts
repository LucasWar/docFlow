import { computed, ref, watch, type Ref } from 'vue'

export function usePagination<T>(items: Ref<T[]>, initialPageSize = 8) {
  const page = ref(1)
  const pageSize = ref(initialPageSize)

  const total = computed(() => items.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  const paginatedItems = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return items.value.slice(start, start + pageSize.value)
  })

  const from = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
  const to = computed(() => Math.min(page.value * pageSize.value, total.value))

  watch([total, pageSize], () => {
    page.value = 1
  })

  watch(totalPages, (value) => {
    if (page.value > value) page.value = value
  })

  return { page, pageSize, total, totalPages, paginatedItems, from, to }
}
