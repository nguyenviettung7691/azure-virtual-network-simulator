<template>
  <div ref="rootRef" class="command-palette">
    <div class="palette-input-shell" :class="{ 'palette-open': isOpen }">
      <i class="pi pi-search palette-search-icon" aria-hidden="true" />
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="palette-input"
        placeholder="Insert components here"
        aria-label="Search and insert Azure components"
        autocomplete="off"
        @focus="openDropdown"
        @keydown="onInputKeydown"
      />
      <span class="palette-shortcut" aria-hidden="true">Ctrl/Cmd+K</span>
    </div>

    <div
      v-if="isOpen"
      ref="dropdownRef"
      class="palette-dropdown"
      role="listbox"
      aria-label="Available Azure components"
    >
      <template v-if="groupedResults.length > 0">
        <section
          v-for="section in groupedResults"
          :key="section.category"
          class="palette-section"
        >
          <h4 class="palette-section-title">{{ section.category }}</h4>
          <button
            v-for="(item, index) in section.items"
            :id="getOptionId(section.startIndex + index)"
            :key="item.type"
            type="button"
            class="palette-option"
            :class="{ 'palette-option-active': activeIndex === section.startIndex + index }"
            role="option"
            :aria-selected="activeIndex === section.startIndex + index"
            @mousedown.prevent
            @mouseenter="activeIndex = section.startIndex + index"
            @click="selectItem(item)"
          >
            <Icon :name="item.icon" mode="svg" :style="{ color: item.color }" class="palette-option-icon" />
            <span class="palette-option-text">
              <strong class="palette-option-label">{{ item.label }}</strong>
              <span class="palette-option-description">{{ item.description }}</span>
            </span>
          </button>
        </section>
      </template>

      <div v-else class="palette-empty-state">
        <i class="pi pi-info-circle" aria-hidden="true" />
        <span>No components match your search.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NetworkComponentType,
  COMPONENT_CATEGORY_ORDER,
  COMPONENTS_BY_CATEGORY,
  getComponentLabel,
  getComponentColor,
  type ComponentCategory,
} from '~/types/network'
import { getAzureTopBarIcon } from '~/lib/azureIcons'

interface PaletteItem {
  type: NetworkComponentType
  category: ComponentCategory
  label: string
  description: string
  icon: string
  color: string
  aliases: string[]
}

interface PaletteSection {
  category: ComponentCategory
  items: PaletteItem[]
  startIndex: number
}

const COMPONENT_DESCRIPTIONS: Partial<Record<NetworkComponentType, string>> = {
  [NetworkComponentType.VNET]: 'Fundamental logical network boundary',
  [NetworkComponentType.SUBNET]: 'Address range inside a VNet',
  [NetworkComponentType.NETWORK_IC]: 'Connects compute to network resources',
  [NetworkComponentType.IP_ADDRESS]: 'Public internet-facing IP endpoint',
  [NetworkComponentType.DNS_ZONE]: 'DNS records for name resolution',
  [NetworkComponentType.VNET_PEERING]: 'Private connectivity between VNets',
  [NetworkComponentType.UDR]: 'Custom routes for traffic steering',
  [NetworkComponentType.NSG]: 'Traffic filtering rules at layer 4',
  [NetworkComponentType.ASG]: 'Application-aware workload grouping',
  [NetworkComponentType.FIREWALL]: 'Managed stateful perimeter firewall',
  [NetworkComponentType.BASTION]: 'Secure browser-based VM access',
  [NetworkComponentType.SERVICE_ENDPOINT]: 'Direct service access over backbone',
  [NetworkComponentType.PRIVATE_ENDPOINT]: 'Private IP access to PaaS services',
  [NetworkComponentType.VPN_GATEWAY]: 'Encrypted hybrid network tunnel',
  [NetworkComponentType.APP_GATEWAY]: 'Layer 7 web traffic load balancer',
  [NetworkComponentType.NVA]: 'Third-party network appliance',
  [NetworkComponentType.LOAD_BALANCER]: 'Layer 4 traffic distribution service',
  [NetworkComponentType.VM]: 'Single virtual machine workload',
  [NetworkComponentType.VMSS]: 'Autoscaling VM fleet',
  [NetworkComponentType.AKS]: 'Managed Kubernetes cluster service',
  [NetworkComponentType.APP_SERVICE]: 'Managed web app hosting platform',
  [NetworkComponentType.FUNCTIONS]: 'Event-driven serverless compute',
  [NetworkComponentType.STORAGE_ACCOUNT]: 'Core account for Azure storage services',
  [NetworkComponentType.BLOB_STORAGE]: 'Object storage for unstructured data',
  [NetworkComponentType.MANAGED_DISK]: 'Persistent block storage for VMs',
  [NetworkComponentType.KEY_VAULT]: 'Secrets, keys, and certificate store',
  [NetworkComponentType.MANAGED_IDENTITY]: 'Credential-free resource authentication',
}

