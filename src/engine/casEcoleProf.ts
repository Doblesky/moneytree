/**
 * Cas d'école du profil prof. Les règles (traitement, primes, retenues, temps partiel,
 * pension, AIP, LEP) viennent des paramètres officiels via src/engine/fonctionPublique.ts ;
 * les loyers, dépenses et frais de déménagement sont des hypothèses saisies par le joueur.
 */
import type { Parametres2026 } from '../data/params/schema.ts'
import { bulletinMensuel, pensionDeBase, promouvoir, traitementMensuel, type PositionGrille } from './fonctionPublique.ts'
import { calculerIR, parametresIR } from './impots.ts'

const CN1: PositionGrille = { grade: 'classe-normale', echelon: 1 }

// ------------------------------------------------------------- Premier traitement

export interface BudgetPremierTraitement {
  netMensuel: number
  impotMensuel: number
  reste: number
  precaution: { basse: number; haute: number }
  /** Revenu fiscal de référence d'une année entière en M1, estimé (salaires − 10 %). */
  revenuFiscalEstime: number
  sousPlafondLep: boolean
}

export function budgetPremierTraitement(
  d: { loyer: number; autresDepenses: number },
  p: Parametres2026,
): BudgetPremierTraitement {
  const b = bulletinMensuel({ statut: 'eleve', position: CN1 }, p)
  const ir = calculerIR(
    { foyer: { situation: 'celibataire', enfantsACharge: 0 }, salaires: [b.netImposable * 12] },
    parametresIR(p),
  )
  const impotMensuel = ir.impotNet / 12
  return {
    netMensuel: b.netAvantImpot,
    impotMensuel,
    reste: b.netAvantImpot - impotMensuel - d.loyer - d.autresDepenses,
    precaution: { basse: 3 * b.netAvantImpot, haute: 6 * b.netAvantImpot },
    revenuFiscalEstime: ir.revenuNetImposable,
    sousPlafondLep: ir.revenuNetImposable <= p['lep.plafondRevenuFiscalReference1Part'].valeur,
  }
}

// ------------------------------------------------------------- Affectation loin

export interface ComparaisonAffectation {
  /** Dépenses de l'installation : déménagement, premier loyer, dépôt de garantie. */
  coutInstallation: number
  /** AIP versée : plafond de la zone, dans la limite des dépenses engagées. */
  aip: number
  /** Ce que coûte l'installation une fois l'AIP reçue. */
  resteInstallation: number
  /** Trajets sur un an si tu gardes ton logement actuel. */
  trajetsAnnuels: number
}

export function comparerAffectation(
  d: { fraisDemenagement: number; nouveauLoyer: number; zoneTendue: boolean; trajetsMensuels: number },
  p: Parametres2026,
): ComparaisonAffectation {
  // Premier loyer et dépôt de garantie : un mois chacun (hypothèse de l'exemple).
  const coutInstallation = d.fraisDemenagement + 2 * d.nouveauLoyer
  const plafond = d.zoneTendue ? p['aip.montantZoneAlur'].valeur : p['aip.montantAutres'].valeur
  const aip = Math.min(plafond, coutInstallation)
  return { coutInstallation, aip, resteInstallation: coutInstallation - aip, trajetsAnnuels: 12 * d.trajetsMensuels }
}

// ------------------------------------------------------------- Temps partiel

export interface CoutTempsPartiel {
  netPlein: number
  netPartiel: number
  /** Net perdu chaque mois. */
  perteMensuelle: number
  /** Retenue pour pension en plus chaque mois, si tu surcotises. */
  surcoutSurcotisation: number
  /** Pension mensuelle brute avec 5 ans à 80 % non surcotisés, et à temps plein. */
  pensionAvec: number
  pensionSans: number
}

/**
 * Cinq ans à 80 % dans une carrière complète de 172 trimestres : la pension compte 4 ans au
 * lieu de 5, soit 4 trimestres de moins (la durée d'assurance, elle, n'est pas touchée).
 */
export function coutTempsPartiel(position: PositionGrille, indiceFinCarriere: number, p: Parametres2026): CoutTempsPartiel {
  const plein = bulletinMensuel({ statut: 'titulaire', position }, p)
  const quotite = p['fp.tempsPartiel.remuneration80'].valeur
  const partiel = bulletinMensuel({ statut: 'titulaire', position, quotite }, p)
  const surcotise = bulletinMensuel({ statut: 'titulaire', position, quotite, surcotisation: true }, p)
  const requis = p['fp.retraite.trimestresRequisNesApres1969'].valeur
  const age = p['fp.retraite.ageTauxPleinSedentaire'].valeur
  const pensionSans = pensionDeBase(
    { indiceMajore: indiceFinCarriere, trimestresLiquidables: requis, trimestresAssurance: requis, ageDepart: age },
    p,
  ).mensuelleBrute
  const pensionAvec = pensionDeBase(
    { indiceMajore: indiceFinCarriere, trimestresLiquidables: requis - 4, trimestresAssurance: requis, ageDepart: age },
    p,
  ).mensuelleBrute
  return {
    netPlein: plein.netAvantImpot,
    netPartiel: partiel.netAvantImpot,
    perteMensuelle: plein.netAvantImpot - partiel.netAvantImpot,
    surcoutSurcotisation: surcotise.retenuePension - partiel.retenuePension,
    pensionAvec,
    pensionSans,
  }
}

// ------------------------------------------------------------- Hors classe

export interface EffetHorsClasse {
  /** Échelon de la hors classe atteint en venant du 11e échelon de la classe normale. */
  echelonArrivee: number
  netClasseNormale: number
  netHorsClasse: number
  /** Pension de base, carrière complète, au sommet de chaque grade. */
  pensionClasseNormale: number
  pensionHorsClasse: number
}

export function effetHorsClasse(p: Parametres2026): EffetHorsClasse {
  const grilleCN = p['certifies.grilleClasseNormale'].valeur
  const grilleHC = p['certifies.grilleHorsClasse'].valeur
  const sommetCN = grilleCN.length
  const arrivee = promouvoir({ position: { grade: 'classe-normale', echelon: sommetCN }, ancienneteMois: 0, bonificationMois: 0 }, 'hors-classe', p)
  const cn = bulletinMensuel({ statut: 'titulaire', position: { grade: 'classe-normale', echelon: sommetCN } }, p)
  const hc = bulletinMensuel({ statut: 'titulaire', position: arrivee.position }, p)
  const requis = p['fp.retraite.trimestresRequisNesApres1969'].valeur
  const age = p['fp.retraite.ageTauxPleinSedentaire'].valeur
  const pension = (indice: number) =>
    pensionDeBase({ indiceMajore: indice, trimestresLiquidables: requis, trimestresAssurance: requis, ageDepart: age }, p)
      .mensuelleBrute
  return {
    echelonArrivee: arrivee.position.echelon,
    netClasseNormale: cn.netAvantImpot,
    netHorsClasse: hc.netAvantImpot,
    pensionClasseNormale: pension(grilleCN.at(-1)?.indiceMajore ?? 0),
    pensionHorsClasse: pension(grilleHC.at(-1)?.indiceMajore ?? 0),
  }
}

/** Traitement indiciaire mensuel au sommet d'une grille (pour les textes). */
export function traitementSommet(indice: number, p: Parametres2026): number {
  return traitementMensuel(indice, p)
}
