/**
 * Deux parties côte à côte (cahier des charges, « Modes de jeu ») : patrimoine net réel,
 * impôts et frais payés, mois par mois.
 */
import { useCallback, useEffect, useMemo } from 'react'
import { Navigate, useParams } from 'react-router'
import { useParties } from '../../app/donnees.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { bilan, type EtatPartie } from '../../engine/simulation.ts'
import { formatMontant } from '../../lib/format.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Graphique } from '../../ui/Graphique.tsx'
import { ANNEES_ENTIERES } from './constantes.ts'

function indicateurs(etat: EtatPartie) {
  const p = parametres2026()
  const b = bilan(etat, p)
  const c = etat.cumuls
  return {
    netReel: b.netReel,
    net: b.net,
    impots: c.impotRevenu + c.prelevementsSociaux + c.csgCrdsEpargneSalariale,
    frais: c.fraisEtf + c.fraisUc,
    interets: c.interets + c.interetsFondsEuros,
    latente: b.fiscaliteLatente,
  }
}

export function EcranComparer() {
  const params = useParams()
  const parties = useParties()
  const a = parties?.find((x) => x.id === Number(params.a))
  const b = parties?.find((x) => x.id === Number(params.b))

  useEffect(() => {
    document.title = 'Comparer deux parties · MoneyTree'
  }, [])

  const mois = useMemo(() => {
    if (!a || !b) return []
    const n = Math.max(a.contenu.partie.historique.length, b.contenu.partie.historique.length)
    return Array.from({ length: n }, (_, i) => i)
  }, [a, b])
  const series = useMemo(() => {
    if (!a || !b) return []
    const valeurs = (etat: EtatPartie) => mois.map((m) => etat.historique[m]?.netReel ?? null)
    return [
      { valeurs: valeurs(a.contenu.partie), libelle: a.nom, annotee: true },
      { valeurs: valeurs(b.contenu.partie), libelle: b.nom, couleur: '--or-texte' },
    ]
  }, [a, b, mois])
  const libelleX = useCallback((m: number) => `an ${Math.round(m / 12)}`, [])

  if (parties === undefined) return null
  if (!a || !b) return <Navigate to="/simulateur/parties" replace />

  const ia = indicateurs(a.contenu.partie)
  const ib = indicateurs(b.contenu.partie)
  const lignes: [string, number, number][] = [
    ['Patrimoine net réel (€ constants)', ia.netReel, ib.netReel],
    ['Patrimoine net (€ courants)', ia.net, ib.net],
    ['Impôts et prélèvements payés', ia.impots, ib.impots],
    ['Frais payés', ia.frais, ib.frais],
    ['Intérêts reçus', ia.interets, ib.interets],
    ['Fiscalité latente', ia.latente, ib.latente],
  ]

  return (
    <>
      <EnTete titre="Comparer" sousTitre={`${a.nom} et ${b.nom}`} retour />
      <main className="ecran apparition">
        <section className="carte" aria-labelledby="comparaison-courbes">
          <div className="carte__etiquettes">
            <h2 id="comparaison-courbes" className="carte__surtitre">
              Patrimoine net réel, mois par mois
            </h2>
            <span className="etiquette etiquette--constants">€ constants</span>
          </div>
          <Graphique
            x={mois}
            series={series}
            libelleX={libelleX}
            increments={ANNEES_ENTIERES}
            resume={`${a.nom} : ${formatMontant(ia.netReel)} ; ${b.nom} : ${formatMontant(ib.netReel)}.`}
          />
          <div className="legende">
            <span>
              <span className="legende__trait" /> {a.nom} (mois {a.contenu.partie.mois})
            </span>
            <span>
              <span className="legende__trait legende__trait--or" /> {b.nom} (mois {b.contenu.partie.mois})
            </span>
          </div>
          {a.contenu.partie.marche.mode !== b.contenu.partie.marche.mode ||
          a.contenu.partie.debutHistorique !== b.contenu.partie.debutHistorique ? (
            <p className="note-source">
              Les deux parties n’ont pas traversé les mêmes marchés : l’écart mêle ta stratégie et la chance. Pour isoler
              l’effet d’une décision, duplique une partie et change un seul levier.
            </p>
          ) : null}
        </section>
        <section className="carte" aria-labelledby="comparaison-tableau">
          <h2 id="comparaison-tableau" className="carte__surtitre">
            Bilan
          </h2>
          <table className="tableau-comparaison chiffres">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">{a.nom}</th>
                <th scope="col">{b.nom}</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(([nom, va, vb]) => (
                <tr key={nom}>
                  <th scope="row">{nom}</th>
                  <td>{formatMontant(va)}</td>
                  <td>{formatMontant(vb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  )
}
