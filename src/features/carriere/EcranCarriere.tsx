import { Link } from 'react-router'
import { useEtatProgression } from '../../app/donnees.ts'
import { MODULES } from '../../content/catalogue.ts'
import { carriereOuverte, moduleTermine } from '../../progression/regles.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'

/**
 * Mode carrière : s'ouvre après les modules 0 à 2 (cahier des charges). Son contenu
 * (événements de vie, score, jauge de sang-froid) arrive avec la phase 3.
 */
export function EcranCarriere() {
  const etat = useEtatProgression()
  const ouvert = etat ? carriereOuverte(etat) : false
  return (
    <>
      <EnTete titre="Carrière" sousTitre="Une année, un choix." />
      <main className="ecran apparition">
        <section className={`carte ${ouvert ? '' : 'carte--verrouillee'}`} aria-labelledby="carriere-etat">
          {ouvert ? null : <Icone nom="cadenas" />}
          <div className="carte__corps">
            <span className="surtitre">{ouvert ? 'Débloqué' : 'Verrouillé'}</span>
            <h2 id="carriere-etat" className="carte__titre">
              Mode carrière
            </h2>
            <p className="carte__texte">
              Chaque année apporte des événements à choix : une offre d’emploi dans une autre ville, une prime, un krach,
              une mise en couple. Le score combine ton patrimoine net réel, ton taux d’épargne, tes objectifs et une jauge
              de sang-froid.
            </p>
            <p className="carte__texte">
              {ouvert
                ? 'Tu as terminé les modules 0 à 2 : le mode carrière arrive avec la phase 3 du développement.'
                : 'Il s’ouvre quand les modules 0 à 2 sont terminés. Il arrive avec la phase 3 du développement.'}
            </p>
          </div>
        </section>
        {etat ? (
          <section className="carte" aria-labelledby="carriere-conditions">
            <h2 id="carriere-conditions" className="carte__surtitre">
              Pour l’ouvrir
            </h2>
            <ul className="liste-conditions">
              {MODULES.slice(0, 3).map((m) => {
                const fait = moduleTermine(etat, m.id)
                return (
                  <li key={m.id} className={fait ? 'fait' : ''}>
                    <Icone nom={fait ? 'coche' : 'cadenas'} taille={16} />
                    Module {m.id} · {m.titre} : palier Découverte {fait ? 'maîtrisé' : 'à maîtriser'}
                  </li>
                )
              })}
            </ul>
            <Link to="/parcours" className="bouton bouton--contour">
              Voir le parcours
            </Link>
          </section>
        ) : null}
      </main>
    </>
  )
}
