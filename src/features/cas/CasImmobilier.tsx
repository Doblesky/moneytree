/**
 * Cas d'école « Louer ou acheter » : un appartement à Bordeaux, avec un horizon de 6 ans.
 * Loyer médian des observatoires des loyers, frais d'acquisition et taux de crédit
 * officiels ; prix au m², évolution des prix et rendement de l'épargne sont à régler (fictifs).
 */
import { useState } from 'react'
import { parametres2026 } from '../../data/params/index.ts'
import { loyerAuM2 } from '../../engine/carriere.ts'
import { louerOuAcheter } from '../../engine/casEcole.ts'
import { formatMontant, formatPourcentage } from '../../lib/format.ts'
import { Choix } from '../../ui/Choix.tsx'
import { Curseur, Resultat } from '../cours/Calculateurs.tsx'
import { BoutonDebrief, Debrief, MiseEnSituation } from './communs.tsx'
import { SOURCES } from './sources.ts'

const euros = (v: number) => formatMontant(v)
const pourcent = (v: number) => formatPourcentage(v / 100, { decimales: 1 })

export function CasLouerAcheter() {
  const p = parametres2026()
  const loyerM2 = loyerAuM2('Bordeaux', p)
  const [surface, setSurface] = useState(45)
  const [prixM2, setPrixM2] = useState(4500)
  const [apport, setApport] = useState(30000)
  const [annees, setAnnees] = useState(6)
  const [evolution, setEvolution] = useState(0)
  const [rendement, setRendement] = useState(3)
  const [choix, setChoix] = useState<'louer' | 'acheter' | null>(null)
  const [vu, setVu] = useState(false)
  const prix = surface * prixM2
  const loyer = Math.round(surface * loyerM2)
  const r = louerOuAcheter(
    {
      prix,
      apport,
      loyer,
      annees,
      tauxCredit: p['credit.tauxMoyenNouveauxCreditsHabitat'].valeur,
      tauxAssurance: 0.003,
      dureeCreditMois: 300,
      // Taxe foncière et charges non récupérables : hypothèse de 2,5 € par m² et par mois.
      chargesProprietaire: surface * 2.5,
      evolutionPrix: evolution / 100,
      rendementEpargne: rendement / 100,
    },
    p,
  )
  const meilleur = r.acheteur >= r.locataire ? 'acheter' : 'louer'
  return (
    <>
      <MiseEnSituation titre="Bordeaux, pour 6 ans">
        <p className="carte__texte chiffres">
          Tu as {euros(apport)} d’apport et un poste à Bordeaux pour environ 6 ans. Louer ou acheter le même appartement ? Le
          loyer médian y est de {formatMontant(loyerM2, { decimales: 1 })} le m² hors charges (observatoires des loyers).
        </p>
        <div className="calculateur">
          <Curseur libelle="Surface" valeur={surface} min={20} max={100} pas={1} format={(v) => `${v} m²`} onChange={setSurface} />
          <Curseur
            libelle="Prix au m² (exemple fictif)"
            valeur={prixM2}
            min={2000}
            max={8000}
            pas={100}
            format={euros}
            onChange={setPrixM2}
          />
          <Curseur libelle="Apport" valeur={apport} min={0} max={100000} pas={1000} format={euros} onChange={setApport} />
          <Curseur libelle="Durée avant de revendre" valeur={annees} min={1} max={20} pas={1} format={(v) => `${v} ans`} onChange={setAnnees} />
          <Curseur libelle="Évolution des prix par an (scénario)" valeur={evolution} min={-3} max={5} pas={0.5} format={pourcent} onChange={setEvolution} />
          <Curseur libelle="Rendement de l’épargne du locataire (fictif)" valeur={rendement} min={0} max={6} pas={0.5} format={pourcent} onChange={setRendement} />
          <Resultat libelle="Prix du logement" valeur={euros(prix)} detail={`Loyer du même logement : ${euros(loyer)} par mois`} />
        </div>
        <p className="note-source">
          Pour un vrai prix au m², regarde les ventes réelles sur l’explorateur des valeurs foncières (DGFiP, data.gouv.fr).
        </p>
        <div className="choix-liste" role="radiogroup" aria-label="Ton choix">
          <Choix choisi={choix === 'louer'} onChoisir={() => { setChoix('louer') }} titre="Je loue" />
          <Choix choisi={choix === 'acheter'} onChoisir={() => { setChoix('acheter') }} titre="J’achète" />
        </div>
        {vu ? null : <BoutonDebrief id="louer-ou-acheter" desactive={choix === null} onVoir={() => { setVu(true) }} />}
      </MiseEnSituation>
      {vu ? (
        <Debrief
          titre={`Au bout de ${annees} an${annees > 1 ? 's' : ''}`}
          modules={[6]}
          sources={[SOURCES.loyersBordeaux, SOURCES.notaire, SOURCES.droitsMutation, SOURCES.creditBdf, SOURCES.hcsf, SOURCES.dvf]}
        >
          <ul className="liste-resultats chiffres">
            <li className={choix === 'acheter' ? 'liste-resultats__choisi' : ''}>
              <span>
                Acheter, puis revendre
                <small className="calculateur__detail">
                  {euros(r.frais)} de frais d’acquisition, {euros(r.coutMensuelProprietaire)} par mois (crédit, assurance, charges)
                </small>
              </span>
              <strong>{euros(r.acheteur)}</strong>
            </li>
            <li className={choix === 'louer' ? 'liste-resultats__choisi' : ''}>
              <span>
                Louer et placer la différence
                <small className="calculateur__detail">{euros(loyer)} de loyer par mois, apport placé</small>
              </span>
              <strong>{euros(r.locataire)}</strong>
            </li>
          </ul>
          <p className="carte__texte chiffres">
            Avec ces réglages, {meilleur === 'acheter' ? 'acheter' : 'louer'} laisse le patrimoine le plus élevé au bout de{' '}
            {annees} ans.{' '}
            {r.anneeEquilibre === null
              ? 'Acheter ne rattrape jamais la location sur 25 ans.'
              : `Acheter devient plus intéressant à partir de ${r.anneeEquilibre} an${r.anneeEquilibre > 1 ? 's' : ''}.`}
          </p>
          <p className="carte__texte">
            Les frais d’acquisition, payés d’emblée, mettent des années à s’amortir : plus l’horizon est court, plus la
            location a de chances de l’emporter. L’évolution des prix, que personne ne connaît d’avance, pèse autant que le
            taux du crédit : fais varier le scénario pour voir.
          </p>
          <p className="note-source">
            Hypothèses : crédit sur 25 ans au taux moyen publié par la Banque de France, assurance de 0,30 % par an, taxe
            foncière et charges non récupérables de 2,5 € par m² et par mois ; revente sans frais d’agence ; plus-value d’une
            résidence principale exonérée.
          </p>
        </Debrief>
      ) : null}
    </>
  )
}
