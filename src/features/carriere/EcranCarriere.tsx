/**
 * Mode carrière : s'ouvre après les modules 0 à 2 (cahier des charges). Une carrière se
 * joue année par année, avec un événement à choix chaque année (phase 3).
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { useCarriereActive, useCarrieres, useEtatProgression } from '../../app/donnees.ts'
import { infoModule } from '../../content/catalogue.ts'
import { METIERS } from '../../profils/metiers.ts'
import { carriereOuverte, moduleTermine, type EtatProgression } from '../../progression/regles.ts'
import { ouvrirCarriere } from '../../storage/carriere.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { LienCasEcole } from '../cas/EcranCas.tsx'
import { NouvelleCarriere } from './NouvelleCarriere.tsx'
import { PartieCarriere } from './PartieCarriere.tsx'

function CarriereVerrouillee({ etat }: { etat: EtatProgression }) {
  return (
    <>
      <EnTete titre="Carrière" sousTitre="Une année, un choix." />
      <main className="ecran apparition">
        <section className="carte carte--verrouillee" aria-labelledby="carriere-etat">
          <Icone nom="cadenas" />
          <div className="carte__corps">
            <span className="surtitre">Verrouillé</span>
            <h2 id="carriere-etat" className="carte__titre">
              Mode carrière
            </h2>
            <p className="carte__texte">{METIERS[etat.metier].presentationCarriere}</p>
            <p className="carte__texte">{METIERS[etat.metier].conditionCarriere}</p>
          </div>
        </section>
        <section className="carte" aria-labelledby="carriere-conditions">
          <h2 id="carriere-conditions" className="carte__surtitre">
            Pour l’ouvrir
          </h2>
          <ul className="liste-conditions">
            {METIERS[etat.metier].modulesCarriere.flatMap((id) => {
              const m = infoModule(id, etat.metier)
              if (!m) return []
              const fait = moduleTermine(etat, m.id)
              return [
                <li key={m.id} className={fait ? 'fait' : ''}>
                  <Icone nom={fait ? 'coche' : 'cadenas'} taille={16} />
                  Module {m.id} · {m.titre} : palier Découverte {fait ? 'maîtrisé' : 'à maîtriser'}
                </li>,
              ]
            })}
          </ul>
          <Link to="/parcours" className="bouton bouton--contour">
            Voir le parcours
          </Link>
        </section>
        <LienCasEcole />
      </main>
    </>
  )
}

export function EcranCarriere() {
  const etat = useEtatProgression()
  const active = useCarriereActive()
  const carrieres = useCarrieres()
  const [creation, setCreation] = useState(false)

  if (etat === undefined || active === undefined) return null
  if (!carriereOuverte(etat)) return <CarriereVerrouillee etat={etat} />

  if (active && !creation) {
    return (
      <PartieCarriere
        key={active.id}
        id={active.id}
        nom={active.nom}
        initiale={active.carriere}
        onNouvelle={() => {
          setCreation(true)
        }}
      />
    )
  }

  const autres = (carrieres ?? []).filter((c) => c.id !== active?.id)
  return (
    <>
      <EnTete titre="Carrière" sousTitre="Une année, un choix." />
      <main className="ecran apparition">
        <LienCasEcole />
        <NouvelleCarriere
          onCreee={() => {
            setCreation(false)
          }}
          onAnnuler={
            active
              ? () => {
                  setCreation(false)
                }
              : undefined
          }
        />
        {autres.length > 0 ? (
          <section className="carte" aria-labelledby="autres-carrieres">
            <h2 id="autres-carrieres" className="carte__surtitre">
              Tes autres carrières
            </h2>
            <div className="choix-liste">
              {autres.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="choix"
                  onClick={() => {
                    void ouvrirCarriere(c.id).then(() => {
                      setCreation(false)
                    })
                  }}
                >
                  <span className="choix__texte">
                    <span className="choix__titre">{c.nom}</span>
                    <span className="texte-secondaire chiffres">
                      {c.carriere.bilans.length} an{c.carriere.bilans.length > 1 ? 's' : ''} joué
                      {c.carriere.bilans.length > 1 ? 's' : ''}
                    </span>
                  </span>
                  <Icone nom="suivant" taille={18} epaisseur={2} />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  )
}
