/**
 * Immobilier et crédit (cahier des charges, sous-modèle 6) : crédit amortissable avec
 * assurance, règles du HCSF et taux de l'usure vérifiés à la souscription, frais
 * d'acquisition dans l'ancien, fiscalité des loyers d'une location nue.
 *
 * Règles réelles (paramètres officiels) : droits de mutation et émoluments du notaire,
 * taux d'effort de 35 % et durée de 25 ans (HCSF), taux de l'usure, micro-foncier.
 * Hypothèses (saisies par le joueur ou signalées) : taux d'assurance, charges, taxe
 * foncière, vacance locative, frais de dossier et de garantie non simulés.
 */
import type { BaremeDegressif, Parametres2026 } from '../data/params/schema.ts'

// --------------------------------------------------------------------------- Crédit

export interface Credit {
  capitalInitial: number
  capitalRestant: number
  /** Taux nominal annuel, hors assurance. */
  tauxAnnuel: number
  /** Assurance emprunteur, en part du capital initial par an. */
  tauxAssurance: number
  dureeMois: number
  moisRestants: number
  /** Mensualité hors assurance, constante. */
  mensualite: number
}

/** Mensualité constante d'un prêt amortissable : C × r / (1 − (1 + r)^−n), r taux mensuel. */
export function mensualiteCredit(capital: number, tauxAnnuel: number, dureeMois: number): number {
  if (capital <= 0 || dureeMois <= 0) return 0
  const r = tauxAnnuel / 12
  if (r === 0) return capital / dureeMois
  return (capital * r) / (1 - (1 + r) ** -dureeMois)
}

export function ouvrirCredit(capital: number, tauxAnnuel: number, tauxAssurance: number, dureeMois: number): Credit {
  return {
    capitalInitial: capital,
    capitalRestant: capital,
    tauxAnnuel,
    tauxAssurance,
    dureeMois,
    moisRestants: dureeMois,
    mensualite: mensualiteCredit(capital, tauxAnnuel, dureeMois),
  }
}

export function assuranceMensuelle(credit: Pick<Credit, 'capitalInitial' | 'tauxAssurance'>): number {
  return (credit.capitalInitial * credit.tauxAssurance) / 12
}

/** Échéance du mois : intérêts, capital remboursé, assurance. Le crédit vaut null une fois soldé. */
export function echeanceCredit(credit: Credit): {
  credit: Credit | null
  interets: number
  capital: number
  assurance: number
  paiement: number
} {
  const interets = credit.capitalRestant * (credit.tauxAnnuel / 12)
  const capital = Math.min(credit.capitalRestant, Math.max(0, credit.mensualite - interets))
  const assurance = assuranceMensuelle(credit)
  const capitalRestant = credit.capitalRestant - capital
  const moisRestants = credit.moisRestants - 1
  const solde = moisRestants <= 0 || capitalRestant < 0.005
  return {
    credit: solde ? null : { ...credit, capitalRestant, moisRestants },
    interets,
    capital,
    assurance,
    paiement: interets + capital + assurance,
  }
}

/** Coût total d'un crédit : intérêts et assurance sur toute la durée. */
export function coutCredit(capital: number, tauxAnnuel: number, tauxAssurance: number, dureeMois: number) {
  let credit: Credit | null = ouvrirCredit(capital, tauxAnnuel, tauxAssurance, dureeMois)
  let interets = 0
  let assurance = 0
  while (credit) {
    const e = echeanceCredit(credit)
    interets += e.interets
    assurance += e.assurance
    credit = e.credit
  }
  return { interets, assurance, total: interets + assurance }
}

// --------------------------------------------------------------- Frais d'acquisition

/** Émoluments du notaire (HT) d'une vente : barème par tranches de prix (service-public F17701). */
export function emolumentsNotaire(prix: number, bareme: BaremeDegressif): number {
  let total = 0
  let bas = 0
  for (const tranche of bareme) {
    const haut = tranche.jusqua ?? Number.POSITIVE_INFINITY
    if (prix > bas) total += (Math.min(prix, haut) - bas) * tranche.taux
    bas = haut
  }
  return total
}

export interface FraisAcquisition {
  droitsMutation: number
  contributionSecurite: number
  emolumentsTTC: number
  total: number
  /** Taux du droit départemental retenu. */
  droitDepartemental: number
}

/**
 * Frais d'un achat dans l'ancien : droits de mutation (droit départemental, taxe communale,
 * frais d'assiette), contribution de sécurité immobilière et émoluments du notaire TTC.
 * Un primo-accédant qui achète sa résidence principale échappe à la hausse de 2025 ; sinon,
 * on retient le plafond de 5 %, voté par une partie des départements. Non compris : débours
 * et formalités, frais de dossier et de garantie du prêt.
 */
