/**
 * Actions individuelles (phase 5, palier Expert du module 3) : huit sociétés fictives,
 * leurs comptes simplifiés, et un cours qui évolue chaque mois.
 *
 * Modèle (hypothèses du jeu, pas une prévision) :
 * - rendement mensuel = taux sans risque + bêta × (rendement du marché − taux sans risque)
 *   + un aléa propre à la société (sa volatilité spécifique). C'est le MEDAF du module 5 :
 *   en moyenne, seul le risque de marché (le bêta) est rémunéré, le risque propre ne l'est pas ;
 * - chaque mois, une petite probabilité de faillite, plus forte pour les sociétés endettées :
 *   le cours tombe alors à zéro ;
 * - les dividendes sont réinvestis dans le cours (le cours suit le rendement total) ;
 * - chaque janvier, le bénéfice suit en partie le cours de l'année écoulée, avec un aléa :
 *   le PER bouge, comme sur un vrai marché.
 *
 * L'aléa a sa propre graine : acheter ou non des actions ne change rien au reste de la partie.
 */
import { Aleatoire } from './aleatoire.ts'

export const IDS_SOCIETES = ['volta', 'hexagone', 'nordlys', 'cobalt', 'rivage', 'atlas', 'ferro', 'pacific'] as const
export type IdSociete = (typeof IDS_SOCIETES)[number]

/** Comptes simplifiés du dernier exercice, en millions d'euros (actions en millions). */
export interface ComptesSociete {
  chiffreAffaires: number
  ebe: number
  resultatNet: number
  capitauxPropres: number
  detteNette: number
  nombreActions: number
  /** Part du bénéfice distribuée en dividendes. */
  tauxDistribution: number
}

export interface Societe {
  id: IdSociete
  nom: string
  secteur: string
  zone: 'Europe' | 'États-Unis' | 'Asie'
  /** Société européenne : éligible au PEA dans la réalité. */
  eligiblePea: boolean
  description: string
  comptes: ComptesSociete
  /** PER au départ de la partie. */
  perInitial: number
  beta: number
  /** Volatilité annuelle propre à la société, hors marché. */
  volatiliteSpecifique: number
  /** Probabilité annuelle de faillite (hypothèse du jeu). */
  probabiliteFaillite: number
}

const s = (
  id: IdSociete,
  nom: string,
  secteur: string,
  zone: Societe['zone'],
  description: string,
  comptes: ComptesSociete,
  perInitial: number,
  beta: number,
  volatiliteSpecifique: number,
  probabiliteFaillite: number,
): Societe => ({ id, nom, secteur, zone, eligiblePea: zone === 'Europe', description, comptes, perInitial, beta, volatiliteSpecifique, probabiliteFaillite })