const COMPONENT_ALIASES: Partial<Record<NetworkComponentType, string[]>> = {
  [NetworkComponentType.NETWORK_IC]: ['nic', 'network interface'],
  [NetworkComponentType.IP_ADDRESS]: ['public ip', 'pip', 'ip'],
  [NetworkComponentType.NSG]: ['nsg', 'security group'],
  [NetworkComponentType.ASG]: ['asg', 'application security group'],
  [NetworkComponentType.VPN_GATEWAY]: ['vpn', 'gateway'],
  [NetworkComponentType.APP_GATEWAY]: ['app gw', 'application gateway', 'waf'],
  [NetworkComponentType.LOAD_BALANCER]: ['lb', 'load balancer'],
  [NetworkComponentType.VM]: ['virtual machine'],
  [NetworkComponentType.VMSS]: ['scale set', 'vmss'],
  [NetworkComponentType.FUNCTIONS]: ['function app', 'serverless'],
  [NetworkComponentType.STORAGE_ACCOUNT]: ['storage'],
  [NetworkComponentType.KEY_VAULT]: ['keyvault', 'vault'],
  [NetworkComponentType.MANAGED_IDENTITY]: ['identity', 'msi'],
  [NetworkComponentType.VNET]: ['virtual network', 'vnet'],
  [NetworkComponentType.SUBNET]: ['subnet'],
  [NetworkComponentType.AKS]: ['kubernetes', 'aks'],
  [NetworkComponentType.UDR]: ['route table', 'udr'],
  [NetworkComponentType.PRIVATE_ENDPOINT]: ['private link', 'private endpoint'],
  [NetworkComponentType.SERVICE_ENDPOINT]: ['service endpoint'],
}

const diagramStore = useDiagramStore()

const query = ref('')
const isOpen = ref(false)
const activeIndex = ref(-1)
const inputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)

const allItems = computed<PaletteItem[]>(() =>
  COMPONENT_CATEGORY_ORDER.flatMap((category) =>
    COMPONENTS_BY_CATEGORY[category].map((type) => ({
      type,
      category,
      label: getComponentLabel(type),
      description: COMPONENT_DESCRIPTIONS[type] || 'Azure network component',
      icon: getAzureTopBarIcon(type),
      color: getComponentColor(type),
      aliases: COMPONENT_ALIASES[type] || [],
    }))
  )
)

const filteredItems = computed<PaletteItem[]>(() => {
  const normalizedQuery = normalizeText(query.value)
  if (!normalizedQuery) {
    return [...allItems.value]
  }

  return allItems.value
    .map((item) => ({ item, score: scoreItem(item, normalizedQuery) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      const categoryDelta = COMPONENT_CATEGORY_ORDER.indexOf(a.item.category) - COMPONENT_CATEGORY_ORDER.indexOf(b.item.category)
      if (categoryDelta !== 0) return categoryDelta
      return a.item.label.localeCompare(b.item.label)
    })
    .map((entry) => entry.item)
})

const groupedResults = computed<PaletteSection[]>(() => {
  let startIndex = 0
  return COMPONENT_CATEGORY_ORDER
    .map((category) => {
      const items = filteredItems.value.filter((item) => item.category === category)
      if (items.length === 0) return null
      const section: PaletteSection = { category, items, startIndex }
      startIndex += items.length
      return section
    })
    .filter((section): section is PaletteSection => !!section)
})

const flatResults = computed<PaletteItem[]>(() => groupedResults.value.flatMap((section) => section.items))

watch([query, groupedResults], () => {
  if (!isOpen.value) return
  activeIndex.value = flatResults.value.length > 0 ? 0 : -1
})

function normalizeText(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ')
}

function scoreItem(item: PaletteItem, normalizedQuery: string): number {
  const label = normalizeText(item.label)
  const description = normalizeText(item.description)
  const tokens = normalizedQuery.split(' ')

  let score = 0
  for (const token of tokens) {
    if (!token) continue

    const exactAlias = item.aliases.some((alias) => normalizeText(alias) === token)
    if (exactAlias) {
      score += 130
      continue
    }

    if (label === token) {
      score += 120
      continue
    }

    if (label.startsWith(token)) {
      score += 95
      continue
    }

    if (label.includes(token)) {
      score += 75
      continue
    }

    const aliasPrefix = item.aliases.some((alias) => normalizeText(alias).startsWith(token))
    if (aliasPrefix) {
      score += 70
      continue
    }

    const aliasContains = item.aliases.some((alias) => normalizeText(alias).includes(token))
    if (aliasContains) {
      score += 60
      continue
    }

    if (description.includes(token)) {
      score += 30
      continue
    }

    return -1
  }

  if (label === normalizedQuery) score += 35
  return score
}

function getOptionId(index: number): string {
  return `component-command-option-${index}`
}

function openDropdown() {
  isOpen.value = true
  activeIndex.value = flatResults.value.length > 0 ? 0 : -1
}

function closeDropdown() {
  isOpen.value = false
  activeIndex.value = -1
}

function focusPalette() {
  openDropdown()
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function selectItem(item: PaletteItem) {
  diagramStore.openAddComponentModal(item.type)
  query.value = ''
  closeDropdown()
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!isOpen.value) openDropdown()
    moveActiveIndex(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isOpen.value) openDropdown()
    moveActiveIndex(-1)
    return
  }

  if (event.key === 'Enter') {
    if (!isOpen.value || activeIndex.value < 0) return
    event.preventDefault()
    const item = flatResults.value[activeIndex.value]
    if (item) selectItem(item)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeDropdown()
    return
  }

  if (event.key === 'Tab') {
    closeDropdown()
  }
}

