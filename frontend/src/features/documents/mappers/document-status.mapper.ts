import { DocumentStatus } from '../enums/document-status'
import { CircleCheckIcon, CircleXIcon, RefreshCcw, Columns3, UploadIcon } from 'lucide-vue-next'
export const documentStatusMapper = {
  [DocumentStatus.COMPLETED]: {
    label: 'Completo',
    class: 'bg-green-100 text-green-700 border-green-200',
    icon: CircleCheckIcon,
  },

  [DocumentStatus.FAILED]: {
    label: 'Erro',
    class: 'bg-red-100 text-red-700 border-red-200',
    icon: CircleXIcon,
  },

  [DocumentStatus.PROCESSING]: {
    label: 'Processando',
    class: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: RefreshCcw,
  },
  [DocumentStatus.QUEUED]: {
    label: 'Em Fila',
    class: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Columns3,
  },
  [DocumentStatus.UPLOADED]: {
    label: 'Upload',
    class: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: UploadIcon,
  },
} as const
