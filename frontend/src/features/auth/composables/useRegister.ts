import { computed } from 'vue'
import { toTypedSchema } from '@vee-validate/zod'
import { useMutation } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { getErrorMessage } from '@/lib/get-error-message'
import { authService } from '../services'
import { registerSchema, type RegisterPayload } from '../schemas/register'

export function useRegisterController() {
  const schema = toTypedSchema(registerSchema)

  const { mutate, isPending, isError, isSuccess, error } = useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: () => {
      toast.success('Cadastro realizado com sucesso.', {
        position: 'top-center',
      })
    },
    onError: (mutationError) => {
      toast.warning(getErrorMessage(mutationError), {
        position: 'top-center',
      })
    },
  })

  const errorMessage = computed(() => (error.value ? getErrorMessage(error.value) : ''))

  function onSubmit(values: Record<string, unknown>) {
    const result = registerSchema.safeParse(values)

    if (!result.success) {
      toast.warning(result.error.issues[0]?.message ?? 'Dados de cadastro inválidos.', {
        position: 'top-center',
      })
      return
    }

    mutate(result.data)
  }

  return {
    errorMessage,
    isError,
    isPending,
    isSuccess,
    onSubmit,
    schema,
  }
}
