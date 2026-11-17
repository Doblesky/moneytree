/**
 * Cas d'école sur le budget et les enveloppes : premier salaire, PEA ou PER, abondement,
 * héritage. Les règles viennent des paramètres officiels ; les rendements constants sont
 * fictifs et signalés.
 */
import { useMemo, useState } from 'react'
import { parametres2026 } from '../../data/params/index.ts'
import { abondementPee, budgetPremierSalaire, comparerPeaPer, projeterHeritage } from '../../engine/casEcole.ts'
import { loyerAuM2, loyerMedian } from '../../engine/carriere.ts'
import { formatMontant, formatPourcentage } from '../../lib/format.ts'
import { Choix } from '../../ui/Choix.tsx'
import { Curseur, Resultat } from '../cours/Calculateurs.tsx'
import { BoutonDebrief, Debrief, MiseEnSituation } from './communs.tsx'
import { SOURCES } from './sources.ts'

const euros = (v: number) => formatMontant(v)
const pourcent = (v: number) => formatPourcentage(v / 100)

export function CasPremierSalaire() {
  const p = parametres2026()
  const brut = p['insertion.ingenieurs.salaireBrutAnnuelMedianHorsPrimes'].valeur
  const [surface, setSurface] = useState(30)
  const [autres, setAutres] = useState(800)
  const [vu, setVu] = useState(false)
  const loyer = loyerMedian('Toulouse', surface, p)
  const b = budgetPremierSalaire({ brutAnnuel: brut, loyer, autresDepenses: autres }, p)
  return (
    <>
      <MiseEnSituation titre="Ton premier budget">
        <p className="carte__texte chiffres">
          Tu décroches ton premier poste à Toulouse : {euros(brut)} brut par an, le salaire médian hors primes des jeunes
          ingénieurs selon l’enquête 2026 de la Conférence des grandes écoles. Le loyer médian y est de{' '}
          {formatMontant(loyerAuM2('Toulouse', p), { decimales: 1 })} le m² hors charges.
        </p>
        <div className="calculateur">
          <Curseur libelle="Surface du logement" valeur={surface} min={15} max={60} pas={1} format={(v) => `${v} m²`} onChange={setSurface} />
          <Curseur libelle="Autres dépenses par mois (hypothèse)" valeur={autres} min={300} max={1600} pas={50} format={euros} onChange={setAutres} />
          <Resultat libelle="Loyer médian pour cette surface" valeur={`${euros(loyer)} / mois`} detail="Hors charges" />
        </div>
        {vu ? null : <BoutonDebrief id="premier-salaire" onVoir={() => { setVu(true) }} />}
      </MiseEnSituation>
      {vu ? (
        <Debrief titre="Ce qu’il te reste chaque mois" modules={[0]} sources={[SOURCES.cge, SOURCES.loyers, SOURCES.precaution, SOURCES.livretA]}>
          <div className="calculateur__lignes chiffres">
            <span>Salaire net avant impôt</span>
            <span>{euros(b.netMensuel)}</span>
            <span>Impôt sur le revenu (moyenne mensuelle)</span>
            <span>−{euros(b.impotMensuel)}</span>
            <span>Loyer</span>
            <span>−{euros(loyer)}</span>
            <span>Autres dépenses</span>
            <span>−{euros(autres)}</span>
            <span>Reste pour épargner</span>
            <span>{euros(b.reste)}</span>
          </div>
          <p className="carte__texte chiffres">
            Selon le portail de la Banque de France, une épargne de précaution vise entre 3 et 6 mois de revenus : ici, de{' '}
            {euros(b.precaution.basse)} à {euros(b.precaution.haute)}.{' '}
            {b.moisPourPrecaution === null
              ? 'Avec ce budget, il ne reste rien à épargner : c’est le premier point à revoir.'
              : `En épargnant tout le reste, le bas de la fourchette est atteint en ${b.moisPourPrecaution} mois.`}
          </p>
          <p className="carte__texte chiffres">
            Elle se range sur des livrets disponibles tout de suite, comme le Livret A (plafond de{' '}
            {euros(p['livretA.plafond'].valeur)}). Tant qu’elle n’est pas constituée, investir en bourse t’expose à devoir
            vendre au pire moment.
          </p>
        </Debrief>
      ) : null}
    </>
  )
}

