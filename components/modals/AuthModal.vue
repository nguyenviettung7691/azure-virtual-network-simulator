<template>
  <Dialog
    v-model:visible="authStore.showAuthModal"
    modal
    :closable="true"
    :style="{ width: '420px' }"
    :header="dialogTitle"
    @hide="authStore.closeAuthModal()"
  >
    <div v-if="isAuthRequestPending" class="auth-loading-state">
      <ProgressSpinner style="width: 14px; height: 14px" strokeWidth="7" />
      <span>Processing request...</span>
    </div>

    <!-- Login -->
    <form v-if="authStore.authMode === 'login' && !authStore.confirmingSignUp" class="auth-form" @submit.prevent="doLogin">
      <div class="field">
        <label>Email</label>
        <InputText v-model="email" type="email" placeholder="you@example.com" class="w-full" autocomplete="username" />
      </div>
      <div class="field">
        <label>Password</label>
        <Password v-model="password" :feedback="false" toggleMask placeholder="Password" inputClass="w-full" class="w-full" :inputProps="{ autocomplete: 'current-password' }" />
      </div>
      <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
      <Button label="Sign In" icon="pi pi-sign-in" class="w-full" type="submit" :loading="loginMutation.isPending.value" />
      <div class="auth-links">
        <a href="#" @click.prevent="authStore.openAuthModal('forgot')">Forgot password?</a>
        <a href="#" @click.prevent="authStore.openAuthModal('register')">Create account</a>
      </div>
    </form>

    <!-- Register -->
    <form v-else-if="authStore.authMode === 'register' && !authStore.confirmingSignUp" class="auth-form" @submit.prevent="doRegister">
      <div class="field">
        <label>Email</label>
        <InputText v-model="email" type="email" placeholder="you@example.com" class="w-full" autocomplete="email" />
      </div>
      <div class="field">
        <label>Password <small>(min 8 characters)</small></label>
        <Password v-model="password" toggleMask placeholder="Password" inputClass="w-full" class="w-full" :feedback="false" :inputProps="{ autocomplete: 'new-password' }" />
      </div>
      <div class="field">
        <label>Confirm Password</label>
        <Password v-model="confirmPassword" :feedback="false" toggleMask placeholder="Confirm password" inputClass="w-full" class="w-full" :inputProps="{ autocomplete: 'new-password' }" />
      </div>
      <Message v-if="localError" severity="error" :closable="false">{{ localError }}</Message>
      <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
      <Button label="Create Account" icon="pi pi-user-plus" class="w-full" type="submit" :loading="registerMutation.isPending.value" />
      <div class="auth-links">
        <a href="#" @click.prevent="authStore.openAuthModal('login')">Already have an account?</a>
      </div>
    </form>

    <!-- Confirm registration code -->
    <div v-else-if="authStore.confirmingSignUp" class="auth-form">
      <p class="confirm-info">A verification code has been sent to <strong>{{ authStore.pendingEmail }}</strong>. Enter it below.</p>
      <div class="field">
        <label>Verification Code</label>
        <InputText v-model="confirmCode" placeholder="123456" class="w-full" @keyup.enter="doConfirmRegister" />
      </div>
      <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
      <Button label="Verify" icon="pi pi-check" class="w-full" :loading="confirmRegistrationMutation.isPending.value" @click="doConfirmRegister" />
    </div>

    <!-- Forgot password -->
    <div v-else-if="authStore.authMode === 'forgot'" class="auth-form">
      <div v-if="!forgotCodeSent">
        <div class="field">
          <label>Email</label>
          <InputText v-model="email" type="email" placeholder="you@example.com" class="w-full" autocomplete="email" />
        </div>
        <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
        <Button label="Send Reset Code" icon="pi pi-envelope" class="w-full" :loading="forgotPasswordMutation.isPending.value" @click="doForgot" />
      </div>
      <form v-else @submit.prevent="doConfirmForgot">
        <div class="field">
          <label>Reset Code</label>
          <InputText v-model="confirmCode" placeholder="123456" class="w-full" />
        </div>
        <div class="field">
          <label>New Password</label>
          <Password v-model="newPassword" :feedback="false" toggleMask inputClass="w-full" class="w-full" :inputProps="{ autocomplete: 'new-password' }" />
        </div>
        <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
        <Button label="Reset Password" icon="pi pi-check" class="w-full" type="submit" :loading="confirmForgotPasswordMutation.isPending.value" />
      </form>
      <div class="auth-links">
        <a href="#" @click.prevent="authStore.openAuthModal('login')">Back to login</a>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const loginMutation = useLoginMutation()
