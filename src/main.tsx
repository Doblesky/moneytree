import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/polices.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/composants.css'
import './styles/coque.css'
import { App } from './App.tsx'
import { BandeauMiseAJour } from './app/BandeauMiseAJour.tsx'
import { parametres2026 } from './data/params/index.ts'
import { demanderStockagePersistant } from './storage/persistance.ts'

const racine = document.getElementById('root')
if (!racine) throw new Error('Élément #root introuvable dans index.html')

// Demande au navigateur de ne pas effacer les données locales (voir storage/persistance.ts).
void demanderStockagePersistant()

function erreurParametres(erreur: unknown) {
  console.error(erreur)
  return (
    <main className="ecran" role="alert">
      <h1 className="titre-m">Paramètres invalides</h1>
      <p className="texte-secondaire">
        Le fichier des paramètres (taux, barèmes, plafonds) ne respecte pas son format :
        l’appli refuse de calculer avec des valeurs douteuses.
      </p>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
        {erreur instanceof Error ? erreur.message : String(erreur)}
      </pre>
    </main>
  )
}

// Valide les paramètres annuels avant d'afficher l'appli.
let contenu
try {
  parametres2026()
  contenu = <App />
} catch (erreur) {
  contenu = erreurParametres(erreur)
}

// Le bandeau de mise à jour (et l'enregistrement du service worker) reste monté même si
// les paramètres sont invalides : une version corrigée peut alors s'installer.
createRoot(racine).render(
  <StrictMode>
    {contenu}
    <BandeauMiseAJour />
  </StrictMode>,
)
