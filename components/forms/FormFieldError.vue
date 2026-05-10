<template>
  <div class="form-field-error-wrapper">
    <input-wrapper
      :class="{ 'has-error': error }"
      class="form-field-input"
    >
      <slot />
    </input-wrapper>
    <small v-if="error" :class="['error-text', `severity-${severity}`]">
      {{ error }}
    </small>
  </div>
</template>

<script setup lang="ts">
interface Props {
  error?: string
  severity?: 'error' | 'warning'
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'error',
})
</script>

<style scoped>
.form-field-error-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  position: relative;
}

.form-field-input.has-error :deep(input),
.form-field-input.has-error :deep(textarea),
.form-field-input.has-error :deep(.p-inputtext),
.form-field-input.has-error :deep(.p-select),
.form-field-input.has-error :deep(.p-select-trigger),
.form-field-input.has-error :deep(.p-inputnumber-input) {
  border-color: var(--red-500) !important;
  background-color: var(--red-50);
}

.error-text {
  font-size: 0.75rem;
  padding: 0.2rem 0.35rem;
  border-radius: 4px;
  display: inline-block;
  max-width: 100%;
  word-break: break-word;
}

.error-text.severity-error {
  color: var(--red-700);
  background-color: var(--red-50);
}

.error-text.severity-warning {
  color: var(--orange-700);
  background-color: var(--orange-50);
}
</style>