export function CasPeaOuPer() {
  const p = parametres2026()
  const [rendement, setRendement] = useState(5)
  const [tmiSortie, setTmiSortie] = useState(0.11)
  const [choix, setChoix] = useState<'pea' | 'per' | null>(null)
  const [vu, setVu] = useState(false)
  const r = comparerPeaPer({ versementAnnuel: 3000, annees: 30, rendement: rendement / 100, tmiEntree: 0.3, tmiSortie }, p)
  const lignes = [
    { cle: 'pea', titre: 'PEA', net: r.pea.net, detail: `prélèvements sociaux seuls sur les gains : ${euros(r.pea.impot)}` },
    { cle: 'per', titre: 'PER, économie d’impôt dépensée', net: r.per.net, detail: `impôt à la sortie : ${euros(r.per.impot)}` },
    {
      cle: 'per+',
      titre: 'PER, économie d’impôt placée sur un PEA',
      net: r.per.net + r.economiePlacee.net,
      detail: `${euros(r.economieAnnuelle)} d’impôt en moins chaque année, placés à côté`,
    },
  ]
  return (
    <>
      <MiseEnSituation titre="3 000 € par an pendant 30 ans">
        <p className="carte__texte chiffres">
          Ta tranche marginale d’imposition est de 30 %. Tu veux placer 3 000 € par an pendant 30 ans, jusqu’à la retraite,
          en ETF monde. PEA ou PER ?
        </p>
        <div className="calculateur">
          <Curseur libelle="Rendement fictif par an" valeur={rendement} min={0} max={8} pas={0.5} format={pourcent} onChange={setRendement} />
        </div>
        <div className="choix-liste" role="radiogroup" aria-label="Ta tranche à la retraite">
          <Choix choisi={tmiSortie === 0.11} onChoisir={() => { setTmiSortie(0.11) }} titre="Tranche à 11 % à la retraite" detail="Tes revenus baissent à la retraite." />
          <Choix choisi={tmiSortie === 0.3} onChoisir={() => { setTmiSortie(0.3) }} titre="Tranche à 30 % à la retraite" detail="Tes revenus restent élevés." />
        </div>
        <div className="choix-liste" role="radiogroup" aria-label="Ton choix">
          <Choix choisi={choix === 'pea'} onChoisir={() => { setChoix('pea') }} titre="Je choisis le PEA" />
          <Choix choisi={choix === 'per'} onChoisir={() => { setChoix('per') }} titre="Je choisis le PER" />
        </div>
        {vu ? null : <BoutonDebrief id="pea-ou-per" desactive={choix === null} onVoir={() => { setVu(true) }} />}
      </MiseEnSituation>
      {vu ? (
        <Debrief titre="Ce qu’il reste après impôt, dans 30 ans" modules={[1, 4]} sources={[SOURCES.per, SOURCES.pea, SOURCES.peaFiscalite]}>
          <ul className="liste-resultats chiffres">
            {lignes.map((l) => (
              <li key={l.cle}>
                <span>
                  {l.titre}
                  <small className="calculateur__detail">{l.detail}</small>
                </span>
                <strong>{euros(l.net)}</strong>
              </li>
            ))}
          </ul>
          <p className="carte__texte">
            Les versements déduits d’un PER sont imposés au barème à la sortie en capital, et les gains au PFU : l’impôt est
            reporté, pas effacé. Le PER gagne quand ta tranche est plus basse à la retraite qu’aujourd’hui, et surtout si
            l’économie d’impôt est placée. Mais il est bloqué jusqu’à la retraite, sauf cas prévus comme l’achat de ta
            résidence principale ; un PEA de plus de 5 ans reste disponible.
          </p>
          <p className="note-source">
            Rendement fictif et constant. Hypothèse : versements dans la limite du plafond de déduction, et sortie étalée
            qui reste dans la tranche choisie.
          </p>
        </Debrief>
      ) : null}
    </>
  )
}

export function CasAbondement() {
  const p = parametres2026()
  const plafondEntreprise = 1500
  const [versement, setVersement] = useState(1500)
  const [choix, setChoix] = useState<'pee' | 'pea' | null>(null)
  const [vu, setVu] = useState(false)
  const r = abondementPee({ versement, taux: 1, plafondEntreprise }, p)
  return (
    <>
      <MiseEnSituation titre="Un abondement à 100 %">
        <p className="carte__texte chiffres">
          Ton employeur abonde ton PEE à 100 %, jusqu’à {euros(plafondEntreprise)} par an (règle fictive de ton
          entreprise). Tu as {euros(versement)} à placer cette année. Le PEE d’abord, ou un PEA ?
        </p>
        <div className="calculateur">
          <Curseur libelle="Somme à placer" valeur={versement} min={100} max={3000} pas={100} format={euros} onChange={setVersement} />
        </div>
        <div className="choix-liste" role="radiogroup" aria-label="Ton choix">
          <Choix choisi={choix === 'pee'} onChoisir={() => { setChoix('pee') }} titre="Remplir le PEE jusqu’au plafond d’abondement" />
          <Choix choisi={choix === 'pea'} onChoisir={() => { setChoix('pea') }} titre="Tout mettre sur un PEA, disponible" />
        </div>
        {vu ? null : <BoutonDebrief id="abondement" desactive={choix === null} onVoir={() => { setVu(true) }} />}
      </MiseEnSituation>
      {vu ? (
        <Debrief titre="Un rendement immédiat, contre un blocage" modules={[4]} sources={[SOURCES.pee]}>
          <div className="calculateur__lignes chiffres">
            <span>Ton versement</span>
            <span>{euros(versement)}</span>
            <span>Abondement brut</span>
            <span>+{euros(r.abondementBrut)}</span>
            <span>CSG et CRDS sur l’abondement</span>
            <span>−{euros(r.csgCrds)}</span>
            <span>Placé sur ton PEE</span>
            <span>{euros(r.netPlace)}</span>
          </div>
          <Resultat
            libelle="Gain immédiat"
            valeur={formatPourcentage(r.gainImmediat, { decimales: 0, signe: true })}
            detail={`Un placement bloqué ${r.blocageAnnees} ans devrait rapporter ${formatPourcentage(r.rendementEquivalent, { decimales: 1 })} par an pour faire aussi bien.`}
          />
          <p className="carte__texte">
            L’abondement est exonéré d’impôt sur le revenu, mais soumis à la CSG et à la CRDS. Il ne peut pas dépasser 3 fois
            ton versement, ni le plafond légal de {euros(p['epargneSalariale.abondementPeeMax'].valeur)} par an. En
            contrepartie, l’argent est bloqué {r.blocageAnnees} ans, sauf cas de déblocage anticipé : ton épargne de
            précaution doit donc être constituée ailleurs avant.
          </p>
        </Debrief>
      ) : null}
    </>
  )
}

