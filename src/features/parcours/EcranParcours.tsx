import { Link } from 'react-router'
import { EnTete } from '../../ui/EnTete.tsx'

/** Parcours : la carte des dix modules arrive en phase 1. */
export function EcranParcours() {
  return (
    <>
      <EnTete
        titre="Ton parcours"
        sousTitre="10 modules, 5 paliers chacun."
        actions={
          <Link to="/reglages" className="pastille-sur-vert">
            Mode expert
          </Link>
        }
      />
      <main className="ecran apparition">
        <section className="carte" aria-labelledby="parcours-vide">
          <span className="surtitre">Bientôt</span>
          <h2 id="parcours-vide" className="carte__titre">
            La carte des modules
          </h2>
          <p className="carte__texte">
            Dix modules à explorer, de la fiche de paie à l’analyse d’un actif. Seul le module
            0 sera ouvert au départ ; les autres resteront visibles, grisés, avec leur titre et
            leur accroche.
          </p>
        </section>
      </main>
    </>
  )
}
