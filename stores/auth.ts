import { defineStore } from 'pinia'
import {
  signIn, signUp, signOut, confirmSignUp,
  resetPassword, confirmResetPassword,
  updatePassword, getCurrentUser,
  fetchUserAttributes,
} from 'aws-amplify/auth'

interface AuthUser {
  userId: string
  username: string
  email: string
  attributes?: Record<string, string>
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  showAuthModal: boolean
  authMode: 'login' | 'register' | 'forgot'
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
    async fetchUser() {
      this.isLoading = true
      try {
        const user = await getCurrentUser()
        const attributes = await fetchUserAttributes()
        this.user = {
          userId: user.userId,
          username: user.username,
          email: attributes.email || '',
          attributes: attributes as Record<string, string>,
        }
        this.isAuthenticated = true
      } catch {
        this.user = null
        this.isAuthenticated = false
      } finally {
        this.isLoading = false
      }
    },

    async login(email: string, password: string) {
      this.isLoading = true
      this.error = null
      try {
        const { isSignedIn, nextStep } = await signIn({ username: email, password })
        if (isSignedIn) {
          await this.fetchUser()
          this.showAuthModal = false
        } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          this.error = 'Please confirm your email before signing in.'
        }
      } catch (err: any) {
        this.error = err.message || 'Login failed. Please check your credentials.'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async register(email: string, password: string) {
      this.isLoading = true
      this.error = null
      try {
        const { nextStep } = await signUp({
          username: email,
          password,
          options: { userAttributes: { email } },
        })
        if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
          this.confirmingSignUp = true
          this.pendingEmail = email
        }
      } catch (err: any) {
        this.error = err.message || 'Registration failed. Please try again.'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async confirmRegistration(email: string, code: string) {
      this.isLoading = true
      this.error = null
      try {
        await confirmSignUp({ username: email, confirmationCode: code })
        this.confirmingSignUp = false
        this.authMode = 'login'
      } catch (err: any) {
        this.error = err.message || 'Confirmation failed. Please check your code.'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async logout() {
      this.isLoading = true
      try {
        await signOut()
        this.user = null
        this.isAuthenticated = false
      } catch (err: any) {
        console.error('Logout error:', err)
      } finally {
        this.isLoading = false
      }
    },

    async forgotPassword(email: string) {
      this.isLoading = true
      this.error = null
      try {
        await resetPassword({ username: email })
        this.pendingEmail = email
      } catch (err: any) {
        this.error = err.message || 'Failed to send reset code.'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async confirmForgotPassword(email: string, code: string, newPassword: string) {
      this.isLoading = true
      this.error = null
      try {
        await confirmResetPassword({ username: email, confirmationCode: code, newPassword })
        this.authMode = 'login'
      } catch (err: any) {
        this.error = err.message || 'Password reset failed.'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    async changePassword(oldPassword: string, newPassword: string) {
      this.isLoading = true
      this.error = null
      try {
        await updatePassword({ oldPassword, newPassword })
      } catch (err: any) {
        this.error = err.message || 'Password change failed.'
        throw err
      } finally {
        this.isLoading = false
      }
    },

    openAuthModal(mode: 'login' | 'register' | 'forgot' = 'login') {
      this.authMode = mode
      this.showAuthModal = true
      this.error = null
    },

    closeAuthModal() {
      this.showAuthModal = false
      this.error = null
      this.confirmingSignUp = false
    },
  },
})
