<script setup lang="ts">
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'

withDefaults(
  defineProps<{
    total: number
    from?: number
    to?: number
    pageSizeOptions?: number[]
  }>(),
  { pageSizeOptions: () => [5, 8, 10, 20] },
)

const page = defineModel<number>('page', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <!-- Resumo + itens por página -->
    <div class="flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:items-center sm:gap-4">
      <p>
        <!-- Mostrando
        <span class="font-medium text-gray-700">{{ from }}–{{ to }}</span> -->
        Total
        <span class="font-medium text-gray-700">{{ total }}</span>
      </p>

      <div class="flex items-center gap-2">
        <span class="hidden sm:inline">Por página:</span>
        <Select
          :model-value="String(pageSize)"
          @update:model-value="(v) => (pageSize = Number(v))"
        >
          <SelectTrigger class="h-8 w-20 bg-white" aria-label="Itens por página">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="o in pageSizeOptions" :key="o" :value="String(o)">
              {{ o }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Navegação (componente do shadcn) -->
    <Pagination
      v-slot="{ page: current }"
      v-model:page="page"
      :total="total"
      :items-per-page="pageSize"
      :sibling-count="1"
      show-edges
      class="mx-0 w-auto"
    >
      <PaginationContent v-slot="{ items }">
        <PaginationPrevious />

        <template v-for="(item, index) in items" :key="index">
          <PaginationItem
            v-if="item.type === 'page'"
            :value="item.value"
            as-child
            class="hidden sm:inline-flex"
          >
            <Button
              :variant="item.value === current ? 'default' : 'outline'"
              size="icon"
              class="h-8 w-8 bg-white text-black"
            >
              {{ item.value }}
            </Button>
          </PaginationItem>
          <PaginationEllipsis v-else :index="index" class="hidden sm:flex" />
        </template>

        <PaginationNext />
      </PaginationContent>
    </Pagination>
  </div>
</template>