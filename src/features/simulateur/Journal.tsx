import { useState } from 'react'
import { dateDuMois, type EtatPartie } from '../../engine/simulation.ts'
import { MOIS_COURTS } from './constantes.ts'

/** Le journal de la partie, les événements les plus récents d'abord. */
export function Journal({ etat }: { etat: EtatPartie }) {
  const [tout, setTout] = useState(false)
  const evenements = [...etat.journal].reverse()
  const affiches = tout ? evenements : evenements.slice(0, 5)
  return (
    <section className="section" aria-labelledby="journal">
      <h2 id="journal" className="section__titre">
        Journal
      </h2>
      <ol className="journal">
        {affiches.map((e, i) => {
          const date = dateDuMois(etat, e.mois)
          return (
            <li key={`${e.mois}-${i}`} className={`journal__evenement journal__evenement--${e.type}`}>
              <span className="journal__date chiffres">
                {MOIS_COURTS[date.mois]} {date.annee}
              </span>
              <span className="journal__titre">{e.titre}</span>
              <span className="texte-secondaire">{e.detail}</span>
            </li>
          )
        })}
      </ol>
      {evenements.length > 5 ? (
        <button
          type="button"
          className="lien-tertiaire"
          onClick={() => {
            setTout(!tout)
          }}
        >
          {tout ? 'Réduire' : `Voir les ${evenements.length} événements`}
        </button>
      ) : null}
    </section>
  )
}
