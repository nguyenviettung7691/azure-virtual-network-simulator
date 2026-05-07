import { defineStore } from 'pinia'

export const useSavedSetupsStore = defineStore('savedSetups', {
  state: () => ({
    showModal: false,
  }),

  actions: {
    openModal() {
      this.showModal = true
    },

    closeModal() {
      this.showModal = false
    },
  },
})
