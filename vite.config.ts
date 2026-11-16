/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Chemin de base de l'appli publiée. En local : « / ». Sur GitHub Pages, le workflow
// de déploiement passe BASE_PATH=/<nom-du-dépôt>/.
const base = process.env.BASE_PATH ?? '/'

// Couleurs reprises de la planche de direction artistique (01_Maquettes/…/Main.dc.html).
const vertDeMarque = '#1E3A2B'
const cremePapier = '#F4EEDF'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'monogramme.svg'],
      manifest: {
        name: 'MoneyTree',
        short_name: 'MoneyTree',
        description:
          "Apprendre à gérer et investir un salaire d'ingénieur en France. Éducatif, aucun conseil en investissement.",
        lang: 'fr',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: vertDeMarque,
        background_color: cremePapier,
        categories: ['education', 'finance'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Tout ce qui sert à l'appli est mis en cache au premier chargement : elle
        // fonctionne ensuite hors ligne. Les polices .woff (repli pour vieux navigateurs)
        // sont exclues, seules les .woff2 servent.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
