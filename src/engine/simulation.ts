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
import {
  acheter,
  ageDuPeaEnMois,
  crediterInterets,
  LIVRET_VIDE,
  moisLivret,
  PEA_FERME,
  retirerLivret,
  retirerPea,
  TITRES_VIDES,
  valeurTitres,
  vendre,
  type Livret,
  type Pea,
  type Titres,
} from './enveloppes.ts'
import {
  calculerIR,
  nombreDeParts,
  parametresIR,
  tauxPrelevementParDefaut,
  tauxPrelevementPersonnalise,
  type Foyer,
} from './impots.ts'
import { libelleMois, nombreDeDepartsPossibles, SERIES, type SeriesMarche } from './marches.ts'
import { brutVersNet } from './salaire.ts'

export const VERSION_ETAT_PARTIE = 1
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
  /** Mois écoulés depuis le début de la partie. */
  mois: number
  /** Date simulée du premier mois (mois de 0 à 11). */
  calendrier: { annee: number; mois: number }
  foyer: Foyer
  salaire: { brutAnnuel: number; hausseReelleAnnuelle: number }
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
}

export const VERSEMENTS_NULS: Versements = { livretA: 0, ldds: 0, lep: 0, pea: 0, cto: 0 }

function nouvelleAnnee(annee: number, indicePrix: number): AnneeFiscale {
  return {
    annee,
    indicePrixDebut: indicePrix,
    salairesImposables: 0,
    prelevementsPayes: 0,
    plusValues: 0,
    chargesDeductibles: 0,
  }
}

/** Date simulée d'un mois de la partie. */
export function dateDuMois(etat: Pick<EtatPartie, 'calendrier'>, mois: number): { annee: number; mois: number } {
  const total = etat.calendrier.mois + mois
  return { annee: etat.calendrier.annee + Math.floor(total / 12), mois: total % 12 }
}

export function creerPartie(config: ConfigPartie, series: SeriesMarche = SERIES): EtatPartie {
  const alea = new Aleatoire(config.graine)
  const departs = nombreDeDepartsPossibles(DUREE_PARTIE_MOIS, series)
  if (departs === 0) throw new Error('Historique trop court pour une partie de dix ans')
  const debutHistorique = config.debutHistorique ?? alea.entier(departs)
  if (debutHistorique < 0 || debutHistorique >= series.mois.length) {
    throw new RangeError(`Début historique invalide : ${debutHistorique}`)
  }
  const etat: EtatPartie = {
    version: VERSION_ETAT_PARTIE,
    graine: config.graine,
    alea: alea.etat,
    debutHistorique,
    dureeDisponible: series.mois.length - debutHistorique,
    mois: 0,
    calendrier: config.calendrier,
    foyer: config.foyer ?? { situation: 'celibataire', enfantsACharge: 0 },
    salaire: {
      brutAnnuel: config.brutAnnuel,
      hausseReelleAnnuelle: config.hausseReelleAnnuelle ?? 0.01,
    },
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
    prixPart: 100,
    indicePrix: 1,
    inflationsRecentes: [],
    fiscal: {
      tauxPrelevement: null,
      anneeEnCours: nouvelleAnnee(config.calendrier.annee, 1),
      aDeclarer: null,
      echeances: [],
      moinsValuesReportables: 0,
    },
    cumuls: { salairesNets: 0, prelevementsSource: 0, impotRevenu: 0, prelevementsSociaux: 0, fraisEtf: 0, interets: 0 },
    journal: [
      {
        mois: 0,
        type: 'debut',
        titre: 'Premier salaire',
        detail:
          'Tu commences ta vie active. La période de marché rejouée reste secrète jusqu’à la fin des dix ans.',
      },
    ],
    historique: [],
  }
  etat.historique.push(pointHistorique(etat))
  return etat
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
  return gainCto * tauxLatentCto(p) + gainPea * tauxPea
}

export interface Bilan {
  courant: number
  livrets: number
  cto: number
  pea: number
  brut: number
  fiscaliteLatente: number
  net: number
  /** Patrimoine net en euros constants du départ. */
  netReel: number
}

export function bilan(etat: EtatPartie, p: Parametres2026): Bilan {
  const livrets = etat.livretA.solde + etat.ldds.solde + etat.lep.solde
  const cto = valeurTitres(etat.cto, etat.prixPart)
  const pea = valeurTitres(etat.pea.titres, etat.prixPart)
  const brut = etat.courant + livrets + cto + pea
  const latente = fiscaliteLatente(etat, p)
  return {
    courant: etat.courant,
    livrets,
    cto,
    pea,
    brut,
    fiscaliteLatente: latente,
    net: brut - latente,
    netReel: (brut - latente) / etat.indicePrix,
  }
}

