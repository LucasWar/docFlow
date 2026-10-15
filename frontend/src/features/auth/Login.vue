<script setup lang="ts">
  import logo from '@/assets/logo.png'
</script>

<template>
  <main class="min-h-screen bg-slate-100 flex">
    <div class="bg-linear-to-b from-background via-background to-cyan-500 w-1/2 flex justify-center pt-40">
      <div class="flex flex-col">
        <div class="flex justify-center text-7xl">
          <img
            :src="logo"
            alt="Logo DocFlow"
            class="w-90 h-auto"
          />
        </div>
        <div class="flex flex-col gap-10 align-middle">
          <div class="flex flex-col gap-4 text-5xl text-white">
            <p>Seus documentos,</p>
            <p>respostas mais rápidas</p>
          </div>
          <div class="flex flex-col gap-1 text-3xl text-white">
            <p>Pesquise, encontre e tenha acesso</p>
            <p>aos seus documentos com o poder da IA</p>
          </div>
        </div>
      </div>
    </div>
    <div class="w-1/2 flex justify-center items-center">LOGIN</div>
  </main>
</template>
