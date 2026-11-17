import { useEffect } from 'react'
import { useEtatProgression, useJournees, useProfil } from '../../app/donnees.ts'
import { formatNombre, formatPourcentage } from '../../lib/format.ts'
import { BADGES, niveau, progressionNiveau, semaine, serieDeJours, seuilNiveau, type Badge } from '../../progression/gamification.ts'
import { jourLocal } from '../../progression/leitner.ts'
import { avancementGlobal } from '../../progression/regles.ts'
import { EnTete } from '../../ui/EnTete.tsx'
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
              Paliers maîtrisés sur les 50 du programme complet (10 modules × 5 paliers). Le 100 % se gagne avec les
              examens de validation, en phase 5.
            </p>
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