function pointHistorique(etat: EtatPartie, p?: Parametres2026): PointHistorique {
  const livrets = etat.livretA.solde + etat.ldds.solde + etat.lep.solde
  const titres = valeurTitres(etat.cto, etat.prixPart) + valeurTitres(etat.pea.titres, etat.prixPart)
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
  return calculerIR({ foyer: etat.foyer, salaires: [salaires] }, pIR).revenuNetImposable
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

function cloreAnneeFiscale(etat: EtatPartie, annee: number): void {
  const close = etat.fiscal.anneeEnCours
  // Les moins-values s'imputent sur les plus-values ; l'excédent se reporte.
  const net = close.plusValues - etat.fiscal.moinsValuesReportables
  etat.fiscal.moinsValuesReportables = Math.max(0, -net)
  etat.fiscal.aDeclarer = { ...close, plusValues: Math.max(0, net) }
  etat.fiscal.anneeEnCours = nouvelleAnnee(annee, etat.indicePrix)
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

function regulariserImpot(etat: EtatPartie, p: Parametres2026): void {
  const declaree = etat.fiscal.aDeclarer
  if (!declaree) return
  etat.fiscal.aDeclarer = null
  const pIR = parametresIR(p, declaree.indicePrixDebut)
  const base = {
    foyer: etat.foyer,
    salaires: [declaree.salairesImposables],
    chargesDeductibles: declaree.chargesDeductibles,
  }
  const irSalaires = calculerIR(base, pIR)
  const plusValues = declaree.plusValues
  let impot: number
  if (etat.optionBareme) {
    impot = calculerIR({ ...base, autresRevenus: plusValues }, pIR).impotNet
    // CSG déductible l'année de son paiement, c'est-à-dire cette année.
    etat.fiscal.anneeEnCours.chargesDeductibles +=
      plusValues * p['prelevementsSociaux.csgDeductibleBareme'].valeur
  } else {
    impot = irSalaires.impotNet + Math.round(plusValues * p['pfu.tauxImpotRevenu'].valeur)
  }
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
  ajouterEvenement(etat, { type: 'regularisation', titre: 'Régularisation de l’impôt', detail })

  const ancien = etat.fiscal.tauxPrelevement
  const nouveau = tauxPrelevementPersonnalise(irSalaires.impotNet, declaree.salairesImposables)
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

function avancerEnPlace(etat: EtatPartie, p: Parametres2026, series: SeriesMarche): void {
  if (etat.mois >= etat.dureeDisponible) return
  const i = etat.debutHistorique + etat.mois
  const rendement = series.actionsMonde[i] ?? 0
  const inflation = series.inflation[i] ?? 0
  const taux = { livretA: series.livretA[i] ?? 0, ldds: series.ldds[i] ?? 0, lep: series.lep[i] ?? 0 }
  const date = dateDuMois(etat, etat.mois)
  const alea = new Aleatoire(etat.alea)

  // 1. Janvier : clôture de l'année fiscale et augmentation.
  if (date.mois === 0 && etat.mois > 0) {
    cloreAnneeFiscale(etat, date.annee)
    augmenterSalaire(etat, alea)
  }

  // 2. Salaire et prélèvement à la source.
  const salaire = brutVersNet(etat.salaire.brutAnnuel, p['cotisations.salarieCadre'].valeur)
  const baseMensuelle = salaire.netImposable / 12
  const tauxPas =
    etat.fiscal.tauxPrelevement ??
    tauxPrelevementParDefaut(baseMensuelle, p['pas.grilleParDefautMetropole'].valeur, etat.indicePrix)
  const prelevement = Math.round(baseMensuelle * tauxPas * 100) / 100
  const netVerse = salaire.netAvantImpot / 12 - prelevement
  etat.courant += netVerse
  etat.cumuls.salairesNets += netVerse
  etat.cumuls.prelevementsSource += prelevement
  etat.fiscal.anneeEnCours.salairesImposables += baseMensuelle
  etat.fiscal.anneeEnCours.prelevementsPayes += prelevement

  // 3. Dépenses courantes, indexées sur l'inflation.
  etat.courant -= etat.depensesMensuelles * etat.indicePrix

  // 4. Septembre : régularisation et nouveau taux ; échéances de septembre à décembre.
  if (date.mois === 8) {
    regulariserImpot(etat, p)
  } else if (date.mois > 8 && etat.fiscal.echeances.length > 0) {
    etat.courant -= etat.fiscal.echeances.shift() ?? 0
  }

  // 5. Marchés : les parts détenues suivent l'indice, moins les frais de l'ETF.
  const valeurAvant = valeurTitres(etat.cto, etat.prixPart) + valeurTitres(etat.pea.titres, etat.prixPart)
  const frais = etat.fraisAnnuelsEtf / 12
  etat.prixPart *= (1 + rendement) * (1 - frais)
  etat.cumuls.fraisEtf += valeurAvant * (1 + rendement) * frais

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
  if (etat.mois === DUREE_PARTIE_MOIS || etat.mois === etat.dureeDisponible) {
    etat.journal.push({
      mois: moisEcoule,
      type: 'fin',
      titre: etat.mois === DUREE_PARTIE_MOIS ? 'Dix ans déjà' : 'Fin des données historiques',
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
  return etat.mois >= Math.min(DUREE_PARTIE_MOIS, etat.dureeDisponible)
}

/** « janvier 2007 – décembre 2016 » : la période réelle rejouée jusqu'ici. */
export function periodeRejouee(etat: EtatPartie, series: SeriesMarche = SERIES): string {
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
  const taux = series[cle][etat.debutHistorique + etat.mois] ?? 0
  const { livret, retire } = retirerLivret(etat[cle], montant, taux)
  if (retire === 0) return etat
  return { ...etat, [cle]: livret, courant: etat.courant + retire }
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

/** Taux du Livret A (ou d'un autre livret) en vigueur ce mois-ci dans la période rejouée. */
export function tauxLivretActuel(etat: EtatPartie, cle: CleLivret, series: SeriesMarche = SERIES): number {
  return series[cle][Math.min(etat.debutHistorique + etat.mois, series.mois.length - 1)] ?? 0
}
