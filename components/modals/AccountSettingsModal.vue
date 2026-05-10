<template>
  <Dialog
    v-model:visible="settingsStore.showSettingsModal"
    modal
    header="Account Settings"
    :style="{ width: '580px', maxWidth: '94vw' }"
    @hide="settingsStore.closeSettingsModal()"
  >
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="appearance">Appearance</Tab>
        <Tab value="diagram">Diagram</Tab>
        <Tab value="profile">Profile</Tab>
      </TabList>

      <div v-if="settingsStore.isSyncing || settingsStore.syncError" class="settings-sync-status" :class="{ error: Boolean(settingsStore.syncError) }">
        <ProgressSpinner v-if="settingsStore.isSyncing" style="width: 14px; height: 14px" strokeWidth="7" />
        <i v-else class="pi pi-exclamation-triangle" />
        <span>{{ settingsStore.isSyncing ? 'Syncing account settings...' : settingsStore.syncError }}</span>
      </div>

      <TabPanels>
        <TabPanel value="profile">
          <div class="settings-section profile-section">
            <div class="profile-header-card">
              <div class="profile-avatar">
                <i class="pi pi-user" />
              </div>
              <div class="profile-meta">
                <h4 class="profile-title">Signed in account</h4>
                <span class="profile-subtitle">Manage your identity, password, and session security.</span>
              </div>
            </div>

            <div class="settings-card highlighted-card">
              <div class="field">
                <label for="account-email">Email</label>
                <InputText id="account-email" :value="authStore.user?.email || ''" disabled class="w-full" />
              </div>
            </div>

            <Divider />

            <form class="settings-card" @submit.prevent="changePassword">
              <input
                type="text"
                name="username"
                value=""
                autocomplete="username"
                readonly
                tabindex="-1"
                aria-hidden="true"
                class="sr-only-username"
              />
              <input
                type="password"
                name="fake-current-password"
                value=""
                autocomplete="current-password"
                readonly
                tabindex="-1"
                aria-hidden="true"
                class="sr-only-username"
              />

              <div class="section-title-row section-title-row-inline">
                <div class="section-title-copy">
                  <h4>Change Password</h4>
                  <span class="section-hint">Use a strong password with at least 8 characters.</span>
                </div>
                <Button
                  type="button"
                  :label="showPasswordSection ? 'Hide' : 'Show'"
                  :icon="showPasswordSection ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                  text
                  size="small"
                  @click="showPasswordSection = !showPasswordSection"
                />
              </div>

              <template v-if="showPasswordSection">
                <div class="field">
                  <label for="current-password">Current Password</label>
                  <Password
                    id="current-password"
                    v-model="oldPassword"
                    :feedback="false"
                    toggleMask
                    inputClass="w-full"
                    class="w-full"
                    :inputProps="{
                      autocomplete: 'off',
                      name: 'account-current-password',
                    }"
                  />
                </div>

                <div class="field">
                  <label for="new-password">New Password</label>
                  <Password
                    id="new-password"
                    v-model="newPassword"
                    :feedback="false"
                    toggleMask
                    inputClass="w-full"
                    class="w-full"
                    :inputProps="{
                      autocomplete: 'new-password',
                      name: 'account-new-password',
                    }"
                  />
                </div>

                <Message v-if="pwError" severity="error" :closable="false">{{ pwError }}</Message>
                <Message v-if="pwSuccess" severity="success" :closable="false">Password changed successfully</Message>

                <div class="password-action-row">
                  <Button
                    label="Change Password"
                    size="small"
                    type="submit"
                    :disabled="!canSubmitPasswordChange"
                    :loading="changePasswordMutation.isPending.value"
                  />
                </div>
              </template>
            </form>

            <Divider />

            <div class="danger-zone">
              <Button
                label="Sign Out"
                icon="pi pi-sign-out"
                severity="danger"
                text
                :loading="logoutMutation.isPending.value"
                @click="logout"
              />
            </div>
          </div>
        </TabPanel>

        <TabPanel value="appearance">
          <div class="settings-section">
            <div class="field settings-card">
              <label>Color Theme</label>
              <span class="field-help">Choose your primary accent color across the app UI.</span>
              <div class="theme-grid">
                <button
                  v-for="theme in themes"
                  :key="theme.value"
                  type="button"
                  class="theme-swatch"
                  :class="{ active: selectedTheme === theme.value }"
                  :style="{ background: theme.color }"
                  :title="theme.label"
                  :aria-label="theme.label"
                  :aria-pressed="selectedTheme === theme.value"
                  @click="selectedTheme = theme.value"
                >
                  <Icon v-if="selectedTheme === theme.value" icon="mdi:check" class="check-icon" />
                </button>
              </div>
            </div>

            <div class="field settings-card">
              <label>Color Mode</label>
              <span class="field-help">Follow system mode or force the app into light or dark appearance.</span>
              <SelectButton
                v-model="darkModeValue"
                :options="darkModeOptions"
                option-label="label"
                option-value="value"
              />
            </div>

            <div class="field settings-card">
              <label>Animate Edges</label>
              <span class="field-help">Animate connection edges in infrastructure mode.</span>
              <ToggleSwitch v-model="animateEdgesValue" />
            </div>

            <div class="field settings-card">
              <label>Show Grid</label>
              <span class="field-help">Show or hide the diagram background grid used for visual alignment.</span>
              <ToggleSwitch v-model="showGridValue" />
            </div>

            <div class="field settings-card">
              <label>Show Minimap</label>
              <span class="field-help">Display a mini-map in the canvas corner for quick panning on large topologies.</span>
              <ToggleSwitch v-model="showMinimapValue" />
            </div>
          </div>
        </TabPanel>

        <TabPanel value="diagram">
          <div class="settings-section">
            <div class="field settings-card">
              <label>Default Azure Region</label>
              <Select v-model="defaultRegionValue" :options="regions" class="w-full" />
            </div>

            <div class="field settings-card">
              <label>Default Resource Group</label>
              <InputText v-model="defaultResourceGroupValue" class="w-full" />
            </div>

            <div class="field settings-card">
              <label>Auto-save interval (seconds)</label>
              <InputNumber v-model="autoSaveIntervalValue" :min="10" :max="300" class="w-full" />
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { DarkModeType, ThemeType } from '~/types/settings'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const changePasswordMutation = useChangePasswordMutation()
const logoutMutation = useLogoutMutation()