export function fraisAcquisitionAncien(
  prix: number,
  p: Parametres2026,
  options: { primoAccedant: boolean },
): FraisAcquisition {
  const departemental = options.primoAccedant
    ? p['notaire.droitDepartementalPrimoAccedant'].valeur
    : p['notaire.droitDepartementalMax'].valeur
  const droitsMutation =
    prix * (departemental + p['notaire.taxeCommunale'].valeur + departemental * p['notaire.fraisAssiette'].valeur)
  const contributionSecurite = prix * p['notaire.contributionSecuriteImmobiliere'].valeur
  const emolumentsTTC = emolumentsNotaire(prix, p['notaire.emolumentsVente'].valeur) * (1 + p['notaire.tvaEmoluments'].valeur)
  return {
    droitsMutation,
    contributionSecurite,
    emolumentsTTC,
    total: droitsMutation + contributionSecurite + emolumentsTTC,
    droitDepartemental: departemental,
  }
}

// ----------------------------------------------------------- Octroi : HCSF et usure

export interface ControleOctroi {
  tauxEffort: number
  effortOk: boolean
  dureeOk: boolean
  /** TAEG approché (taux nominal + assurance), comparé au taux de l'usure des prêts de 20 ans et plus. */
  taegApproche: number
  usureOk: boolean
  ok: boolean
  motifs: string[]
}

/**
 * Critères vérifiés à la souscription : taux d'effort de 35 % au plus et durée de 25 ans au
 * plus (HCSF), TAEG sous le taux de l'usure. Simplifications : le revenu retenu est le
 * revenu net mensuel avant impôt ; la marge de flexibilité des banques (20 % de leur
 * production) n'est pas simulée ; l'usure n'est contrôlée que pour les prêts de 20 ans et
 * plus, la seule catégorie dont le taux est dans les paramètres.
 */
export function controleOctroi(
  d: { chargesCreditMensuelles: number; revenusNetsMensuels: number; dureeMois: number; tauxAnnuel: number; tauxAssurance: number },
  p: Parametres2026,
): ControleOctroi {
  const tauxEffort = d.revenusNetsMensuels > 0 ? d.chargesCreditMensuelles / d.revenusNetsMensuels : Number.POSITIVE_INFINITY
  const effortMax = p['hcsf.tauxEffortMax'].valeur
  const dureeMax = p['hcsf.dureeMaxAnnees'].valeur * 12
  const effortOk = tauxEffort <= effortMax + 1e-9
  const dureeOk = d.dureeMois <= dureeMax
  const taegApproche = d.tauxAnnuel + d.tauxAssurance
  const usure = p['usure.pretsImmobiliersTauxFixe20AnsEtPlus'].valeur
  const usureOk = d.dureeMois < 240 || taegApproche <= usure + 1e-9
  const motifs: string[] = []
  if (!effortOk) {
    motifs.push(
      `Taux d’effort de ${(tauxEffort * 100).toFixed(1).replace('.', ',')} % : le HCSF fixe un maximum de ${Math.round(effortMax * 100)} %.`,
    )
  }
  if (!dureeOk) motifs.push(`Durée de ${Math.round(d.dureeMois / 12)} ans : le HCSF fixe un maximum de ${dureeMax / 12} ans.`)
  if (!usureOk) {
    motifs.push(
      `TAEG d’environ ${(taegApproche * 100).toFixed(2).replace('.', ',')} % : au-dessus du taux de l’usure (${(usure * 100).toFixed(2).replace('.', ',')} %).`,
    )
  }
  return { tauxEffort, effortOk, dureeOk, taegApproche, usureOk, ok: effortOk && dureeOk && usureOk, motifs }
}

// ------------------------------------------------------------ Revenus d'une location nue

/**
 * Revenu foncier imposable : micro-foncier (abattement de 30 %) sous le plafond de loyers,
 * sinon régime réel (loyers moins charges déductibles, sans report de déficit simulé).
 */
export function revenuFoncierImposable(
  loyersBruts: number,
  chargesDeductibles: number,
  p: Parametres2026,
): { imposable: number; regime: 'micro-foncier' | 'reel' } {
  if (loyersBruts <= 0) return { imposable: 0, regime: 'micro-foncier' }
  if (loyersBruts < p['revenusFonciers.plafondMicroFoncier'].valeur) {
    return { imposable: loyersBruts * (1 - p['revenusFonciers.abattementMicroFoncier'].valeur), regime: 'micro-foncier' }
  }
  return { imposable: Math.max(0, loyersBruts - chargesDeductibles), regime: 'reel' }
}
