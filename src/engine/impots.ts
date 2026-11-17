/**
 * Impôt sur le revenu (barème progressif, quotient familial, décote) et prélèvement à la
 * source. Calcul exact pour les cas simulés : salaires, revenus du capital imposés au
 * barème sur option, CSG déductible. Non simulés : frais réels, réductions et crédits
 * d'impôt, cas particuliers de demi-parts (parent isolé, invalidité, anciens combattants).
 *
 * Arrondis, comme le simulateur officiel : revenu imposable, droits simples et décote à
 * l'euro le plus proche ; taux de prélèvement à la décimale la plus proche.
 */
import type { BaremeProgressif, Parametres2026 } from '../data/params/schema.ts'

export type Situation = 'celibataire' | 'couple'

export interface Foyer {
  situation: Situation
  /** Enfants mineurs à charge (hors résidence alternée). */
  enfantsACharge: number
}

export interface ParametresIR {
  bareme: BaremeProgressif
  abattementTaux: number
  abattementMinimum: number
  abattementMaximum: number
  decotePlafondSeul: number
  decotePlafondCouple: number
  decoteTaux: number
  plafondParDemiPart: number
  seuilRecouvrement: number
}

/**
 * Paramètres de l'impôt, montants multipliés par `indexation` : dans le simulateur, les
 * limites suivent l'inflation simulée (hypothèse : la loi de finances indexe le barème).
 */
export function parametresIR(p: Parametres2026, indexation = 1): ParametresIR {
  return {
    bareme: p['ir.bareme'].valeur.map((t) => ({
      jusqua: t.jusqua === null ? null : t.jusqua * indexation,
      taux: t.taux,
    })),
    abattementTaux: p['ir.abattementFraisPro.taux'].valeur,
    abattementMinimum: p['ir.abattementFraisPro.minimum'].valeur * indexation,
    abattementMaximum: p['ir.abattementFraisPro.maximum'].valeur * indexation,
    decotePlafondSeul: p['ir.decote.plafondPersonneSeule'].valeur * indexation,
    decotePlafondCouple: p['ir.decote.plafondCouple'].valeur * indexation,
    decoteTaux: p['ir.decote.taux'].valeur,
    plafondParDemiPart: p['ir.plafonnementQuotientFamilial.parDemiPart'].valeur * indexation,
    seuilRecouvrement: p['ir.seuilRecouvrement'].valeur * indexation,
  }
}

/** Parts de quotient familial : 1 ou 2, + 0,5 pour chacun des deux premiers enfants, + 1 ensuite. */
export function nombreDeParts(foyer: Foyer): number {
  const base = foyer.situation === 'couple' ? 2 : 1
  const enfants = Math.max(0, Math.floor(foyer.enfantsACharge))
  return base + Math.min(enfants, 2) * 0.5 + Math.max(0, enfants - 2)
}

function partsDeBase(foyer: Foyer): number {
  return foyer.situation === 'couple' ? 2 : 1
}

/** Impôt d'une part, barème progressif (non arrondi). */
export function impotParPart(revenuParPart: number, bareme: BaremeProgressif): number {
  let impot = 0
  let bas = 0
  for (const tranche of bareme) {
    const haut = tranche.jusqua ?? Number.POSITIVE_INFINITY
    if (revenuParPart > bas) impot += (Math.min(revenuParPart, haut) - bas) * tranche.taux
    bas = haut
  }
  return impot
}

/** Taux marginal : taux de la tranche dans laquelle tombe le revenu d'une part. */
export function tauxMarginal(revenuParPart: number, bareme: BaremeProgressif): number {
  for (const tranche of bareme) {
    if (tranche.jusqua === null || revenuParPart <= tranche.jusqua) return tranche.taux
  }
  return bareme.at(-1)?.taux ?? 0
}

/** Déduction forfaitaire de 10 % sur les salaires d'une personne, bornée. */
export function abattementFraisPro(salaireNetImposable: number, p: ParametresIR): number {
  if (salaireNetImposable <= 0) return 0
  const brut = salaireNetImposable * p.abattementTaux
  const borne = Math.min(Math.max(brut, p.abattementMinimum), p.abattementMaximum)
  return Math.round(Math.min(borne, salaireNetImposable))
}

