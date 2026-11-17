import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Icone } from '../ui/Icone.tsx'

/** Tant que l'appli reste ouverte, on cherche une nouvelle version toutes les heures. */
const INTERVALLE_VERIFICATION_MS = 60 * 60 * 1000

function chercherNouvelleVersion(enregistrement: ServiceWorkerRegistration) {
  if (enregistrement.installing || !navigator.onLine) return
  enregistrement.update().catch(() => {
    // Serveur injoignable : on réessaiera à la prochaine vérification.
  })
}

/**
 * Enregistre le service worker et affiche un bandeau quand une nouvelle version vient de
 * s'installer. L'appli à l'écran tourne encore sur l'ancien code : « Recharger » passe à
 * la nouvelle tout de suite. Sinon, elle s'affichera à la prochaine ouverture.
 *
 * Le navigateur cherche une mise à jour à chaque lancement. On cherche aussi au retour
 * au premier plan (une appli installée reste souvent en arrière-plan des jours entiers)
 * et toutes les heures.
 *
 * Monté une seule fois, à la racine : les écouteurs vivent aussi longtemps que l'appli.
 * En développement, le module virtuel ne fait rien (pas de service worker).
 */
export function BandeauMiseAJour() {
  const [nouvelleVersion, setNouvelleVersion] = useState(false)
  const [masque, setMasque] = useState(false)

  useRegisterSW({
    onNeedReload() {
      setNouvelleVersion(true)
    },
    onRegisteredSW(_url, enregistrement) {
      if (!enregistrement) return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') chercherNouvelleVersion(enregistrement)
      })
      setInterval(() => {
        chercherNouvelleVersion(enregistrement)
      }, INTERVALLE_VERIFICATION_MS)
    },
  })

  if (!nouvelleVersion || masque) return null

  return (
    <div className="bandeau-maj" role="status">
      <div className="ligne__libelle">
        <span className="ligne__titre">Nouvelle version installée</span>
        <span className="texte-secondaire">
          Recharge pour l’utiliser. Tes données restent sur ce téléphone.
        </span>
      </div>
      <div className="bandeau-maj__actions">
        <button
          type="button"
          className="lien-tertiaire"
          onClick={() => {
            window.location.reload()
          }}
        >
          <Icone nom="actualiser" taille={18} epaisseur={2} />
          Recharger
        </button>
        <button
          type="button"
          className="lien-debloquer"
          onClick={() => {
            setMasque(true)
          }}
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}