/** Sociétés fictives : toute ressemblance avec une entreprise réelle serait fortuite. */
export const SOCIETES: readonly Societe[] = [
  s('volta', 'Volta Énergies', 'Électricité', 'Europe',
    'Produit et distribue de l’électricité. Activité régulière, beaucoup d’investissements financés par la dette.',
    { chiffreAffaires: 9000, ebe: 2400, resultatNet: 700, capitauxPropres: 6000, detteNette: 8400, nombreActions: 500, tauxDistribution: 0.6 },
    11, 0.6, 0.18, 0.005),
  s('hexagone', 'Hexagone Maroquinerie', 'Luxe', 'Europe',
    'Sacs et accessoires haut de gamme vendus dans le monde entier. Très rentable, peu endettée, chère en bourse.',
    { chiffreAffaires: 6000, ebe: 1900, resultatNet: 1200, capitauxPropres: 7000, detteNette: 1400, nombreActions: 100, tauxDistribution: 0.45 },
    28, 1.1, 0.22, 0.001),
  s('nordlys', 'Nordlys Pharma', 'Santé', 'Europe',
    'Médicaments et vaccins. Des revenus stables, mais un risque propre à chaque essai clinique.',
    { chiffreAffaires: 12000, ebe: 3600, resultatNet: 2000, capitauxPropres: 15000, detteNette: 6000, nombreActions: 400, tauxDistribution: 0.5 },
    16, 0.7, 0.24, 0.002),
  s('cobalt', 'Cobalt Robotique', 'Industrie', 'Europe',
    'Petite société de robots industriels en forte croissance. Peu de bénéfices pour l’instant, aucun dividende.',
    { chiffreAffaires: 400, ebe: 60, resultatNet: 20, capitauxPropres: 300, detteNette: 240, nombreActions: 50, tauxDistribution: 0 },
    45, 1.4, 0.4, 0.02),
  s('rivage', 'Rivage Distribution', 'Grande distribution', 'Europe',
    'Supermarchés. Marges minces, dette lourde, gros dividende : bon marché en apparence.',
    { chiffreAffaires: 20000, ebe: 900, resultatNet: 250, capitauxPropres: 2500, detteNette: 4500, nombreActions: 250, tauxDistribution: 0.56 },
    8, 0.9, 0.32, 0.03),
  s('atlas', 'Atlas Cloud', 'Logiciel', 'États-Unis',
    'Logiciels en ligne pour les entreprises. Croissance rapide attendue : le marché la paie très cher.',
    { chiffreAffaires: 5000, ebe: 1500, resultatNet: 800, capitauxPropres: 4000, detteNette: 400, nombreActions: 200, tauxDistribution: 0 },
    60, 1.3, 0.35, 0.005),
  s('ferro', 'Ferro Matériaux', 'Matériaux de construction', 'Europe',
    'Ciment et béton. Suit l’activité du bâtiment, donc la conjoncture.',
    { chiffreAffaires: 8000, ebe: 1400, resultatNet: 500, capitauxPropres: 5000, detteNette: 4500, nombreActions: 200, tauxDistribution: 0.48 },
    12, 1.1, 0.25, 0.007),
  s('pacific', 'Pacific Mobility', 'Automobile', 'Asie',
    'Constructeur automobile. Énormément de chiffre d’affaires, peu de marge, beaucoup de dette.',
    { chiffreAffaires: 30000, ebe: 3000, resultatNet: 1200, capitauxPropres: 14000, detteNette: 15400, nombreActions: 600, tauxDistribution: 0.27 },
    9, 1.2, 0.3, 0.01),
]

export function societe(id: IdSociete): Societe {
  const trouvee = SOCIETES.find((x) => x.id === id)
  if (!trouvee) throw new Error(`Société inconnue : ${id}`)
  return trouvee
}

export interface MarcheActions {
  /** État du générateur propre aux actions. */
  alea: number
  cours: Record<IdSociete, number>
  /** Cours au dernier mois de janvier, pour faire évoluer les bénéfices. */
  coursDebutAnnee: Record<IdSociete, number>
  /** Multiplicateur des comptes depuis le départ (1 au départ). */
  facteurBenefice: Record<IdSociete, number>
  faillites: IdSociete[]
}

export interface LigneTitreVif {
  societe: IdSociete
  quantite: number
  /** Prix de revient total de la ligne, en euros. */
  prixDeRevient: number
}

function parSociete<T>(f: (x: Societe) => T): Record<IdSociete, T> {
  return Object.fromEntries(SOCIETES.map((x) => [x.id, f(x)])) as Record<IdSociete, T>
}

/** Bénéfice par action, en euros, des comptes de départ. */
export function bpaInitial(x: Societe): number {
  return x.comptes.resultatNet / x.comptes.nombreActions
}

export function marcheActionsInitial(graine: number): MarcheActions {
  const cours = parSociete((x) => Math.round(x.perInitial * bpaInitial(x) * 100) / 100)
  return {
    alea: new Aleatoire((graine ^ 0x5eed5) >>> 0).etat,
    cours,
    coursDebutAnnee: { ...cours },
    facteurBenefice: parSociete(() => 1),
    faillites: [],
  }
}

/**
 * Un mois de bourse pour les huit sociétés. `rendementMarche` est le rendement mensuel des
 * actions monde, `tauxSansRisque` un taux annuel. Renvoie les sociétés tombées en faillite.
 */
