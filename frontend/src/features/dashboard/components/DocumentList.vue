<script setup lang="ts">
import type { DocumentStatus } from '@/features/documents/enums/document-status';
import { documentStatusMapper } from '@/features/documents/mappers/document-status.mapper';
import { cn } from '@/lib/utils';
import { EllipsisVerticalIcon } from 'lucide-vue-next'
defineProps<{
  documents: {
    title: string
    status: DocumentStatus
    date: Date
    size: number
  }[]
}>()
</script>

<template>
  <ul v-if="documents.length" class="space-y-2">
    <li
      v-for="(document, index) in documents"
      :key="`${document.title}-${index}`"
      class="flex items-center justify-between rounded-lg border bg-white p-3"
    >
      <div class="min-w-1/2 flex items-center justify-between">
        <div class="flex flex-col justify-center">
          <p class="truncate font-medium">
            {{ document.title }}
          </p>
          <div class="flex gap-8">
            <p class="text-sm text-gray-500">
              {{ document.date.toLocaleDateString('pt-BR') }}
            </p>
            <p class="text-sm text-gray-500">
              {{ (document.size / 1024).toFixed(1) }} KB
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