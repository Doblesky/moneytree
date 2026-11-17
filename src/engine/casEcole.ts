/**
 * Cas d'école (cahier des charges, « Modes de jeu ») : des scénarios courts avec un objectif
 * précis, corrigés par un débrief. Chaque fonction calcule ce que le débrief affiche, à partir
 * des paramètres officiels et des séries historiques réelles. Les rendements constants
 * (PEA ou PER, frais) sont fictifs et signalés comme tels à l'écran.
 */
import type { Parametres2026 } from '../data/params/schema.ts'
import { calculerIR, parametresIR } from './impots.ts'
import { SERIES, type SeriesMarche } from './marches.ts'
import { projeterVersements, type ResultatProjection } from './projection.ts'
import { brutVersNet } from './salaire.ts'

// ------------------------------------------------------------------ Premier salaire

export interface BudgetPremierSalaire {
  netMensuel: number
  impotMensuel: number
  disponible: number
  reste: number
  /** Épargne de précaution visée : 3 à 6 mois de revenus (portail de la Banque de France). */
  precaution: { basse: number; haute: number }
  /** Mois d'épargne pour atteindre le bas de la fourchette (null si rien ne reste). */
  moisPourPrecaution: number | null
}

export function budgetPremierSalaire(
  d: { brutAnnuel: number; loyer: number; autresDepenses: number },
  p: Parametres2026,
): BudgetPremierSalaire {
  const s = brutVersNet(d.brutAnnuel, p['cotisations.salarieCadre'].valeur)
  const ir = calculerIR({ foyer: { situation: 'celibataire', enfantsACharge: 0 }, salaires: [s.netImposable] }, parametresIR(p))
  const netMensuel = s.netAvantImpot / 12
  const impotMensuel = ir.impotNet / 12
  const disponible = netMensuel - impotMensuel
  const reste = disponible - d.loyer - d.autresDepenses
  const precaution = { basse: 3 * netMensuel, haute: 6 * netMensuel }
  return {
    netMensuel,
    impotMensuel,
    disponible,
    reste,
    precaution,
    moisPourPrecaution: reste > 0 ? Math.ceil(precaution.basse / reste) : null,
  }
}

// ---------------------------------------------------------------------- PEA ou PER

export interface ResultatEnveloppe {
  verse: number
  valeur: number
  impot: number
  net: number
}

/** Valeur acquise de versements annuels en début d'année, à rendement constant. */
function valeurAcquise(versementAnnuel: number, annees: number, rendement: number): number {
  let valeur = 0
  for (let k = 0; k < annees; k++) valeur = (valeur + versementAnnuel) * (1 + rendement)
  return valeur
}

function sortiePea(verse: number, valeur: number, p: Parametres2026): ResultatEnveloppe {
  const impot = Math.max(0, valeur - verse) * p['pea.tauxApres5Ans'].valeur
  return { verse, valeur, impot, net: valeur - impot }
}

/**
 * Versements annuels sur un PEA ou sur un PER (déduits, dans la limite du plafond), sortie
 * en capital à la retraite : versements déduits au barème, à la tranche de sortie choisie
 * (sortie étalée qui reste dans cette tranche), gains au PFU (service-public F34982).
 */
export function comparerPeaPer(
  d: { versementAnnuel: number; annees: number; rendement: number; tmiEntree: number; tmiSortie: number },
  p: Parametres2026,
): { pea: ResultatEnveloppe; per: ResultatEnveloppe; economiePlacee: ResultatEnveloppe; economieAnnuelle: number } {
  const verse = d.versementAnnuel * d.annees
  const valeur = valeurAcquise(d.versementAnnuel, d.annees, d.rendement)
  const pea = sortiePea(verse, valeur, p)
  const gains = Math.max(0, valeur - verse)
  const impotPer = verse * d.tmiSortie + gains * p['pfu.tauxGlobal'].valeur
  const per = { verse, valeur, impot: impotPer, net: valeur - impotPer }
  const economieAnnuelle = d.versementAnnuel * d.tmiEntree
  const economiePlacee = sortiePea(
    economieAnnuelle * d.annees,
    valeurAcquise(economieAnnuelle, d.annees, d.rendement),
    p,
  )
  return { pea, per, economiePlacee, economieAnnuelle }
}

// ---------------------------------------------------------------------- Abondement

export interface ResultatAbondement {
  abondementBrut: number
  csgCrds: number
  /** Ce qui arrive sur le PEE : ton versement, plus l'abondement net. */
  netPlace: number
  gainImmediat: number
  /** Rendement annuel qu'un autre placement devrait servir pendant le blocage pour faire aussi bien. */
  rendementEquivalent: number
  blocageAnnees: number
}

export function abondementPee(
  d: { versement: number; taux: number; plafondEntreprise: number },
  p: Parametres2026,
): ResultatAbondement {
  const plafond = Math.min(d.plafondEntreprise, p['epargneSalariale.abondementPeeMax'].valeur)
  const abondementBrut = Math.max(
    0,
    Math.min(d.versement * Math.min(d.taux, p['epargneSalariale.abondementRatioMax'].valeur), plafond),
  )
  const csgCrds = abondementBrut * p['csgCrds.revenusActivite'].valeur
  const netPlace = d.versement + abondementBrut - csgCrds
  const blocageAnnees = p['epargneSalariale.blocagePeeAnnees'].valeur
  const gainImmediat = d.versement > 0 ? netPlace / d.versement - 1 : 0
  return {
    abondementBrut,
    csgCrds,
    netPlace,
    gainImmediat,
    rendementEquivalent: d.versement > 0 ? (netPlace / d.versement) ** (1 / blocageAnnees) - 1 : 0,
    blocageAnnees,
  }
}