const activeTab = ref('appearance')
const oldPassword = ref('')
const newPassword = ref('')
const showPasswordSection = ref(false)
const pwError = ref('')
const pwSuccess = ref(false)

const selectedTheme = computed<ThemeType>({
  get: () => settingsStore.theme,
  set: value => settingsStore.updateTheme(value),
})

const darkModeValue = computed<DarkModeType>({
  get: () => settingsStore.darkMode,
  set: value => settingsStore.updateDarkMode(value),
})

const animateEdgesValue = computed<boolean>({
  get: () => settingsStore.animateEdges,
  set: value => settingsStore.updateSettings({ animateEdges: value }),
})

const showGridValue = computed<boolean>({
  get: () => settingsStore.showGrid,
  set: value => settingsStore.updateSettings({ showGrid: value }),
})

const showMinimapValue = computed<boolean>({
  get: () => settingsStore.showMinimap,
  set: value => settingsStore.updateSettings({ showMinimap: value }),
})

const defaultRegionValue = computed<string>({
  get: () => settingsStore.defaultRegion,
  set: value => settingsStore.updateSettings({ defaultRegion: value }),
})

const defaultResourceGroupValue = computed<string>({
  get: () => settingsStore.defaultResourceGroup,
  set: value => settingsStore.updateSettings({ defaultResourceGroup: value }),
})

const autoSaveIntervalValue = computed<number>({
  get: () => settingsStore.autoSaveInterval,
  set: value => {
    if (!Number.isFinite(value)) return
    settingsStore.updateSettings({ autoSaveInterval: Math.max(10, Math.min(300, value)) })
  },
})

const canSubmitPasswordChange = computed(() =>
  oldPassword.value.trim().length > 0
  && newPassword.value.trim().length > 0
)

const darkModeOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
]

const themes: Array<{ value: ThemeType; label: string; color: string }> = [
  { value: 'ocean-blue', label: 'Ocean Blue', color: '#0078d4' },
  { value: 'azure-dark', label: 'Azure Dark', color: '#004578' },
  { value: 'forest-green', label: 'Forest Green', color: '#107c10' },
  { value: 'sunset-orange', label: 'Sunset Orange', color: '#d83b01' },
  { value: 'midnight-purple', label: 'Midnight Purple', color: '#5c2d91' },
  { value: 'rose-gold', label: 'Rose Gold', color: '#c43e1c' },
]

