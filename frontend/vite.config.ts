import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pms-icon.svg', 'favicon-64.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'PMS · Control de suministros',
        short_name: 'PMS',
        description: 'Inventario y estado de impresoras',
        theme_color: '#f6f4ef',
        background_color: '#f6f4ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pms-logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pms-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pms-logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
  ]
  // No dev proxy: the API is an absolute cross-origin URL (VITE_API_URL) in every
  // environment now, and the Edge Function's CORS allowlist includes localhost:5173.
})
