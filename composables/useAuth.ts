export const useAuth = () => {
  const authStore = useAuthStore()

  return {
    user: computed(() => authStore.user),
    isAuthenticated: computed(() => authStore.isAuthenticated),
    isLoading: computed(() => authStore.isLoading),
    showAuthModal: computed(() => authStore.showAuthModal),
    authMode: computed(() => authStore.authMode),
    error: computed(() => authStore.error),
    confirmingSignUp: computed(() => authStore.confirmingSignUp),
    pendingEmail: computed(() => authStore.pendingEmail),

    login: authStore.login.bind(authStore),
    register: authStore.register.bind(authStore),
    logout: authStore.logout.bind(authStore),
    forgotPassword: authStore.forgotPassword.bind(authStore),
    confirmForgotPassword: authStore.confirmForgotPassword.bind(authStore),
    confirmRegistration: authStore.confirmRegistration.bind(authStore),
    changePassword: authStore.changePassword.bind(authStore),
    fetchUser: authStore.fetchUser.bind(authStore),
    openAuthModal: authStore.openAuthModal.bind(authStore),
    closeAuthModal: authStore.closeAuthModal.bind(authStore),
  }
}
