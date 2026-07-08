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
        'monrad-icon-192.png',
        'monrad-icon-512.png',
        'apple-touch-icon.png',
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
