<script setup lang="ts">
import Card from '@/components/ui/card/Card.vue'
import CardContent from '@/components/ui/card/CardContent.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue'
import { cn } from '@/lib/utils';
import type { Component } from 'vue'

defineProps<{
  icon: {
    color?: string
    bgColor?: string
    iconFile: Component
  }
  title: string
  subTitle: string
  total: number
}>()
</script>

<template>
  <div class="w-full min-w-0">
    <Card class="w-full min-w-0 h-65">
        <CardHeader class="flex flex-col gap-2 min-w-0">
            <div :class="cn('p-2 rounded-full',  icon.bgColor ? icon.bgColor : 'bg-blue-300' , icon.color ? icon.color : 'text-white')"> 
              <component :is="icon.iconFile" class="w-6 h-6 shrink-0" />
            </div>
            <span class="truncate text-xl">{{ title }}</span>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
          <div class="text-4xl">
            {{ total }}
          </div>
          <div class="text-lg">
            {{ subTitle }}
          </div>
        </CardContent>
    </Card>
  </div>
</template>