import { useLiveQuery } from 'dexie-react-hooks'
import { useId } from 'react'
import { formatDateHeure } from '../../lib/format.ts'
import { VERSION_APPLI } from '../../lib/version.ts'
import { lireProfil, modifierProfil } from '../../storage/profil.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { SectionDonnees } from './SectionDonnees.tsx'

/** Réglages : mode expert (enregistré, encore sans effet), données, à propos et version. */
export function EcranReglages() {
  const idModeExpert = useId()
  const profil = useLiveQuery(() => lireProfil())

  return (
    <>
      <EnTete titre="Réglages" retour />
      <main className="ecran apparition">
        <section className="section" aria-labelledby="reglages-parcours">
          <h2 id="reglages-parcours" className="section__titre">
            Parcours
          </h2>
          <div className="carte">
            <div className="ligne">
              <div className="ligne__libelle">
                <label htmlFor={idModeExpert} className="ligne__titre">
                  Mode expert
                </label>
                <span className="texte-secondaire">
                  Ouvre d’un coup tous les modules et tous les leviers du simulateur. Sans
                  effet pour l’instant : il servira dès la phase&nbsp;1.
                </span>
              </div>
              <input
                id={idModeExpert}
                type="checkbox"
                role="switch"
                className="interrupteur"
                disabled={profil === undefined}
                checked={profil?.modeExpert ?? false}
                onChange={(evenement) => {
                  void modifierProfil({ modeExpert: evenement.target.checked })
                }}
              />
            </div>
          </div>
        </section>

        <SectionDonnees />

        <section className="section" aria-labelledby="reglages-apropos">
          <h2 id="reglages-apropos" className="section__titre">
            À propos
          </h2>
          <div className="carte">
            <p className="carte__texte">
              MoneyTree est une appli éducative et personnelle. Elle explique, rejoue
              l’historique et modélise des scénarios, mais ne prédit rien et ne donne aucun
              conseil en investissement.
            </p>
            <hr className="separateur" />
            <div className="ligne__libelle">
              <span className="ligne__titre">Version</span>
              <span className="texte-secondaire">
                Publiée le {formatDateHeure(new Date(VERSION_APPLI.construiteLe))}
              </span>
              <span className="texte-secondaire">
                Code <span className="code-version">{VERSION_APPLI.commit}</span>
              </span>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
