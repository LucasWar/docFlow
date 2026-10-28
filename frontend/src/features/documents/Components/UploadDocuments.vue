<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useDropZone } from '@vueuse/core'
import { ChevronLeftIcon, CloudUploadIcon, FileTextIcon, UploadIcon } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { formatFileSize, MAX_FILE_SIZE_MB, useDocumentUpload } from '@/composables/useUploadDocument';


const emit = defineEmits<{
  cancel: []
  uploaded: []
}>()

const dropZoneRef = useTemplateRef<HTMLDivElement>('dropZoneRef')
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

const { items, queue, isUploading, canUpload, addFiles, removeFile, uploadAll } =
  useDocumentUpload({ onFinished: () => emit('uploaded') })

// Sem "dataTypes": a validação é feita pelo composable, assim arquivos inválidos
// também aparecem na lista com a mensagem de erro em vez de serem ignorados.
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (files) => addFiles(files),
  multiple: true,
})

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(input.files)
  // Permite selecionar novamente os mesmos arquivos
  input.value = ''
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-3 md:flex-row justify-between pt-7 pl-7 pr-7">
      <div class="flex flex-col">
        <span class="text-3xl font-bold text-background">Adicionar Documentos</span>
        <span class="text-lg font-medium text-gray-500">
          Faça o upload dos seus arquivos para que sejam processados e indexados.
        </span>
      </div>
      <Button
        class="h-10 shrink-0 gap-2 bg-blue-500 hover:bg-blue-600"
        :disabled="isUploading"
        @click="emit('cancel')"
      >
        <ChevronLeftIcon />
        <span>Voltar para documentos</span>
      </Button>
    </div>

    <!-- Área de arrastar e clicar -->
    <div
      ref="dropZoneRef"
      role="button"
      tabindex="0"
      class="m-7 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors bg-gray-200"
      :class="
        isOverDropZone ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
      "
      @click="openFilePicker"
      @keydown.enter.prevent="openFilePicker"
      @keydown.space.prevent="openFilePicker"
    >
      <div class="flex flex-col items-center justify-center">
        <CloudUploadIcon class="w-20 h-20 text-blue-400" />
        <p class="text-lg font-semibold">Arraste e solte seus arquivos aqui</p>
        <p class="mt-2">ou <span class="text-blue-400">clique para selecionar</span></p>
        <p class="mt-1 text-sm text-gray-400">
          Formato aceito: PDF (máx. {{ MAX_FILE_SIZE_MB }} MB por arquivo)
        </p>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept=".pdf,application/pdf"
      multiple
      class="hidden"
      @change="onFileSelected"
    />

    <!-- Lista de arquivos -->
    <ul v-if="items.length" class="mx-7 space-y-2">
      <li
        v-for="item in items"
        :key="item.id"
        class="rounded-lg border bg-white p-3"
        :class="item.validationError || item.uploadError ? 'border-red-300' : 'border-gray-200'"
      >
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <div class="shrink-0 rounded-lg bg-orange-100 p-2 text-orange-600">
                <FileTextIcon class="h-4 w-4" />
              </div>
              <p class="truncate font-medium">{{ item.file.name }}</p>
            </div>
            <p class="text-sm text-gray-500">{{ formatFileSize(item.file.size) }}</p>
          </div>

          <div class="ml-4 flex shrink-0 items-center gap-3">
            <span v-if="item.status === 'success'" class="text-sm font-medium text-green-600">
              Enviado
            </span>
            <span v-else-if="item.status === 'uploading'" class="text-sm text-gray-500">
              {{ item.progress }}%
            </span>

            <button
              v-if="item.status !== 'uploading'"
              type="button"
              class="text-red-500 hover:text-red-700"
              @click="removeFile(item.id)"
            >
              Remover
            </button>
          </div>
        </div>

        <!-- Barra de progresso -->
        <div
          v-if="item.status === 'uploading' || item.status === 'success'"
          class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          :aria-valuenow="item.progress"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full transition-all duration-200"
            :class="item.status === 'success' ? 'bg-green-500' : 'bg-blue-500'"
            :style="{ width: `${item.progress}%` }"
          />
        </div>

        <!-- Mensagens de erro -->
        <p v-if="item.validationError" class="mt-2 text-sm text-red-600">
          {{ item.validationError }}
        </p>
        <p v-else-if="item.uploadError" class="mt-2 text-sm text-red-600">
          {{ item.uploadError }}
        </p>
      </li>
    </ul>

    <!-- Ação de envio -->
    <div v-if="items.length" class="flex justify-end px-7 py-5">
      <Button
        class="h-10 gap-2 bg-blue-500 hover:bg-blue-600"
        :disabled="!canUpload"
        @click="uploadAll"
      >
        <UploadIcon class="h-4 w-4" />
        <span>
          {{ isUploading ? 'Enviando...' : `Upload${queue.length ? ` (${queue.length})` : ''}` }}
        </span>
      </Button>
    </div>
  </div>
</template>