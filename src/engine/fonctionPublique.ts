/**
 * Rémunération et carrière d'un professeur certifié de l'enseignement public (profil
 * « futur·e prof »). Toutes les règles viennent des paramètres sourcés (src/data/params) :
 * - traitement indiciaire = indice majoré × valeur annuelle de l'indice 100 / 1 200
 *   (décret n° 85-1148, art. 3) ;
 * - élève fonctionnaire (M1) payé à l'indice majoré minimum (décret n° 72-581, art. 26-1) ;
 * - grilles, durées d'échelon, bonification d'un an aux 6e et 8e échelons, accès à la hors
 *   classe et à la classe exceptionnelle (décrets n° 72-581, 2017-789 et 82-1105) ;
 * - primes : prime d'attractivité (classe normale), ISOE part fixe, abattement « transfert
 *   primes/points », indemnité de résidence ;
 * - retenues : pension civile, RAFP, CSG et CRDS (fiche Service-Public F468).
 *
 * Hypothèses signalées (paramètre `m2e.stagiaireEchelon`, non vérifié) : le stagiaire est
 * payé au 1er échelon, avec l'ISOE et la prime d'attractivité. La cotisation santé
 * obligatoire (contrat MGEN-CNP depuis mai 2026) n'est pas publiée : le net calculé ici est
 * donc « avant cotisation santé ».
 */
import type { EchelonGrille, GrilleIndiciaire, Parametres2026, PointBrutNet, SerieDatee } from '../data/params/schema.ts'

export type Grade = 'classe-normale' | 'hors-classe' | 'classe-exceptionnelle'
export type StatutProf = 'eleve' | 'stagiaire' | 'titulaire'
/** Zone d'indemnité de résidence : 3 % (zone 1), 1 % (zone 2), 0 % (zone 3). */
export type ZoneResidence = 1 | 2 | 3

export interface PositionGrille {
  grade: Grade
  echelon: number
}

export const LIBELLES_GRADES: Readonly<Record<Grade, string>> = {
  'classe-normale': 'classe normale',
  'hors-classe': 'hors classe',
  'classe-exceptionnelle': 'classe exceptionnelle',
}

export function grilleDe(grade: Grade, p: Parametres2026): GrilleIndiciaire {
  if (grade === 'classe-normale') return p['certifies.grilleClasseNormale'].valeur
  if (grade === 'hors-classe') return p['certifies.grilleHorsClasse'].valeur
  return p['certifies.grilleClasseExceptionnelle'].valeur
}

export function echelonDe(position: PositionGrille, p: Parametres2026): EchelonGrille {
  const grille = grilleDe(position.grade, p)
  const e = grille[position.echelon - 1]
  if (!e) throw new RangeError(`Échelon inconnu : ${position.grade} ${String(position.echelon)}`)
  return e
}

/** Traitement indiciaire brut mensuel d'un indice majoré, au point d'indice en vigueur. */
export function traitementMensuel(indiceMajore: number, p: Parametres2026, valeurPoint = p['fp.valeurPointAnnuelle'].valeur): number {
  return (indiceMajore * valeurPoint) / 1200
}

/** Indice majoré de la situation : l'indice minimum pour l'élève, celui de l'échelon sinon. */
export function indiceDe(statut: StatutProf, position: PositionGrille, p: Parametres2026): number {
  if (statut === 'eleve') return p['fp.indiceMinimum'].valeur
  return echelonDe(position, p).indiceMajore
}

/** Position du stagiaire (hypothèse non vérifiée : 1er échelon de la classe normale). */
export function positionStagiaire(p: Parametres2026): PositionGrille {
  return { grade: 'classe-normale', echelon: p['m2e.stagiaireEchelon'].valeur }
}

export interface SituationProf {
  statut: StatutProf
  position: PositionGrille
  zone?: ZoneResidence
  /** Quotité de rémunération (1 à temps plein, 6/7 à 80 %). */
  quotite?: number
  /** Temps partiel : retenue pour pension calculée sur le temps plein au taux de surcotisation. */
  surcotisation?: boolean
  /** Valeur annuelle de l'indice 100 (le point d'indice en vigueur par défaut). */
  valeurPoint?: number
}

