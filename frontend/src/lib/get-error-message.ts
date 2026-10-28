import { isAxiosError } from 'axios'
import { type ErrorCode, ErrorMessage } from '@/contantes/error-message'

export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const errorCode: ErrorCode = error.response?.data?.errorCode ?? 'INTERNAL_SERVER_ERROR'
    return ErrorMessage[errorCode] !== undefined
      ? ErrorMessage[errorCode].message
      : 'Erro não reconhecido'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Erro inesperado'
}
