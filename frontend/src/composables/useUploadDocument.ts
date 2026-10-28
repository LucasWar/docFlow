import { computed, ref } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { documentsService } from '@/services/documents'
import { byteForMegabyte } from '@/lib/byte-for-megabyte'
import { extractType } from '@/lib/extract-type'

export const MAX_FILE_SIZE_MB = 20
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const ALLOWED_EXTENSIONS = ['pdf']

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export interface UploadItem {
  id: string
  file: File
  status: UploadStatus
  progress: number
  /** Erro de regra (extensão/tamanho): o arquivo nunca é enviado */
  validationError: string | null
  /** Erro ocorrido durante a solicitação da URL ou o envio */
  uploadError: string | null
}

interface PresignedUrlPayload {
  fileName: string
  type: string
  size: number
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExtension(fileName: string) {
  const index = fileName.lastIndexOf('.')
  return index === -1 ? '' : fileName.slice(index + 1).toLowerCase()
}

function validateFile(file: File): string | null {
  const errors: string[] = []

  if (!ALLOWED_EXTENSIONS.includes(getExtension(file.name))) {
    errors.push('Formato não permitido. Envie apenas arquivos PDF.')
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(
      `O arquivo tem ${formatFileSize(file.size)} e excede o limite de ${MAX_FILE_SIZE_MB} MB.`,
    )
  }

  return errors.length ? errors.join(' ') : null
}

function isSameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
}

export function useDocumentUpload(options: { onFinished?: () => void } = {}) {
  const items = ref<UploadItem[]>([])

  const { mutateAsync: getUrl } = useMutation({
    mutationFn: (payload: PresignedUrlPayload) => documentsService.presignedURL(payload),
  })

  const isUploading = computed(() => items.value.some((i) => i.status === 'uploading'))

  /** Arquivos válidos que ainda não foram enviados (ou falharam e podem ser reenviados) */
  const queue = computed(() =>
    items.value.filter((i) => !i.validationError && (i.status === 'idle' || i.status === 'error')),
  )

  const canUpload = computed(() => queue.value.length > 0 && !isUploading.value)

  function addFiles(newFiles: File[] | FileList | null | undefined) {
    if (!newFiles) return

    for (const file of Array.from(newFiles)) {
      // Ignora duplicados
      if (items.value.some((i) => isSameFile(i.file, file))) continue

      items.value.push({
        id: crypto.randomUUID(),
        file,
        status: 'idle',
        progress: 0,
        validationError: validateFile(file),
        uploadError: null,
      })
    }
  }

  function removeFile(id: string) {
    const item = items.value.find((i) => i.id === id)
    if (!item || item.status === 'uploading') return
    items.value = items.value.filter((i) => i.id !== id)
  }

  async function uploadOne(item: UploadItem) {
    item.status = 'uploading'
    item.progress = 0
    item.uploadError = null

    try {
      const url = await getUrl({
        fileName: item.file.name,
        size: byteForMegabyte(item.file.size),
        type: extractType(item.file.type),
      })

      await documentsService.uploadFile(url, item.file, (percent: number) => {
        item.progress = percent
      })

      item.progress = 100
      item.status = 'success'
    } catch (error) {
      console.error(`Erro ao enviar "${item.file.name}":`, error)
      item.status = 'error'
      item.uploadError = 'Não foi possível enviar o arquivo. Tente novamente.'
    }
  }

  async function uploadAll() {
    if (!canUpload.value) return

    // Cada arquivo tem seu próprio try/catch, então uma falha não cancela as outras
    await Promise.all(queue.value.map(uploadOne))

    if (items.value.some((i) => i.status === 'success')) {
      options.onFinished?.()
    }
  }

  return {
    items,
    queue,
    isUploading,
    canUpload,
    addFiles,
    removeFile,
    uploadAll,
  }
}
