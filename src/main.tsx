import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/polices.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/composants.css'
import { App } from './App.tsx'

const racine = document.getElementById('root')
if (!racine) throw new Error('Élément #root introuvable dans index.html')

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
