import {
  confirmResetPassword,
  confirmSignUp,
  fetchUserAttributes,
  getCurrentUser,
  resetPassword,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from 'aws-amplify/auth'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { AuthUser } from '~/types/auth'

export const authCurrentUserQueryKey = ['auth', 'current-user'] as const

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) {
      return message
    }
  }

  return fallback
}

export async function fetchCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const user = await getCurrentUser()
    const attributes = await fetchUserAttributes()

    return {
      userId: user.userId,
      username: user.username,
      email: attributes.email || '',
      attributes: attributes as Record<string, string>,
    }
  } catch {
    return null
  }
}

export function useCurrentUserQuery(enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: authCurrentUserQueryKey,
    queryFn: fetchCurrentAuthUser,
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useRefreshCurrentUser() {
  const queryClient = useQueryClient()

  return async () => queryClient.fetchQuery({
    queryKey: authCurrentUserQueryKey,
    queryFn: fetchCurrentAuthUser,
    staleTime: 0,
  })
}

export function useLoginMutation() {
  const authStore = useAuthStore()
  const refreshCurrentUser = useRefreshCurrentUser()

  return useMutation({
    mutationFn: async ({ email, password }: { email: string, password: string }) => {
      const result = await signIn({ username: email, password })

      return {
        email,
        ...result,
      }
    },
    onMutate: () => {
      authStore.setError(null)
    },
    onSuccess: async ({ isSignedIn, nextStep }) => {
      if (isSignedIn) {
        await refreshCurrentUser()
        authStore.closeAuthModal()
        return
      }

      if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        authStore.setError('Please confirm your email before signing in.')
      }
    },
    onError: (error) => {
      authStore.setError(resolveErrorMessage(error, 'Login failed. Please check your credentials.'))
    },
  })
}

export function useRegisterMutation() {
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async ({ email, password }: { email: string, password: string }) => signUp({
      username: email,
      password,
      options: { userAttributes: { email } },
    }),
    onMutate: () => {
      authStore.setError(null)
    },
    onSuccess: ({ nextStep }, { email }) => {
      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        authStore.beginSignUpConfirmation(email)
      }
    },
    onError: (error) => {
      authStore.setError(resolveErrorMessage(error, 'Registration failed. Please try again.'))
    },
  })
}

export function useConfirmRegistrationMutation() {
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async ({ email, code }: { email: string, code: string }) => confirmSignUp({
      username: email,
      confirmationCode: code,
    }),
    onMutate: () => {
      authStore.setError(null)
    },
    onSuccess: () => {
      authStore.completeSignUpConfirmation()
    },
    onError: (error) => {
      authStore.setError(resolveErrorMessage(error, 'Confirmation failed. Please check your code.'))
    },
  })
}

export function useForgotPasswordMutation() {
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      await resetPassword({ username: email })
      return email
    },
    onMutate: () => {
      authStore.setError(null)
    },
    onSuccess: (email) => {
      authStore.setPendingEmail(email)
    },
    onError: (error) => {
      authStore.setError(resolveErrorMessage(error, 'Failed to send reset code.'))
    },
  })
}

export function useConfirmForgotPasswordMutation() {
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: ({ email, code, newPassword }: { email: string, code: string, newPassword: string }) => confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    }),
    onMutate: () => {
      authStore.setError(null)
    },
    onSuccess: () => {
      authStore.completePasswordReset()
    },
    onError: (error) => {
      authStore.setError(resolveErrorMessage(error, 'Password reset failed.'))
    },
  })
}

export function useChangePasswordMutation() {
  const authStore = useAuthStore()

  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string, newPassword: string }) => updatePassword({
      oldPassword,
      newPassword,
    }),
    onMutate: () => {
      authStore.setError(null)
    },
    onError: (error) => {
      authStore.setError(resolveErrorMessage(error, 'Password change failed.'))
    },
  })
}

export function useLogoutMutation() {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      authStore.clearUser()
      authStore.closeAuthModal()
      queryClient.setQueryData(authCurrentUserQueryKey, null)
    },
    onError: (error) => {
      authStore.setError(resolveErrorMessage(error, 'Logout failed. Please try again.'))
    },
  })
}