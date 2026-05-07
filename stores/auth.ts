import { defineStore } from 'pinia'
import type { AuthMode, AuthUser } from '~/types/auth'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  showAuthModal: boolean
  authMode: AuthMode
  error: string | null
  confirmingSignUp: boolean
  pendingEmail: string
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    showAuthModal: false,
    authMode: 'login',
    error: null,
    confirmingSignUp: false,
    pendingEmail: '',
  }),

  getters: {
    currentUser: (state) => state.user,
    userId: (state) => state.user?.userId || null,
  },

  actions: {
    setLoading(isLoading: boolean) {
      this.isLoading = isLoading
    },

    setError(error: string | null) {
      this.error = error
    },

    hydrateUser(user: AuthUser) {
      this.user = user
      this.isAuthenticated = true
    },

    clearUser() {
      this.user = null
      this.isAuthenticated = false
      const settingsStore = useSettingsStore()
      settingsStore.setCurrentUser(null)
    },

    setPendingEmail(email: string) {
      this.pendingEmail = email
    },

    beginSignUpConfirmation(email: string) {
      this.pendingEmail = email
      this.confirmingSignUp = true
      this.error = null
    },

    completeSignUpConfirmation() {
      this.confirmingSignUp = false
      this.authMode = 'login'
      this.error = null
    },

    completePasswordReset() {
      this.authMode = 'login'
      this.pendingEmail = ''
      this.error = null
    },

    openAuthModal(mode: AuthMode = 'login') {
      this.authMode = mode
      this.showAuthModal = true
      this.error = null
      this.confirmingSignUp = false
      this.pendingEmail = ''
    },

    closeAuthModal() {
      this.showAuthModal = false
      this.error = null
      this.confirmingSignUp = false
      this.pendingEmail = ''
    },
  },
})
