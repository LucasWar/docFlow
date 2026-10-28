<script setup lang="ts">
import { documentStatusMapper } from '@/features/documents/mappers/document-status.mapper';
import { formatarData } from '@/lib/fomat-data';
import { cn } from '@/lib/utils';
import type { StatusDocument } from '@/shared/types/status-document';
import { EllipsisVerticalIcon } from 'lucide-vue-next'

defineProps<{
  documents: {
    id: string
    fileName: string
    size: number
    pageCount: number
    status: StatusDocument
    createdAt: string
  }[]
}>()
</script>

<template>
  <ul v-if="documents.length" class="space-y-2">
    <li
      v-for="document in documents"
      :key="`${document.id}`"
      class="flex items-center justify-between rounded-lg border bg-white p-3"
    >
      <div class="min-w-1/2 flex items-center justify-between">
        <div class="flex flex-col justify-center">
          <p class="truncate font-medium">
            {{ document.fileName }}
          </p>
          <div class="flex gap-8">
            <p class="text-sm text-gray-500">
              {{ formatarData(document.createdAt) }}
            </p>
            <p class="text-sm text-gray-500">
              {{ document.size.toFixed(2) }} KB
            </p>
          </div>
        </div>
        <p :class="cn('flex items-center gap-1 text-sm bg-green-400 rounded-2xl p-1 font-medium text-white', documentStatusMapper[document.status].class)">
          <component :is="documentStatusMapper[document.status].icon" class="h-3.5 w-3.5" /> {{ documentStatusMapper[document.status].label}}
        </p>
      </div>

      <button
        type="button"
        class="ml-4"
      >
        <EllipsisVerticalIcon />
      </button>
    </li>
  </ul>

  <p v-else class="p-4 text-center text-gray-500">
    Nenhum documento adicionado.
  </p>
</template>