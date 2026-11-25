import { useLiveQuery } from 'dexie-react-hooks'
import { useId } from 'react'
import { formatDateHeure } from '../../lib/format.ts'
import type { ReglageWidget } from '../../storage/db.ts'
import { lireProfil } from '../../storage/profil.ts'
import { INTERVALLES_WIDGET, type IntervalleWidget } from '../../widget/paquet.ts'
import { modifierReglageWidget, reglageWidget } from '../../widget/reglage.ts'
import { synchroniserWidget } from '../../widget/synchro.ts'

const LIBELLES_INTERVALLE: Record<IntervalleWidget, string> = {
  10: '10 min',
  15: '15 min',
  30: '30 min',
  60: '1 h',
  180: '3 h',
}

const LIEN_COMPAGNON = `${import.meta.env.BASE_URL}compagnon/moneytree-widget.apk`

/** Section « Widget » des Réglages : activer l'envoi au compagnon Android et régler la rotation. */
export function SectionWidget() {
  const idInterrupteur = useId()
  const profil = useLiveQuery(() => lireProfil())
  const reglage = profil ? reglageWidget(profil) : undefined

  // Appelé depuis un appui : Chrome accepte alors d'ouvrir le compagnon.
  function changer(modif: Partial<ReglageWidget>) {
    void modifierReglageWidget(modif).then((nouveau) => {
      if (nouveau.actif) void synchroniserWidget('reglage')
    })
  }

  return (
    <section className="section" aria-labelledby="reglages-widget">
      <h2 id="reglages-widget" className="section__titre">
        Widget
      </h2>
      <div className="carte">
        <div className="ligne">
          <div className="ligne__libelle">
            <label htmlFor={idInterrupteur} className="ligne__titre">
              Widget installé sur ce téléphone
            </label>
            <span className="texte-secondaire">
              Affiche sur ton écran d’accueil une carte des paliers que tu maîtrises.
            </span>
          </div>
          <input
            id={idInterrupteur}
            type="checkbox"
            role="switch"
            className="interrupteur"
            disabled={reglage === undefined}
            checked={reglage?.actif ?? false}
            onChange={(evenement) => {
              changer({ actif: evenement.target.checked })
            }}
          />
        </div>
        {reglage?.introuvableLe !== undefined ? (
          <p className="texte-secondaire" role="status">
            Compagnon introuvable : installe-le puis réactive l’interrupteur.
          </p>
        ) : reglage?.dernierEnvoiLe !== undefined ? (
          <p className="texte-secondaire" role="status">
            Dernier envoi : {formatDateHeure(new Date(reglage.dernierEnvoiLe))} · {reglage.nbCartes ?? 0} cartes
          </p>
        ) : null}
      </div>

      <div className="carte">
        <span className="ligne__titre" id="reglages-widget-duree">
          Changer de carte toutes les
        </span>
        <div className="choix-liste" role="radiogroup" aria-labelledby="reglages-widget-duree">
          {INTERVALLES_WIDGET.map((minutes) => {
            const actif = reglage?.intervalleMinutes === minutes
            return (
              <button
                key={minutes}
                type="button"
                role="radio"
                aria-checked={actif}
                disabled={reglage === undefined}
                className="choix"
                onClick={() => {
                  if (!actif) changer({ intervalleMinutes: minutes })
                }}
              >
                <span className="choix__titre">{LIBELLES_INTERVALLE[minutes]}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="carte">
        <a className="bouton bouton--contour" href={LIEN_COMPAGNON} download>
          Télécharger le compagnon Android
        </a>
        <ol className="texte-secondaire">
          <li>Ouvre le fichier téléchargé et autorise l’installation.</li>
          <li>
            Sur un Xiaomi, autorise le démarrage automatique de MoneyTree Widget et retire ses restrictions de
            batterie.
          </li>
          <li>Ajoute le widget MoneyTree depuis l’écran d’accueil.</li>
          <li>Active l’interrupteur ci-dessus.</li>
        </ol>
      </div>
    </section>
  )
}
