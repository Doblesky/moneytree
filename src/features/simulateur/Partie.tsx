/**
 * Une partie en cours (maquette 7) : patrimoine net réel en euros constants, leviers,
 * avance d'un mois, d'un an ou jusqu'au prochain événement, point de sauvegarde.
 * Le simulateur grandit avec toi : un levier n'apparaît qu'une fois son module terminé.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useEtatProgression } from '../../app/donnees.ts'
import type { Levier } from '../../content/catalogue.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { SCENARIOS } from '../../engine/modesMarche.ts'
import {
  avancer,
  avancerJusquAuProchainEvenement,
  bilan,
  dateDuMois,
  estTerminee,
  periodeRejouee,
  periodeRevelee,
  type EtatPartie,
} from '../../engine/simulation.ts'
import { formatMontant } from '../../lib/format.ts'
import { levierDebloque } from '../../progression/regles.ts'
import { badgesDuSimulateur } from '../../storage/apprentissage.ts'
import type { ContenuSauvegarde } from '../../storage/db.ts'
import { enregistrerPartie } from '../../storage/partie.ts'
import { Terme } from '../../ui/glossaire.tsx'
import { Graphique } from '../../ui/Graphique.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { Rosace } from '../../ui/Rosace.tsx'
import { Comptes, Impots } from './Comptes.tsx'
import { ANNEES_ENTIERES, MOIS } from './constantes.ts'
import { Eventail } from './Eventail.tsx'
import { Journal } from './Journal.tsx'
import { Leviers } from './Leviers.tsx'
import { Variation } from './LigneLevier.tsx'
import { Operations } from './Operations.tsx'

const LIBELLE_MODE = {
  historique: 'Historique',
  'monte-carlo': 'Monte Carlo',
  scenario: 'Scénario',
} as const

export function Partie({ id, nom, contenu }: { id: number; nom: string; contenu: ContenuSauvegarde }) {
  const p = parametres2026()
  const progression = useEtatProgression()
  const [etat, setEtat] = useState<EtatPartie>(contenu.partie)
  const [point, setPoint] = useState<EtatPartie | null>(contenu.pointDeSauvegarde)
  const [constants, setConstants] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const appliquer = useCallback(
    (suivant: EtatPartie, nouveauPoint: EtatPartie | null = point) => {
      setEtat(suivant)
      setPoint(nouveauPoint)
      void enregistrerPartie(id, suivant, nouveauPoint)
      void badgesDuSimulateur(suivant.mois)
    },
    [id, point],
  )

  useEffect(() => {
    if (!message) return
    const minuterie = window.setTimeout(() => {
      setMessage(null)
    }, 3000)
    return () => {
      window.clearTimeout(minuterie)
    }
  }, [message])

  const b = bilan(etat, p)
  const date = dateDuMois(etat, etat.mois)
  const historique = etat.historique
  const precedent = historique.at(-2)
  const variation = precedent ? b.netReel - precedent.netReel : 0
  const revelee = periodeRevelee(etat)
  const terminee = estTerminee(etat)
  const debloque = (l: Levier) => (progression ? levierDebloque(progression, l) : false)
  const mode = etat.marche.mode

  const x = useMemo(() => historique.map((h) => h.mois), [historique])
  const series = useMemo(
    () => [
      {
        valeurs: historique.map((h) => (constants ? h.netReel : h.brut - h.fiscaliteLatente)),
        libelle: 'Patrimoine net',
        aire: true,
      },
    ],
    [historique, constants],
  )
  const libelleX = useCallback((mois: number) => String(dateDuMois(etat, Math.round(mois)).annee), [etat])

  return (
    <>
      <header className="entete sur-vert entete--simulateur">
        <Rosace taille={220} className="entete__rosace" />
        <div className="entete__contenu">
          <div className="entete__barre">
            <div className="entete__titres">
              <span className="surtitre surtitre--or chiffres">
                {nom} · mois {etat.mois}
              </span>
              <h1 className="entete__titre">
                {MOIS[date.mois]} {date.annee}
              </h1>
            </div>
            <button
              type="button"
              className="pastille-sur-vert"
              aria-label="Enregistrer un point de sauvegarde"
              onClick={() => {
                appliquer(etat, etat)
                setMessage('Point de sauvegarde enregistré : tu pourras y revenir pour tester une autre décision.')
              }}
            >
              <Icone nom="signet" taille={16} />
              Sauvegarder
            </button>
          </div>
        </div>
      </header>

      <main className="ecran apparition simulateur">
        {message ? (
          <p className="message message--succes" role="status">
            {message}
          </p>
        ) : null}

        <div className="barre-parties">
          <span className="etiquette etiquette--mode">
            {LIBELLE_MODE[mode]}
            {mode === 'scenario' && etat.marche.scenario ? ` · ${SCENARIOS[etat.marche.scenario].nom}` : ''}
          </span>
          <Link to="/simulateur/parties" className="lien-tertiaire">
            Mes parties
            <Icone nom="suivant" taille={16} epaisseur={2} />
          </Link>
        </div>

        {revelee ? (
          <section className="carte carte--importante sur-vert" aria-labelledby="periode-revelee">
            <span className="surtitre surtitre--or">{mode === 'historique' ? 'La période révélée' : 'Dix ans déjà'}</span>
            <h2 id="periode-revelee" className="carte__titre">
              {mode === 'historique' ? periodeRejouee(etat) : `Tu as traversé ${periodeRejouee(etat)}`}
            </h2>
            <p className="carte__texte">
              {mode === 'historique'
                ? 'Tu viens de rejouer cette vraie période : krachs, reprises, inflation et taux des livrets compris.'
                : 'Compare cette partie à une autre stratégie dans « Mes parties ».'}
              {terminee ? ' Les données s’arrêtent ici.' : ' Tu peux continuer tant qu’il reste des données.'}
            </p>
          </section>
        ) : null}

        <section className="carte" aria-labelledby="patrimoine">
          <div className="carte__etiquettes">
            <h2 id="patrimoine" className="carte__surtitre">
              Patrimoine <Terme cle="patrimoine-net-reel">net réel</Terme>
            </h2>
            <button
              type="button"
              className={`etiquette ${constants ? 'etiquette--constants' : 'etiquette--courants'}`}
              aria-pressed={constants}
              onClick={() => {
                setConstants(!constants)
              }}
            >
              {constants ? '€ constants' : '€ courants'}
            </button>
          </div>
          <p className="montant-principal chiffres">{formatMontant(constants ? b.netReel : b.net)}</p>
          <Variation valeur={variation} suffixe="ce mois" />
          <Graphique
            x={x}
            series={series}
            libelleX={libelleX}
            increments={ANNEES_ENTIERES}
            resume={`Patrimoine net ${constants ? 'en euros constants' : 'en euros courants'} : ${formatMontant(constants ? b.netReel : b.net)} au mois ${etat.mois}.`}
          />
          <p className="note-source">
            Net de la <Terme cle="fiscalite-latente">fiscalité latente</Terme> ({formatMontant(b.fiscaliteLatente)}), en
            euros {constants ? 'du départ de la partie' : 'de chaque date'}.
          </p>
        </section>

        <Leviers etat={etat} debloque={debloque} onChange={appliquer} />

        {debloque('monteCarlo') ? <Eventail etat={etat} /> : null}

        <Comptes etat={etat} />

        {debloque('detailImpot') ? <Impots etat={etat} /> : null}

        <Operations etat={etat} debloque={debloque} onChange={appliquer} onMessage={setMessage} />

        <Journal etat={etat} />

        {point ? (
          <button
            type="button"
            className="bouton bouton--contour"
            onClick={() => {
              appliquer(point, point)
              setMessage(`Retour au point de sauvegarde (mois ${point.mois}).`)
            }}
          >
            <Icone nom="actualiser" taille={18} />
            Revenir au point de sauvegarde (mois {point.mois})
          </button>
        ) : null}
      </main>

      <div className="barre-avance" role="group" aria-label="Avancer dans le temps">
        <button
          type="button"
          className="bouton bouton--plein"
          disabled={terminee}
          onClick={() => {
            appliquer(avancer(etat, p, 1))
          }}
        >
          +1 mois
        </button>
        <button
          type="button"
          className="bouton bouton--contour"
          disabled={terminee}
          onClick={() => {
            appliquer(avancer(etat, p, 12))
          }}
        >
          +1 an
        </button>
        <button
          type="button"
          className="bouton bouton--contour"
          disabled={terminee}
          onClick={() => {
            appliquer(avancerJusquAuProchainEvenement(etat, p))
          }}
        >
          <Icone nom="sauter" taille={18} />
          Événement
        </button>
      </div>
    </>
  )
}
