/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Chemin de base de l'appli publiée. En local : « / ». Sur GitHub Pages, le workflow
// de déploiement passe BASE_PATH=/<nom-du-dépôt>/.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
