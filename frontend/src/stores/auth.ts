import { userService } from '@/services/user'
import type { UserData } from '@/types/UserData.type'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserData | null>(null)
  const accessToken = ref(localStorage.getItem('accessToken'))

  function setToken(token: string) {
    accessToken.value = token
    localStorage.setItem('accessToken', token)
  }

  function logout() {
    accessToken.value = null
    user.value = null // precisa estar aqui
    localStorage.removeItem('accessToken')
  }

  async function fetchUser() {
    if (!accessToken.value) return
    try {
      user.value = await userService.me()
    } catch {
      logout()
    }
  }

  return {
    user,
    accessToken,
    setToken,
    logout,
    fetchUser,
  }
})
