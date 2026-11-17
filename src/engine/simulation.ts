/**
 * Moteur de simulation mois par mois (bac à sable, mode historique).
 *
 * Il prend un état et renvoie l'état du mois suivant, sans rien modifier : c'est ce qui
 * permet la sauvegarde, le retour à un point de sauvegarde et, plus tard, la comparaison
 * de deux parties. L'état est un objet JSON pur, enregistrable tel quel dans IndexedDB.
 *
 * Deux couches de réalisme :
 * - les règles connues sont calculées exactement : brut → net (calé sur l'Urssaf), impôt
 *   sur le revenu, prélèvement à la source et régularisation de septembre, livrets,
 *   fiscalité du CTO et du PEA ;
 * - les marchés sont rejoués sur une vraie période (MSCI World en euros, inflation Insee,
 *   taux des livrets de la Banque de France), tirée au hasard et révélée à la fin.
 *
 * Hypothèses de modèle (aucune n'est une donnée officielle) : hausse de salaire chaque
 * janvier = inflation des 12 derniers mois + hausse réelle choisie + aléa ; limites de
 * l'impôt indexées sur l'inflation simulée ; dépenses courantes indexées sur l'inflation.
 */
import type { Parametres2026 } from '../data/params/schema.ts'
import { formatMontant } from '../lib/format.ts'
import { Aleatoire } from './aleatoire.ts'
import { plafondPer } from './calculs.ts'
import { areDuMois, JOURS_VERSES_PAR_MOIS, ouvrirDroitsAre, type DroitsAre } from './chomage.ts'
import {
  acheter,
  ageDuPeaEnMois,
  ASSURANCE_VIE_FERMEE,
  crediterInterets,
  impotLatentPer,
  LIVRET_VIDE,
  moisLivret,
  PEA_FERME,
  PEE_VIDE,
  PER_VIDE,
  racheterAssuranceVie,
  retirerLivret,
  retirerPea,
  retirerPee,
  revientPee,
  TITRES_VIDES,
  valeurAssuranceVie,
  valeurPee,
  valeurTitres,
  vendre,
  verserPee,
  type AssuranceVie,
  type Livret,
  type Pea,
  type Pee,
  type Per,
  type Titres,
} from './enveloppes.ts'
import {
  calculerIR,
  nombreDeParts,
  parametresIR,
  tauxMarginal,
  tauxPrelevementParDefaut,
  tauxPrelevementPersonnalise,
  type Foyer,
} from './impots.ts'
import { libelleMois, nombreDeDepartsPossibles, SERIES, type SeriesMarche } from './marches.ts'
import {
  DUREE_TRAJECTOIRE_MOIS,
  indicesBootstrap,
  indicesScenario,
  ligneDuMois,
  SCENARIOS,
  type LigneMarche,
  type MarcheDeLaPartie,
  type ModeMarche,
  type Scenario,
} from './modesMarche.ts'
import { brutVersNet } from './salaire.ts'

export const VERSION_ETAT_PARTIE = 3
/** Mois de l'année où l'intéressement et la participation sont versés (hypothèse : juin). */
const MOIS_INTERESSEMENT = 5
/** Durée d'une partie du mode historique : les dix premières années. */
export const DUREE_PARTIE_MOIS = 120
/** Chute mensuelle des actions à partir de laquelle le journal signale un événement. */
const SEUIL_CHUTE_MARCHE = -0.07
/** Écart type de l'aléa sur la hausse de salaire annuelle (hypothèse de modèle). */
const ALEA_HAUSSE_SALAIRE = 0.01

export type CleLivret = 'livretA' | 'ldds' | 'lep'

export interface Versements {
  livretA: number
  ldds: number
  lep: number
  pea: number
  cto: number
  assuranceVie: number
  per: number
  /** Versements volontaires du salarié sur son PEE. */
  pee: number
}

/** Épargne salariale : règles propres à l'entreprise, choisies par le joueur (hypothèses). */
export interface EpargneSalariale {
  /** Abondement de l'employeur, en part du versement du salarié (1 = 100 %). */
  abondementTaux: number
  /** Plafond annuel d'abondement fixé par l'entreprise (borné par la loi). */
  abondementPlafond: number
  /** Intéressement et participation bruts versés chaque année. */
  interessementAnnuel: number
  /** Placer l'intéressement sur le PEE (exonéré d'impôt) plutôt que le percevoir. */
  placerInteressement: boolean
}

export const EPARGNE_SALARIALE_AUCUNE: EpargneSalariale = {
  abondementTaux: 0,
  abondementPlafond: 0,
  interessementAnnuel: 0,
  placerInteressement: true,
}

/** Situation professionnelle : en poste, ou en recherche d'emploi (indemnisée ou non). */
export interface Emploi {
  enPoste: boolean
  /** Mois travaillés sur les 24 derniers mois (approché : plafonné à 24, remis à zéro à chaque perte d'emploi). */
  moisTravailles: number
  /** A déjà perçu l'ARE (sinon, règle des primo-entrants). */
  dejaIndemnise: boolean
  droitsAre: DroitsAre | null
  /** Mois de recherche restants avant de reprendre un emploi. */
  moisRechercheRestants: number
  /** Brut annuel du prochain emploi, en euros courants. */
  brutReprise: number
}

export const EMPLOI_EN_POSTE: Emploi = {
  enPoste: true,
  moisTravailles: 0,
  dejaIndemnise: false,
  droitsAre: null,
  moisRechercheRestants: 0,
  brutReprise: 0,
}

export type TypeEvenement =
  | 'debut'
  | 'augmentation'
  | 'regularisation'
  | 'taux-prelevement'
  | 'interets'
  | 'tresorerie'
  | 'plafond'
  | 'marche'
  | 'operation'
  | 'emploi'
  | 'vie'
  | 'fin'

export interface Evenement {
  mois: number
  type: TypeEvenement
  titre: string
  detail: string
}

export interface PointHistorique {
  mois: number
  /** Patrimoine brut, en euros courants. */
  brut: number
  /** Patrimoine net d'impôts latents, en euros constants du départ. */
  netReel: number
  courant: number
  livrets: number
  titres: number
  fiscaliteLatente: number
  indicePrix: number
}

export interface AnneeFiscale {
  annee: number
  /** Indice des prix au début de l'année : indexe les limites de l'impôt. */
  indicePrixDebut: number
  salairesImposables: number
  prelevementsPayes: number
  /** Plus-values nettes réalisées sur le CTO (moins-values déduites). */
  plusValues: number
  chargesDeductibles: number
  /** Plafond de déduction des versements PER de l'année (calculé sur l'année précédente). */
  plafondPer: number
  /** Versements PER déjà déduits cette année. */
  versementsPerDeduits: number
  /** Abattement de l'assurance-vie déjà utilisé cette année. */
  abattementAssuranceVie: number
  abondementAnnee: number
}