const registerMutation = useRegisterMutation()
const confirmRegistrationMutation = useConfirmRegistrationMutation()
const forgotPasswordMutation = useForgotPasswordMutation()
const confirmForgotPasswordMutation = useConfirmForgotPasswordMutation()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const confirmCode = ref('')
const newPassword = ref('')
const localError = ref('')
const forgotCodeSent = ref(false)

const dialogTitle = computed(() => {
  if (authStore.confirmingSignUp) return 'Verify Your Email'
  if (authStore.authMode === 'login') return 'Sign In'
  if (authStore.authMode === 'register') return 'Create Account'
  return 'Reset Password'
})

const isAuthRequestPending = computed(() => {
  return loginMutation.isPending.value
    || registerMutation.isPending.value
    || confirmRegistrationMutation.isPending.value
    || forgotPasswordMutation.isPending.value
    || confirmForgotPasswordMutation.isPending.value
})

watch(() => authStore.showAuthModal, (v) => {
  if (v) {
    email.value = ''
    password.value = ''
    confirmPassword.value = ''
    confirmCode.value = ''
    newPassword.value = ''
    localError.value = ''
    forgotCodeSent.value = false
    authStore.setError(null)
  }
})

async function doLogin() {
  if (!email.value || !password.value) return
  try {
    await loginMutation.mutateAsync({ email: email.value, password: password.value })
  } catch {
    // Store error state already reflects the failure.
  }
}

async function doRegister() {
  localError.value = ''
  if (!email.value || !password.value) { localError.value = 'All fields required'; return }
  if (password.value.length < 8) { localError.value = 'Password must be at least 8 characters'; return }
  if (password.value !== confirmPassword.value) { localError.value = 'Passwords do not match'; return }
  try {
    await registerMutation.mutateAsync({ email: email.value, password: password.value })
  } catch {
    // Store error state already reflects the failure.
  }
}

async function doConfirmRegister() {
  try {
    await confirmRegistrationMutation.mutateAsync({ email: authStore.pendingEmail, code: confirmCode.value })
  } catch {
    // Store error state already reflects the failure.
  }
}

async function doForgot() {
  if (!email.value) return
  try {
    await forgotPasswordMutation.mutateAsync({ email: email.value })
    forgotCodeSent.value = true
  } catch {
    // Store error state already reflects the failure.
  }
}

async function doConfirmForgot() {
  try {
    await confirmForgotPasswordMutation.mutateAsync({
      email: authStore.pendingEmail || email.value,
      code: confirmCode.value,
      newPassword: newPassword.value,
    })
  } catch {
    // Store error state already reflects the failure.
  }
}
</script>

<style scoped>
.auth-form { display: flex; flex-direction: column; gap: 1.25rem; padding-top: 0.5rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field label { font-size: 0.85rem; font-weight: 600; color: var(--text-color-secondary); }
.auth-links { display: flex; justify-content: space-between; font-size: 0.85rem; padding-top: 0.25rem; }
.auth-links a { color: var(--primary-color); text-decoration: none; font-weight: 500; transition: opacity 0.2s ease; }
.auth-links a:hover { opacity: 0.8; text-decoration: underline; }
.confirm-info { font-size: 0.9rem; color: var(--text-color-secondary); margin: 0; line-height: 1.5; }

.auth-loading-state {
  align-items: center;
  color: var(--text-color-secondary);
  display: inline-flex;
  font-size: 0.78rem;
  font-weight: 600;
  gap: 0.45rem;
  margin-bottom: 0.75rem;
}

/* Ensure PrimeVue Password component fills the width properly */
:deep(.p-password) { display: flex; width: 100%; }
:deep(.p-password input) { width: 100%; }
</style>
