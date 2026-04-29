<template>
  <Dialog
    v-model:visible="authStore.showAuthModal"
    modal
    :closable="true"
    :style="{ width: '420px' }"
    :header="dialogTitle"
    @hide="authStore.closeAuthModal()"
  >
    <!-- Login -->
    <div v-if="authStore.authMode === 'login' && !authStore.confirmingSignUp" class="auth-form">
      <div class="field">
        <label>Email</label>
        <InputText v-model="email" type="email" placeholder="you@example.com" class="w-full" @keyup.enter="doLogin" />
      </div>
      <div class="field">
        <label>Password</label>
        <Password v-model="password" :feedback="false" toggleMask placeholder="Password" inputClass="w-full" class="w-full" @keyup.enter="doLogin" />
      </div>
      <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
      <Button label="Sign In" icon="pi pi-sign-in" class="w-full" :loading="authStore.isLoading" @click="doLogin" />
      <div class="auth-links">
        <a href="#" @click.prevent="authStore.openAuthModal('forgot')">Forgot password?</a>
        <a href="#" @click.prevent="authStore.openAuthModal('register')">Create account</a>
      </div>
    </div>

    <!-- Register -->
    <div v-else-if="authStore.authMode === 'register' && !authStore.confirmingSignUp" class="auth-form">
      <div class="field">
        <label>Email</label>
        <InputText v-model="email" type="email" placeholder="you@example.com" class="w-full" />
      </div>
      <div class="field">
        <label>Password <small>(min 8 characters)</small></label>
        <Password v-model="password" toggleMask placeholder="Password" inputClass="w-full" class="w-full" :feedback="false" />
      </div>
      <div class="field">
        <label>Confirm Password</label>
        <Password v-model="confirmPassword" :feedback="false" toggleMask placeholder="Confirm password" inputClass="w-full" class="w-full" />
      </div>
      <Message v-if="localError" severity="error" :closable="false">{{ localError }}</Message>
      <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
      <Button label="Create Account" icon="pi pi-user-plus" class="w-full" :loading="authStore.isLoading" @click="doRegister" />
      <div class="auth-links">
        <a href="#" @click.prevent="authStore.openAuthModal('login')">Already have an account?</a>
      </div>
    </div>

    <!-- Confirm registration code -->
    <div v-else-if="authStore.confirmingSignUp" class="auth-form">
      <p class="confirm-info">A verification code has been sent to <strong>{{ authStore.pendingEmail }}</strong>. Enter it below.</p>
      <div class="field">
        <label>Verification Code</label>
        <InputText v-model="confirmCode" placeholder="123456" class="w-full" @keyup.enter="doConfirmRegister" />
      </div>
      <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
      <Button label="Verify" icon="pi pi-check" class="w-full" :loading="authStore.isLoading" @click="doConfirmRegister" />
    </div>

    <!-- Forgot password -->
    <div v-else-if="authStore.authMode === 'forgot'" class="auth-form">
      <div v-if="!forgotCodeSent">
        <div class="field">
          <label>Email</label>
          <InputText v-model="email" type="email" placeholder="you@example.com" class="w-full" />
        </div>
        <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
        <Button label="Send Reset Code" icon="pi pi-envelope" class="w-full" :loading="authStore.isLoading" @click="doForgot" />
      </div>
      <div v-else>
        <div class="field">
          <label>Reset Code</label>
          <InputText v-model="confirmCode" placeholder="123456" class="w-full" />
        </div>
        <div class="field">
          <label>New Password</label>
          <Password v-model="newPassword" :feedback="false" toggleMask inputClass="w-full" class="w-full" />
        </div>
        <Message v-if="authStore.error" severity="error" :closable="false">{{ authStore.error }}</Message>
        <Button label="Reset Password" icon="pi pi-check" class="w-full" :loading="authStore.isLoading" @click="doConfirmForgot" />
      </div>
      <div class="auth-links">
        <a href="#" @click.prevent="authStore.openAuthModal('login')">Back to login</a>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
const authStore = useAuthStore()

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

watch(() => authStore.showAuthModal, (v) => {
  if (v) { email.value = ''; password.value = ''; confirmPassword.value = ''; confirmCode.value = ''; newPassword.value = ''; localError.value = ''; forgotCodeSent.value = false }
})

async function doLogin() {
  if (!email.value || !password.value) return
  await authStore.login(email.value, password.value)
}

async function doRegister() {
  localError.value = ''
  if (!email.value || !password.value) { localError.value = 'All fields required'; return }
  if (password.value.length < 8) { localError.value = 'Password must be at least 8 characters'; return }
  if (password.value !== confirmPassword.value) { localError.value = 'Passwords do not match'; return }
  await authStore.register(email.value, password.value)
}

async function doConfirmRegister() {
  await authStore.confirmRegistration(authStore.pendingEmail, confirmCode.value)
}

async function doForgot() {
  if (!email.value) return
  await authStore.forgotPassword(email.value)
  if (!authStore.error) forgotCodeSent.value = true
}

async function doConfirmForgot() {
  await authStore.confirmForgotPassword(authStore.pendingEmail || email.value, confirmCode.value, newPassword.value)
}
</script>

<style scoped>
.auth-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field label { font-size: 0.85rem; font-weight: 600; color: var(--text-color-secondary); }
.auth-links { display: flex; justify-content: space-between; font-size: 0.8rem; }
.auth-links a { color: var(--primary-color); text-decoration: none; }
.confirm-info { font-size: 0.88rem; color: var(--text-color-secondary); margin: 0; }
</style>
