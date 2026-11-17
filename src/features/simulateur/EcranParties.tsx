/**
 * Mes parties (phase 2) : autant de sauvegardes que tu veux. Ouvrir, renommer, dupliquer
 * pour tester une autre décision, supprimer, et comparer deux parties côte à côte.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useParties } from '../../app/donnees.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { bilan, dateDuMois } from '../../engine/simulation.ts'
import { formatDateHeure, formatMontant } from '../../lib/format.ts'
import { dupliquerPartie, ouvrirPartie, renommerPartie, supprimerPartie } from '../../storage/partie.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { MOIS } from './constantes.ts'

const MODES = { historique: 'Historique', 'monte-carlo': 'Monte Carlo', scenario: 'Scénario' } as const

export function EcranParties() {
  const parties = useParties()
  const naviguer = useNavigate()
  const [selection, setSelection] = useState<number[]>([])
  const p = parametres2026()

  useEffect(() => {
    document.title = 'Mes parties · MoneyTree'
  }, [])

  const basculer = (id: number) => {
    setSelection((actuelle) =>
      actuelle.includes(id) ? actuelle.filter((x) => x !== id) : [...actuelle, id].slice(-2),
    )
  }

  return (
    <>
      <EnTete titre="Mes parties" sousTitre="Autant de sauvegardes que tu veux." retour />
      <main className="ecran apparition">
        <Link to="/simulateur/nouvelle" className="bouton bouton--plein">
          <Icone nom="pousse" taille={20} />
          Nouvelle partie
        </Link>
        {parties?.length === 0 ? <p className="texte-secondaire">Aucune partie pour l’instant.</p> : null}
        <ul className="liste-parties">
          {parties?.map(({ id, nom, majLe, contenu }) => {
            const etat = contenu.partie
            const date = dateDuMois(etat, etat.mois)
            const b = bilan(etat, p)
            const choisie = selection.includes(id)
            return (
              <li key={id} className={`carte partie ${choisie ? 'partie--choisie' : ''}`}>
                <div className="partie__haut">
                  <div className="partie__texte">
                    <span className="surtitre">
                      {MODES[etat.marche.mode]} · mois {etat.mois} · {MOIS[date.mois]} {date.annee}
                    </span>
                    <h2 className="carte__titre">{nom}</h2>
                    <span className="texte-secondaire chiffres">
                      Patrimoine net réel : {formatMontant(b.netReel)} · modifiée le {formatDateHeure(new Date(majLe))}
                    </span>
                  </div>
                  <label className="case partie__comparer">
                    <input
                      type="checkbox"
                      checked={choisie}
                      onChange={() => {
                        basculer(id)
                      }}
                    />
                    Comparer
                  </label>
                </div>
                <div className="partie__actions">
                  <button
                    type="button"
                    className="bouton-pastille"
                    onClick={() => {
                      void ouvrirPartie(id).then(() => naviguer('/simulateur'))
                    }}
                  >
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    className="lien-tertiaire"
                    onClick={() => {
                      const nouveau = window.prompt('Nouveau nom de la partie', nom)
                      if (nouveau !== null) void renommerPartie(id, nouveau)
                    }}
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    className="lien-tertiaire"
                    onClick={() => {
                      void dupliquerPartie(id, `${nom} (copie)`)
                    }}
                  >
                    Dupliquer
                  </button>
                  <button
                    type="button"
                    className="lien-debloquer"
                    onClick={() => {
                      if (window.confirm(`Supprimer « ${nom} » ? Elle ne pourra pas être récupérée.`)) {
                        void supprimerPartie(id)
                        setSelection((s) => s.filter((x) => x !== id))
                      }
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {selection.length === 2 ? (
          <Link to={`/simulateur/comparer/${selection[0]}/${selection[1]}`} className="bouton bouton--contour barre-comparer">
            Comparer les deux parties
            <Icone nom="suivant" taille={18} epaisseur={2} />
          </Link>
        ) : (
          <p className="texte-secondaire">Coche deux parties pour les comparer côte à côte.</p>
        )}
      </main>
    </>
  )
}