// ------------------------------------------------------------------ Investir en 2007

export interface Trajectoires2007 {
  mois: string[]
  enUneFois: number[]
  en24Mois: number[]
  /** Somme versée à la fin de chaque mois dans la version étalée. */
  verse24: number[]
}

/** 20 000 € sur le MSCI World en euros : tout en janvier 2007, ou 1/24 par mois sur 2007 et 2008. */
export function investir2007(montant = 20000, series: SeriesMarche = SERIES): Trajectoires2007 {
  const debut = series.mois.indexOf('2007-01')
  const fin = series.mois.indexOf('2016-12')
  const res: Trajectoires2007 = { mois: [], enUneFois: [], en24Mois: [], verse24: [] }
  if (debut < 0 || fin < debut) return res
  let uneFois = montant
  let etale = 0
  let verse = 0
  for (let k = debut; k <= fin; k++) {
    const r = series.actionsMonde[k] ?? 0
    if (k < debut + 24) {
      etale += montant / 24
      verse += montant / 24
    }
    uneFois *= 1 + r
    etale *= 1 + r
    res.mois.push(series.mois[k] ?? '')
    res.enUneFois.push(uneFois)
    res.en24Mois.push(etale)
    res.verse24.push(verse)
  }
  return res
}

// ----------------------------------------------------------------------- Mars 2020

export type ChoixMars2020 = 'vendre' | 'tenir' | 'renforcer'

export interface ResultatMars2020 {
  /** Rendement du MSCI World en euros en mars 2020. */
  baisseMars: number
  valeurFinMars: number
  /** Valeur fin décembre 2021 selon le choix fait fin mars 2020. */
  valeurs: Record<ChoixMars2020, number>
  verse: Record<ChoixMars2020, number>
  mois: string[]
  series: Record<ChoixMars2020, number[]>
}

/**
 * Un portefeuille d'actions monde de `capital` fin février 2020. Fin mars, après la chute :
 * tout vendre (l'argent reste sur un compte, sans tenir compte de l'impôt), tenir, ou
 * renforcer avec `renfort` pris sur l'épargne disponible. Valeurs jusqu'à fin 2021.
 */
export function mars2020(capital = 20000, renfort = 5000, series: SeriesMarche = SERIES): ResultatMars2020 {
  const mars = series.mois.indexOf('2020-03')
  const fin = series.mois.indexOf('2021-12')
  const baisseMars = series.actionsMonde[mars] ?? 0
  const valeurFinMars = capital * (1 + baisseMars)
  const res: ResultatMars2020 = {
    baisseMars,
    valeurFinMars,
    valeurs: { vendre: valeurFinMars, tenir: valeurFinMars, renforcer: valeurFinMars + renfort },
    verse: { vendre: capital, tenir: capital, renforcer: capital + renfort },
    mois: ['2020-02', '2020-03'],
    series: {
      vendre: [capital, valeurFinMars],
      tenir: [capital, valeurFinMars],
      renforcer: [capital, valeurFinMars + renfort],
    },
  }
  if (mars < 0 || fin < mars) return res
  for (let k = mars + 1; k <= fin; k++) {
    const r = series.actionsMonde[k] ?? 0
    res.valeurs.tenir *= 1 + r
    res.valeurs.renforcer *= 1 + r
    res.mois.push(series.mois[k] ?? '')
    res.series.vendre.push(res.valeurs.vendre)
    res.series.tenir.push(res.valeurs.tenir)
    res.series.renforcer.push(res.valeurs.renforcer)
  }
  return res
}

// ------------------------------------------------------------------------- Les frais

/**
 * Versements mensuels sur 30 ans à un rendement brut fictif, avec des frais annuels
 * prélevés chaque mois (un douzième). Une valeur par année, départ compris.
 */
export function capitalAvecFrais(d: { mensuel: number; annees: number; rendement: number; frais: number }): number[] {
  const rendementMensuel = (1 + d.rendement) ** (1 / 12) - 1
  const valeurs = [0]
  let valeur = 0
  for (let m = 1; m <= d.annees * 12; m++) {
    valeur = (valeur + d.mensuel) * (1 + rendementMensuel) * (1 - d.frais / 12)
    if (m % 12 === 0) valeurs.push(valeur)
  }
  return valeurs
}

// ------------------------------------------------------------------------- Héritage

/**
 * Rendements mensuels réels (corrigés de l'inflation) d'un portefeuille rééquilibré chaque
 * mois : `partActions` en actions monde, le reste au taux du Livret A de chaque mois.
 */
export function rendementsMixtes(partActions: number, series: SeriesMarche = SERIES): number[] {
  return series.actionsMonde.map((r, i) => {
    const inflation = series.inflation[i] ?? 0
    const livret = (series.livretA[i] ?? 0) / 12
    const nominal = partActions * r + (1 - partActions) * livret
    return (1 + nominal) / (1 + inflation) - 1
  })
}

/** Projection Monte Carlo d'une somme placée en une fois, en euros d'aujourd'hui. */
export function projeterHeritage(d: { montant: number; partActions: number; annees: number; graine?: number }): ResultatProjection {
  return projeterVersements({
    versementMensuel: 0,
    capitalInitial: d.montant,
    mois: d.annees * 12,
    rendements: rendementsMixtes(d.partActions),
    trajectoires: 1000,
    graine: d.graine ?? 20261117,
  })
}
