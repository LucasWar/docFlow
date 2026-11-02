<script setup lang="ts">
import Input from '@/components/ui/input/Input.vue'
import { SearchIcon, FileSearchIcon, FileTextIcon } from 'lucide-vue-next';
import Button from '@/components/ui/button/Button.vue';
import Card from '@/components/ui/card/Card.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardContent from '@/components/ui/card/CardContent.vue';
import { useSearchContextController } from '@/features/search/composable/useSearchContext';
const {records, isPending, search} = useSearchContextController()

const exampleQuests = [
  'Qual é o prazo para pagamento ?',
  'Quais são as obrigações da contratada ?',
  'Existe multa em caso de atraso ?',
  'Quais os documentos estão relacionados a este contratado ?'
]

</script>
<template>
  <div class="flex min-h-full flex-col gap-6 p-4 md:p-6 xl:h-full">
    
    <header class="flex flex-col items-start gap-1">
      <span class="text-xl font-bold sm:text-2xl">Busca em linguagem natural</span>
      <span class="font-medium text-gray-600/80">
        Faça pergunta sobre seus documentos. Nossa IA encontrará as informações mais relevantes.
      </span>
    </header>
    <div class="flex flex-col gap-4 w-full pt-15">
      <div class="relative w-full h-full">
        <SearchIcon
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        />
        <Input
          class="h-10 w-full bg-white pl-10"
          placeholder="Ex: Qual é o prazo para pagamento previsto no contrato ?"
          v-model="search"
        />
        <Button class="absolute top-0.5 right-1"><SearchIcon/></Button>
      </div>
      <div class="flex flex-col gap-4">
        <span class="font-medium text-gray-500">Exemplos de perguntas:</span>
        <div class="flex flex-col lg:flex-row justify-between items-center truncate">
          <span v-for="(quest, index) in exampleQuests" :key="index" class="bg-gray-200 text-blue-900 font-medium p-2 px-8 rounded-2xl">{{ quest }}</span>
        </div>
      </div>  
    </div>
    <div class="grid grid-cols-3 gap-3">
      <Card>
        <CardHeader class="flex gap-2 items-center">
          <FileSearchIcon class="w-10 h-10 p-2 bg-blue-500 rounded-full text-white"/>
          <span class="font-medium">
            Busque por contexto
          </span>
        </CardHeader>
        <CardContent>
          Encontre informações mesmo que não use palavras exatas.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          Busque por contexto
        </CardHeader>
        <CardContent>
          Encontre informações mesmo que não use palavras exatas.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          Busque por contexto
        </CardHeader>
        <CardContent>
          Encontre informações mesmo que não use palavras exatas.
        </CardContent>
      </Card>
    </div>
    <div v-if="records.length > 0" class="flex flex-col gap-4">

      <!-- Cabeçalho dos resultados -->
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <span class="text-lg font-semibold text-blue-950">
            Resultados encontrados
          </span>
          <span class="text-sm text-gray-500">
            Trechos de documentos relacionados à sua pesquisa.
          </span>
        </div>

        <span class="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full">
          {{ records.length }} trechos
        </span>
      </div>

      <!-- Lista de resultados -->
      <div class="flex flex-col gap-3">

        <div
          v-for="(record, index) in records"
          :key="`${record.documentId}-${record.pageNumber}-${index}`"
          class="group w-full rounded-xl border border-blue-100 bg-white p-4
                shadow-sm transition-all duration-200
                hover:border-blue-300 hover:shadow-md"
        >

          <!-- Informações do documento -->
          <div class="flex items-center justify-between gap-3">

            <div class="flex min-w-0 items-center gap-3">

             <div class="shrink-0 rounded-lg bg-orange-50 p-2 text-orange-600">
                <FileTextIcon class="h-4 w-4" />
              </div>

              <div class="flex min-w-0 flex-col gap-1">
                <span class="truncate text-sm font-semibold text-blue-950">
                  {{ record.fileName }}
                </span>

                <span class="text-xs text-gray-500">
                  Página {{ record.pageNumber }}
                </span>
              </div>

            </div>

            <span class="hidden shrink-0 rounded-full bg-emerald-50
                        px-3 py-1 text-xs font-medium text-emerald-700 sm:block">
              Trecho encontrado
            </span>

          </div>

          <!-- Conteúdo encontrado -->
          <div class="mt-4 rounded-lg border border-gray-100
                      bg-gray-50/80 p-3">

            <div class="mb-2 flex items-center gap-2">
              <FileSearchIcon class="h-4 w-4 text-blue-500" />

              <span class="text-xs font-semibold uppercase tracking-wide
                          text-blue-800">
                Conteúdo relacionado
              </span>
            </div>

            <p class="whitespace-pre-line break-words text-sm leading-relaxed
                      text-gray-600">
              {{ record.content }}
            </p>

          </div>

        </div>

      </div>
    </div>
  </div>
</template>