export interface EtatPartie {
  version: typeof VERSION_ETAT_PARTIE
  graine: number
  /** État du générateur aléatoire. */
  alea: number
  /** Indice du premier mois rejoué dans les séries historiques (caché jusqu'à la fin). */
  debutHistorique: number
  /** Mois de données disponibles à partir du départ. */
  dureeDisponible: number
  /** Mode de marché : historique, Monte Carlo ou scénario. */
  marche: MarcheDeLaPartie
  /** Mois écoulés depuis le début de la partie. */
  mois: number
  /** Durée prévue de la partie (dix ans au simulateur, plus en mode carrière). */
  dureeMois: number
  /** Date simulée du premier mois (mois de 0 à 11). */
  calendrier: { annee: number; mois: number }
  foyer: Foyer
  /**
   * Salaires nets imposables annuels du conjoint, en euros du départ (indexés sur l'inflation).
   * Servent seulement à l'imposition commune d'un couple marié ou pacsé : le joueur paie sa
   * part de l'impôt du foyer, au prorata des revenus.
   */
  revenuConjoint: number
  salaire: { brutAnnuel: number; hausseReelleAnnuelle: number }
  emploi: Emploi
  /** Tout est vendu dans la panique : les placements en actions restent en liquidités jusqu'à ce mois. */
  horsMarcheJusquAuMois: number | null
  /** Niveau de l'indice actions (1 au départ) et son plus haut : sert à repérer un krach. */
  indiceMarche: { niveau: number; sommet: number }
  /** Dépenses courantes mensuelles, en euros du départ (indexées sur l'inflation). */
  depensesMensuelles: number
  fraisAnnuelsEtf: number
  versements: Versements
  /** Option pour le barème progressif des revenus du capital (sinon PFU). */
  optionBareme: boolean
  courant: number
  livretA: Livret
  ldds: Livret
  lep: Livret
  cto: Titres
  pea: Pea
  assuranceVie: AssuranceVie
  /** Part des versements sur l'assurance-vie placée en unités de compte (0 à 1). */
  partUniteDeCompte: number
  /** Frais de gestion annuels des unités de compte du contrat (hypothèse). */
  fraisAnnuelsUc: number
  per: Per
  pee: Pee
  epargneSalariale: EpargneSalariale
  /** Prix d'une part de l'ETF monde (100 au départ). */
  prixPart: number
  /** Indice des prix, 1 au départ. */
  indicePrix: number
  inflationsRecentes: number[]
  fiscal: {
    /** Taux personnalisé ; null tant que l'administration n'en a pas (grille par défaut). */
    tauxPrelevement: number | null
    anneeEnCours: AnneeFiscale
    /** Revenus de l'année précédente, déclarés au printemps, régularisés en septembre. */
    aDeclarer: AnneeFiscale | null
    /** Échéances restantes d'un solde d'impôt payé en plusieurs fois. */
    echeances: number[]
    moinsValuesReportables: number
  }
  cumuls: {
    salairesNets: number
    /** Total du prélèvement à la source retenu sur les salaires. */
    prelevementsSource: number
    /** Impôt sur le revenu dû (salaires et plus-values, après régularisation). */
    impotRevenu: number
    prelevementsSociaux: number
    fraisEtf: number
    interets: number
    /** Intérêts du fonds en euros crédités (nets de prélèvements sociaux). */
    interetsFondsEuros: number
    fraisUc: number
    abondement: number
    interessement: number
    /** CSG et CRDS sur l'abondement et l'intéressement. */
    csgCrdsEpargneSalariale: number
    /** Allocations chômage versées, après retenues et prélèvement à la source. */
    allocationsChomage: number
    /** Primes versées, après cotisations et prélèvement à la source. */
    primes: number
    /** Dépenses de consommation : dépenses courantes et dépenses exceptionnelles. */
    depenses: number
  }
  journal: Evenement[]
  historique: PointHistorique[]
}

export interface ConfigPartie {
  brutAnnuel: number
  depensesMensuelles: number
  graine: number
  /** Date simulée du premier mois (mois de 0 à 11). */
  calendrier: { annee: number; mois: number }
  foyer?: Foyer
  hausseReelleAnnuelle?: number
  fraisAnnuelsEtf?: number
  tresorerieInitiale?: number
  versements?: Partial<Versements>
  /** Indice de départ dans l'historique ; tiré au hasard par défaut. */
  debutHistorique?: number
  /** Mode de marché (historique par défaut). */
  mode?: ModeMarche
  scenario?: Scenario
  epargneSalariale?: Partial<EpargneSalariale>
  /** Durée de la partie (dix ans par défaut). */
  dureeMois?: number
}

export const VERSEMENTS_NULS: Versements = {
  livretA: 0,
  ldds: 0,
  lep: 0,
  pea: 0,
  cto: 0,
  assuranceVie: 0,
  per: 0,
  pee: 0,
}

function nouvelleAnnee(annee: number, indicePrix: number, plafondPer: number): AnneeFiscale {
  return {
    annee,
    indicePrixDebut: indicePrix,
    salairesImposables: 0,
    prelevementsPayes: 0,
    plusValues: 0,
    chargesDeductibles: 0,
    plafondPer,
    versementsPerDeduits: 0,
    abattementAssuranceVie: 0,
    abondementAnnee: 0,
  }
}


/** Date simulée d'un mois de la partie. */
export function dateDuMois(etat: Pick<EtatPartie, 'calendrier'>, mois: number): { annee: number; mois: number } {
  const total = etat.calendrier.mois + mois
  return { annee: etat.calendrier.annee + Math.floor(total / 12), mois: total % 12 }
}

const TEXTE_DEBUT: Record<ModeMarche, string> = {
  historique:
    'Tu commences ta vie active. La période de marché rejouée reste secrète jusqu’à la fin des dix ans.',
  'monte-carlo':
    'Tu commences ta vie active. Les marchés suivent une trajectoire Monte Carlo : des années réelles recollées au hasard.',
  scenario: 'Tu commences ta vie active, face à un scénario de crise choisi pour tester ta stratégie.',
}

export function creerPartie(config: ConfigPartie, series: SeriesMarche = SERIES): EtatPartie {
  const alea = new Aleatoire(config.graine)
  const mode = config.mode ?? 'historique'
  let debutHistorique = 0
  let marche: MarcheDeLaPartie = { mode: 'historique' }
  let dureeDisponible: number
  const dureeMois = config.dureeMois ?? DUREE_PARTIE_MOIS
  if (mode === 'historique') {
    const departs = nombreDeDepartsPossibles(dureeMois, series)
    if (departs === 0) throw new Error('Historique trop court pour cette durée de partie')
    debutHistorique = config.debutHistorique ?? alea.entier(departs)
    if (debutHistorique < 0 || debutHistorique >= series.mois.length) {
      throw new RangeError(`Début historique invalide : ${debutHistorique}`)
    }
    dureeDisponible = series.mois.length - debutHistorique
  } else if (mode === 'monte-carlo') {
    const duree = Math.max(DUREE_TRAJECTOIRE_MOIS, dureeMois)
    marche = { mode, indices: indicesBootstrap(alea, series.mois.length, duree) }
    dureeDisponible = duree
  } else {
    const scenario = config.scenario ?? 'krach'
    marche = { mode, scenario, indices: indicesScenario(scenario, alea, series) }
    dureeDisponible = DUREE_TRAJECTOIRE_MOIS
  }
  const etat: EtatPartie = {
    version: VERSION_ETAT_PARTIE,
    graine: config.graine,
    alea: alea.etat,
    debutHistorique,
    dureeDisponible,
    marche,
    mois: 0,
    dureeMois,
    calendrier: config.calendrier,
    foyer: config.foyer ?? { situation: 'celibataire', enfantsACharge: 0 },
    revenuConjoint: 0,
    salaire: {
      brutAnnuel: config.brutAnnuel,
      hausseReelleAnnuelle: config.hausseReelleAnnuelle ?? 0.01,
    },
    emploi: EMPLOI_EN_POSTE,
    horsMarcheJusquAuMois: null,
    indiceMarche: { niveau: 1, sommet: 1 },
    depensesMensuelles: config.depensesMensuelles,
    fraisAnnuelsEtf: config.fraisAnnuelsEtf ?? 0.002,
    versements: { ...VERSEMENTS_NULS, ...config.versements },
    optionBareme: false,
    courant: config.tresorerieInitiale ?? 0,
    livretA: LIVRET_VIDE,
    ldds: LIVRET_VIDE,
    lep: LIVRET_VIDE,
    cto: TITRES_VIDES,
    pea: PEA_FERME,
    assuranceVie: ASSURANCE_VIE_FERMEE,
    partUniteDeCompte: 0,
    fraisAnnuelsUc: 0.006,
    per: PER_VIDE,
    pee: PEE_VIDE,
    epargneSalariale: { ...EPARGNE_SALARIALE_AUCUNE, ...config.epargneSalariale },
    prixPart: 100,
    indicePrix: 1,
    inflationsRecentes: [],
    fiscal: {
      tauxPrelevement: null,
      // Premier emploi : pas de revenus d'activité l'année précédente, plafond PER minimal.
      anneeEnCours: nouvelleAnnee(config.calendrier.annee, 1, 0),
      aDeclarer: null,
      echeances: [],
      moinsValuesReportables: 0,
    },
    cumuls: { ...CUMULS_NULS },
    journal: [{ mois: 0, type: 'debut', titre: 'Premier salaire', detail: TEXTE_DEBUT[mode] }],
    historique: [],
  }
  etat.historique.push(pointHistorique(etat))
  return etat
}

const CUMULS_NULS: EtatPartie['cumuls'] = {
  salairesNets: 0,
  prelevementsSource: 0,
  impotRevenu: 0,
  prelevementsSociaux: 0,
  fraisEtf: 0,
  interets: 0,
  interetsFondsEuros: 0,
  fraisUc: 0,
  abondement: 0,
  interessement: 0,
  csgCrdsEpargneSalariale: 0,
  allocationsChomage: 0,
  primes: 0,
  depenses: 0,
}

/** Champs ajoutés en version 3 (phase 3) : emploi, conjoint, krachs. */
function migrerVersV3(v2: EtatPartie): EtatPartie {
  return {
    ...v2,
    version: VERSION_ETAT_PARTIE,
    dureeMois: DUREE_PARTIE_MOIS,
    revenuConjoint: 0,
    emploi: EMPLOI_EN_POSTE,
    horsMarcheJusquAuMois: null,
    indiceMarche: { niveau: 1, sommet: 1 },
    cumuls: { ...CUMULS_NULS, ...v2.cumuls },
  }
}

