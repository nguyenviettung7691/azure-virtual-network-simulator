import { useQueryClient } from '@tanstack/vue-query'
import { authCurrentUserQueryKey, fetchCurrentAuthUser } from '~/composables/useAuthQueries'

export const useAuth = () => {
  const authStore = useAuthStore()
  const settingsStore = useSettingsStore()
  const queryClient = useQueryClient()
  const loginMutation = useLoginMutation()
  const registerMutation = useRegisterMutation()
  const logoutMutation = useLogoutMutation()
  const forgotPasswordMutation = useForgotPasswordMutation()
  const confirmForgotPasswordMutation = useConfirmForgotPasswordMutation()
  const confirmRegistrationMutation = useConfirmRegistrationMutation()
  const changePasswordMutation = useChangePasswordMutation()

  async function fetchUser() {
    authStore.setLoading(true)

    try {
      const user = await queryClient.fetchQuery({
        queryKey: authCurrentUserQueryKey,
        queryFn: fetchCurrentAuthUser,
        staleTime: 0,
      })

      if (user) {
        authStore.hydrateUser(user)
        settingsStore.setCurrentUser(user.userId)
      } else {
        authStore.clearUser()
      }

      return user
    } finally {
      authStore.setLoading(false)
    }
  }

  return {
    user: computed(() => authStore.user),
    isAuthenticated: computed(() => authStore.isAuthenticated),
    isLoading: computed(() => (
      authStore.isLoading
      || loginMutation.isPending.value
      || registerMutation.isPending.value
      || logoutMutation.isPending.value
      || forgotPasswordMutation.isPending.value
      || confirmForgotPasswordMutation.isPending.value
      || confirmRegistrationMutation.isPending.value
      || changePasswordMutation.isPending.value
    )),
    showAuthModal: computed(() => authStore.showAuthModal),
    authMode: computed(() => authStore.authMode),
    error: computed(() => authStore.error),
    confirmingSignUp: computed(() => authStore.confirmingSignUp),
    pendingEmail: computed(() => authStore.pendingEmail),

    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    register: (email: string, password: string) => registerMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
    forgotPassword: (email: string) => forgotPasswordMutation.mutateAsync({ email }),
    confirmForgotPassword: (email: string, code: string, newPassword: string) => confirmForgotPasswordMutation.mutateAsync({ email, code, newPassword }),
    confirmRegistration: (email: string, code: string) => confirmRegistrationMutation.mutateAsync({ email, code }),
    changePassword: (oldPassword: string, newPassword: string) => changePasswordMutation.mutateAsync({ oldPassword, newPassword }),
    fetchUser,
    openAuthModal: authStore.openAuthModal.bind(authStore),
    closeAuthModal: authStore.closeAuthModal.bind(authStore),
  }
}
