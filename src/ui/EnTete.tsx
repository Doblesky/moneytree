import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icone } from './Icone.tsx'
import { Monogramme } from './Monogramme.tsx'
import { Rosace } from './Rosace.tsx'

interface Props {
  titre: string
  sousTitre?: string
  /** Éléments à droite de la marque (pastilles, bouton Réglages…). */
  actions?: ReactNode
  /** Affiche une flèche de retour à la place de la marque. */
  retour?: boolean
}

/** En-tête vert des écrans : guillochis, rosace, double filet doré. */
export function EnTete({ titre, sousTitre, actions, retour = false }: Props) {
  const naviguer = useNavigate()

  useEffect(() => {
    document.title = `${titre} · MoneyTree`
  }, [titre])

  return (
    <header className="entete sur-vert">
      <Rosace taille={220} className="entete__rosace" />
      <div className="entete__contenu">
        <div className="entete__barre">
          {retour ? (
            <button
              type="button"
              className="bouton-icone bouton-icone--retour"
              aria-label="Retour"
              onClick={() => {
                // Revient à l'écran précédent ; si l'appli a été ouverte directement sur
                // cet écran (pas d'historique interne), retourne à l'accueil.
                const etat = window.history.state as { idx?: number } | null
                void ((etat?.idx ?? 0) > 0 ? naviguer(-1) : naviguer('/'))
              }}
            >
              <Icone nom="retour" epaisseur={2} />
            </button>
          ) : (
            <Link to="/" className="entete__marque" aria-label="MoneyTree, accueil">
              <Monogramme taille={28} />
              <span className="entete__nom">MoneyTree</span>
            </Link>
          )}
          {actions ? <div className="entete__actions">{actions}</div> : null}
        </div>
        <div className="entete__titres">
          <h1 className="entete__titre">{titre}</h1>
          {sousTitre ? <p className="entete__sous-titre">{sousTitre}</p> : null}
        </div>
      </div>
    </header>
  )
}
