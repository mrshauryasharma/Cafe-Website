import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Kimmo’s Kitchen Terminal & Loyalty',
        short_name: 'Kimmo’s Kitchen',
        description: 'Smart Café Billing, Loyalty, and Membership Terminal',
        theme_color: '#111111',
        background_color: '#FAF9F6',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'vite.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}']
      }
    })
  ],
  server: {
    port: 3000
  }
});