export function CasHeritage() {
  const p = parametres2026()
  const montant = 50000
  const [actions, setActions] = useState(60)
  const [vu, setVu] = useState(false)
  const projections = useMemo(
    () =>
      vu
        ? {
            choisi: projeterHeritage({ montant, partActions: actions / 100, annees: 20 }),
            prudent: projeterHeritage({ montant, partActions: 0, annees: 20 }),
            actions: projeterHeritage({ montant, partActions: 1, annees: 20 }),
          }
        : null,
    [vu, actions],
  )
  const abattement = p['succession.abattementEnfant'].valeur
  return (
    <>
      <MiseEnSituation titre="50 000 € à 30 ans">
        <p className="carte__texte chiffres">
          Tu hérites de 50 000 € d’un de tes parents. Ta part étant inférieure à l’abattement de {euros(abattement)} dont
          bénéficie chaque enfant, tu ne paies pas de droits de succession (si tu n’as pas déjà reçu de donations de ce
          parent). Tu ne prévois pas d’y toucher avant 20 ans.
        </p>
        <div className="calculateur">
          <Curseur libelle="Part en actions monde" valeur={actions} min={0} max={100} pas={10} format={(v) => `${v} %`} onChange={setActions} />
          <Resultat libelle="Répartition" valeur={`${euros((montant * actions) / 100)} en actions`} detail={`${euros((montant * (100 - actions)) / 100)} au taux du Livret A`} />
        </div>
        {vu ? null : <BoutonDebrief id="heritage" onVoir={() => { setVu(true) }} />}
      </MiseEnSituation>
      {vu && projections ? (
        <Debrief titre="Dans 20 ans, en euros d’aujourd’hui" modules={[4, 5]} sources={[SOURCES.succession, SOURCES.livretA, SOURCES.pea, SOURCES.msci]}>
          <ul className="liste-resultats chiffres">
            {[
              { cle: 'choisi', titre: `Ta répartition (${actions} % en actions)`, r: projections.choisi },
              { cle: 'prudent', titre: 'Tout au taux du Livret A', r: projections.prudent },
              { cle: 'actions', titre: 'Tout en actions monde', r: projections.actions },
            ].map((l) => (
              <li key={l.cle}>
                <span>
                  {l.titre}
                  <small className="calculateur__detail">
                    1 cas sur 10 sous {euros(l.r.final.p10)}, 1 sur 10 au-dessus de {euros(l.r.final.p90)}
                  </small>
                </span>
                <strong>{euros(l.r.final.p50)}</strong>
              </li>
            ))}
          </ul>
          <p className="carte__texte chiffres">
            Médianes de 1 000 trajectoires faites de mois réels recollés au hasard, corrigées de l’inflation. Plus la part
            en actions monte, plus la médiane grimpe, mais plus l’écart entre les bons et les mauvais cas se creuse.
          </p>
          <p className="carte__texte chiffres">
            Côté enveloppes : le Livret A est plafonné à {euros(p['livretA.plafond'].valeur)}, le PEA accepte jusqu’à{' '}
            {euros(p['pea.plafondVersements'].valeur)} de versements, et une assurance-vie ouverte maintenant aura ses 8 ans
            à 38 ans. MoneyTree ne te dira pas quoi choisir : vérifie d’abord ton épargne de précaution et ton horizon.
          </p>
        </Debrief>
      ) : null}
    </>
  )
}