/**
 * Convertit une partie enregistrée par une version précédente : les nouveaux comptes sont
 * vides, le marché est historique. Renvoie null si l'objet n'est pas une partie.
 */
export function migrerEtat(brut: unknown): EtatPartie | null {
  if (typeof brut !== 'object' || brut === null || !('version' in brut)) return null
  const version: unknown = brut.version
  if (version === VERSION_ETAT_PARTIE) return brut as EtatPartie
  if (version === 2) return migrerVersV3(brut as EtatPartie)
  if (version !== 1) return null
  const v1 = brut as EtatPartie
  const migrerAnnee = (a: AnneeFiscale | null): AnneeFiscale | null =>
    a ? { ...nouvelleAnnee(a.annee, a.indicePrixDebut, 0), ...a } : null
  return migrerVersV3({
    ...v1,
    marche: { mode: 'historique' },
    versements: { ...VERSEMENTS_NULS, ...v1.versements },
    assuranceVie: ASSURANCE_VIE_FERMEE,
    partUniteDeCompte: 0,
    fraisAnnuelsUc: 0.006,
    per: PER_VIDE,
    pee: PEE_VIDE,
    epargneSalariale: EPARGNE_SALARIALE_AUCUNE,
    fiscal: {
      ...v1.fiscal,
      anneeEnCours: migrerAnnee(v1.fiscal.anneeEnCours) ?? nouvelleAnnee(v1.calendrier.annee, 1, 0),
      aDeclarer: migrerAnnee(v1.fiscal.aDeclarer),
    },
    cumuls: { ...CUMULS_NULS, ...v1.cumuls },
  })
}

// ------------------------------------------------------------------------------ Bilan

function tauxLatentCto(p: Parametres2026): number {
  return p['pfu.tauxImpotRevenu'].valeur + p['prelevementsSociaux.tauxGeneral'].valeur
}

/** Impôts qu'il faudrait payer si l'on vendait tout aujourd'hui (CTO au PFU, PEA selon son âge). */
export function fiscaliteLatente(etat: EtatPartie, p: Parametres2026): number {
  const gainCto = Math.max(0, valeurTitres(etat.cto, etat.prixPart) - etat.cto.prixDeRevient)
  const valeurPea = valeurTitres(etat.pea.titres, etat.prixPart)
  const gainPea = Math.max(0, valeurPea - etat.pea.versements)
  const peaExonere =
    ageDuPeaEnMois(etat.pea, etat.mois) >= p['pea.dureeExonerationImpotRevenu'].valeur * 12
  const tauxPea = peaExonere ? p['pea.tauxApres5Ans'].valeur : tauxLatentCto(p)

  // Assurance-vie : impôt d'un rachat total aujourd'hui (abattement restant de l'année).
  const av = etat.assuranceVie
  const impotAv =
    av.ouvertAuMois === null
      ? 0
      : (() => {
          const r = racheterAssuranceVie(av, Number.POSITIVE_INFINITY, etat.prixPart, etat.mois, reglesAssuranceVie(etat, p))
          return r.impotRevenu + r.prelevementsSociaux
        })()

  // PER : sortie en capital estimée à la tranche marginale actuelle.
  const pIR = parametresIR(p, etat.indicePrix)
  const salaires = brutVersNet(etat.salaire.brutAnnuel, p['cotisations.salarieCadre'].valeur).netImposable
  const revenu = calculerIR(
    { foyer: etat.foyer, salaires: salairesDuFoyer(etat, salaires, etat.indicePrix) },
    pIR,
  ).revenuNetImposable
  const tmi = tauxMarginal(revenu / nombreDeParts(etat.foyer), pIR.bareme)
  const impotPer = impotLatentPer(etat.per, etat.prixPart, tmi, tauxLatentCto(p))

  // PEE : prélèvements sociaux sur les gains.
  const gainPee = Math.max(0, valeurPee(etat.pee, etat.prixPart) - revientPee(etat.pee))

  return (
    gainCto * tauxLatentCto(p) +
    gainPea * tauxPea +
    impotAv +
    impotPer +
    gainPee * p['prelevementsSociaux.tauxGeneral'].valeur
  )
}

export function reglesAssuranceVie(etat: EtatPartie, p: Parametres2026) {
  const abattement =
    (etat.foyer.situation === 'couple'
      ? p['assuranceVie.abattementApres8Ans.couple'].valeur
      : p['assuranceVie.abattementApres8Ans.personneSeule'].valeur) * etat.indicePrix
  return {
    dureeFiscaleMois: p['assuranceVie.dureeFiscaleAnnees'].valeur * 12,
    tauxImpotAvant: p['pfu.tauxImpotRevenu'].valeur,
    tauxImpotApres: p['assuranceVie.tauxImpotApres8Ans'].valeur,
    plafondPrimesTauxReduit: p['assuranceVie.plafondPrimesTauxReduit'].valeur,
    abattementRestant: Math.max(0, abattement - etat.fiscal.anneeEnCours.abattementAssuranceVie),
    tauxPrelevementsSociaux: p['prelevementsSociaux.tauxAssuranceVie'].valeur,
  }
}

export interface Bilan {
  courant: number
  livrets: number
  cto: number
  pea: number
  assuranceVie: number
  per: number
  pee: number
  brut: number
  fiscaliteLatente: number
  net: number
  /** Patrimoine net en euros constants du départ. */
  netReel: number
}

function valeursEnveloppes(etat: EtatPartie) {
  return {
    livrets: etat.livretA.solde + etat.ldds.solde + etat.lep.solde,
    cto: valeurTitres(etat.cto, etat.prixPart),
    pea: valeurTitres(etat.pea.titres, etat.prixPart),
    assuranceVie: valeurAssuranceVie(etat.assuranceVie, etat.prixPart),
    per: valeurTitres(etat.per.titres, etat.prixPart),
    pee: valeurPee(etat.pee, etat.prixPart),
  }
}

export function bilan(etat: EtatPartie, p: Parametres2026): Bilan {
  const v = valeursEnveloppes(etat)
  const brut = etat.courant + v.livrets + v.cto + v.pea + v.assuranceVie + v.per + v.pee
  const latente = fiscaliteLatente(etat, p)
  return {
    courant: etat.courant,
    ...v,
    brut,
    fiscaliteLatente: latente,
    net: brut - latente,
    netReel: (brut - latente) / etat.indicePrix,
  }
}

function pointHistorique(etat: EtatPartie, p?: Parametres2026): PointHistorique {
  const v = valeursEnveloppes(etat)
  const livrets = v.livrets
  const titres = v.cto + v.pea + v.assuranceVie + v.per + v.pee
  const brut = etat.courant + livrets + titres
  const latente = p ? fiscaliteLatente(etat, p) : 0
  const arrondi = (x: number) => Math.round(x * 100) / 100
  return {
    mois: etat.mois,
    brut: arrondi(brut),
    netReel: arrondi((brut - latente) / etat.indicePrix),
    courant: arrondi(etat.courant),
    livrets: arrondi(livrets),
    titres: arrondi(titres),
    fiscaliteLatente: arrondi(latente),
    indicePrix: Math.round(etat.indicePrix * 1e6) / 1e6,
  }
}

// --------------------------------------------------------------------- Livrets et LEP

/** Revenu fiscal de référence estimé : salaires imposables − 10 % de la dernière année connue. */
function revenuFiscalEstime(etat: EtatPartie, p: Parametres2026): number {
  const reference = etat.fiscal.aDeclarer ?? null
  const indexation = reference?.indicePrixDebut ?? etat.indicePrix
  const pIR = parametresIR(p, indexation)
  const salaires =
    reference && reference.salairesImposables > 0
      ? reference.salairesImposables
      : brutVersNet(etat.salaire.brutAnnuel, p['cotisations.salarieCadre'].valeur).netImposable
  return calculerIR({ foyer: etat.foyer, salaires: salairesDuFoyer(etat, salaires, indexation) }, pIR)
    .revenuNetImposable
}

/**
 * Éligibilité au LEP : revenu fiscal de référence sous le plafond. Simplification : on
 * estime le revenu fiscal à partir des salaires de la dernière année connue, et un LEP
 * devenu inéligible n'accepte plus de versements (son solde reste placé).
 */