const regions = ['eastus', 'eastus2', 'westus', 'westus2', 'westeurope', 'northeurope', 'southeastasia', 'australiaeast']

watch(() => settingsStore.showSettingsModal, (visible) => {
  if (!visible) {
    resetPasswordSection()
    return
  }

  activeTab.value = 'appearance'
  resetPasswordSection()
})

function resetPasswordSection() {
  oldPassword.value = ''
  newPassword.value = ''
  showPasswordSection.value = false
  pwError.value = ''
  pwSuccess.value = false
}

async function changePassword() {
  if (!canSubmitPasswordChange.value) {
    pwError.value = 'Enter both current and new password.'
    return
  }

  pwError.value = ''
  pwSuccess.value = false

  try {
    await changePasswordMutation.mutateAsync({ oldPassword: oldPassword.value, newPassword: newPassword.value })
    pwSuccess.value = true
    oldPassword.value = ''
    newPassword.value = ''
  } catch (err: any) {
    pwError.value = err.message || 'Failed to change password'
  }
}

async function logout() {
  try {
    await logoutMutation.mutateAsync()
    settingsStore.closeSettingsModal()
  } catch {
    // Keep the modal open when sign-out fails.
  }
}
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 0.5rem 0;
}

.profile-section {
  gap: 0.8rem;
}

.profile-section :deep(.p-divider-horizontal) {
  margin: 0.2rem 0;
}

.settings-sync-status {
  align-items: center;
  color: var(--text-color-secondary);
  display: inline-flex;
  font-size: 0.76rem;
  font-weight: 600;
  gap: 0.4rem;
  margin: 0.6rem 0 0.2rem;
}

.settings-sync-status.error {
  color: var(--danger);
}

.profile-header-card {
  align-items: center;
  background:
    radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--primary) 24%, transparent) 0%, transparent 54%),
    color-mix(in srgb, var(--surface-card) 90%, var(--primary) 10%);
  border: 1px solid color-mix(in srgb, var(--primary) 26%, var(--surface-border) 74%);
  border-radius: 0.8rem;
  display: flex;
  gap: 0.7rem;
  padding: 0.9rem;
}

.profile-avatar {
  align-items: center;
  background: color-mix(in srgb, var(--primary) 22%, var(--surface) 78%);
  border: 1px solid color-mix(in srgb, var(--primary) 45%, transparent);
  border-radius: 999px;
  color: var(--primary);
  display: flex;
  flex-shrink: 0;
  height: 40px;
  justify-content: center;
  width: 40px;
}

.profile-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.profile-title {
  margin: 0;
}

.profile-subtitle {
  color: var(--text-color-secondary);
  font-size: 0.76rem;
}

.highlighted-card {
  border-color: color-mix(in srgb, var(--primary) 22%, var(--surface-border) 78%);
}

.settings-card {
  border: 1px solid var(--surface-border);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--surface-card) 86%, var(--surface-ground) 14%);
  padding: 0.9rem;
}

.profile-section .settings-card {
  padding: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field label {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-color-secondary);
}

.profile-section :deep(.p-inputtext),
.profile-section :deep(.p-password-input) {
  padding: 0.55rem 0.75rem;
}

.field-help {
  font-size: 0.76rem;
  color: var(--text-color-secondary);
}

.section-title-row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.3rem;
}

.section-title-row-inline {
  align-items: center;
  flex-direction: row;
  justify-content: space-between;
}

.section-title-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

h4 {
  margin: 0;
  font-size: 0.94rem;
  color: var(--text-color);
}

.section-hint {
  font-size: 0.76rem;
  color: var(--text-color-secondary);
}

.danger-zone {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0;
}

.theme-grid {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.theme-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--surface-border) 85%, transparent);
}

.theme-swatch.active { border-color: var(--text-color); }

.check-icon { color: #fff; font-size: 1rem; }

.password-action-row {
  display: flex;
  justify-content: flex-start;
}

.sr-only-username {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
}

:deep(.p-password) {
  display: flex;
  width: 100%;
}

:deep(.p-password input) {
  width: 100%;
}
</style>