export interface BulletinProf {
  indiceMajore: number
  traitementIndiciaire: number
  indemniteResidence: number
  primeAttractivite: number
  isoe: number
  /** Abattement « transfert primes/points » (montant positif, retiré des primes). */
  transfertPrimesPoints: number
  brut: number
  retenuePension: number
  rafp: number
  csg: number
  crds: number
  cotisations: number
  /** Net à payer avant impôt et avant la cotisation santé obligatoire. */
  netAvantImpot: number
  /** Net imposable : base du prélèvement à la source. */
  netImposable: number
}

function primeAttractiviteAnnuelle(position: PositionGrille, p: Parametres2026): number {
  if (position.grade !== 'classe-normale') return 0
  return p['enseignants.primeAttractivite'].valeur.find((x) => x.echelon === position.echelon)?.montant ?? 0
}

function tauxResidence(zone: ZoneResidence, p: Parametres2026): number {
  if (zone === 1) return p['fp.indemniteResidence.zone1'].valeur
  if (zone === 2) return p['fp.indemniteResidence.zone2'].valeur
  return p['fp.indemniteResidence.zone3'].valeur
}

/**
 * Bulletin de paie mensuel. L'élève fonctionnaire ne touche que son traitement : aucun texte
 * lu ne lui attribue de prime, et son indemnité de résidence n'est pas modélisée.
 */
export function bulletinMensuel(s: SituationProf, p: Parametres2026): BulletinProf {
  const quotite = s.quotite ?? 1
  const indiceMajore = indiceDe(s.statut, s.position, p)
  const traitementPlein = traitementMensuel(indiceMajore, p, s.valeurPoint)
  const traitementIndiciaire = traitementPlein * quotite
  const eleve = s.statut === 'eleve'
  const indemniteResidence = eleve ? 0 : traitementIndiciaire * tauxResidence(s.zone ?? 3, p)
  const primeAttractivite = eleve ? 0 : (primeAttractiviteAnnuelle(s.position, p) / 12) * quotite
  const isoe = eleve ? 0 : (p['enseignants.isoe.partFixe'].valeur / 12) * quotite
  const primes = primeAttractivite + isoe
  // L'abattement porte sur les primes (pas sur l'indemnité de résidence), dans leur limite.
  const transfertPrimesPoints = Math.min(primes, p['fp.transfertPrimesPoints.categorieA'].valeur / 12)
  const primesVersees = primes - transfertPrimesPoints
  const brut = traitementIndiciaire + indemniteResidence + primesVersees
  const retenuePension = s.surcotisation
    ? traitementPlein * p['fp.surcotisation80.taux'].valeur
    : traitementIndiciaire * p['fp.retenuePensionCivile'].valeur
  const rafp =
    Math.min(indemniteResidence + primesVersees, traitementIndiciaire * p['fp.rafp.plafondPartTraitement'].valeur) *
    p['fp.rafp.taux'].valeur
  const assietteCsg = brut * p['fp.csgCrds.assiette'].valeur
  const csg = assietteCsg * p['fp.csg.taux'].valeur
  const crds = assietteCsg * p['fp.crds.taux'].valeur
  const cotisations = retenuePension + rafp + csg + crds
  const netAvantImpot = brut - cotisations
  // Restent imposables : la part non déductible de la CSG et la CRDS.
  const netImposable = netAvantImpot + assietteCsg * p['fp.csg.partNonDeductible'].valeur + crds
  return {
    indiceMajore,
    traitementIndiciaire,
    indemniteResidence,
    primeAttractivite,
    isoe,
    transfertPrimesPoints,
    brut,
    retenuePension,
    rafp,
    csg,
    crds,
    cotisations,
    netAvantImpot,
    netImposable,
  }
}

/**
 * Points de calage brut → net d'un professeur titulaire (zone 3), un par échelon des trois
 * grades : le simulateur les interpole comme ceux du cadre (src/engine/salaire.ts).
 */