export interface DonneesIR {
  foyer: Foyer
  /** Salaires nets imposables annuels, un montant par déclarant. */
  salaires: readonly number[]
  /** Revenus imposés au barème sans abattement (plus-values sur option, par exemple). */
  autresRevenus?: number
  /** Charges déductibles du revenu global (CSG déductible, par exemple). */
  chargesDeductibles?: number
}

export interface DetailIR {
  revenuNetImposable: number
  parts: number
  /** Impôt du barème après plafonnement du quotient familial (« droits simples »). */
  droitsSimples: number
  /** Supplément dû au plafonnement des effets du quotient familial. */
  plafonnementQuotientFamilial: number
  decote: number
  /** Impôt avant seuil de recouvrement. */
  impotAvantRecouvrement: number
  /** Impôt dû (0 sous le seuil de recouvrement). */
  impotNet: number
  tauxMarginal: number
  /** Impôt net / revenu net imposable. */
  tauxMoyen: number
}

export function calculerIR(donnees: DonneesIR, p: ParametresIR): DetailIR {
  const { foyer } = donnees
  const salairesNets = donnees.salaires.reduce(
    (somme, s) => somme + Math.max(0, s) - abattementFraisPro(s, p),
    0,
  )
  const revenuNetImposable = Math.max(
    0,
    Math.round(salairesNets + (donnees.autresRevenus ?? 0) - (donnees.chargesDeductibles ?? 0)),
  )
  const parts = nombreDeParts(foyer)
  const base = partsDeBase(foyer)

  const impotToutesParts = impotParPart(revenuNetImposable / parts, p.bareme) * parts
  const demiPartsSupplementaires = (parts - base) * 2
  const impotSansEnfants =
    impotParPart(revenuNetImposable / base, p.bareme) * base -
    demiPartsSupplementaires * p.plafondParDemiPart
  const avantPlafond = Math.round(impotToutesParts)
  const droitsSimples = Math.round(Math.max(impotToutesParts, impotSansEnfants))

  const plafondDecote = foyer.situation === 'couple' ? p.decotePlafondCouple : p.decotePlafondSeul
  const decote = Math.min(
    droitsSimples,
    Math.max(0, Math.round(plafondDecote - p.decoteTaux * droitsSimples)),
  )
  const impotAvantRecouvrement = droitsSimples - decote
  const impotNet = impotAvantRecouvrement < p.seuilRecouvrement ? 0 : impotAvantRecouvrement

  return {
    revenuNetImposable,
    parts,
    droitsSimples,
    plafonnementQuotientFamilial: droitsSimples - avantPlafond,
    decote,
    impotAvantRecouvrement,
    impotNet,
    tauxMarginal: tauxMarginal(revenuNetImposable / parts, p.bareme),
    tauxMoyen: revenuNetImposable > 0 ? impotNet / revenuNetImposable : 0,
  }
}

/**
 * Taux personnalisé du prélèvement à la source : impôt / revenus soumis au prélèvement
 * (CGI, art. 204 H I), arrondi à la décimale la plus proche (0,05 % compte pour 0,1 %).
 */
export function tauxPrelevementPersonnalise(impot: number, salairesNetsImposables: number): number {
  if (salairesNetsImposables <= 0 || impot <= 0) return 0
  return Math.round((impot / salairesNetsImposables) * 1000 + 1e-9) / 1000
}

/**
 * Taux par défaut (« neutre ») : le taux de la tranche s'applique à toute la base mensuelle.
 * `indexation` convertit la base en euros de l'année des paramètres.
 */
export function tauxPrelevementParDefaut(
  baseMensuelle: number,
  grille: BaremeProgressif,
  indexation = 1,
): number {
  const base = baseMensuelle / indexation
  for (const tranche of grille) {
    if (tranche.jusqua === null || base < tranche.jusqua) return tranche.taux
  }
  return grille.at(-1)?.taux ?? 0
}
