<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import { SearchIcon } from '@lucide/vue'
import { FileIcon, TextIcon, FileTextIcon } from 'lucide-vue-next'
import DashboardCard from './components/DashboardCard.vue'

const exampleQuestions = [
  'Qual o prazo para pagamento previsto no contrato?',
  'Quais são as obrigações da contratada?',
  'Existe multa em caso de atraso?',
  'Quais documentos estão relacionados ao contrato?',
]
</script>

<template>
  <!-- Mobile: coluna com scroll, conteúdo no topo e cards no fluxo normal.
       Desktop (xl): tela fixa, conteúdo centralizado e cards colados no rodapé. -->
  <div
    class="min-h-full flex flex-col items-center gap-10 px-4 pt-12 pb-6
           md:pt-24
           xl:h-full xl:pt-60 xl:pb-0 xl:gap-0 xl:relative xl:overflow-hidden"
  >
    <!-- Busca -->
    <div class="w-full max-w-280">
      <div class="flex flex-col items-center justify-center gap-2 pb-8 text-center md:pb-12 xl:pb-15">
        <span class="font-bold text-xl sm:text-2xl">Olá, João! 👋</span>
        <span class="text-gray-600/80 font-medium">O que você gostaria de fazer hoje?</span>
      </div>

      <div class="flex flex-col gap-6">
        <div class="relative">
          <Input
            class="w-full h-12 pl-12 pr-14 bg-white"
            placeholder="Faça uma pergunta sobre seus documentos..."
          />
          <SearchIcon class="absolute left-4 top-4 w-4 h-4" />
          <Button class="absolute right-2 top-1 w-10 h-10">
            <SearchIcon class="w-6 h-6" />
          </Button>
        </div>

        <div class="flex flex-col gap-4 md:gap-5">
          <span class="text-gray-600/80">Exemplo de perguntas:</span>
          <!-- 1 coluna no mobile, 2 a partir de md -->
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-2 md:gap-y-5 xl:gap-y-8">
            <div v-for="question in exampleQuestions" :key="question">
              <span
                class="inline-block text-sm text-gray-600/80 p-3 bg-white rounded-full
                       md:text-base"
              >
                {{ question }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cards: 1 coluna (mobile), 2 colunas (md), 4 colunas (xl) -->
    <div
      class="w-full grid grid-cols-1 gap-4
             md:grid-cols-2
             xl:grid-cols-4 xl:absolute xl:bottom-0 xl:left-0 xl:p-4"
    >
      <DashboardCard
        :icon="{ iconFile: FileIcon, color: 'text-white', bgColor: 'bg-blue-600' }"
        title="Documentos"
        sub-title="Quantidade de documentos processados"
        :total="12"
      />
      <DashboardCard
        :icon="{ iconFile: TextIcon }"
        title="Chunks"
        sub-title="Trechos indexados para busca"
        :total="480"
      />
      <DashboardCard
        :icon="{ iconFile: FileTextIcon }"
        title="Páginas"
        sub-title="Número de páginas para pesquisa"
        :total="60"
      />
      <DashboardCard
        :icon="{ iconFile: FileIcon, bgColor: 'bg-green-300' }"
        title="teste"
        sub-title="teste2"
        :total="25"
      />
    </div>
  </div>
</template>