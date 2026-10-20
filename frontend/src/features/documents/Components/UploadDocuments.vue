<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useDropZone } from '@vueuse/core'
import { ChevronLeftIcon, CloudUploadIcon, FileTextIcon } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
const dropZoneRef = useTemplateRef<HTMLDivElement>('dropZoneRef')
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

const emit = defineEmits<{
  cancel: []
}>()

const files = ref<File[]>([])

function onDrop(droppedFiles: File[] | null) {
  if (droppedFiles) {
    files.value.push(...droppedFiles)
  }
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement

  if (input.files) {
    files.value.push(...Array.from(input.files))
  }

  // Permite selecionar novamente o mesmo arquivo
  input.value = ''
}

function removeFile(index: number) {
  files.value.splice(index, 1)
}

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop,
  multiple: true,
  dataTypes: [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ],
})
</script>

<template>
  <div>
    <div class="flex flex-col gap-3 md:flex-row justify-between pt-7 pl-7 pr-7">
      <div class="flex flex-col">
        <span class="text-3xl font-bold text-background">
          Adicionar Documentos
        </span>

        <span class="text-lg font-medium text-gray-500">
          Faça o upload dos seus arquivos para que sejam processados e indexados.
        </span>
      </div>
      <Button class="h-10 shrink-0 gap-2 bg-blue-500 hover:bg-blue-600" @click="emit('cancel')">
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
      :class="isOverDropZone
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-300 hover:border-blue-400'"
      @click="openFilePicker"
      @keydown.enter.prevent="openFilePicker"
      @keydown.space.prevent="openFilePicker"
    >
      <div class="flex flex-col items-center justify-center">
        <span>
          <CloudUploadIcon  
            class="w-20 h-20 text-blue-400"
          />
        </span>
        <p class="text-lg font-semibold">
          Arraste e solte seus arquivos aqui
        </p>

        <p class="mt-2">
          ou <span class="text-blue-400">clique selecionar</span>
        </p>

        <p class="mt-1 text-sm text-gray-400">
          Formatos aceitos: PDF (Máx, 20MB por arquivo)
        </p>
      </div>
    </div>

    <!-- Input escondido -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".jpg,.jpeg,.png,.pdf"
      multiple
      class="hidden"
      @change="onFileSelected"
    />

    <!-- Lista de arquivos selecionados -->
    <ul v-if="files.length" class="mx-7 space-y-2">
      <li
        v-for="(file, index) in files"
        :key="`${file.name}-${index}`"
        class="flex items-center justify-between rounded-lg border p-3 bg-white"
      >
        <div class="min-w-0">
          <div class="flex justify-center items-center gap-2">
            <div class="shrink-0 rounded-lg bg-orange-100 p-2 text-orange-600">
              <FileTextIcon class="h-4 w-4" />
            </div>
            <p class="truncate font-medium">{{ file.name }}</p>
          </div>
          <p class="text-sm text-gray-500">
            {{ (file.size / 1024).toFixed(1) }} KB
          </p>
        </div>

        <button
          type="button"
          class="ml-4 text-red-500 hover:text-red-700"
          @click="removeFile(index)"
        >
          Remover
        </button>
      </li>
    </ul>
  </div>
</template>