export function pointsCalageProf(p: Parametres2026): PointBrutNet[] {
  const situations: SituationProf[] = [
    { statut: 'eleve', position: { grade: 'classe-normale', echelon: 1 } },
    ...(['classe-normale', 'hors-classe', 'classe-exceptionnelle'] as const).flatMap((grade) =>
      grilleDe(grade, p).map((e) => ({ statut: 'titulaire' as const, position: { grade, echelon: e.echelon } })),
    ),
  ]
  const points = situations
    .map((s) => bulletinMensuel(s, p))
    .map((b) => ({ brutAnnuel: b.brut * 12, netAvantImpotAnnuel: b.netAvantImpot * 12, netImposableAnnuel: b.netImposable * 12 }))
    .sort((a, b) => a.brutAnnuel - b.brutAnnuel)
  // Le calage exige des bruts strictement croissants.
  return points.filter((x, i) => i === 0 || x.brutAnnuel > (points[i - 1]?.brutAnnuel ?? 0))
}

// ---------------------------------------------------------------------- Avancement

export interface Avancement {
  position: PositionGrille
  /** Mois passés dans l'échelon actuel. */
  ancienneteMois: number
  /** Mois retirés de la durée de l'échelon actuel (bonification d'un an aux 6e et 8e). */
  bonificationMois: number
}

/** Durée de l'échelon actuel, bonification déduite (null : dernier échelon du grade). */
export function dureeEchelon(a: Avancement, p: Parametres2026): number | null {
  const duree = echelonDe(a.position, p).dureeMois
  return duree === null ? null : Math.max(0, duree - a.bonificationMois)
}

/** Avance d'un mois ; renvoie le nouvel avancement et l'échelon gagné, le cas échéant. */
export function avancerUnMois(a: Avancement, p: Parametres2026): { avancement: Avancement; promu: boolean } {
  const duree = dureeEchelon(a, p)
  const anciennete = a.ancienneteMois + 1
  if (duree !== null && anciennete >= duree && a.position.echelon < grilleDe(a.position.grade, p).length) {
    return {
      avancement: {
        position: { ...a.position, echelon: a.position.echelon + 1 },
        ancienneteMois: anciennete - duree,
        bonificationMois: 0,
      },
      promu: true,
    }
  }
  return { avancement: { ...a, ancienneteMois: anciennete }, promu: false }
}

/** Le rendez-vous de carrière qui peut bonifier l'échelon : 6e ou 8e de la classe normale. */
export function echelonAvecRendezVous(position: PositionGrille): boolean {
  return position.grade === 'classe-normale' && (position.echelon === 6 || position.echelon === 8)
}

/** Promouvable à la hors classe : 9e échelon de la classe normale depuis au moins deux ans. */
export function promouvableHorsClasse(a: Avancement, p: Parametres2026): boolean {
  const { grade, echelon } = a.position
  if (grade !== 'classe-normale') return false
  return echelon > 9 || (echelon === 9 && a.ancienneteMois >= p['certifies.horsClasse.ancienneteMinMois'].valeur)
}

export function promouvableClasseExceptionnelle(a: Avancement, p: Parametres2026): boolean {
  return a.position.grade === 'hors-classe' && a.position.echelon >= p['certifies.classeExceptionnelle.echelonHorsClasseMin'].valeur
}

/**
 * Classement dans le nouveau grade : l'échelon d'indice égal ou immédiatement supérieur
 * (décret n° 72-581, art. 35 et 36-1). Exception : du 9e échelon de la classe normale, on
 * entre au 2e de la hors classe en gardant l'ancienneté au-delà de deux ans. Ailleurs,
 * l'ancienneté repart de zéro (simplification : le décret en garde une partie dans
 * certains cas).
 */
