import { useLiveQuery } from 'dexie-react-hooks'
import { useId } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatDateHeure } from '../../lib/format.ts'
import { VERSION_APPLI } from '../../lib/version.ts'
import { IDS_METIER, METIERS, metierDe } from '../../profils/metiers.ts'
import { lireProfil, modifierProfil } from '../../storage/profil.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { SectionDonnees } from './SectionDonnees.tsx'
import { SectionNotes } from './SectionNotes.tsx'

/** Réglages : profil, mode expert, introduction, glossaire, remarques, données, à propos et version. */
export function EcranReglages() {
  const idModeExpert = useId()
  const profil = useLiveQuery(() => lireProfil())
  const naviguer = useNavigate()

  return (
    <>
      <EnTete titre="Réglages" retour />
      <main className="ecran apparition">
        <section className="section" aria-labelledby="reglages-profil">
          <h2 id="reglages-profil" className="section__titre">
            Ton profil
          </h2>
          <p className="texte-secondaire">
            Il choisit les modules propres à ton métier, les exemples, les cas d’école et le mode carrière. Changer de
            profil garde toute ta progression.
          </p>
          <div className="choix-liste" role="radiogroup" aria-label="Profil">
            {IDS_METIER.map((id) => {
              const m = METIERS[id]
              const actif = profil !== undefined && metierDe(profil) === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  disabled={profil === undefined}
                  className="choix choix--grand"
                  onClick={() => {
                    if (!actif) void modifierProfil({ metier: id })
                  }}
                >
                  <span className="choix__icone">
                    <Icone nom={m.icone} taille={20} />
                  </span>
                  <span className="choix__texte">
                    <span className="choix__titre">{m.libelle}</span>
                    <span className="texte-secondaire">{m.detail}</span>
                  </span>
                  <span className="choix__coche" aria-hidden="true">
                    {actif ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

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
                  Ouvre d’un coup tous les modules, tous les paliers et tous les leviers du
                  simulateur. Pour revenir à la découverte progressive, désactive-le.
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
          <div className="carte">
            <Link to="/progres" className="ligne ligne--lien">
              <span className="ligne__titre">Tes progrès et tes badges</span>
            </Link>
            <hr className="separateur" />
            <Link to="/glossaire" className="ligne ligne--lien">
              <span className="ligne__titre">Glossaire</span>
            </Link>
            <hr className="separateur" />
            <button
              type="button"
              className="ligne ligne--lien"
              onClick={() => {
                void modifierProfil({ lancementTermine: false }).then(() => naviguer('/bienvenue'))
              }}
            >
              <span className="ligne__titre">Revoir l’introduction</span>
            </button>
          </div>
        </section>

        <SectionNotes />

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