function moveActiveIndex(delta: number) {
  const total = flatResults.value.length
  if (total === 0) {
    activeIndex.value = -1
    return
  }

  if (activeIndex.value < 0) {
    activeIndex.value = delta > 0 ? 0 : total - 1
    return
  }

  activeIndex.value = (activeIndex.value + delta + total) % total
}

function isTextEntryElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const isTextboxRole = target.getAttribute('role') === 'textbox'
  return target.isContentEditable
    || isTextboxRole
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value) return
  if (!rootRef.value) return

  const target = event.target as Node | null
  if (!target) return

  if (!rootRef.value.contains(target)) {
    closeDropdown()
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  const isPaletteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
  if (!isPaletteShortcut) return

  const targetIsInput = isTextEntryElement(event.target)
  const targetIsPaletteInput = event.target === inputRef.value
  if (targetIsInput && !targetIsPaletteInput) return

  event.preventDefault()
  focusPalette()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<style scoped>
.command-palette {
  position: relative;
  width: 100%;
  max-width: 680px;
  margin-inline: auto;
}

@media (min-width: 1920px) {
  .command-palette {
    max-width: 820px;
  }
}

@media (max-width: 1919px) {
  .command-palette {
    max-width: 760px;
  }
}

@media (max-width: 1599px) {
  .command-palette {
    max-width: 700px;
  }
}

@media (max-width: 1279px) {
  .command-palette {
    max-width: 620px;
  }
}

@media (max-width: 1151px) {
  .command-palette {
    max-width: 560px;
  }
}

@media (max-width: 1024px) {
  .command-palette {
    max-width: 500px;
  }
}

.palette-input-shell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 44px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-card) 86%, var(--primary-color) 14%);
  padding: 0 0.75rem;
  transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
}

.palette-open,
.palette-input-shell:focus-within {
  border-color: color-mix(in srgb, var(--primary-color) 58%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 18%, transparent);
  background: color-mix(in srgb, var(--surface-card) 92%, var(--primary-color) 8%);
}

.palette-search-icon {
  color: var(--text-color-secondary);
  font-size: 0.88rem;
}

.palette-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-color);
  font-size: 0.9rem;
  font-weight: 600;
}

.palette-input::placeholder {
  color: color-mix(in srgb, var(--text-color-secondary) 88%, transparent);
  font-weight: 500;
}

.palette-shortcut {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--text-color-secondary);
  border: 1px solid color-mix(in srgb, var(--surface-border) 65%, transparent);
  border-radius: 999px;
  padding: 0.16rem 0.44rem;
  white-space: nowrap;
}

.palette-dropdown {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 0;
  right: 0;
  max-height: min(64vh, 560px);
  overflow-y: auto;
  padding: 0.55rem;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-card) 97%, #ffffff 3%);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.2);
  z-index: 240;
}

.palette-section {
  margin-bottom: 0.45rem;
}

.palette-section:last-child {
  margin-bottom: 0;
}

.palette-section-title {
  margin: 0;
  padding: 0.28rem 0.45rem;
  color: var(--text-color-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.palette-option {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 0.62rem;
  padding: 0.52rem 0.6rem;
  text-align: left;
  cursor: pointer;
}

.palette-option:hover,
.palette-option-active {
  border-color: color-mix(in srgb, var(--primary-color) 44%, transparent);
  background: color-mix(in srgb, var(--primary-color) 13%, transparent);
}

.palette-option-icon {
  width: 1.45rem;
  height: 1.45rem;
  flex-shrink: 0;
}

.palette-option-text {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  min-width: 0;
}

.palette-option-label {
  font-size: 0.9rem;
  line-height: 1.2;
}

.palette-option-description {
  font-size: 0.77rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  line-height: 1.2;
}

.palette-empty-state {
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  font-weight: 600;
}

@media (max-width: 1024px) {
  .command-palette {
    width: min(100%, 500px);
  }

  .palette-input-shell {
    height: 40px;
    border-radius: 10px;
    padding: 0 0.58rem;
    gap: 0.4rem;
  }

  .palette-input {
    font-size: 0.84rem;
  }

  .palette-shortcut {
    display: none;
  }

  .palette-dropdown {
    max-height: min(70vh, 520px);
    border-radius: 12px;
    padding: 0.45rem;
  }

  .palette-option {
    padding: 0.56rem 0.52rem;
  }
}
</style>
