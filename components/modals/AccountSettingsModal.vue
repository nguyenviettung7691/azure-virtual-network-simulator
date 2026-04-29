<template>
  <Dialog
    v-model:visible="settingsStore.showSettingsModal"
    modal
    header="Account Settings"
    :style="{ width: '520px' }"
    @hide="settingsStore.closeSettingsModal()"
  >
    <Tabs value="appearance">
      <TabList>
        <Tab value="profile">Profile</Tab>
        <Tab value="appearance">Appearance</Tab>
        <Tab value="layout">Layout</Tab>
      </TabList>

      <TabPanels>
        <TabPanel value="profile">
          <div class="settings-section">
            <div class="field">
              <label>Email</label>
              <InputText :value="authStore.user?.email || ''" disabled class="w-full" />
            </div>
            <Divider />
            <h4>Change Password</h4>
            <div class="field">
              <label>Current Password</label>
              <Password v-model="oldPassword" :feedback="false" toggleMask inputClass="w-full" class="w-full" />
            </div>
            <div class="field">
              <label>New Password</label>
              <Password v-model="newPassword" :feedback="false" toggleMask inputClass="w-full" class="w-full" />
            </div>
            <Message v-if="pwError" severity="error" :closable="false">{{ pwError }}</Message>
            <Message v-if="pwSuccess" severity="success" :closable="false">Password changed successfully</Message>
            <Button label="Change Password" size="small" :loading="changingPw" @click="changePassword" />
            <Divider />
            <Button label="Sign Out" icon="pi pi-sign-out" severity="danger" text @click="logout" />
          </div>
        </TabPanel>

        <TabPanel value="appearance">
          <div class="settings-section">
            <div class="field">
              <label>Color Theme</label>
              <div class="theme-grid">
                <div
                  v-for="theme in themes"
                  :key="theme.value"
                  class="theme-swatch"
                  :class="{ active: settingsStore.theme === theme.value }"
                  :style="{ background: theme.color }"
                  :title="theme.label"
                  @click="settingsStore.updateTheme(theme.value as any)"
                >
                  <Icon v-if="settingsStore.theme === theme.value" icon="mdi:check" class="check-icon" />
                </div>
              </div>
            </div>
            <div class="field">
              <label>Dark Mode</label>
              <SelectButton
                v-model="darkModeValue"
                :options="darkModeOptions"
                option-label="label"
                option-value="value"
                @change="settingsStore.updateDarkMode(darkModeValue as any)"
              />
            </div>
            <div class="field">
              <label>Animate Edges</label>
              <ToggleSwitch v-model="animateEdges" @change="settingsStore.updateSettings({ animateEdges })" />
            </div>
            <div class="field">
              <label>Show Grid</label>
              <ToggleSwitch v-model="showGrid" @change="settingsStore.updateSettings({ showGrid })" />
            </div>
            <div class="field">
              <label>Show Minimap</label>
              <ToggleSwitch v-model="showMinimap" @change="settingsStore.updateSettings({ showMinimap })" />
            </div>
          </div>
        </TabPanel>

        <TabPanel value="layout">
          <div class="settings-section">
            <div class="field">
              <label>Default Azure Region</label>
              <Select v-model="defaultRegion" :options="regions" class="w-full" @change="settingsStore.updateSettings({ defaultRegion })" />
            </div>
            <div class="field">
              <label>Default Resource Group</label>
              <InputText v-model="defaultResourceGroup" class="w-full" @blur="settingsStore.updateSettings({ defaultResourceGroup })" />
            </div>
            <div class="field">
              <label>Auto-save interval (seconds)</label>
              <InputNumber v-model="autoSaveInterval" :min="10" :max="300" class="w-full" @blur="settingsStore.updateSettings({ autoSaveInterval })" />
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const oldPassword = ref('')
const newPassword = ref('')
const pwError = ref('')
const pwSuccess = ref(false)
const changingPw = ref(false)

const darkModeValue = ref(settingsStore.darkMode)
const animateEdges = ref(settingsStore.animateEdges)
const showGrid = ref(settingsStore.showGrid)
const showMinimap = ref(settingsStore.showMinimap)
const defaultRegion = ref(settingsStore.defaultRegion)
const defaultResourceGroup = ref(settingsStore.defaultResourceGroup)
const autoSaveInterval = ref(settingsStore.autoSaveInterval)

const darkModeOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
]

const themes = [
  { value: 'ocean-blue', label: 'Ocean Blue', color: '#0078d4' },
  { value: 'azure-dark', label: 'Azure Dark', color: '#004578' },
  { value: 'forest-green', label: 'Forest Green', color: '#107c10' },
  { value: 'sunset-orange', label: 'Sunset Orange', color: '#d83b01' },
  { value: 'midnight-purple', label: 'Midnight Purple', color: '#5c2d91' },
  { value: 'rose-gold', label: 'Rose Gold', color: '#c43e1c' },
]

const regions = ['eastus', 'eastus2', 'westus', 'westus2', 'westeurope', 'northeurope', 'southeastasia', 'australiaeast']

async function changePassword() {
  if (!oldPassword.value || !newPassword.value) return
  changingPw.value = true
  pwError.value = ''
  pwSuccess.value = false
  try {
    await authStore.changePassword(oldPassword.value, newPassword.value)
    pwSuccess.value = true
    oldPassword.value = ''
    newPassword.value = ''
  } catch (err: any) {
    pwError.value = err.message || 'Failed to change password'
  } finally {
    changingPw.value = false
  }
}

async function logout() {
  await authStore.logout()
  settingsStore.closeSettingsModal()
}
</script>

<style scoped>
.settings-section { display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-size: 0.85rem; font-weight: 600; color: var(--text-color-secondary); }
h4 { margin: 0; font-size: 0.9rem; color: var(--text-color); }
.theme-grid { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.theme-swatch {
  width: 36px; height: 36px; border-radius: 50%; cursor: pointer;
  border: 3px solid transparent; display: flex; align-items: center; justify-content: center;
  transition: border-color 0.2s;
}
.theme-swatch.active { border-color: var(--text-color); }
.check-icon { color: #fff; font-size: 1rem; }
</style>
