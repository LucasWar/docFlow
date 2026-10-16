<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import logo from '@/assets/logo.png'
import {
  HouseIcon,
  FileTextIcon,
  SettingsIcon,
  SearchIcon,
  MenuIcon,
  XIcon,
} from '@lucide/vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'

const navItems = [
  { to: '/', label: 'Início', icon: HouseIcon },
  { to: '/documentos', label: 'Documentos', icon: FileTextIcon },
  { to: '/buscar', label: 'Buscar', icon: SearchIcon },
  { to: '/configuracoes', label: 'Configurações', icon: SettingsIcon },
]

// Controla o drawer no mobile (no desktop a sidebar é sempre visível)
const isMenuOpen = ref(false)
const route = useRoute()

// Fecha o menu ao navegar para outra página
watch(() => route.fullPath, () => {
  isMenuOpen.value = false
})

// Fecha o menu com a tecla Esc
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') isMenuOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="flex h-dvh w-full overflow-hidden bg-gray-200">
    <!-- Overlay escuro atrás do drawer (só mobile) -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMenuOpen"
        class="fixed inset-0 z-30 bg-black/50 lg:hidden"
        @click="isMenuOpen = false"
      />
    </Transition>

    <!-- Sidebar: drawer no mobile, fixa a partir de lg -->
    <aside
      id="sidebar"
      class="fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col justify-between
             -translate-x-full transition-transform duration-300
             rounded-r-2xl bg-linear-to-b from-background via-background to-cyan-500
             lg:static lg:z-auto lg:max-w-none lg:shrink-0 lg:translate-x-0"
      :class="{ 'translate-x-0': isMenuOpen }"
    >
      <div>
        <div class="relative flex justify-center py-5">
          <img
            :src="logo"
            alt="Logo DocFlow"
            class="h-auto w-24 xl:w-35"
          />
          <!-- Botão de fechar (só mobile) -->
          <button
            type="button"
            class="absolute right-3 top-4 rounded-lg p-2 text-white hover:bg-white/10 lg:hidden"
            aria-label="Fechar menu"
            @click="isMenuOpen = false"
          >
            <XIcon class="h-6 w-6" />
          </button>
        </div>

        <nav class="flex flex-col gap-2 px-4 lg:gap-4">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            active-class="bg-cyan-600/30"
            class="flex items-center gap-3 rounded-xl px-3 py-3
                   text-lg font-medium text-white transition-colors
                   hover:bg-cyan-600/20 lg:text-xl"
          >
            <component :is="item.icon" class="h-6 w-6 shrink-0" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>
      </div>

      <footer class="flex items-center gap-3 p-4">
        <Avatar class="h-11 w-11">
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
        <span class="truncate font-medium text-white">Lucas Warley</span>
      </footer>
    </aside>

    <!-- Coluna de conteúdo: topbar (mobile) + página -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Topbar: só no mobile -->
      <header class="flex shrink-0 items-center gap-3 bg-background px-4 py-3 lg:hidden">
        <button
          type="button"
          class="rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="Abrir menu"
          aria-controls="sidebar"
          :aria-expanded="isMenuOpen"
          @click="isMenuOpen = true"
        >
          <MenuIcon class="h-6 w-6" />
        </button>
        <img :src="logo" alt="Logo DocFlow" class="h-8 w-auto" />
      </header>

      <!-- O scroll acontece aqui, não na página inteira -->
      <main class="min-h-0 flex-1 overflow-y-auto bg-gray-200">
        <RouterView />
      </main>
    </div>
  </div>
</template>