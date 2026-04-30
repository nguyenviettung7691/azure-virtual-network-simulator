export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  modules: [
    '@primevue/nuxt-module',
    '@pinia/nuxt',
  ],
  primevue: {
    options: {
      theme: {
        preset: 'Aura',
        options: {
          prefix: 'p',
          darkModeSelector: '.dark-mode',
          cssLayer: false,
        },
      },
      ripple: true,
    },
  },
  css: ['~/assets/css/main.css', '~/assets/css/diagram.css'],
  runtimeConfig: {
    public: {
      awsRegion: process.env.NUXT_PUBLIC_AWS_REGION || 'us-east-1',
      cognitoUserPoolId: process.env.NUXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      cognitoClientId: process.env.NUXT_PUBLIC_COGNITO_CLIENT_ID || '',
      s3Bucket: process.env.NUXT_PUBLIC_S3_BUCKET || '',
      bedrockRegion: process.env.NUXT_PUBLIC_BEDROCK_REGION || 'us-east-1',
    },
  },
  vite: {
    optimizeDeps: {
      include: ['dagre', '@vue-flow/core', '@vue-flow/background', '@vue-flow/controls', '@vue-flow/minimap'],
    },
  },
  app: {
    head: {
      title: 'Azure Virtual Network Simulator',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Interactive Azure Virtual Network topology designer and simulator' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
})
