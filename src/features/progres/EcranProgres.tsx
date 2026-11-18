import { useEffect } from 'react'
import { Link } from 'react-router'
import { useEtatProgression, useJournees, useProfil } from '../../app/donnees.ts'
import { formatNombre, formatPourcentage } from '../../lib/format.ts'
import { BADGES, niveau, progressionNiveau, semaine, serieDeJours, seuilNiveau, type Badge } from '../../progression/gamification.ts'
import { jourLocal } from '../../progression/leitner.ts'
import { NOMS_PALIERS } from '../../content/catalogue.ts'
import { avancementGlobal, niveauAtteint, type EtatProgression } from '../../progression/regles.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { examenBlancConseille } from '../../progression/examenBlanc.ts'
import { Icone } from '../../ui/Icone.tsx'
import { SceauXP } from '../../ui/JetonXP.tsx'

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Tes progrès : XP et niveau, série de jours, badges, avancement vers les 100 %. */
export function EcranProgres() {
  const profil = useProfil()
  const etat = useEtatProgression()
  const journees = useJournees()
  const aujourdhui = jourLocal()
  const jours = (journees ?? []).map((j) => j.date)
  const xp = profil?.xp ?? 0
  const n = niveau(xp)
  const obtenus = new Set(profil?.badges ?? [])

  useEffect(() => {
    document.title = 'Tes progrès · MoneyTree'
  }, [])

  return (
    <>
      <EnTete titre="Tes progrès" sousTitre="Des secteurs dorés, pas des euros." retour />
      <main className="ecran apparition">
        <section className="carte" aria-labelledby="progres-niveau">
          <div className="niveau">
            <SceauXP taille={48} />
            <div>
              <h2 id="progres-niveau" className="carte__titre">
                Niveau {n}
              </h2>
              <p className="texte-secondaire chiffres">
                {formatNombre(xp)} XP · prochain niveau à {formatNombre(seuilNiveau(n + 1))} XP
              </p>
            </div>
          </div>
          <div className="barre-avancement barre-avancement--or" aria-hidden="true">
            <span style={{ width: `${progressionNiveau(xp) * 100}%` }} />
          </div>
        </section>

        <section className="carte" aria-labelledby="progres-serie">
          <h2 id="progres-serie" className="carte__surtitre">
            Série : {serieDeJours(jours, aujourdhui)} jour{serieDeJours(jours, aujourdhui) > 1 ? 's' : ''}
          </h2>
          <div className="semaine semaine--clair">
            {semaine(jours, aujourdhui).map((j, i) => (
              <span key={j.jour} className={`semaine__jour ${j.actif ? 'actif' : ''}`}>
                <span className="semaine__pastille" aria-hidden="true">
                  {j.actif ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
                </span>
                {JOURS[i]}
              </span>
            ))}
          </div>
          <p className="texte-secondaire">Un palier ou le quiz du jour suffit pour compter la journée.</p>
        </section>

        {etat ? (
          <section className="carte" aria-labelledby="progres-global">
            <h2 id="progres-global" className="carte__surtitre">
              Vers le niveau professionnel
            </h2>
            <p className="montant-principal chiffres">{formatPourcentage(avancementGlobal(etat), { decimales: 0 })}</p>
            <p className="texte-secondaire">
              50 paliers (10 modules × 5). Chacun compte pour moitié quand son quiz est réussi, et en entier quand son
              examen de validation l’est : le 100 % ne s’obtient qu’avec les 50 examens.
            </p>
            <NiveauAtteint etat={etat} />
          </section>
        ) : null}

        {etat ? (
          <section className="carte" aria-labelledby="progres-examen-blanc">
            <h2 id="progres-examen-blanc" className="carte__surtitre">
              Examen blanc
            </h2>
            <p className="texte-secondaire">
              30 questions sur le format de l’examen AMF : 80 % dans chaque catégorie, une minute par question.
              {profil?.examensBlancs?.length
                ? ` ${String(profil.examensBlancs.filter((r) => r.reussi).length)} réussi(s) sur ${String(profil.examensBlancs.length)}.`
                : ''}
            </p>
            <Link to="/examen-blanc" className="bouton bouton--contour">
              {examenBlancConseille(etat) ? 'Passer un examen blanc' : 'Le découvrir'}
            </Link>
          </section>
        ) : null}

        <section className="section" aria-labelledby="progres-badges">
          <h2 id="progres-badges" className="section__titre">
            Badges
          </h2>
          <ul className="badges">
            {(Object.keys(BADGES) as Badge[]).map((b) => (
              <li key={b} className={`badge ${obtenus.has(b) ? 'badge--obtenu' : ''}`}>
                <span className="badge__icone">
                  <Icone nom={obtenus.has(b) ? 'medaille' : 'cadenas'} taille={20} />
                </span>
                <span>
                  <span className="ligne__titre">{BADGES[b].nom}</span>
                  <span className="texte-secondaire"> · {BADGES[b].description}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  )
}

function NiveauAtteint({ etat }: { etat: EtatProgression }) {
  const { palier, modulesAuSuivant } = niveauAtteint(etat)
  const suivant = NOMS_PALIERS[palier]
  return (
    <p className="texte-secondaire">
      {palier === 0 ? (
        <>Niveau de connaissances : à valider. </>
      ) : (
        <>
          Niveau de connaissances : <strong>{NOMS_PALIERS[palier - 1]}</strong>, validé dans les dix modules.{' '}
        </>
      )}
      {suivant ? (
        <span className="chiffres">
          {suivant} : {modulesAuSuivant} module{modulesAuSuivant > 1 ? 's' : ''} sur 10.
        </span>
      ) : null}
    </p>
  )
}