export function eligibleLep(etat: EtatPartie, p: Parametres2026): boolean {
  const demiParts = (nombreDeParts(etat.foyer) - 1) * 2
  const plafond =
    (p['lep.plafondRevenuFiscalReference1Part'].valeur +
      demiParts * p['lep.plafondRevenuFiscalReferenceDemiPart'].valeur) *
    etat.indicePrix
  return revenuFiscalEstime(etat, p) <= plafond
}

function plafondLivret(cle: CleLivret, p: Parametres2026): number {
  if (cle === 'livretA') return p['livretA.plafond'].valeur
  if (cle === 'ldds') return p['ldds.plafond'].valeur
  return p['lep.plafond'].valeur
}

// ------------------------------------------------------------------- Mois suivant

function ajouterEvenement(etat: EtatPartie, evenement: Omit<Evenement, 'mois'>): void {
  etat.journal.push({ mois: etat.mois, ...evenement })
}

const euros = (x: number) => formatMontant(x)

function cloreAnneeFiscale(etat: EtatPartie, annee: number, p: Parametres2026): void {
  const close = etat.fiscal.anneeEnCours
  // Les moins-values s'imputent sur les plus-values ; l'excédent se reporte.
  const net = close.plusValues - etat.fiscal.moinsValuesReportables
  etat.fiscal.moinsValuesReportables = Math.max(0, -net)
  etat.fiscal.aDeclarer = { ...close, plusValues: Math.max(0, net) }
  // Revenus d'activité nets de frais professionnels de l'année close : base du plafond PER.
  const pIR = parametresIR(p, close.indicePrixDebut)
  const revenusActivite = calculerIR({ foyer: etat.foyer, salaires: [close.salairesImposables] }, pIR).revenuNetImposable
  etat.fiscal.anneeEnCours = nouvelleAnnee(annee, etat.indicePrix, plafondPer(revenusActivite, etat.indicePrix, p))
}

function augmenterSalaire(etat: EtatPartie, alea: Aleatoire): void {
  const inflation12 = etat.inflationsRecentes.reduce((acc, i) => acc * (1 + i), 1) - 1
  const hausse = Math.max(
    0,
    inflation12 + etat.salaire.hausseReelleAnnuelle + alea.normal() * ALEA_HAUSSE_SALAIRE,
  )
  etat.salaire.brutAnnuel *= 1 + hausse
  ajouterEvenement(etat, {
    type: 'augmentation',
    titre: `Augmentation de ${(hausse * 100).toFixed(1).replace('.', ',')} %`,
    detail: `Inflation des 12 derniers mois : ${(inflation12 * 100).toFixed(1).replace('.', ',')} %. Nouveau brut annuel : ${euros(etat.salaire.brutAnnuel)}.`,
  })
}

/** Salaires nets imposables du foyer : les tiens, plus ceux du conjoint en cas d'imposition commune. */
function salairesDuFoyer(etat: EtatPartie, tiens: number, indexation: number): number[] {
  return etat.foyer.situation === 'couple' && etat.revenuConjoint > 0
    ? [tiens, etat.revenuConjoint * indexation]
    : [tiens]
}

function regulariserImpot(etat: EtatPartie, p: Parametres2026): void {
  const declaree = etat.fiscal.aDeclarer
  if (!declaree) return
  etat.fiscal.aDeclarer = null
  const pIR = parametresIR(p, declaree.indicePrixDebut)
  const salaires = salairesDuFoyer(etat, declaree.salairesImposables, declaree.indicePrixDebut)
  const totalSalaires = salaires.reduce((a, b) => a + b, 0)
  // Ta part de l'impôt du foyer, au prorata des salaires (1 si tu déclares seul).
  const part = totalSalaires > 0 ? declaree.salairesImposables / totalSalaires : 1
  const base = { foyer: etat.foyer, salaires, chargesDeductibles: declaree.chargesDeductibles }
  const irSalaires = calculerIR(base, pIR)
  const plusValues = declaree.plusValues
  let impot: number
  if (etat.optionBareme) {
    // Le supplément d'impôt dû aux plus-values est entièrement pour toi.
    impot = calculerIR({ ...base, autresRevenus: plusValues }, pIR).impotNet - irSalaires.impotNet * (1 - part)
    // CSG déductible l'année de son paiement, c'est-à-dire cette année.
    etat.fiscal.anneeEnCours.chargesDeductibles +=
      plusValues * p['prelevementsSociaux.csgDeductibleBareme'].valeur
  } else {
    impot = irSalaires.impotNet * part + Math.round(plusValues * p['pfu.tauxImpotRevenu'].valeur)
  }
  impot = Math.round(impot)
  const prelevementsSociaux = Math.round(plusValues * p['prelevementsSociaux.tauxGeneral'].valeur)
  const solde = impot - declaree.prelevementsPayes
  etat.cumuls.impotRevenu += impot
  etat.cumuls.prelevementsSociaux += prelevementsSociaux
  etat.courant -= prelevementsSociaux

  const seuil = p['pas.seuilPaiementFractionne'].valeur * etat.indicePrix
  let detail: string
  if (solde > seuil) {
    const echeance = solde / 4
    etat.fiscal.echeances = [echeance, echeance, echeance]
    etat.courant -= echeance
    detail = `Impôt ${declaree.annee} : ${euros(impot)}, prélevé ${euros(declaree.prelevementsPayes)}. Il reste ${euros(solde)} à payer en 4 fois, de septembre à décembre.`
  } else if (solde > 0) {
    etat.courant -= solde
    detail = `Impôt ${declaree.annee} : ${euros(impot)}, prélevé ${euros(declaree.prelevementsPayes)}. Le solde de ${euros(solde)} est prélevé en septembre.`
  } else if (solde < 0) {
    etat.courant -= solde
    detail = `Impôt ${declaree.annee} : ${euros(impot)}, prélevé ${euros(declaree.prelevementsPayes)}. Le trop-perçu de ${euros(-solde)} t’est remboursé (dans le simulateur, en septembre).`
  } else {
    detail = `Impôt ${declaree.annee} : ${euros(impot)}, entièrement payé par le prélèvement à la source.`
  }
  if (prelevementsSociaux > 0) {
    detail += ` Prélèvements sociaux sur tes plus-values : ${euros(prelevementsSociaux)}.`
  }
  if (part < 1) detail += ' Couple imposé en commun : tu paies ta part de l’impôt du foyer, au prorata de vos salaires.'
  ajouterEvenement(etat, { type: 'regularisation', titre: 'Régularisation de l’impôt', detail })

  const ancien = etat.fiscal.tauxPrelevement
  // Taux du foyer : le même pour les deux conjoints.
  const nouveau = tauxPrelevementPersonnalise(irSalaires.impotNet, totalSalaires)
  etat.fiscal.tauxPrelevement = nouveau
  ajouterEvenement(etat, {
    type: 'taux-prelevement',
    titre: `Taux de prélèvement : ${(nouveau * 100).toFixed(1).replace('.', ',')} %`,
    detail:
      ancien === null
        ? 'Ton premier taux personnalisé remplace la grille par défaut, calculé sur ta déclaration.'
        : `Ton taux personnalisé est mis à jour à partir de ta dernière déclaration (avant : ${(ancien * 100).toFixed(1).replace('.', ',')} %).`,
  })
}

/**
 * Prélèvement à la source sur un revenu imposable du mois (salaire, prime, allocation
 * chômage) : taux personnalisé, ou grille par défaut tant que l'administration n'en a pas.
 */
function prelever(etat: EtatPartie, baseImposable: number, p: Parametres2026, baseGrille = baseImposable): number {
  const taux =
    etat.fiscal.tauxPrelevement ??
    tauxPrelevementParDefaut(baseGrille, p['pas.grilleParDefautMetropole'].valeur, etat.indicePrix)
  const prelevement = Math.round(baseImposable * taux * 100) / 100
  etat.cumuls.prelevementsSource += prelevement
  etat.fiscal.anneeEnCours.salairesImposables += baseImposable
  etat.fiscal.anneeEnCours.prelevementsPayes += prelevement
  return prelevement
}

/**
 * Un mois sans emploi : allocation chômage si des droits sont ouverts, puis reprise d'un
 * emploi à la fin de la recherche. Simplification : l'allocation nette est imposée comme un
 * salaire (avec la déduction de 10 %), et les droits non utilisés ne sont pas rechargés.
 */
