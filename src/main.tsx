import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/polices.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/composants.css'
import './styles/coque.css'
import { App } from './App.tsx'
import { demanderStockagePersistant } from './storage/persistance.ts'

const racine = document.getElementById('root')
if (!racine) throw new Error('Élément #root introuvable dans index.html')

// Demande au navigateur de ne pas effacer les données locales (voir storage/persistance.ts).
void demanderStockagePersistant()

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
