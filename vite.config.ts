import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pulse-icon.svg'],
      manifest: {
        name: 'PULSE — Your people. Your moments. Your world.',
        short_name: 'PULSE',
        description: 'Connect privately. Share your moments. Discover your world.',
        theme_color: '#0A0A0B',
        background_color: '#0A0A0B',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/pulse-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});
