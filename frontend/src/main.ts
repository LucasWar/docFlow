import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth.ts'

const app = createApp(App)

app.use(VueQueryPlugin)
app.use(createPinia())
app.use(router)

app.mount('#app')
