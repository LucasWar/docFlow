<script setup lang="ts">
  import { FileIcon, TextIcon, FileTextIcon } from 'lucide-vue-next'
  import DashboardCard from './components/DashboardCard.vue'
  import Card from '@/components/ui/card/Card.vue'
  import CardHeader from '@/components/ui/card/CardHeader.vue'
  import CardContent from '@/components/ui/card/CardContent.vue'

  import DocumentList from './components/DocumentList.vue'
import { DocumentStatus } from '../documents/enums/document-status.ts'

  const documents = [
    {
      title: "teste 1",
      size: 8000,
      date: new Date(),
      status: DocumentStatus.COMPLETED
    },
    {
      title: "teste 1",
      size: 8000,
      date: new Date(),
      status: DocumentStatus.COMPLETED
    },
    {
      title: "teste 1",
      size: 8000,
      date: new Date(),
      status: DocumentStatus.COMPLETED
    },
    {
      title: "teste 1",
      size: 8000,
      date: new Date(),
      status: DocumentStatus.COMPLETED
    },
    {
      title: "teste 1",
      size: 8000,
      date: new Date(),
      status: DocumentStatus.COMPLETED
    },
    {
      title: "teste 1",
      size: 8000,
      date: new Date(),
      status: DocumentStatus.COMPLETED
    },
    {
      title: "teste 1",
      size: 8000,
      date: new Date(),
      status: DocumentStatus.COMPLETED
    }
  ]
</script>

<template>
  <!-- Mobile: tudo empilhado, a página rola dentro do <main> do layout.
       Desktop (xl): a página ocupa 100% da altura e a área de baixo estica. -->
  <div class="flex min-h-full flex-col gap-6 p-4 md:p-6 xl:h-full">
    <!-- Título -->
    <header class="flex flex-col items-start gap-1">
      <span class="text-xl font-bold sm:text-2xl">Olá, Lucas Warley ! 👋</span>
      <span class="font-medium text-gray-600/80">
        Aqui está um resumo geral das suas atividades no DocFlow
      </span>
    </header>

    <!-- Cards de métricas: 1 coluna (mobile), 2 (md), 4 (xl) -->
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
    </section>

    <!-- Área inferior: ocupa todo o espaço que sobrar.
         1 coluna (mobile/md), 2 colunas (xl), com o card principal mais largo. -->
    <section class="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-3 xl:min-h-0">
      <!-- Card principal: 2/3 da largura no desktop -->
      <Card class="flex min-h-64 flex-col xl:col-span-2 xl:min-h-0">
        <CardHeader class="flex flex-row items-center justify-between">
          <span class="font-semibold">Documentos recentes</span>
          <a href="/documentos" class="text-sm text-blue-500 hover:underline">
            Ver todos
          </a>
        </CardHeader>
        <!-- min-h-0 + overflow permitem rolar a lista sem estourar o card -->
        <CardContent class="min-h-0 flex-1 overflow-y-auto">
          <DocumentList 
            :documents="documents"
          />
        </CardContent>
      </Card>

      <!-- Segundo card: 1/3 da largura no desktop -->
      <Card class="flex min-h-64 flex-col xl:min-h-0">
        <CardHeader>
          <span class="font-semibold">Novo card</span>
        </CardHeader>
        <CardContent class="min-h-0 flex-1 overflow-y-auto">
          <!-- Conteúdo aqui -->
        </CardContent>
      </Card>
    </section>
  </div>
</template>