export function promouvoir(a: Avancement, grade: Exclude<Grade, 'classe-normale'>, p: Parametres2026): Avancement {
  if (grade === 'hors-classe' && a.position.grade === 'classe-normale' && a.position.echelon === 9) {
    return {
      position: { grade, echelon: 2 },
      ancienneteMois: Math.max(0, a.ancienneteMois - p['certifies.horsClasse.ancienneteMinMois'].valeur),
      bonificationMois: 0,
    }
  }
  const indice = echelonDe(a.position, p).indiceMajore
  const grille = grilleDe(grade, p)
  const cible = grille.find((e) => e.indiceMajore >= indice) ?? grille.at(-1)
  return { position: { grade, echelon: cible?.echelon ?? 1 }, ancienneteMois: 0, bonificationMois: 0 }
}

// ---------------------------------------------------------------------- Point d'indice

/** Valeur annuelle de l'indice 100 à une date (AAAA-MM) : la dernière valeur entrée en vigueur. */
export function valeurPointA(mois: string, serie: SerieDatee): number {
  let valeur = serie[0]?.valeur ?? 0
  for (const x of serie) if (x.depuis.slice(0, 7) <= mois) valeur = x.valeur
  return valeur
}

/**
 * Élasticité historique du point d'indice à l'inflation : log(hausse du point) / log(hausse
 * des prix) sur la période commune aux deux séries. Sert au Monte Carlo, qui ne connaît
 * pas de dates : le point y suit les prix dans la même proportion qu'entre 2002 et
 * aujourd'hui. C'est une modélisation du passé, pas une prévision.
 */
export function elasticitePointInflation(
  serie: SerieDatee,
  mois: readonly string[],
  inflation: readonly number[],
): number {
  const debut = serie[0]?.depuis.slice(0, 7) ?? ''
  let prix = 1
  let premier = ''
  let dernier = ''
  for (const [i, m] of mois.entries()) {
    if (m < debut) continue
    if (premier === '') premier = m
    prix *= 1 + (inflation[i] ?? 0)
    dernier = m
  }
  if (premier === '' || prix <= 1) return 0
  const hausse = valeurPointA(dernier, serie) / valeurPointA(premier, serie)
  return Math.log(hausse) / Math.log(prix)
}

// ---------------------------------------------------------------------- Retraite

export interface ResultatPension {
  /** Pension de base mensuelle brute, décote comprise. */
  mensuelleBrute: number
  /** Traitement indiciaire mensuel de référence (temps plein). */
  traitementReference: number
  trimestresManquants: number
  decote: number
}

/**
 * Pension de base du fonctionnaire (fiches F21142 et F20349) : traitement indiciaire détenu
 * depuis au moins six mois × 75 % × trimestres liquidables / trimestres requis, moins
 * 1,25 % par trimestre manquant (20 au plus). Le nombre de trimestres manquants est le plus
 * petit entre ceux qui séparent de l'âge du taux plein automatique et ceux qui manquent à la
 * durée requise. Hors RAFP, bonifications et minimum garanti.
 */
export function pensionDeBase(
  d: { indiceMajore: number; trimestresLiquidables: number; trimestresAssurance: number; ageDepart: number },
  p: Parametres2026,
  valeurPoint = p['fp.valeurPointAnnuelle'].valeur,
): ResultatPension {
  const requis = p['fp.retraite.trimestresRequisNesApres1969'].valeur
  const traitementReference = traitementMensuel(d.indiceMajore, p, valeurPoint)
  const proportion = Math.min(1, d.trimestresLiquidables / requis)
  const versAge = Math.max(0, Math.ceil((p['fp.retraite.ageTauxPleinSedentaire'].valeur - d.ageDepart) * 4))
  const versDuree = Math.max(0, requis - d.trimestresAssurance)
  const trimestresManquants = Math.min(p['fp.retraite.decoteMaxTrimestres'].valeur, versAge, versDuree)
  const decote = trimestresManquants * p['fp.retraite.decoteParTrimestre'].valeur
  return {
    mensuelleBrute: traitementReference * p['fp.retraite.tauxMax'].valeur * proportion * (1 - decote),
    traitementReference,
    trimestresManquants,
    decote,
  }
}