function moisSansEmploi(etat: EtatPartie, p: Parametres2026): void {
  const emploi = { ...etat.emploi }
  if (emploi.droitsAre) {
    const premierMois = emploi.droitsAre.joursVerses === 0
    const joursMax = premierMois
      ? JOURS_VERSES_PAR_MOIS - p['chomage.delaiAttenteJours'].valeur
      : JOURS_VERSES_PAR_MOIS
    const r = areDuMois(emploi.droitsAre, p, joursMax)
    if (r.net > 0) {
      const prelevement = prelever(etat, r.net, p)
      etat.courant += r.net - prelevement
      etat.cumuls.allocationsChomage += r.net - prelevement
    }
    emploi.droitsAre = r.droits
    if (r.droits.joursVerses >= r.droits.joursTotal) {
      emploi.droitsAre = null
      ajouterEvenement(etat, {
        type: 'emploi',
        titre: 'Fin de tes droits au chômage',
        detail: 'Tu as perçu toute ton allocation : jusqu’à ton prochain emploi, tu vis sur ton épargne.',
      })
    }
  }
  emploi.moisRechercheRestants -= 1
  if (emploi.moisRechercheRestants <= 0) {
    emploi.enPoste = true
    emploi.moisRechercheRestants = 0
    emploi.moisTravailles = 0
    emploi.droitsAre = null
    etat.salaire = { ...etat.salaire, brutAnnuel: emploi.brutReprise }
    ajouterEvenement(etat, {
      type: 'emploi',
      titre: 'Nouvel emploi',
      detail: `Tu reprends un poste à ${euros(emploi.brutReprise)} brut par an.`,
    })
  }
  etat.emploi = emploi
}

