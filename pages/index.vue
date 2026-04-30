<template>
  <div class="app-container">
    <AppHeader />
    <div class="main-content">
      <LeftPanel />
      <div class="diagram-area">
        <DiagramCanvas />
      </div>
      <RightPanel />
    </div>
    <BottomToolbar />
    <ChallengePanel />

    <!-- Global Modals -->
    <AuthModal />
    <AccountSettingsModal />
    <SavedSetupsModal />
    <ComponentFormModal />
    <ConfirmActionDialog />
    <ChallengeSetupModal />
    <CongratulationsModal />
    <TestFormModal />
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Azure Virtual Network Simulator' })
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--surface-ground);
  color: var(--text-color);
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.diagram-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
}
</style>
