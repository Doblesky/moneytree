/**
 * Allocation d'aide au retour à l'emploi (ARE), règles des fins de contrat à compter du
 * 1er avril 2025, moins de 55 ans (service-public F38881, F2064 ; retenues : France Travail).
 *
 * Allocation approchée, comme le prévoit le cahier des charges :
 * - le salaire journalier de référence (SJR) est le brut annuel divisé par 365, ce qui vaut
 *   pour un salarié à temps plein toute l'année ;
 * - la durée d'indemnisation part des mois travaillés (jours calendaires ≈ mois × 365 / 12) ;
 * - CSG au taux normal (le taux réduit des revenus modestes n'est pas simulé) ;
 * - pas de différé congés payés ni de différé spécifique, pas de rechargement des droits.
 */
import type { Parametres2026 } from '../data/params/schema.ts'

export interface DroitsAre {
  /** Salaire journalier de référence. */
  sjr: number
  /** Allocation brute journalière avant dégressivité. */
  journalierBrut: number
  /** Jours indemnisables à l'ouverture des droits. */
  joursTotal: number
  /** Jours déjà versés. */
  joursVerses: number
}

export interface DetailAreJournaliere {
  brut: number
  retraiteComplementaire: number
  csgCrds: number
  net: number
}

/** Jours calendaires moyens dans un mois. */
export const JOURS_PAR_MOIS = 365 / 12
/** L'ARE est versée sur la base de 30 jours par mois (service-public F38881). */
export const JOURS_VERSES_PAR_MOIS = 30

export function sjrDepuisBrutAnnuel(brutAnnuel: number): number {
  return brutAnnuel / 365
}

/**
 * Droits ouverts à la perte d'emploi. `moisTravailles` : mois travaillés sur les 24 derniers
 * mois. Renvoie null si la durée minimale de travail n'est pas atteinte.
 */
export function ouvrirDroitsAre(
  brutAnnuel: number,
  moisTravailles: number,
  dejaIndemnise: boolean,
  p: Parametres2026,
): DroitsAre | null {
  const minimum = dejaIndemnise
    ? p['chomage.affiliationMinMois'].valeur
    : p['chomage.affiliationMinMoisPrimoEntrant'].valeur
  const mois = Math.min(24, moisTravailles)
  if (mois < minimum || brutAnnuel <= 0) return null
  const sjr = sjrDepuisBrutAnnuel(brutAnnuel)
  const formule = p['chomage.partieFixeJournaliere'].valeur + p['chomage.tauxPartieVariable'].valeur * sjr
  const journalierBrut = Math.min(
    Math.max(formule, p['chomage.plancherSjr'].valeur * sjr),
    p['chomage.plafondSjr'].valeur * sjr,
  )
  const joursTotal = Math.min(
    p['chomage.dureeMaxJours'].valeur,
    Math.round(mois * JOURS_PAR_MOIS * p['chomage.coefficientDuree'].valeur),
  )
  return { sjr, journalierBrut, joursTotal, joursVerses: 0 }
}

/** Allocation d'un jour donné, après dégressivité éventuelle et retenues. */
export function areJournaliere(droits: DroitsAre, p: Parametres2026): DetailAreJournaliere {
  let brut = droits.journalierBrut
  // Dégressivité : −30 % à partir du 7e mois de versement, au-delà d'un certain SJR.
  const debutDegressivite = 6 * JOURS_VERSES_PAR_MOIS
  if (droits.sjr > p['chomage.seuilDegressiviteSjr'].valeur && droits.joursVerses >= debutDegressivite) {
    brut = Math.max(
      brut * (1 - p['chomage.tauxDegressivite'].valeur),
      Math.min(brut, p['chomage.plancherDegressiviteJournalier'].valeur),
    )
  }
  const minimum = p['chomage.minimumNetJournalier'].valeur
  // La participation retraite ne fait pas descendre l'allocation sous le minimum.
  const retraiteComplementaire = Math.max(
    0,
    Math.min(droits.sjr * p['chomage.retraiteComplementaireSjr'].valeur, brut - minimum),
  )
  // CSG et CRDS : pas en dessous du SMIC journalier.
  const smic = p['chomage.smicJournalier'].valeur
  const taux = p['chomage.tauxCsg'].valeur + p['chomage.tauxCrds'].valeur
  const csgPleine = brut * (1 - p['chomage.abattementAssietteCsg'].valeur) * taux
  const apresRetraite = brut - retraiteComplementaire
  const csgCrds = brut < smic ? 0 : Math.max(0, Math.min(csgPleine, apresRetraite - smic))
  const net = Math.max(minimum, apresRetraite - csgCrds)
  return { brut, retraiteComplementaire, csgCrds, net }
}

/**
 * Montant net versé pour un mois : 30 jours au plus (moins le délai d'attente le premier
 * mois), dans la limite des droits restants.
 */
export function areDuMois(
  droits: DroitsAre,
  p: Parametres2026,
  joursMax: number = JOURS_VERSES_PAR_MOIS,
): { droits: DroitsAre; net: number; brut: number; jours: number } {
  const jours = Math.max(0, Math.min(joursMax, droits.joursTotal - droits.joursVerses))
  let net = 0
  let brut = 0
  // Approximation : la dégressivité s'applique au mois entier dès que 180 jours ont été versés.
  if (jours > 0) {
    const d = areJournaliere(droits, p)
    net = d.net * jours
    brut = d.brut * jours
  }
  return { droits: { ...droits, joursVerses: droits.joursVerses + jours }, net, brut, jours }
}
