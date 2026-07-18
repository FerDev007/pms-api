import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
export default defineConfig({
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['pms-mark.svg'],
            manifest: {
                name: 'PMS · Control de suministros',
                short_name: 'PMS',
                description: 'Inventario y estado de impresoras',
                theme_color: '#6b705c',
                background_color: '#ffe8d6',
                display: 'standalone',
                start_url: '/',
                icons: [{ src: '/pms-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
            },
            workbox: {
                navigateFallback: '/index.html',
                runtimeCaching: [],
                globPatterns: ['**/*.{js,css,html,svg,woff2}']
            }
        })
    ],
    server: {
        proxy: { '/pms': 'http://localhost:8000', '/health': 'http://localhost:8000' }
    }
});
