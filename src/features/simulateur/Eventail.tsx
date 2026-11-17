/**
 * Monte Carlo de la stratégie (débloqué avec le module 3) : si tu gardes tes réglages, où
 * pourrait en être ton patrimoine net réel dans dix ans ? Une fourchette, pas une prédiction.
 */
import { useCallback, useMemo, useState } from 'react'
import { dateDuMois, type EtatPartie, type ResultatProjectionPartie } from '../../engine/simulation.ts'
import { formatMontant } from '../../lib/format.ts'
import { Graphique } from '../../ui/Graphique.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { ANNEES_ENTIERES } from './constantes.ts'

const TRAJECTOIRES = 500
const HORIZON_MOIS = 120

export function Eventail({ etat }: { etat: EtatPartie }) {
  const [resultat, setResultat] = useState<ResultatProjectionPartie | null>(null)
  const [enCours, setEnCours] = useState(false)
  // Une projection ne vaut que pour l'état qui l'a produite.
  const [moisProjete, setMoisProjete] = useState<number | null>(null)
  const perimee = moisProjete !== null && moisProjete !== etat.mois

  const projeter = useCallback(() => {
    setEnCours(true)
    const travailleur = new Worker(new URL('../../engine/strategie.worker.ts', import.meta.url), { type: 'module' })
    travailleur.onmessage = (e: MessageEvent<ResultatProjectionPartie>) => {
      setResultat(e.data)
      setMoisProjete(etat.mois)
      setEnCours(false)
      travailleur.terminate()
    }
    travailleur.postMessage({ etat, trajectoires: TRAJECTOIRES, horizonMois: HORIZON_MOIS, graine: etat.alea + etat.mois })
  }, [etat])

  const series = useMemo(
    () =>
      resultat
        ? [
            { valeurs: resultat.p10, libelle: '1 cas sur 10 en dessous', discret: true },
            { valeurs: resultat.p90, libelle: '1 cas sur 10 au-dessus', discret: true },
            { valeurs: resultat.p50, libelle: 'Médiane', annotee: true },
          ]
        : [],
    [resultat],
  )
  const libelleX = useCallback((mois: number) => String(dateDuMois(etat, Math.round(mois)).annee), [etat])

  return (
    <section className="carte" aria-labelledby="eventail">
      <div className="carte__etiquettes">
        <h2 id="eventail" className="carte__surtitre">
          Et si tu gardais ces réglages ?
        </h2>
        <span className="etiquette etiquette--constants">€ constants</span>
      </div>
      {resultat && !perimee ? (
        <>
          <Graphique
            x={resultat.mois}
            series={series}
            bande={[0, 1]}
            libelleX={libelleX}
            increments={ANNEES_ENTIERES}
            resume={`Dans dix ans : 1 cas sur 10 sous ${formatMontant(resultat.p10.at(-1) ?? 0)}, médiane ${formatMontant(resultat.p50.at(-1) ?? 0)}, 1 cas sur 10 au-dessus de ${formatMontant(resultat.p90.at(-1) ?? 0)}.`}
          />
          <p className="carte__texte chiffres">
            Dans dix ans, 8 trajectoires sur 10 finissent entre{' '}
            <strong>{formatMontant(resultat.p10.at(-1) ?? 0)}</strong> et{' '}
            <strong>{formatMontant(resultat.p90.at(-1) ?? 0)}</strong>, la moitié au-dessus de{' '}
            <strong>{formatMontant(resultat.p50.at(-1) ?? 0)}</strong>.
          </p>
          <p className="note-source">
            {TRAJECTOIRES} trajectoires Monte Carlo : des blocs de douze mois réels (actions, inflation, taux) recollés au
            hasard. Ce n’est pas une prédiction : c’est une fourchette.
          </p>
        </>
      ) : (
        <p className="carte__texte">
          Projette ta stratégie actuelle sur {TRAJECTOIRES} trajectoires tirées dans l’historique, pour lire une fourchette
          plutôt qu’une courbe unique.
        </p>
      )}
      <button type="button" className="bouton bouton--contour" disabled={enCours} onClick={projeter}>
        <Icone nom="courbe" taille={18} />
        {enCours ? 'Calcul en cours…' : resultat && !perimee ? 'Recalculer' : 'Projeter ma stratégie sur 10 ans'}
      </button>
    </section>
  )
}
