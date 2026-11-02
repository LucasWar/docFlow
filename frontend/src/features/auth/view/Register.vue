<script setup lang="ts">
  import logo from '@/assets/logo.png'
  import Button from '@/components/ui/button/Button.vue'
  import Input from '@/components/ui/input/Input.vue'
  import { LockIcon, UserIcon } from '@lucide/vue'
  import { Field, Form } from 'vee-validate'
  import { useRegisterController } from '@/features/auth/composables/useRegister'

const { errorMessage, isError, isPending, isSuccess, onSubmit, schema } =
  useRegisterController()
</script>

<template>
  <main
    class="min-h-dvh flex items-center justify-center p-4
           bg-linear-to-b from-background via-background to-cyan-500
           lg:p-0 lg:bg-none lg:bg-slate-100"
  >
    <section
      class="hidden lg:flex lg:w-1/2 lg:min-h-dvh justify-center pt-40
             bg-linear-to-b from-background via-background to-cyan-500"
    >
      <div class="flex flex-col">
        <div class="flex justify-center">
          <img
            :src="logo"
            alt="Logo DocFlow"
            class="w-96 xl:w-140 h-auto"
          />
        </div>
        <div class="flex flex-col gap-10">
          <div class="flex flex-col gap-4 text-4xl xl:text-5xl text-white">
            <p>Seus documentos,</p>
            <p>respostas mais rápidas.</p>
          </div>
          <div class="flex flex-col gap-1 text-2xl xl:text-3xl text-white">
            <p>Pesquise, encontre e tenha acesso</p>
            <p>aos seus documentos com o poder da IA.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="w-full flex justify-center items-center lg:w-1/2 lg:min-h-dvh">
      <div
        class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl
               sm:p-8
               lg:max-w-120 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none"
      >
        <div class="flex flex-col gap-8 lg:gap-10">
          <div class="flex flex-col text-center lg:text-left">
            <span class="text-2xl font-medium sm:text-3xl">
              Crie sua conta
            </span>
            <span class="text-base">
              Cadastre-se para continuar.
            </span>
          </div>

          <Form
            :validation-schema="schema"
            class="flex flex-col gap-5"
            @submit="onSubmit"
          >
            <Field name="name" v-slot="{ field, errorMessage: fieldError }">
              <div>
                <label for="register-name" class="mb-1 block text-sm font-medium">
                  Nome
                </label>
                <div class="relative flex items-center">
                  <UserIcon class="absolute left-3 h-5 w-5" aria-hidden="true" />
                  <Input
                    v-bind="field"
                    id="register-name"
                    name="name"
                    class="h-11 w-full pl-11"
                    placeholder="Seu nome"
                    autocomplete="name"
                    :aria-invalid="Boolean(fieldError)"
                    :aria-describedby="fieldError ? 'register-name-error' : undefined"
                  />
                </div>
                <span
                  v-if="fieldError"
                  id="register-name-error"
                  class="text-sm text-red-500"
                >
                  {{ fieldError }}
                </span>
              </div>
            </Field>

            <Field name="email" v-slot="{ field, errorMessage: fieldError }">
              <div>
                <label for="register-email" class="mb-1 block text-sm font-medium">
                  E-mail
                </label>
                <div class="relative flex items-center">
                  <UserIcon class="absolute left-3 h-5 w-5" aria-hidden="true" />
                  <Input
                    v-bind="field"
                    id="register-email"
                    name="email"
                    type="email"
                    class="h-11 w-full pl-11"
                    placeholder="E-mail do usuário"
                    autocomplete="email"
                    :aria-invalid="Boolean(fieldError)"
                    :aria-describedby="fieldError ? 'register-email-error' : undefined"
                  />
                </div>
                <span
                  v-if="fieldError"
                  id="register-email-error"
                  class="text-sm text-red-500"
                >
                  {{ fieldError }}
                </span>
              </div>
            </Field>

            <Field name="password" v-slot="{ field, errorMessage: fieldError }">
              <div>
                <label for="register-password" class="mb-1 block text-sm font-medium">
                  Senha
                </label>
                <div class="relative flex items-center">
                  <LockIcon class="absolute left-3 h-5 w-5" aria-hidden="true" />
                  <Input
                    v-bind="field"
                    id="register-password"
                    name="password"
                    type="password"
                    class="h-11 w-full pl-11"
                    placeholder="Mínimo de 8 caracteres"
                    autocomplete="new-password"
                    :aria-invalid="Boolean(fieldError)"
                    :aria-describedby="fieldError ? 'register-password-error' : undefined"
                  />
                </div>
                <span
                  v-if="fieldError"
                  id="register-password-error"
                  class="text-sm text-red-500"
                >
                  {{ fieldError }}
                </span>
              </div>
            </Field>

            <p v-if="isError" class="text-sm text-red-500" role="alert">
              {{ errorMessage }}
            </p>
            <p v-if="isSuccess" class="text-sm text-green-600" role="status">
              Cadastro realizado com sucesso.
            </p>

            <Button class="h-11 w-full" type="submit" :disabled="isPending">
              {{ isPending ? 'Cadastrando...' : 'Cadastrar' }}
            </Button>
          </Form>

          <p class="text-center text-sm">
            Já possui uma conta?
            <RouterLink :to="{ name: 'login' }" class="text-blue-400 underline">
              Entrar
            </RouterLink>
          </p>
        </div>
      </div>
    </section>
  </main>
</template>
