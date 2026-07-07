import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: false,
      includeAssets: [
        'favicon.svg',
        'manifest.webmanifest',
        'monrad-logo-cropped.jpg',
        'pwa-192.svg',
        'pwa-512.svg',
      ],
      workbox: {
        globPatterns: [],
        navigateFallback: null,
        runtimeCaching: [],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
