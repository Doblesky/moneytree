import { Link } from 'react-router'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'

/**
 * Accueil : une seule action, pas un tableau de bord. En phase 0, la carte « prochaine
 * étape » annonce le premier module, qui arrive en phase 1.
 */
export function EcranAccueil() {
  return (
    <>
      <EnTete
        titre="Salut !"
        sousTitre="Dix minutes aujourd’hui suffisent."
        actions={
          <Link to="/reglages" className="bouton-icone" aria-label="Réglages">
            <Icone nom="reglages" />
          </Link>
        }
      />
      <main className="ecran apparition">
        <section className="carte carte--importante sur-vert" aria-labelledby="prochaine-etape">
          <span className="surtitre surtitre--or">Prochaine étape</span>
          <h2 id="prochaine-etape" className="carte__titre">
            Module 0 · Bases
          </h2>
          <p className="carte__texte">
            Brut et net, budget, épargne de précaution, intérêts composés, inflation. Les
            premiers cours arrivent avec la phase&nbsp;1.
          </p>
          <Link to="/parcours" className="bouton bouton--sur-vert">
            Voir le parcours
            <Icone nom="suivant" taille={20} epaisseur={2} />
          </Link>
        </section>
        <p className="texte-secondaire" style={{ padding: '0 4px' }}>
          MoneyTree est éducatif : il explique, rejoue et modélise, mais ne donne aucun
          conseil en investissement.
        </p>
      </main>
    </>
  )
}