export function moisActions(
  m: MarcheActions,
  rendementMarche: number,
  tauxSansRisque: number,
  janvier: boolean,
): { marche: MarcheActions; faillites: IdSociete[] } {
  const alea = new Aleatoire(m.alea)
  const rf = tauxSansRisque / 12
  const cours = { ...m.cours }
  const coursDebutAnnee = { ...m.coursDebutAnnee }
  const facteurBenefice = { ...m.facteurBenefice }
  const faillites = [...m.faillites]
  const nouvelles: IdSociete[] = []
  for (const x of SOCIETES) {
    // Tirages toujours faits, dans le même ordre : la suite ne dépend pas des faillites passées.
    const z = alea.normal()
    const u = alea.suivant()
    const zBenefice = alea.normal()
    if (faillites.includes(x.id)) continue
    if (u < x.probabiliteFaillite / 12) {
      cours[x.id] = 0
      facteurBenefice[x.id] = 0
      faillites.push(x.id)
      nouvelles.push(x.id)
      continue
    }
    const sigma = x.volatiliteSpecifique / Math.sqrt(12)
    const base = Math.max(-0.95, rf + x.beta * (rendementMarche - rf))
    cours[x.id] = cours[x.id] * Math.exp(Math.log(1 + base) + sigma * z - (sigma * sigma) / 2)
    if (janvier) {
      const variation = cours[x.id] / Math.max(0.01, coursDebutAnnee[x.id])
      facteurBenefice[x.id] = facteurBenefice[x.id] * Math.pow(variation, 0.6) * Math.exp(0.08 * zBenefice)
      coursDebutAnnee[x.id] = cours[x.id]
    }
  }
  return { marche: { alea: alea.etat, cours, coursDebutAnnee, facteurBenefice, faillites }, faillites: nouvelles }
}

export interface Ratios {
  cours: number
  /** Comptes du dernier exercice, en millions d'euros. */
  chiffreAffaires: number
  ebe: number
  resultatNet: number
  capitauxPropres: number
  detteNette: number
  /** Bénéfice par action, en euros. */
  bpa: number
  /** Cours / bénéfice par action (null si le bénéfice est nul). */
  per: number | null
  rendementDividende: number
  /** Dette nette / capitaux propres. */
  endettement: number
  /** Capitalisation boursière, en millions d'euros. */
  capitalisation: number
  enFaillite: boolean
}

export function ratios(x: Societe, m: MarcheActions): Ratios {
  const f = m.facteurBenefice[x.id]
  const cours = m.cours[x.id]
  const enFaillite = m.faillites.includes(x.id)
  const resultatNet = x.comptes.resultatNet * f
  const bpa = resultatNet / x.comptes.nombreActions
  return {
    cours,
    chiffreAffaires: x.comptes.chiffreAffaires * Math.sqrt(f),
    ebe: x.comptes.ebe * f,
    resultatNet,
    capitauxPropres: x.comptes.capitauxPropres,
    detteNette: x.comptes.detteNette,
    bpa,
    per: bpa > 0 && cours > 0 ? cours / bpa : null,
    rendementDividende: cours > 0 ? (bpa * x.comptes.tauxDistribution) / cours : 0,
    endettement: x.comptes.detteNette / x.comptes.capitauxPropres,
    capitalisation: cours * x.comptes.nombreActions,
    enFaillite,
  }
}

export function valeurLigne(l: LigneTitreVif, m: MarcheActions): number {
  return l.quantite * m.cours[l.societe]
}

export function valeurLignes(lignes: readonly LigneTitreVif[], m: MarcheActions): number {
  return lignes.reduce((total, l) => total + valeurLigne(l, m), 0)
}

/** Plus-value (ou moins-value) latente de l'ensemble des lignes. */
export function gainLatentLignes(lignes: readonly LigneTitreVif[], m: MarcheActions): number {
  return lignes.reduce((total, l) => total + valeurLigne(l, m) - l.prixDeRevient, 0)
}
