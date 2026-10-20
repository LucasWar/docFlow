<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Table from '@/components/ui/table/Table.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import {
  SearchIcon,
  UploadIcon,
  EllipsisVerticalIcon,
  FileTextIcon,
} from '@lucide/vue'
import { cn } from 'cn'
import { documentStatusMapper } from '../mappers/document-status.mapper'
import { DocumentStatus } from '../enums/document-status'
import AppPagination from '@/components/AppPagination.vue'
import { usePagination } from '@/composables/usePagination'

const statuses = Object.values(DocumentStatus)

const emit = defineEmits<{
  upload: []
}>()

// Dados de exemplo (substitua pela sua fonte real)
const documentsList = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Contrato de prestação de serviços ${i + 1}.pdf`,
  size: 40,
  numPages: 20,
  status: DocumentStatus.COMPLETED,
  dateUpload: new Date(),
}))

// Filtros
const search = ref('')
const selectedStatus = ref<string>('all')

const filteredDocuments = computed(() =>
  documentsList.filter((doc) => {
    const matchesName = doc.name.toLowerCase().includes(search.value.toLowerCase())
    const matchesStatus =
      selectedStatus.value === 'all' || doc.status === selectedStatus.value
    return matchesName && matchesStatus
  }),
)

//Isso aqui vai ser substituido pela chamada da API
const { page, pageSize, total, totalPages, paginatedItems, from, to } =
  usePagination(filteredDocuments, 8)

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
</script>

<template>
  <div class="flex min-h-full flex-col gap-6 p-4 md:p-6 xl:p-8">
    <header class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold text-background md:text-3xl">Documentos</h1>
        <p class="text-base font-medium text-gray-500 md:text-lg">
          Gerencie seus documentos, acompanhe o processamento e organize seu conteúdo.
        </p>
      </div>


      <div class="flex w-full flex-col gap-3 xl:w-150">
        <div class="flex flex-col gap-3 sm:flex-row">
          <Button class="h-10 shrink-0 gap-2 bg-blue-500 hover:bg-blue-600"  @click="emit('upload')">
            <UploadIcon class="h-4 w-4" />
            <span>Fazer upload</span>
          </Button>

          <div class="relative w-full">
            <SearchIcon
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            />
            <Input
              v-model="search"
              class="h-10 w-full bg-white pl-10"
              placeholder="Pesquise aqui seus documentos"
            />
          </div>
        </div>

        <div class="flex sm:justify-end">
          <Select v-model="selectedStatus">
            <SelectTrigger class="w-full bg-white sm:w-56">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem v-for="status in statuses" :key="status" :value="status">
                {{ documentStatusMapper[status].label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>

    <div
      v-if="filteredDocuments.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-white py-16 text-center"
    >
      <FileTextIcon class="h-10 w-10 text-gray-300" />
      <p class="font-medium text-gray-600">Nenhum documento encontrado</p>
      <p class="text-sm text-gray-400">Tente ajustar a busca ou o filtro de status.</p>
    </div>

    <template v-else>

      <ul class="flex flex-col gap-3 md:hidden">
        <li
          v-for="doc in filteredDocuments"
          :key="doc.id"
          class="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <div class="rounded-lg bg-blue-50 p-2 text-blue-600">
                <FileTextIcon class="h-5 w-5" />
              </div>
              <span class="truncate font-medium text-gray-800">{{ doc.name }}</span>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              aria-label="Ações do documento"
            >
              <EllipsisVerticalIcon class="h-5 w-5" />
            </button>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
            <span
              :class="cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                documentStatusMapper[doc.status].class,
              )"
            >
              <component :is="documentStatusMapper[doc.status].icon" class="h-3.5 w-3.5" />
              {{ documentStatusMapper[doc.status].label }}
            </span>
            <span>{{ doc.size }} MB · {{ doc.numPages }} págs.</span>
            <span>{{ formatDate(doc.dateUpload) }}</span>
          </div>
        </li>
      </ul>


      <div class="hidden overflow-hidden rounded-xl border bg-white shadow-sm md:block">
        <Table>
          <TableHeader class="bg-gray-50">
            <TableRow class="hover:bg-gray-50">
              <TableHead class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Nome
              </TableHead>
        
              <TableHead class="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">
                Tamanho
              </TableHead>
              <TableHead class="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">
                Páginas
              </TableHead>
              <TableHead class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </TableHead>
              <TableHead class="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 xl:table-cell">
                Data de upload
              </TableHead>
              <TableHead class="w-12 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span class="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            <TableRow
              v-for="doc in filteredDocuments"
              :key="doc.id"
              class="transition-colors hover:bg-blue-50/40"
            >
              <TableCell class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="shrink-0 rounded-lg bg-orange-50 p-2 text-orange-600">
                    <FileTextIcon class="h-4 w-4" />
                  </div>
                  <div class="flex min-w-0 flex-col">
                    <span class="max-w-48 truncate font-medium text-gray-800 lg:max-w-72 xl:max-w-96">
                      {{ doc.name }}
                    </span>
              
                    <span class="text-xs text-gray-400 lg:hidden">
                      {{ doc.size }} MB · {{ doc.numPages }} págs.
                    </span>
                  </div>
                </div>
              </TableCell>

              <TableCell class="hidden px-4 py-3 text-gray-600 lg:table-cell">
                {{ doc.size }} MB
              </TableCell>

              <TableCell class="hidden px-4 py-3 text-gray-600 lg:table-cell">
                {{ doc.numPages }}
              </TableCell>

              <TableCell class="px-4 py-3">
                <span
                  :class="cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                    documentStatusMapper[doc.status].class,
                  )"
                >
                  <component :is="documentStatusMapper[doc.status].icon" class="h-3.5 w-3.5" />
                  {{ documentStatusMapper[doc.status].label }}
                </span>
              </TableCell>

              <TableCell class="hidden px-4 py-3 text-gray-600 xl:table-cell">
                {{ formatDate(doc.dateUpload) }}
              </TableCell>

              <TableCell class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                  aria-label="Ações do documento"
                >
                  <EllipsisVerticalIcon class="h-4 w-4" />
                </button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <AppPagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="total"
        :total-pages="totalPages"
        :from="from"
        :to="to"
      />
    </template>
  </div>
</template>