function avancerEnPlace(etat: EtatPartie, p: Parametres2026, series: SeriesMarche): void {
  if (etat.mois >= etat.dureeDisponible) return
  const ligne: LigneMarche = ligneDuMois(etat.marche, etat.debutHistorique, etat.mois, series)
  const rendement = ligne.actions
  const inflation = ligne.inflation
  const taux = { livretA: ligne.livretA, ldds: ligne.ldds, lep: ligne.lep }
  const date = dateDuMois(etat, etat.mois)
  const alea = new Aleatoire(etat.alea)

  // 1. Janvier : clôture de l'année fiscale et augmentation.
  if (date.mois === 0 && etat.mois > 0) {
    cloreAnneeFiscale(etat, date.annee, p)
    if (etat.emploi.enPoste) augmenterSalaire(etat, alea)
  }

  // 2. Salaire (ou allocation chômage) et prélèvement à la source.
  if (etat.emploi.enPoste) {
    const salaire = brutVersNet(etat.salaire.brutAnnuel, p['cotisations.salarieCadre'].valeur)
    const baseMensuelle = salaire.netImposable / 12
    const prelevement = prelever(etat, baseMensuelle, p)
    const netVerse = salaire.netAvantImpot / 12 - prelevement
    etat.courant += netVerse
    etat.cumuls.salairesNets += netVerse
    etat.emploi = { ...etat.emploi, moisTravailles: Math.min(24, etat.emploi.moisTravailles + 1) }
  } else {
    moisSansEmploi(etat, p)
  }

  // 3. Dépenses courantes, indexées sur l'inflation.
  const depenses = etat.depensesMensuelles * etat.indicePrix
  etat.courant -= depenses
  etat.cumuls.depenses += depenses

  // 4. Septembre : régularisation et nouveau taux ; échéances de septembre à décembre.
  if (date.mois === 8) {
    regulariserImpot(etat, p)
  } else if (date.mois > 8 && etat.fiscal.echeances.length > 0) {
    etat.courant -= etat.fiscal.echeances.shift() ?? 0
  }

  // Intéressement et participation, une fois par an : CSG et CRDS retenues, puis placés sur
  // le PEE (exonérés d'impôt, bloqués 5 ans) ou perçus (imposables comme un salaire).
  const es = etat.epargneSalariale
  if (date.mois === MOIS_INTERESSEMENT && es.interessementAnnuel > 0) {
    const brutInteressement = es.interessementAnnuel * etat.indicePrix
    const csg = brutInteressement * p['csgCrds.revenusActivite'].valeur
    const net = brutInteressement - csg
    etat.cumuls.interessement += brutInteressement
    etat.cumuls.csgCrdsEpargneSalariale += csg
    if (es.placerInteressement) {
      etat.pee = verserPee(etat.pee, net, etat.prixPart, etat.mois + p['epargneSalariale.blocagePeeAnnees'].valeur * 12)
    } else {
      etat.courant += net
      // Simplification : le montant perçu est imposé comme un salaire.
      etat.fiscal.anneeEnCours.salairesImposables += net
    }
    ajouterEvenement(etat, {
      type: 'operation',
      titre: 'Intéressement et participation',
      detail: es.placerInteressement
        ? `${euros(net)} placés sur ton PEE après CSG et CRDS : exonérés d’impôt sur le revenu, bloqués 5 ans.`
        : `${euros(net)} versés sur ton compte après CSG et CRDS : ils s’ajoutent à ton revenu imposable.`,
    })
  }

  // 5. Marchés : les parts détenues suivent l'indice, moins les frais de l'ETF.
  const enTitres =
    valeurTitres(etat.cto, etat.prixPart) +
    valeurTitres(etat.pea.titres, etat.prixPart) +
    valeurTitres(etat.assuranceVie.uc, etat.prixPart) +
    valeurTitres(etat.per.titres, etat.prixPart) +
    valeurPee(etat.pee, etat.prixPart)
  etat.indiceMarche = {
    niveau: etat.indiceMarche.niveau * (1 + rendement),
    sommet: Math.max(etat.indiceMarche.sommet, etat.indiceMarche.niveau * (1 + rendement)),
  }
  // Après une vente dans la panique, l'argent attend en liquidités : la part ne bouge plus.
  const horsMarche = etat.horsMarcheJusquAuMois !== null && etat.mois < etat.horsMarcheJusquAuMois
  if (!horsMarche) {
    const frais = etat.fraisAnnuelsEtf / 12
    etat.prixPart *= (1 + rendement) * (1 - frais)
    etat.cumuls.fraisEtf += enTitres * (1 + rendement) * frais
  }
  if (etat.horsMarcheJusquAuMois !== null && etat.mois + 1 >= etat.horsMarcheJusquAuMois) {
    etat.horsMarcheJusquAuMois = null
    ajouterEvenement(etat, {
      type: 'operation',
      titre: 'Retour sur les marchés',
      detail: 'Tu rachètes tes parts au cours du jour : ton épargne suit de nouveau les marchés.',
    })
  }
  // Frais de gestion du contrat d'assurance-vie sur les unités de compte.
  if (etat.assuranceVie.uc.parts > 0) {
    const fraisUc = etat.fraisAnnuelsUc / 12
    etat.cumuls.fraisUc += valeurTitres(etat.assuranceVie.uc, etat.prixPart) * fraisUc
    etat.assuranceVie = {
      ...etat.assuranceVie,
      uc: { ...etat.assuranceVie.uc, parts: etat.assuranceVie.uc.parts * (1 - fraisUc) },
    }
  }

  // 6. Versements programmés, dans la limite de l'argent disponible.
  let tresorerieInsuffisante = false
  const disponible = () => Math.max(0, etat.courant)
  for (const cle of ['livretA', 'ldds', 'lep'] as const) {
    let souhaite = etat.versements[cle]
    if (cle === 'lep' && souhaite > 0 && !eligibleLep(etat, p)) souhaite = 0
    const avant = etat[cle]
    const plafond = plafondLivret(cle, p)
    const { livret, verse } = moisLivret(avant, souhaite, disponible(), plafond, taux[cle])
    if (souhaite > 0 && avant.solde < plafond - 0.005 && livret.solde >= plafond - 0.005) {
      ajouterEvenement(etat, {
        type: 'plafond',
        titre: 'Plafond atteint',
        detail: `Ton ${cle === 'livretA' ? 'Livret A' : cle === 'ldds' ? 'LDDS' : 'LEP'} est plein : les versements s’arrêtent, les intérêts continuent.`,
      })
    } else if (verse < souhaite && disponible() < souhaite) {
      tresorerieInsuffisante = true
    }
    etat[cle] = livret
    etat.courant -= verse
  }
  const plafondPea = p['pea.plafondVersements'].valeur
  if (etat.versements.pea > 0 && !etat.pea.cloture) {
    if (etat.pea.ouvertAuMois === null) {
      etat.pea = { ...etat.pea, ouvertAuMois: etat.mois }
      ajouterEvenement(etat, {
        type: 'operation',
        titre: 'PEA ouvert',
        detail: 'L’horloge des 5 ans démarre aujourd’hui.',
      })
    }
    const verse = Math.max(
      0,
      Math.min(etat.versements.pea, plafondPea - etat.pea.versements, disponible()),
    )
    if (verse < etat.versements.pea && disponible() < etat.versements.pea) tresorerieInsuffisante = true
    etat.pea = {
      ...etat.pea,
      versements: etat.pea.versements + verse,
      titres: acheter(etat.pea.titres, verse, etat.prixPart),
    }
    etat.courant -= verse
  }
  if (etat.versements.cto > 0) {
    const verse = Math.min(etat.versements.cto, disponible())
    if (verse < etat.versements.cto) tresorerieInsuffisante = true
    etat.cto = acheter(etat.cto, verse, etat.prixPart)
    etat.courant -= verse
  }

  // Assurance-vie : versement réparti entre fonds en euros et unités de compte. Les intérêts
  // du fonds en euros courent chaque mois et sont crédités le 31 décembre.
  {
    const souhaite = etat.versements.assuranceVie
    const verse = Math.min(souhaite, disponible())
    if (verse < souhaite) tresorerieInsuffisante = true
    let av = etat.assuranceVie
    if (verse > 0 && av.ouvertAuMois === null) {
      av = { ...av, ouvertAuMois: etat.mois }
      ajouterEvenement(etat, {
        type: 'operation',
        titre: 'Assurance-vie ouverte',
        detail: 'L’horloge des 8 ans démarre aujourd’hui : après 8 ans, la fiscalité des rachats s’allège.',
      })
    }
    const versUc = verse * etat.partUniteDeCompte
    const versEuros = verse - versUc
    if (av.ouvertAuMois !== null) {
      av = {
        ...av,
        fondsEuros: moisLivret(av.fondsEuros, versEuros, versEuros, Number.POSITIVE_INFINITY, ligne.fondsEuros).livret,
        uc: acheter(av.uc, versUc, etat.prixPart),
        primes: av.primes + verse,
      }
    }
    etat.assuranceVie = av
    etat.courant -= verse
  }

  // PER individuel : versements déductibles dans la limite du plafond de l'année.
  if (etat.versements.per > 0) {
    const verse = Math.min(etat.versements.per, disponible())
    if (verse < etat.versements.per) tresorerieInsuffisante = true
    const annee = etat.fiscal.anneeEnCours
    const plafond = annee.plafondPer > 0 ? annee.plafondPer : plafondPer(0, etat.indicePrix, p)
    const deduit = Math.max(0, Math.min(verse, plafond - annee.versementsPerDeduits))
    annee.versementsPerDeduits += deduit
    annee.chargesDeductibles += deduit
    etat.per = {
      versementsDeduits: etat.per.versementsDeduits + deduit,
      versementsNonDeduits: etat.per.versementsNonDeduits + verse - deduit,
      titres: acheter(etat.per.titres, verse, etat.prixPart),
    }
    etat.courant -= verse
  }

  // PEE : versement volontaire (25 % du brut annuel au plus) et abondement de l'employeur,
  // exonéré d'impôt sur le revenu mais soumis à la CSG et à la CRDS (service-public F2142).
  if (etat.versements.pee > 0) {
    const plafondAnnuel = etat.salaire.brutAnnuel * p['epargneSalariale.versementsVolontairesTaux'].valeur
    const verse = Math.min(etat.versements.pee, disponible(), plafondAnnuel / 12)
    if (verse < etat.versements.pee && disponible() < etat.versements.pee) tresorerieInsuffisante = true
    const annee = etat.fiscal.anneeEnCours
    const plafondAbondement = Math.min(
      es.abondementPlafond * etat.indicePrix,
      p['epargneSalariale.abondementPeeMax'].valeur * etat.indicePrix,
    )
    const abondementBrut = Math.max(
      0,
      Math.min(
        verse * Math.min(es.abondementTaux, p['epargneSalariale.abondementRatioMax'].valeur),
        plafondAbondement - annee.abondementAnnee,
      ),
    )
    const csg = abondementBrut * p['csgCrds.revenusActivite'].valeur
    annee.abondementAnnee += abondementBrut
    etat.cumuls.abondement += abondementBrut
    etat.cumuls.csgCrdsEpargneSalariale += csg
    const disponibleAuMois = etat.mois + p['epargneSalariale.blocagePeeAnnees'].valeur * 12
    etat.pee = verserPee(etat.pee, verse + abondementBrut - csg, etat.prixPart, disponibleAuMois)
    etat.courant -= verse
  }
  if (tresorerieInsuffisante && !etat.journal.some((e) => e.type === 'tresorerie' && e.mois > etat.mois - 12)) {
    ajouterEvenement(etat, {
      type: 'tresorerie',
      titre: 'Fin de mois serrée',
      detail:
        'Ton compte courant ne suffit pas pour tous tes versements : certains ont été réduits ce mois-ci.',
    })
  }

  // 7. 31 décembre : les intérêts des livrets s'ajoutent au capital.
  if (date.mois === 11) {
    let total = 0
    for (const cle of ['livretA', 'ldds', 'lep'] as const) {
      const { livret, credites } = crediterInterets(etat[cle])
      etat[cle] = livret
      total += credites
    }
    etat.cumuls.interets += total
    if (total > 0.5) {
      ajouterEvenement(etat, {
        type: 'interets',
        titre: 'Intérêts des livrets',
        detail: `${euros(total)} d’intérêts, exonérés d’impôt et de prélèvements sociaux, s’ajoutent à tes livrets.`,
      })
    }
    // Fonds en euros : intérêts de l'année, nets des prélèvements sociaux prélevés par l'assureur.
    const fe = etat.assuranceVie.fondsEuros
    if (fe.interetsCourus > 0) {
      const ps = fe.interetsCourus * p['prelevementsSociaux.tauxAssuranceVie'].valeur
      const net = fe.interetsCourus - ps
      etat.assuranceVie = { ...etat.assuranceVie, fondsEuros: { solde: fe.solde + net, interetsCourus: 0 } }
      etat.cumuls.interetsFondsEuros += net
      etat.cumuls.prelevementsSociaux += ps
      if (net > 0.5) {
        ajouterEvenement(etat, {
          type: 'interets',
          titre: 'Fonds en euros',
          detail: `${euros(net)} d’intérêts crédités au taux de ${(ligne.fondsEuros * 100).toFixed(2).replace('.', ',')} %${ligne.fondsEurosEstime ? ' (taux estimé)' : ''}, après ${euros(ps)} de prélèvements sociaux.`,
        })
      }
    }
  }

  // 8. Inflation du mois.
  etat.indicePrix *= 1 + inflation
  etat.inflationsRecentes = [...etat.inflationsRecentes, inflation].slice(-12)
  etat.alea = alea.etat
  etat.mois += 1

  // Ces deux événements concernent le mois qui vient de s'écouler.
  const moisEcoule = etat.mois - 1
  if (rendement <= SEUIL_CHUTE_MARCHE) {
    etat.journal.push({
      mois: moisEcoule,
      type: 'marche',
      titre: `Les actions chutent de ${Math.abs(rendement * 100).toFixed(1).replace('.', ',')} %`,
      detail:
        'Ton ETF monde perd beaucoup en un mois. Personne ne sait si la baisse va continuer : que fais-tu ?',
    })
  }
  if (etat.mois === etat.dureeMois || etat.mois === etat.dureeDisponible) {
    etat.journal.push({
      mois: moisEcoule,
      type: 'fin',
      titre:
        etat.mois === etat.dureeMois
          ? etat.dureeMois === DUREE_PARTIE_MOIS
            ? 'Dix ans déjà'
            : `${Math.round(etat.dureeMois / 12)} ans déjà`
          : 'Fin des données historiques',
      detail: `Tu viens de traverser ${periodeRejouee(etat, series)}.`,
    })
  }
  etat.historique.push(pointHistorique(etat, p))
}

/** Avance de `mois` mois (s'arrête à la fin des données). */
export function avancer(
  etat: EtatPartie,
  p: Parametres2026,
  mois = 1,
  series: SeriesMarche = SERIES,
): EtatPartie {
  const suivant = structuredClone(etat)
  for (let k = 0; k < mois && suivant.mois < suivant.dureeDisponible; k++) {
    avancerEnPlace(suivant, p, series)
  }
  return suivant
}

/** Types d'événements qui arrêtent « Prochain événement ». */
const EVENEMENTS_MARQUANTS: ReadonlySet<TypeEvenement> = new Set([
  'augmentation',
  'regularisation',
  'marche',
  'plafond',
  'tresorerie',
  'emploi',
  'fin',
])

/** Avance jusqu'au prochain événement marquant (au plus `maximum` mois). */
export function avancerJusquAuProchainEvenement(
  etat: EtatPartie,
  p: Parametres2026,
  maximum = 24,
  series: SeriesMarche = SERIES,
): EtatPartie {
  const suivant = structuredClone(etat)
  for (let k = 0; k < maximum && suivant.mois < suivant.dureeDisponible; k++) {
    const avant = suivant.journal.length
    avancerEnPlace(suivant, p, series)
    if (suivant.journal.slice(avant).some((e) => EVENEMENTS_MARQUANTS.has(e.type))) break
  }
  return suivant
}

