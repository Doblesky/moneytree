// Génère les icônes PNG de la PWA à partir du monogramme (public/monogramme.svg).
// À relancer seulement si le monogramme change : `npm run icones`. Les PNG sont commités,
// le build n'a donc pas besoin de sharp.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const vertDeMarque = '#1E3A2B'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Icône « maskable » : fond plein, monogramme dans la zone sûre (cercle de 80 %).
    maskable: {
      sizes: [512],
      padding: 0.12,
      resizeOptions: { background: vertDeMarque },
    },
    apple: {
      sizes: [180],
      padding: 0.12,
      resizeOptions: { background: vertDeMarque },
    },
  },
  images: ['public/monogramme.svg'],
})
