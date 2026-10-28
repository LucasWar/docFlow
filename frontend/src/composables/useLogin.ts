import { z } from 'zod'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { authService } from '@/services/auth'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import { getErrorMessage } from '@/lib/get-error-message'

export function userLoginController() {
  const auth = useAuthStore()

  const queryClient = useQueryClient()

  const zodSchema = z.object({
    email: z.string().nonempty('E-mail não pode esta vázio').email('E-mail inválido'),
    passworld: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres'),
  })

  const router = useRouter()

  const schema = toTypedSchema(zodSchema)

  type LoginForm = z.infer<typeof zodSchema>

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: LoginForm) => {
      return await authService.login(values)
    },
    onSuccess: async ({ accessToken }) => {
      auth.setToken(accessToken)
      await auth.fetchUser()
      router.push('/')
    },
    onError: (error) => {
      toast.warning(getErrorMessage(error), {
        position: 'top-center',
      })
    },
  })

  const { errors } = useForm({
    validationSchema: schema,
  })

  async function onSubmit(values: LoginForm) {
    mutate(values)
  }

  return {
    errors,
    onSubmit,
    schema,
    isPending,
  }
}