export function estTerminee(etat: EtatPartie): boolean {
  return etat.mois >= etat.dureeDisponible
}

/** Les dix ans sont écoulés : la période réelle peut être révélée. */
export function periodeRevelee(etat: EtatPartie): boolean {
  return etat.mois >= Math.min(etat.dureeMois, etat.dureeDisponible)
}

/** « janvier 2007 – décembre 2016 » : la période réelle rejouée jusqu'ici, ou le mode joué. */
export function periodeRejouee(etat: EtatPartie, series: SeriesMarche = SERIES): string {
  if (etat.marche.mode === 'monte-carlo') {
    return 'une trajectoire Monte Carlo, faite d’années réelles recollées au hasard'
  }
  if (etat.marche.mode === 'scenario') {
    return `le scénario « ${SCENARIOS[etat.marche.scenario ?? 'krach'].nom} »`
  }
  const debut = series.mois[etat.debutHistorique] ?? ''
  const fin = series.mois[etat.debutHistorique + Math.max(0, etat.mois - 1)] ?? ''
  return `${libelleMois(debut)} – ${libelleMois(fin)}`
}

// ---------------------------------------------------------------- Décisions ponctuelles

export function modifierVersements(etat: EtatPartie, versements: Partial<Versements>): EtatPartie {
  const propres = Object.fromEntries(
    Object.entries(versements).map(([cle, v]) => [cle, Math.max(0, Math.round(v))]),
  )
  return { ...etat, versements: { ...etat.versements, ...propres } }
}

export function modifierPartie(
  etat: EtatPartie,
  modifications: Partial<Pick<EtatPartie, 'depensesMensuelles' | 'optionBareme' | 'fraisAnnuelsEtf'>> & {
    brutAnnuel?: number
  },
): EtatPartie {
  const { brutAnnuel, ...reste } = modifications
  return {
    ...etat,
    ...reste,
    salaire: brutAnnuel === undefined ? etat.salaire : { ...etat.salaire, brutAnnuel },
  }
}

function avecJournal(etat: EtatPartie, evenement: Omit<Evenement, 'mois'>): EtatPartie {
  return { ...etat, journal: [...etat.journal, { mois: etat.mois, ...evenement }] }
}

// --------------------------------------------------------------- Événements de vie

/**
 * Perte d'emploi (ou recherche du premier emploi) : les droits à l'ARE s'ouvrent si tu as
 * assez travaillé, puis tu reprends un poste au bout de `moisRecherche` mois.
 */
export function perdreEmploi(
  etat: EtatPartie,
  p: Parametres2026,
  options: { moisRecherche: number; brutReprise: number; titre: string; detail: string },
): EtatPartie {
  const droits = etat.emploi.enPoste
    ? ouvrirDroitsAre(etat.salaire.brutAnnuel, etat.emploi.moisTravailles, etat.emploi.dejaIndemnise, p)
    : null
  const suivant: EtatPartie = {
    ...etat,
    emploi: {
      enPoste: false,
      moisTravailles: 0,
      dejaIndemnise: etat.emploi.dejaIndemnise || droits !== null,
      droitsAre: droits,
      moisRechercheRestants: Math.max(1, Math.round(options.moisRecherche)),
      brutReprise: options.brutReprise,
    },
  }
  return avecJournal(suivant, { type: 'emploi', titre: options.titre, detail: options.detail })
}

/** Nouveau salaire (promotion, changement d'employeur, mutation), en euros courants. */
export function changerDeSalaire(etat: EtatPartie, brutAnnuel: number, titre: string, detail: string): EtatPartie {
  return avecJournal(
    { ...etat, salaire: { ...etat.salaire, brutAnnuel } },
    { type: 'emploi', titre, detail },
  )
}

/** Prime brute versée ce mois-ci : cotisations au même taux que le salaire, puis prélèvement à la source. */
export function percevoirPrime(etat: EtatPartie, brut: number, p: Parametres2026): EtatPartie {
  const suivant = structuredClone(etat)
  const reference = brutVersNet(Math.max(1, etat.salaire.brutAnnuel), p['cotisations.salarieCadre'].valeur)
  const net = brut * (reference.netAvantImpot / reference.brut)
  const imposable = brut * (reference.netImposable / reference.brut)
  const prelevement = prelever(suivant, imposable, p, reference.netImposable / 12)
  suivant.courant += net - prelevement
  suivant.cumuls.primes += net - prelevement
  ajouterEvenement(suivant, {
    type: 'vie',
    titre: 'Prime exceptionnelle',
    detail: `${euros(brut)} brut, soit ${euros(net - prelevement)} versés après cotisations et prélèvement à la source.`,
  })
  return suivant
}

/**
 * Dépense exceptionnelle (voiture, déménagement, mariage…). Si le compte courant ne suffit
 * pas, l'argent est pris sur les livrets, comme on le ferait avec une épargne de précaution.
 */
export function depenser(etat: EtatPartie, montant: number, titre: string, detail: string): EtatPartie {
  const suivant = structuredClone(etat)
  suivant.courant -= montant
  suivant.cumuls.depenses += montant
  let manque = -suivant.courant
  for (const cle of ['livretA', 'ldds', 'lep'] as const) {
    if (manque <= 0) break
    const { livret, retire } = retirerLivret(suivant[cle], manque, 0)
    suivant[cle] = livret
    suivant.courant += retire
    manque -= retire
  }
  ajouterEvenement(suivant, { type: 'vie', titre, detail })
  return suivant
}

/** Change le foyer fiscal (mise en couple pacsée ou mariée, naissance). */
export function modifierFoyer(etat: EtatPartie, foyer: Foyer, revenuConjoint = etat.revenuConjoint): EtatPartie {
  return { ...etat, foyer, revenuConjoint }
}

/**
 * Vente de tout ce qui est investi en actions, dans la panique : l'argent reste en
 * liquidités dans chaque enveloppe pendant `mois` mois, puis il est réinvesti au cours du
 * jour. Sur le compte-titres, la vente réalise la plus-value (imposée l'an prochain) et le
 * rachat fixe un nouveau prix de revient. Simplification : pas de frais de transaction.
 */
export function vendreDansLaPanique(etat: EtatPartie, mois: number): EtatPartie {
  const valeurCto = valeurTitres(etat.cto, etat.prixPart)
  const plusValue = valeurCto - etat.cto.prixDeRevient
  const suivant: EtatPartie = {
    ...etat,
    cto: { ...etat.cto, prixDeRevient: valeurCto },
    horsMarcheJusquAuMois: etat.mois + Math.max(1, Math.round(mois)),
    fiscal: {
      ...etat.fiscal,
      anneeEnCours: {
        ...etat.fiscal.anneeEnCours,
        plusValues: etat.fiscal.anneeEnCours.plusValues + plusValue,
      },
    },
  }
  return avecJournal(suivant, {
    type: 'operation',
    titre: 'Tout vendu',
    detail: `Tes placements en actions passent en liquidités${valeurCto > 0 ? ` (${plusValue >= 0 ? 'plus-value' : 'moins-value'} de ${euros(Math.abs(plusValue))} sur le compte-titres)` : ''}. Tu prévois de racheter dans ${Math.round(mois)} mois.`,
  })
}

/** Valeur de tout ce qui est investi en actions (CTO, PEA, unités de compte, PER, PEE). */
export function valeurEnActions(etat: EtatPartie): number {
  const v = valeursEnveloppes(etat)
  return v.cto + v.pea + valeurTitres(etat.assuranceVie.uc, etat.prixPart) + v.per + v.pee
}

/** Vend des parts du CTO ; la plus-value sera imposée à la régularisation de l'année suivante. */
export function vendreCto(etat: EtatPartie, montant: number): EtatPartie {
  const { titres, vendu, plusValue } = vendre(etat.cto, montant, etat.prixPart)
  if (vendu === 0) return etat
  const suivant: EtatPartie = {
    ...etat,
    cto: titres,
    courant: etat.courant + vendu,
    fiscal: {
      ...etat.fiscal,
      anneeEnCours: {
        ...etat.fiscal.anneeEnCours,
        plusValues: etat.fiscal.anneeEnCours.plusValues + plusValue,
      },
    },
  }
  return avecJournal(suivant, {
    type: 'operation',
    titre: 'Vente sur le compte-titres',
    detail: `${euros(vendu)} vendus, ${plusValue >= 0 ? 'plus-value' : 'moins-value'} de ${euros(Math.abs(plusValue))}, déclarée l’an prochain.`,
  })
}

