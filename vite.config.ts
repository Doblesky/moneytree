/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Chemin de base de l'appli publiée. En local : « / ». Sur GitHub Pages, le workflow
// de déploiement passe BASE_PATH=/<nom-du-dépôt>/.
const base = process.env.BASE_PATH ?? '/'

/**
 * Commit dont l'appli est construite, affiché dans Réglages › À propos. Sur GitHub Actions,
 * GITHUB_SHA le donne ; en local, on interroge git et on signale les modifications non
 * commitées, pour ne pas confondre une version de travail avec la version publiée.
 */
function commitCourant(): string {
  const depuisCI = process.env.GITHUB_SHA
  if (depuisCI) return depuisCI.slice(0, 7)
  try {
    const commit = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim()
    const modifie = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== ''
    return modifie ? `${commit}-modifié` : commit
  } catch {
    return 'inconnu'
  }
}

// Couleurs reprises de la planche de direction artistique (01_Maquettes/…/Main.dc.html).
const vertDeMarque = '#1E3A2B'
const cremePapier = '#F4EEDF'

export default defineConfig({
  base,
  // Version de l'appli, lue par src/lib/version.ts.
  define: {
    __MONEYTREE_VERSION__: JSON.stringify({
      commit: commitCourant(),
      construiteLe: new Date().toISOString(),
    }),
  },
  build: {
    rolldownOptions: {
      output: {
        // Bibliothèques dans des fichiers à part : elles changent rarement, et le service
        // worker n'a pas à les retélécharger à chaque mise à jour de l'appli.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'routeur', test: /node_modules[\\/](react-router|cookie|set-cookie-parser)[\\/]/ },
            { name: 'donnees', test: /node_modules[\\/](dexie|dexie-react-hooks|zod)[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // La nouvelle version s'installe d'elle-même dès qu'elle est trouvée ; l'appli
      // propose alors de recharger (src/app/BandeauMiseAJour.tsx) au lieu de le faire
      // d'office, pour ne pas couper l'utilisateur en plein exercice.
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
        // Le compagnon Android (public/compagnon/) doit se télécharger, pas ouvrir l'appli.
        navigateFallbackDenylist: [/\/compagnon\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
