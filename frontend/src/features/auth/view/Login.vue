<script setup lang="ts">
import logo from '@/assets/logo.png'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Input from '@/components/ui/input/Input.vue'
import { UserIcon, LockIcon } from '@lucide/vue'
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
              Bem-vindo de volta!
            </span>
            <span class="text-base">
              Faça o login para continuar.
            </span>
          </div>

          <form class="flex flex-col gap-5">
            <div class="relative flex items-center">
              <UserIcon class="absolute w-6 h-6 left-3" />
              <Input
                class="w-full h-11 pl-11"
                placeholder="E-mail do usuário"
              />
            </div>

            <div class="relative flex items-center">
              <LockIcon class="absolute w-6 h-6 left-3" />
              <Input
                class="w-full h-11 pl-11"
                type="password"
                placeholder="Senha"
              />
            </div>

            <div
              class="w-full flex flex-col gap-3 pt-1 pb-4 text-sm
                     sm:flex-row sm:justify-between sm:items-center sm:text-base
                     lg:pt-3 lg:pb-7"
            >
              <div class="flex gap-2 items-center">
                <Checkbox class="border-background" />
                <span>Lembre-se de mim!</span>
              </div>
              <a href="#" class="text-blue-400 underline">
                Esqueceu sua senha?
              </a>
            </div>

            <Button class="w-full h-11">
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </section>
  </main>
</template>