export function retirerDuPea(etat: EtatPartie, montant: number, p: Parametres2026): EtatPartie {
  const r = retirerPea(etat.pea, montant, etat.prixPart, etat.mois, {
    dureeExonerationMois: p['pea.dureeExonerationImpotRevenu'].valeur * 12,
    tauxImpot: p['pfu.tauxImpotRevenu'].valeur,
    tauxPrelevementsSociaux: p['pea.tauxApres5Ans'].valeur,
  })
  if (r.net === 0 && r.gain === 0 && !r.cloture) return etat
  const suivant: EtatPartie = {
    ...etat,
    pea: r.pea,
    courant: etat.courant + r.net,
    cumuls: {
      ...etat.cumuls,
      impotRevenu: etat.cumuls.impotRevenu + r.impotRevenu,
      prelevementsSociaux: etat.cumuls.prelevementsSociaux + r.prelevementsSociaux,
    },
  }
  return avecJournal(suivant, {
    type: 'operation',
    titre: r.cloture ? 'PEA clôturé' : 'Retrait sur le PEA',
    detail: `${euros(r.net)} versés sur ton compte courant après ${euros(r.impotRevenu + r.prelevementsSociaux)} d’impôts sur un gain de ${euros(r.gain)}.${r.cloture && r.impotRevenu > 0 ? ' Retrait avant 5 ans : le plan est clôturé.' : ''}`,
  })
}

export function retirerDuLivret(
  etat: EtatPartie,
  cle: CleLivret,
  montant: number,
  series: SeriesMarche = SERIES,
): EtatPartie {
  const taux = tauxLivretActuel(etat, cle, series)
  const { livret, retire } = retirerLivret(etat[cle], montant, taux)
  if (retire === 0) return etat
  return { ...etat, [cle]: livret, courant: etat.courant + retire }
}

/** Rachat sur l'assurance-vie : impôt et prélèvements sociaux réglés au rachat (simplification). */
export function racheterDeLAssuranceVie(etat: EtatPartie, montant: number, p: Parametres2026): EtatPartie {
  const r = racheterAssuranceVie(etat.assuranceVie, montant, etat.prixPart, etat.mois, reglesAssuranceVie(etat, p))
  if (r.net === 0 && r.gain === 0) return etat
  const suivant: EtatPartie = {
    ...etat,
    assuranceVie: r.av,
    courant: etat.courant + r.net,
    cumuls: {
      ...etat.cumuls,
      impotRevenu: etat.cumuls.impotRevenu + r.impotRevenu,
      prelevementsSociaux: etat.cumuls.prelevementsSociaux + r.prelevementsSociaux,
    },
    fiscal: {
      ...etat.fiscal,
      anneeEnCours: {
        ...etat.fiscal.anneeEnCours,
        abattementAssuranceVie: etat.fiscal.anneeEnCours.abattementAssuranceVie + r.abattementUtilise,
      },
    },
  }
  return avecJournal(suivant, {
    type: 'operation',
    titre: 'Rachat sur l’assurance-vie',
    detail: `${euros(r.net)} versés sur ton compte. Gain imposable : ${euros(r.gain)}${r.abattementUtilise > 0 ? `, dont ${euros(r.abattementUtilise)} couverts par l’abattement` : ''} ; impôt ${euros(r.impotRevenu)}, prélèvements sociaux ${euros(r.prelevementsSociaux)}.`,
  })
}

/** Retire les sommes débloquées du PEE : gains soumis aux seuls prélèvements sociaux. */
export function retirerDuPee(etat: EtatPartie, montant: number, p: Parametres2026): EtatPartie {
  const r = retirerPee(etat.pee, montant, etat.prixPart, etat.mois, p['prelevementsSociaux.tauxGeneral'].valeur)
  if (r.net === 0 && r.gain === 0) return etat
  const suivant: EtatPartie = {
    ...etat,
    pee: r.pee,
    courant: etat.courant + r.net,
    cumuls: { ...etat.cumuls, prelevementsSociaux: etat.cumuls.prelevementsSociaux + r.prelevementsSociaux },
  }
  return avecJournal(suivant, {
    type: 'operation',
    titre: 'Retrait sur le PEE',
    detail: `${euros(r.net)} versés sur ton compte, exonérés d’impôt sur le revenu ; ${euros(r.prelevementsSociaux)} de prélèvements sociaux sur ${euros(r.gain)} de gains.`,
  })
}

export function modifierEpargneSalariale(etat: EtatPartie, modifications: Partial<EpargneSalariale>): EtatPartie {
  return { ...etat, epargneSalariale: { ...etat.epargneSalariale, ...modifications } }
}

export function modifierPartUniteDeCompte(etat: EtatPartie, part: number): EtatPartie {
  return { ...etat, partUniteDeCompte: Math.max(0, Math.min(1, part)) }
}

export interface ResultatProjectionPartie {
  /** Mois de la partie de chaque point (tous les douze mois). */
  mois: number[]
  p10: number[]
  p50: number[]
  p90: number[]
}

/**
 * Projette la stratégie actuelle (versements et réglages inchangés) sur des trajectoires
 * Monte Carlo : où pourrait en être le patrimoine net réel dans `horizonMois` mois ?
 */
export function projeterStrategie(
  etat: EtatPartie,
  p: Parametres2026,
  options: { trajectoires: number; horizonMois: number; graine: number },
  series: SeriesMarche = SERIES,
): ResultatProjectionPartie {
  const alea = new Aleatoire(options.graine)
  const points = Math.floor(options.horizonMois / 12)
  const valeurs: number[][] = Array.from({ length: points + 1 }, () => [])
  for (let t = 0; t < options.trajectoires; t++) {
    const copie = structuredClone(etat)
    copie.historique = []
    copie.journal = []
    const nouveaux = indicesBootstrap(alea, series.mois.length, options.horizonMois)
    copie.marche = { mode: 'monte-carlo', indices: [...new Array<number>(etat.mois).fill(0), ...nouveaux] }
    copie.dureeDisponible = etat.mois + options.horizonMois
    valeurs[0]?.push(bilan(copie, p).netReel)
    for (let m = 1; m <= options.horizonMois; m++) {
      avancerEnPlace(copie, p, series)
      if (m % 12 === 0) valeurs[m / 12]?.push(bilan(copie, p).netReel)
    }
  }
  const quantile = (serie: number[], q: number) => {
    const trie = [...serie].sort((a, b) => a - b)
    const position = (trie.length - 1) * q
    const bas = trie[Math.floor(position)] ?? 0
    const haut = trie[Math.ceil(position)] ?? bas
    return bas + (haut - bas) * (position - Math.floor(position))
  }
  return {
    mois: valeurs.map((_, k) => etat.mois + k * 12),
    p10: valeurs.map((v) => quantile(v, 0.1)),
    p50: valeurs.map((v) => quantile(v, 0.5)),
    p90: valeurs.map((v) => quantile(v, 0.9)),
  }
}

/** Taux de prélèvement à la source appliqué ce mois-ci, et s'il est personnalisé. */
export function tauxPrelevementActuel(etat: EtatPartie, p: Parametres2026): { taux: number; personnalise: boolean } {
  if (etat.fiscal.tauxPrelevement !== null) return { taux: etat.fiscal.tauxPrelevement, personnalise: true }
  const base = brutVersNet(etat.salaire.brutAnnuel, p['cotisations.salarieCadre'].valeur).netImposable / 12
  return {
    taux: tauxPrelevementParDefaut(base, p['pas.grilleParDefautMetropole'].valeur, etat.indicePrix),
    personnalise: false,
  }
}

/** Taux du Livret A (ou d'un autre livret) en vigueur ce mois-ci dans la trajectoire jouée. */
export function tauxLivretActuel(etat: EtatPartie, cle: CleLivret, series: SeriesMarche = SERIES): number {
  const mois = Math.min(etat.mois, etat.dureeDisponible - 1)
  return ligneDuMois(etat.marche, etat.debutHistorique, mois, series)[cle]
}

/** Taux du fonds en euros de l'année en cours dans la trajectoire jouée, et s'il est estimé. */
export function tauxFondsEurosActuel(etat: EtatPartie, series: SeriesMarche = SERIES): { taux: number; estime: boolean } {
  const ligne = ligneDuMois(etat.marche, etat.debutHistorique, Math.min(etat.mois, etat.dureeDisponible - 1), series)
  return { taux: ligne.fondsEuros, estime: ligne.fondsEurosEstime }
}
