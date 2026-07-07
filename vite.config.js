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
        'pwa-192.svg',
        'pwa-512.svg',
        'icons.svg',
      ],
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,jpg,jpeg,webp,ico}',
        ],
        navigateFallback: null,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
})
