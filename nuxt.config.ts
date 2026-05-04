export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-04-30',
  devtools: { enabled: false },
  components: {
    dirs: [
      { path: '~/components', pathPrefix: false },
    ],
  },
  modules: [
    '@primevue/nuxt-module',
    '@pinia/nuxt',
  ],
  primevue: {
    importTheme: { as: 'PrimeVueTheme', from: '~/assets/primevue-theme.ts' },
    options: {
      ripple: true,
    },
    // Restrict auto-import to only the components actually used in this project.
    // The default (include: '*') registers all 100+ PrimeVue components as Vite
    // modules, each with an associated Style module — causing steady heap growth
    // in dev mode as the module graph accumulates across HMR cycles.
    components: {
      include: [
        'Accordion', 'AccordionContent', 'AccordionHeader', 'AccordionPanel',
        'Button',
        'Checkbox',
        'Dialog',
        'Divider',
        'InputNumber', 'InputText',
        'Message',
        'MeterGroup',
        'Password',
        'ProgressBar', 'ProgressSpinner',
        'Select', 'SelectButton',
        'Tabs', 'Tab', 'TabList', 'TabPanel', 'TabPanels',
        'Tag',
        'Textarea',
        'ToggleSwitch',
        'Tooltip',
      ],
    },
  },
  css: [
    'primeicons/primeicons.css',
    '@vue-flow/core/dist/style.css',
    '@vue-flow/controls/dist/style.css',
    '~/assets/css/main.css',
    '~/assets/css/diagram.css',
  ],
  runtimeConfig: {
    public: {
      awsRegion: process.env.NUXT_PUBLIC_AWS_REGION || 'us-east-1',
      cognitoUserPoolId: process.env.NUXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      cognitoClientId: process.env.NUXT_PUBLIC_COGNITO_CLIENT_ID || '',
      s3Bucket: process.env.NUXT_PUBLIC_S3_BUCKET || '',
      bedrockRegion: process.env.NUXT_PUBLIC_BEDROCK_REGION || 'us-east-1',
      mongodbEndpoint: process.env.NUXT_PUBLIC_MONGODB_ENDPOINT || '',
      mongodbApiKey: process.env.NUXT_PUBLIC_MONGODB_API_KEY || '',
      mongodbDatabase: process.env.NUXT_PUBLIC_MONGODB_DATABASE || 'vnet-simulator',
      mongodbCollection: process.env.NUXT_PUBLIC_MONGODB_COLLECTION || 'user_settings',
    },
  },
  vite: {
    optimizeDeps: {
      include: ['dagre', '@vue-flow/core', '@vue-flow/background', '@vue-flow/controls', '@vue-flow/minimap'],
    },
    worker: {
      format: 'es',
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
        { rel: 'icon', type: 'image/svg+xml', href: '/virtual-networks.svg' },
      ],
    },
  },
})
