<script setup lang="ts">
import Input from '@/components/ui/input/Input.vue'
import { SearchIcon, FileSearchIcon } from 'lucide-vue-next';
import Button from '@/components/ui/button/Button.vue';
import Card from '@/components/ui/card/Card.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardContent from '@/components/ui/card/CardContent.vue';

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
    <footer class="grid grid-cols-3 gap-3">
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
    </footer>
  </div>
</template>