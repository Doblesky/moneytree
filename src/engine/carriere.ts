/**
 * Mode carrière (cahier des charges, « Modes de jeu ») : on avance année par année, et chaque
 * année apporte un événement à choix. Le score combine le patrimoine net réel, le taux
 * d'épargne, les objectifs atteints et une jauge de sang-froid qui baisse si l'on vend dans
 * la panique.
 *
 * Deux couches, comme le simulateur :
 * - les règles réelles viennent du moteur et des paramètres officiels : salaire net, impôt
 *   (imposition commune des couples pacsés ou mariés), allocation chômage, loyers médians ;
 * - les montants des événements (hausse d'une offre, coût d'une panne, dépenses d'un enfant,
 *   durée d'une recherche d'emploi…) sont des hypothèses de jeu, signalées comme telles.
 */
import type { CleParametre, Parametres2026 } from '../data/params/schema.ts'
import { formatMontant, formatPourcentage } from '../lib/format.ts'
import { Aleatoire } from './aleatoire.ts'
import { areJournaliere, JOURS_VERSES_PAR_MOIS } from './chomage.ts'
import { SERIES, type SeriesMarche } from './marches.ts'
import type { ModeMarche } from './modesMarche.ts'
import { brutVersNet } from './salaire.ts'
import {
  avancer,
  bilan,
  changerDeSalaire,
  creerPartie,
  depenser,
  estTerminee,
  modifierFoyer,
  modifierPartie,
  modifierVersements,
  perdreEmploi,
  percevoirPrime,
  valeurEnActions,
  vendreBien,
  vendreDansLaPanique,
  migrerEtat,
  type EtatPartie,
  type Versements,
} from './simulation.ts'

export const VERSION_CARRIERE = 1
export const DUREE_CARRIERE_ANNEES = 20

export const VILLES = ['Toulouse', 'Bordeaux', 'Lyon', 'Paris'] as const
export type Ville = (typeof VILLES)[number]

const CLE_LOYER: Record<Ville, CleParametre> = {
  Toulouse: 'loyers.toulouse',
  Bordeaux: 'loyers.bordeaux',
  Lyon: 'loyers.lyon',
  Paris: 'loyers.paris',
}

export function estVille(texte: unknown): texte is Ville {
  return typeof texte === 'string' && (VILLES as readonly string[]).includes(texte)
}

/** Loyer médian au m² (observatoires des loyers), hors charges. */
export function loyerAuM2(ville: Ville, p: Parametres2026): number {
  const valeur: unknown = p[CLE_LOYER[ville]].valeur
  return typeof valeur === 'number' ? valeur : 0
}

export function loyerMedian(ville: Ville, surface: number, p: Parametres2026): number {
  return Math.round(loyerAuM2(ville, p) * surface)
}

/**
 * Hypothèses de jeu : aucune n'est une donnée officielle. Elles fixent l'ordre de grandeur
 * des événements, et l'écran les signale comme des chiffres du jeu.
 */
export const HYPOTHESES = {
  /** Baisse des actions depuis leur plus haut qui déclenche l'événement « krach ». */
  seuilKrach: -0.2,
  /** Durée pendant laquelle l'argent vendu dans la panique reste en liquidités. */
  moisHorsMarche: 12,
  /** Durée de la pause des versements quand on « attend que ça passe ». */
  moisPauseVersements: 12,
  sangFroid: { vendre: -30, attendre: -10, continuer: 5 },
  rechercheInitialeMois: [3, 8],
  rechercheApresLicenciementMois: [4, 10],
  /** Salaire d'un poste accepté tout de suite plutôt que de continuer à chercher. */
  decotePosteImmediat: 0.08,
  hausseOffreVille: [0.05, 0.12],
  hausseOffreConcurrent: [0.05, 0.12],
  haussePromotion: 0.07,
  fraisDemenagement: 2000,
  prime: [1000, 4000],
  panne: [800, 2500],
  economieSansVoiture: 120,
  depensesParEnfant: 400,
  /** Logement commun : surface multipliée, loyer partagé à deux. */
  surfaceCouple: 1.5,
  revenuConjoint: [0.7, 1.1],
  /** Poids d'une année sans événement, face aux poids des événements possibles. */
  poidsAnneeCalme: 1.5,
  tresorerieInitiale: 3000,
} as const

export type TypeEvenementCarriere =
  | 'recherche'
  | 'offre-ville'
  | 'prime'
  | 'promotion'
  | 'offre-concurrent'
  | 'licenciement'
  | 'couple'
  | 'pacs'
  | 'enfant'
  | 'panne'
  | 'krach'

export interface ChoixCarriere {
  id: 'a' | 'b' | 'c'
  titre: string
  detail: string
}

export interface EvenementCarriere {
  type: TypeEvenementCarriere
  titre: string
  texte: string
  choix: ChoixCarriere[]
  /** Valeurs tirées au hasard, reprises par le choix retenu. */
  valeurs: Record<string, number>
  ville?: Ville
}

export type CleObjectif = 'precaution' | 'residencePrincipale' | 'independance'

export interface BilanAnnee {
  /** Années écoulées (1 = fin de la première année). */
  annee: number
  netReel: number
  tauxEpargne: number
  sangFroid: number
  score: number
}

export interface EtatCarriere {
  version: typeof VERSION_CARRIERE
  partie: EtatPartie
  alea: number
  dureeAnnees: number
  ageDepart: number
  ville: Ville
  /** Surface du logement (choix du joueur). */
  surface: number
  /** Ta part du loyer, en euros du départ (comprise dans les dépenses courantes). */
  loyer: number
  couple: 'seul' | 'couple' | 'cohabitation' | 'pacse'
  enfants: number
  voiture: boolean
  /** Années chez l'employeur actuel. */
  anciennete: number
  sangFroid: number
  evenement: EvenementCarriere | null
  /** Conséquence du dernier choix, affichée jusqu'à l'année suivante. */
  resultat: { titre: string; texte: string } | null
  choix: { annee: number; type: TypeEvenementCarriere; titre: string; choix: string }[]
  bilans: BilanAnnee[]
  objectifs: Record<CleObjectif, number | null>
  krachSignale: boolean
  versementsSuspendus: Versements | null
  repriseVersementsAuMois: number | null
}

export interface ConfigCarriere {
  brutAnnuel: number
  ville: Ville
  surface: number
  /** Dépenses mensuelles hors loyer, en euros du départ. */
  depensesHorsLoyer: number
  graine: number
  mode: Extract<ModeMarche, 'historique' | 'monte-carlo'>
  calendrier: { annee: number; mois: number }
  ageDepart?: number
  dureeAnnees?: number
  /** Mode historique : premier mois rejoué (tiré au hasard par défaut). */
  debutHistorique?: number
}

const euros = (x: number) => formatMontant(x)
const pourcent = (x: number) => formatPourcentage(x, { decimales: 0 })

function entre(alea: Aleatoire, [min, max]: readonly [number, number]): number {
  return min + (max - min) * alea.suivant()
}

function entierEntre(alea: Aleatoire, [min, max]: readonly [number, number]): number {
  return min + alea.entier(max - min + 1)
}

function arrondiCent(x: number): number {
  return Math.round(x / 100) * 100
}

// ------------------------------------------------------------------------- Création

export function creerCarriere(config: ConfigCarriere, p: Parametres2026, series: SeriesMarche = SERIES): EtatCarriere {
  const dureeAnnees = config.dureeAnnees ?? DUREE_CARRIERE_ANNEES
  const loyer = loyerMedian(config.ville, config.surface, p)
  const partie = creerPartie(
    {
      brutAnnuel: config.brutAnnuel,
      depensesMensuelles: config.depensesHorsLoyer + loyer,
      graine: config.graine,
      calendrier: config.calendrier,
      tresorerieInitiale: HYPOTHESES.tresorerieInitiale,
      // Point de départ modifiable par le joueur : un versement mensuel sur le Livret A.
      versements: { livretA: 200 },
      mode: config.mode,
      dureeMois: dureeAnnees * 12,
      ...(config.debutHistorique === undefined ? {} : { debutHistorique: config.debutHistorique }),
    },
    series,
  )
  const alea = new Aleatoire(config.graine ^ 0x5bd1e995)
  const carriere: EtatCarriere = {
    version: VERSION_CARRIERE,
    partie,
    alea: alea.etat,
    dureeAnnees,
    ageDepart: config.ageDepart ?? 23,
    ville: config.ville,
    surface: config.surface,
    loyer,
    couple: 'seul',
    enfants: 0,
    voiture: true,
    anciennete: 0,
    sangFroid: 100,
    evenement: null,
    resultat: null,
    choix: [],
    bilans: [],
    objectifs: { precaution: null, residencePrincipale: null, independance: null },
    krachSignale: false,
    versementsSuspendus: null,
    repriseVersementsAuMois: null,
  }
  // Recherche d'emploi au départ : environ un diplômé sur cinq n'a pas d'emploi six mois
  // après son diplôme (taux net d'emploi de l'enquête CGE).
  const tauxEmploi = p['insertion.ingenieurs.tauxNetEmploi'].valeur
  const tirage = new Aleatoire(carriere.alea)
  if (tirage.suivant() >= tauxEmploi) {
    carriere.alea = tirage.etat
    carriere.evenement = evenementRecherche(carriere, tirage, p)
    carriere.alea = tirage.etat
  } else {
    carriere.alea = tirage.etat
    tirerEvenement(carriere, p)
  }
  return carriere
}

// ------------------------------------------------------------------------- Événements

function netMensuel(partie: EtatPartie, p: Parametres2026): number {
  return brutVersNet(partie.salaire.brutAnnuel, p['cotisations.salarieCadre'].valeur).netAvantImpot / 12
}

function evenementRecherche(c: EtatCarriere, alea: Aleatoire, p: Parametres2026): EvenementCarriere {
  const mois = entierEntre(alea, HYPOTHESES.rechercheInitialeMois)
  const tauxEmploi = p['insertion.ingenieurs.tauxNetEmploi'].valeur
  const brut = c.partie.salaire.brutAnnuel
  const decote = HYPOTHESES.decotePosteImmediat
  return {
    type: 'recherche',
    titre: 'Ton premier emploi se fait attendre',
    texte: `Selon l’enquête 2026 de la Conférence des grandes écoles, ${pourcent(tauxEmploi)} des jeunes ingénieurs ont un emploi six mois après leur diplôme. Pas toi, pas encore : sans emploi précédent, tu n’as pas droit à l’allocation chômage. Tu as ${euros(HYPOTHESES.tresorerieInitiale)} de côté.`,
    choix: [
      {
        id: 'a',
        titre: 'Continuer à chercher le bon poste',
        detail: `Environ ${mois} mois de recherche (chiffre du jeu), puis ${euros(brut)} brut par an.`,
      },
      {
        id: 'b',
        titre: 'Accepter tout de suite un poste moins payé',
        detail: `${euros(brut * (1 - decote))} brut par an, soit ${pourcent(decote)} de moins (chiffre du jeu).`,
      },
    ],
    valeurs: { mois, brut },
  }
}

function autresVilles(c: EtatCarriere): Ville[] {
  return VILLES.filter((v) => v !== c.ville)
}

interface Candidat {
  type: TypeEvenementCarriere
  poids: number
}

function candidats(c: EtatCarriere): Candidat[] {
  const enPoste = c.partie.emploi.enPoste
  const annee = c.bilans.length
  const liste: Candidat[] = []
  if (enPoste) {
    liste.push({ type: 'offre-ville', poids: 0.6 })
    liste.push({ type: 'prime', poids: 1.2 })
    // Les promotions deviennent plus probables avec l'ancienneté (au moins un an dans l'entreprise).
    if (c.anciennete >= 1) liste.push({ type: 'promotion', poids: Math.min(1, 0.15 * c.anciennete) })
    liste.push({ type: 'offre-concurrent', poids: 0.6 })
    if (annee >= 2) liste.push({ type: 'licenciement', poids: 0.5 })
  }
  if (c.couple === 'seul') liste.push({ type: 'couple', poids: 1 })
  if (c.couple === 'couple' || c.couple === 'cohabitation') liste.push({ type: 'pacs', poids: 0.8 })
  if ((c.couple === 'cohabitation' || c.couple === 'pacse') && c.enfants < 3) liste.push({ type: 'enfant', poids: 0.7 })
  if (c.voiture) liste.push({ type: 'panne', poids: 0.8 })
  return liste
}

/** Tire l'événement de l'année qui commence. */
function tirerEvenement(c: EtatCarriere, p: Parametres2026): void {
  const alea = new Aleatoire(c.alea)
  const liste = candidats(c)
  // Certaines années passent sans événement.
  const total = liste.reduce((s, x) => s + x.poids, 0) + HYPOTHESES.poidsAnneeCalme
  let tirage = alea.suivant() * total
  let type: TypeEvenementCarriere | null = null
  for (const x of liste) {
    tirage -= x.poids
    if (tirage < 0) {
      type = x.type
      break
    }
  }
  c.evenement = type ? construireEvenement(c, type, alea, p) : null
  c.alea = alea.etat
}

function construireEvenement(
  c: EtatCarriere,
  type: TypeEvenementCarriere,
  alea: Aleatoire,
  p: Parametres2026,
): EvenementCarriere | null {
  const brut = c.partie.salaire.brutAnnuel
  const indice = c.partie.indicePrix
  switch (type) {
    case 'offre-ville': {
      const villes = autresVilles(c)
      const ville = villes[alea.entier(villes.length)] ?? 'Toulouse'
      const hausse = entre(alea, HYPOTHESES.hausseOffreVille)
      const loyerNouveau = loyerMedian(ville, c.surface, p)
      return {
        type,
        ville,
        titre: `Une offre à ${ville}`,
        texte: `Une entreprise de ${ville} te propose ${pourcent(hausse)} de salaire en plus. Le loyer médian y est de ${formatMontant(loyerAuM2(ville, p), { decimales: 1 })} le m² hors charges, contre ${formatMontant(loyerAuM2(c.ville, p), { decimales: 1 })} à ${c.ville} (observatoires des loyers).`,
        choix: [
          {
            id: 'a',
            titre: `Accepter et déménager à ${ville}`,
            detail: `${euros(brut * (1 + hausse))} brut par an. Loyer de ${euros(loyerNouveau * indice)} pour ${c.surface} m², déménagement de ${euros(HYPOTHESES.fraisDemenagement)} (chiffre du jeu).`,
          },
          { id: 'b', titre: `Rester à ${c.ville}`, detail: `Ton loyer reste de ${euros(c.loyer * indice)} par mois.` },
        ],
        valeurs: { hausse, loyerNouveau },
      }
    }
    case 'prime': {
      const montant = arrondiCent(entre(alea, HYPOTHESES.prime) * indice)
      return {
        type,
        titre: 'Une prime exceptionnelle',
        texte: `Ton équipe a bien travaillé : tu reçois une prime de ${euros(montant)} brut. Elle est soumise aux cotisations et à l’impôt, comme ton salaire.`,
        choix: [
          { id: 'a', titre: 'La mettre de côté', detail: 'Elle rejoint ton compte, et tes versements habituels la placent.' },
          { id: 'b', titre: 'Te faire plaisir', detail: 'Un voyage, un vélo neuf : tu la dépenses entièrement.' },
        ],
        valeurs: { montant },
      }
    }
    case 'promotion': {
      const hausse = HYPOTHESES.haussePromotion
      return {
        type,
        titre: 'Une promotion',
        texte: `Après ${c.anciennete} an${c.anciennete > 1 ? 's' : ''} dans l’entreprise, on te propose d’encadrer une équipe : ${pourcent(hausse)} de salaire en plus (chiffre du jeu), mais plus de responsabilités.`,
        choix: [
          { id: 'a', titre: 'Accepter', detail: `${euros(brut * (1 + hausse))} brut par an.` },
          { id: 'b', titre: 'Refuser pour l’instant', detail: 'Ton salaire continue d’évoluer comme avant.' },
        ],
        valeurs: { hausse },
      }
    }
    case 'offre-concurrent': {
      const hausse = entre(alea, HYPOTHESES.hausseOffreConcurrent)
      const perdAbondement = c.partie.epargneSalariale.abondementTaux > 0
      return {
        type,
        titre: 'Un concurrent te contacte',
        texte: `Une entreprise de ${c.ville} te propose ${pourcent(hausse)} de salaire en plus, sans déménager.${perdAbondement ? ' Mais elle n’a pas de plan d’épargne entreprise : tu perdrais l’abondement de ton employeur actuel.' : ''}`,
        choix: [
          {
            id: 'a',
            titre: 'Changer d’employeur',
            detail: `${euros(brut * (1 + hausse))} brut par an. Ton ancienneté repart de zéro.`,
          },
          { id: 'b', titre: 'Rester', detail: 'Tu gardes ton poste, ton ancienneté et tes avantages.' },
        ],
        valeurs: { hausse },
      }
    }
    case 'licenciement': {
      const mois = entierEntre(alea, HYPOTHESES.rechercheApresLicenciementMois)
      return {
        type,
        titre: 'Licenciement économique',
        texte: `Ton entreprise supprime ton poste. Tu t’inscris à France Travail : ta recherche devrait durer environ ${mois} mois (chiffre du jeu). Pendant ce temps, l’allocation chômage remplace une partie de ton salaire.`,
        choix: [
          { id: 'a', titre: 'Garder tes versements', detail: 'Tu continues à épargner chaque mois, si ton compte le permet.' },
          { id: 'b', titre: 'Suspendre tes versements', detail: 'Tu gardes ton argent disponible jusqu’à ton prochain emploi.' },
        ],
        valeurs: { mois },
      }
    }
    case 'couple': {
      const surfaceCommune = Math.round(c.surface * HYPOTHESES.surfaceCouple)
      const ville = c.ville
      const part = loyerMedian(ville, surfaceCommune, p) / 2
      const proprietaire = estProprietaire(c.partie)
      return {
        type,
        titre: 'Une rencontre',
        texte: proprietaire
          ? 'Ça devient sérieux. Vivre ensemble chez toi, c’est un grand pas.'
          : 'Ça devient sérieux. Vivre ensemble partagerait le loyer, mais c’est un grand pas.',
        choix: [
          {
            id: 'a',
            titre: 'Emménager ensemble',
            detail: proprietaire
              ? 'Ton conjoint s’installe chez toi.'
              : `${surfaceCommune} m² à deux : ta part du loyer passe à ${euros(part * indice)} par mois.`,
          },
          { id: 'b', titre: 'Chacun chez soi pour l’instant', detail: 'Rien ne change pour ton budget.' },
        ],
        valeurs: { surfaceCommune, part },
      }
    }
    case 'pacs': {
      const ratio = entre(alea, HYPOTHESES.revenuConjoint)
      const tiens = brutVersNet(brut, p['cotisations.salarieCadre'].valeur).netImposable
      const revenuConjoint = (tiens * ratio) / indice
      return {
        type,
        titre: 'Se pacser ?',
        texte: `Pacsés ou mariés, vous déclarez vos revenus ensemble : l’impôt du foyer est calculé sur deux parts. Ton conjoint gagne environ ${euros(revenuConjoint * indice)} net imposable par an (chiffre du jeu).`,
        choix: [
          { id: 'a', titre: 'Se pacser', detail: 'Imposition commune dès la prochaine déclaration.' },
          { id: 'b', titre: 'Rester en union libre', detail: 'Chacun continue de déclarer seul.' },
        ],
        valeurs: { revenuConjoint },
      }
    }
    case 'enfant': {
      return {
        type,
        titre: 'Un enfant ?',
        texte: `Un enfant à charge ajoute une demi-part au quotient familial (module 1), mais aussi des dépenses : ${euros(HYPOTHESES.depensesParEnfant * indice)} par mois dans le jeu.`,
        choix: [
          { id: 'a', titre: 'Agrandir la famille', detail: `+${euros(HYPOTHESES.depensesParEnfant * indice)} de dépenses par mois.` },
          { id: 'b', titre: 'Pas maintenant', detail: 'Rien ne change.' },
        ],
        valeurs: {},
      }
    }
    case 'panne': {
      const cout = arrondiCent(entre(alea, HYPOTHESES.panne) * indice)
      return {
        type,
        titre: 'Ta voiture tombe en panne',
        texte: `Le garagiste annonce ${euros(cout)} de réparation. C’est exactement à ça que sert une épargne de précaution.`,
        choix: [
          { id: 'a', titre: 'Réparer', detail: `${euros(cout)}, pris sur ton compte puis sur tes livrets.` },
          {
            id: 'b',
            titre: 'Te passer de voiture',
            detail: `Vélo et transports : ${euros(HYPOTHESES.economieSansVoiture * indice)} de dépenses en moins chaque mois (chiffre du jeu).`,
          },
        ],
        valeurs: { cout },
      }
    }
    case 'krach':
    case 'recherche':
      return null
  }
}

function evenementKrach(c: EtatCarriere): EvenementCarriere {
  const baisse = c.partie.indiceMarche.niveau / c.partie.indiceMarche.sommet - 1
  const enActions = valeurEnActions(c.partie)
  return {
    type: 'krach',
    titre: `Krach : les actions perdent ${pourcent(-baisse)}`,
    texte: `Depuis leur plus haut, les actions ont perdu ${pourcent(-baisse)}. Tes placements en actions valent maintenant ${euros(enActions)}. Les gros titres parlent de panique. Que fais-tu ?`,
    choix: [
      {
        id: 'a',
        titre: 'Tout vendre pour limiter la casse',
        detail: `Tu sors des marchés et tu rachètes dans ${HYPOTHESES.moisHorsMarche} mois.`,
      },
      {
        id: 'b',
        titre: 'Attendre que ça passe',
        detail: `Tu gardes tes parts, sans verser pendant ${HYPOTHESES.moisPauseVersements} mois.`,
      },
      { id: 'c', titre: 'Continuer comme prévu', detail: 'Tu gardes tes parts et tu continues à verser.' },
    ],
    valeurs: { baisse },
  }
}

// ----------------------------------------------------------------------------- Choix

const VERSEMENTS_ACTIONS: readonly (keyof Versements)[] = ['pea', 'cto', 'assuranceVie', 'per', 'pee']

function suspendreVersements(c: EtatCarriere, cles: readonly (keyof Versements)[], jusquAuMois: number): void {
  if (c.versementsSuspendus === null) c.versementsSuspendus = { ...c.partie.versements }
  c.repriseVersementsAuMois = Math.max(c.repriseVersementsAuMois ?? 0, jusquAuMois)
  c.partie = modifierVersements(c.partie, Object.fromEntries(cles.map((k) => [k, 0])))
}

function changerDepenses(c: EtatCarriere, delta: number): void {
  c.partie = modifierPartie(c.partie, { depensesMensuelles: Math.max(0, c.partie.depensesMensuelles + delta) })
}

function changerLoyer(c: EtatCarriere, nouveau: number): void {
  changerDepenses(c, nouveau - c.loyer)
  c.loyer = nouveau
}

/** Applique le choix du joueur à l'événement en cours. */
export function choisir(carriere: EtatCarriere, id: ChoixCarriere['id'], p: Parametres2026): EtatCarriere {
  const evenement = carriere.evenement
  if (!evenement) return carriere
  const choix = evenement.choix.find((x) => x.id === id)
  if (!choix) return carriere
  const c = structuredClone(carriere)
  const v = evenement.valeurs
  const brut = c.partie.salaire.brutAnnuel
  const annee = c.bilans.length + 1
  let resultat: { titre: string; texte: string } = { titre: choix.titre, texte: choix.detail }

  switch (evenement.type) {
    case 'recherche': {
      if (id === 'a') {
        const mois = v.mois ?? 6
        c.partie = perdreEmploi(c.partie, p, {
          moisRecherche: mois,
          brutReprise: v.brut ?? brut,
          titre: 'Recherche d’emploi',
          detail: `Sans emploi précédent, pas d’allocation chômage : tu vis sur ton épargne pendant ta recherche.`,
        })
        resultat = { titre: 'Tu continues à chercher', texte: `Environ ${mois} mois sans salaire, puis un poste à ${euros(v.brut ?? brut)} brut par an.` }
      } else {
        const nouveau = brut * (1 - HYPOTHESES.decotePosteImmediat)
        c.partie = changerDeSalaire(c.partie, nouveau, 'Premier emploi', `Tu acceptes un poste à ${euros(nouveau)} brut par an.`)
        resultat = { titre: 'Tu commences tout de suite', texte: `Ton salaire de départ : ${euros(nouveau)} brut par an.` }
      }
      break
    }
    case 'offre-ville': {
      if (id === 'a' && evenement.ville) {
        const nouveau = brut * (1 + (v.hausse ?? 0))
        c.partie = changerDeSalaire(c.partie, nouveau, `Nouveau poste à ${evenement.ville}`, `${euros(nouveau)} brut par an.`)
        c.partie = depenser(c.partie, HYPOTHESES.fraisDemenagement * c.partie.indicePrix, 'Déménagement', `${euros(HYPOTHESES.fraisDemenagement * c.partie.indicePrix)} de frais de déménagement.`)
        // Propriétaire : tu vends ton logement avant de partir, et tu redeviens locataire.
        for (const bien of c.partie.biens.filter((b) => b.usage === 'residence-principale')) {
          c.partie = vendreBien(c.partie, bien.id)
        }
        const surface = c.couple === 'seul' || c.couple === 'couple' ? c.surface : Math.round(c.surface * HYPOTHESES.surfaceCouple)
        const loyer = loyerMedian(evenement.ville, surface, p) / (c.couple === 'seul' || c.couple === 'couple' ? 1 : 2)
        changerLoyer(c, loyer)
        c.ville = evenement.ville
        c.anciennete = 0
        resultat = { titre: `Direction ${evenement.ville}`, texte: `Salaire de ${euros(nouveau)} brut par an, loyer de ${euros(loyer * c.partie.indicePrix)} par mois.` }
      }
      break
    }
    case 'prime': {
      const montant = v.montant ?? 0
      const avant = c.partie.courant
      c.partie = percevoirPrime(c.partie, montant, p)
      const net = c.partie.courant - avant
      if (id === 'b') {
        c.partie = depenser(c.partie, net, 'Un plaisir', `${euros(net)} dépensés.`)
        resultat = { titre: 'Tu t’es fait plaisir', texte: `${euros(net)} dépensés, après cotisations et impôt.` }
      } else {
        resultat = { titre: 'Prime mise de côté', texte: `${euros(net)} arrivent sur ton compte, après cotisations et impôt.` }
      }
      break
    }
    case 'promotion':
    case 'offre-concurrent': {
      if (id === 'a') {
        const nouveau = brut * (1 + (v.hausse ?? 0))
        const titre = evenement.type === 'promotion' ? 'Promotion' : 'Nouvel employeur'
        c.partie = changerDeSalaire(c.partie, nouveau, titre, `${euros(nouveau)} brut par an.`)
        if (evenement.type === 'offre-concurrent') {
          c.anciennete = 0
          c.partie = { ...c.partie, epargneSalariale: { ...c.partie.epargneSalariale, abondementTaux: 0, abondementPlafond: 0 } }
        }
        resultat = { titre, texte: `Ton salaire passe à ${euros(nouveau)} brut par an.` }
      }
      break
    }
    case 'licenciement': {
      const mois = v.mois ?? 6
      c.partie = perdreEmploi(c.partie, p, {
        moisRecherche: mois,
        brutReprise: brut,
        titre: 'Licenciement économique',
        detail: 'Tu t’inscris à France Travail.',
      })
      c.anciennete = 0
      const droits = c.partie.emploi.droitsAre
      if (id === 'b') suspendreVersements(c, Object.keys(c.partie.versements) as (keyof Versements)[], c.partie.mois + mois)
      resultat = droits
        ? {
            titre: 'Tes droits au chômage',
            texte: `Allocation d’environ ${euros(areJournaliere(droits, p).net * JOURS_VERSES_PAR_MOIS)} net par mois, pendant ${droits.joursTotal} jours au plus.`,
          }
        : { titre: 'Pas de droits au chômage', texte: 'Tu n’as pas assez travaillé pour ouvrir des droits : tu vis sur ton épargne.' }
      break
    }
    case 'couple': {
      if (id === 'a' && estProprietaire(c.partie)) {
        c.couple = 'cohabitation'
        resultat = { titre: 'Vous emménagez ensemble', texte: 'Ton conjoint s’installe dans ton logement.' }
      } else if (id === 'a') {
        c.couple = 'cohabitation'
        changerLoyer(c, v.part ?? c.loyer)
        resultat = { titre: 'Vous emménagez ensemble', texte: `Ta part du loyer : ${euros((v.part ?? c.loyer) * c.partie.indicePrix)} par mois.` }
      } else {
        c.couple = 'couple'
      }
      break
    }
    case 'pacs': {
      if (id === 'a') {
        c.couple = 'pacse'
        c.partie = modifierFoyer(c.partie, { ...c.partie.foyer, situation: 'couple' }, v.revenuConjoint ?? 0)
        resultat = { titre: 'Vous êtes pacsés', texte: 'Votre prochaine déclaration sera commune : deux parts, et un taux de prélèvement commun.' }
      }
      break
    }
    case 'enfant': {
      if (id === 'a') {
        c.enfants += 1
        // Simplification : l'enfant est rattaché à ta déclaration (commune si vous êtes pacsés).
        c.partie = modifierFoyer(c.partie, { ...c.partie.foyer, enfantsACharge: c.partie.foyer.enfantsACharge + 1 })
        changerDepenses(c, HYPOTHESES.depensesParEnfant)
        resultat = { titre: 'Bienvenue au bébé', texte: `${euros(HYPOTHESES.depensesParEnfant * c.partie.indicePrix)} de dépenses en plus chaque mois.` }
      }
      break
    }
    case 'panne': {
      if (id === 'a') {
        const cout = v.cout ?? 0
        c.partie = depenser(c.partie, cout, 'Réparation de la voiture', `${euros(cout)} de réparation.`)
        resultat = { titre: 'Voiture réparée', texte: `${euros(cout)} payés.` }
      } else {
        c.voiture = false
        changerDepenses(c, -HYPOTHESES.economieSansVoiture)
        resultat = { titre: 'Sans voiture', texte: `${euros(HYPOTHESES.economieSansVoiture * c.partie.indicePrix)} de dépenses en moins chaque mois.` }
      }
      break
    }
    case 'krach': {
      if (id === 'a') {
        c.partie = vendreDansLaPanique(c.partie, HYPOTHESES.moisHorsMarche)
        c.sangFroid = Math.max(0, c.sangFroid + HYPOTHESES.sangFroid.vendre)
        resultat = { titre: 'Tu as tout vendu', texte: `Ta jauge de sang-froid baisse de ${-HYPOTHESES.sangFroid.vendre} points.` }
      } else if (id === 'b') {
        suspendreVersements(c, VERSEMENTS_ACTIONS, c.partie.mois + HYPOTHESES.moisPauseVersements)
        c.sangFroid = Math.max(0, c.sangFroid + HYPOTHESES.sangFroid.attendre)
        resultat = { titre: 'Tu attends', texte: `Tes versements en actions s’arrêtent pour ${HYPOTHESES.moisPauseVersements} mois. Sang-froid : −${-HYPOTHESES.sangFroid.attendre} points.` }
      } else {
        c.sangFroid = Math.min(100, c.sangFroid + HYPOTHESES.sangFroid.continuer)
        resultat = { titre: 'Tu tiens le cap', texte: `Tu continues à verser. Sang-froid : +${HYPOTHESES.sangFroid.continuer} points.` }
      }
      break
    }
  }
  c.choix.push({ annee, type: evenement.type, titre: evenement.titre, choix: choix.titre })
  c.evenement = null
  c.resultat = resultat
  return c
}

// ------------------------------------------------------------------- Bilan et score

export function estCarriereTerminee(c: EtatCarriere): boolean {
  return c.partie.mois >= c.dureeAnnees * 12 || estTerminee(c.partie)
}

export function ageActuel(c: EtatCarriere): number {
  return c.ageDepart + Math.floor(c.partie.mois / 12)
}

/** Part des revenus nets (salaires, allocations, primes, après impôt) non dépensée. */
export function tauxEpargne(partie: EtatPartie): number {
  const k = partie.cumuls
  const revenus = k.salairesNets + k.allocationsChomage + k.primes
  return revenus > 0 ? Math.max(0, 1 - k.depenses / revenus) : 0
}

export interface Objectif {
  cle: CleObjectif
  titre: string
  detail: string
  atteint: boolean
}

/**
 * Trois objectifs (cahier des charges) : une épargne de précaution de 3 mois de revenus (bas
 * de la fourchette de 3 à 6 mois du portail de la Banque de France, voir le module 0), l'achat
 * de la résidence principale, et l'indépendance financière, définie dans le jeu comme un
 * patrimoine de 25 années de dépenses.
 */
export function objectifs(c: EtatCarriere, p: Parametres2026): Objectif[] {
  const partie = c.partie
  const b = bilan(partie, p)
  const net = netMensuel(partie, p)
  const depensesAnnuelles = partie.depensesMensuelles * partie.indicePrix * 12
  return [
    {
      cle: 'precaution',
      titre: 'Épargne de précaution',
      detail: `3 mois de revenus sur tes livrets : ${euros(3 * net)}.`,
      atteint: c.objectifs.precaution !== null || b.livrets >= 3 * net,
    },
    {
      cle: 'residencePrincipale',
      titre: 'Résidence principale',
      detail: 'Acheter ton logement (avec le module 6).',
      atteint: c.objectifs.residencePrincipale !== null || estProprietaire(partie),
    },
    {
      cle: 'independance',
      titre: 'Indépendance financière',
      detail: `25 années de dépenses : ${euros(25 * depensesAnnuelles)} (objectif du jeu).`,
      atteint: c.objectifs.independance !== null || b.net >= 25 * depensesAnnuelles,
    },
  ]
}

export interface DetailScore {
  patrimoine: number
  epargne: number
  objectifs: number
  sangFroid: number
  total: number
}

/**
 * Score sur 1 000 : jusqu'à 400 points pour le patrimoine net (100 par année de salaire net),
 * 200 pour le taux d'épargne (10 points par point de pourcentage), 100 par objectif atteint et
 * la jauge de sang-froid (sur 100).
 */
export function score(c: EtatCarriere, p: Parametres2026): DetailScore {
  const b = bilan(c.partie, p)
  const salaireAnnuel = netMensuel(c.partie, p) * 12
  const patrimoine = Math.round(Math.max(0, Math.min(400, salaireAnnuel > 0 ? (100 * b.net) / salaireAnnuel : 0)))
  const epargne = Math.round(Math.min(200, tauxEpargne(c.partie) * 1000))
  const nbObjectifs = objectifs(c, p).filter((o) => o.atteint).length
  const sangFroid = Math.round(c.sangFroid)
  return { patrimoine, epargne, objectifs: nbObjectifs * 100, sangFroid, total: patrimoine + epargne + nbObjectifs * 100 + sangFroid }
}

function cloreAnnee(c: EtatCarriere, p: Parametres2026): void {
  const annee = Math.floor(c.partie.mois / 12)
  for (const o of objectifs(c, p)) {
    if (o.atteint && c.objectifs[o.cle] === null) c.objectifs[o.cle] = annee
  }
  if (c.partie.emploi.enPoste) c.anciennete += 1
  c.bilans.push({
    annee,
    netReel: bilan(c.partie, p).netReel,
    tauxEpargne: tauxEpargne(c.partie),
    sangFroid: c.sangFroid,
    score: score(c, p).total,
  })
}

/**
 * Avance jusqu'à la fin de l'année en cours. S'arrête plus tôt si un krach survient : le
 * joueur choisit, puis reprend. L'événement de l'année suivante est tiré à la fin de l'année.
 */
export function avancerAnnee(carriere: EtatCarriere, p: Parametres2026, series: SeriesMarche = SERIES): EtatCarriere {
  if (carriere.evenement || estCarriereTerminee(carriere)) return carriere
  const c = structuredClone(carriere)
  c.resultat = null
  const finAnnee = (Math.floor(c.partie.mois / 12) + 1) * 12
  while (c.partie.mois < finAnnee && !estCarriereTerminee(c)) {
    if (c.repriseVersementsAuMois !== null && c.partie.mois >= c.repriseVersementsAuMois && c.versementsSuspendus) {
      c.partie = modifierVersements(c.partie, c.versementsSuspendus)
      c.versementsSuspendus = null
      c.repriseVersementsAuMois = null
    }
    c.partie = avancer(c.partie, p, 1, series)
    const baisse = c.partie.indiceMarche.niveau / c.partie.indiceMarche.sommet - 1
    // Un nouveau krach peut être signalé une fois les actions revenues près de leur plus haut.
    if (baisse > -0.05) c.krachSignale = false
    if (
      !c.krachSignale &&
      baisse <= HYPOTHESES.seuilKrach &&
      c.partie.horsMarcheJusquAuMois === null &&
      valeurEnActions(c.partie) >= 1000
    ) {
      c.krachSignale = true
      c.evenement = evenementKrach(c)
      break
    }
  }
  if (c.partie.mois >= finAnnee || estCarriereTerminee(c)) {
    cloreAnnee(c, p)
    if (!c.evenement && !estCarriereTerminee(c)) tirerEvenement(c, p)
  }
  return c
}

export function estProprietaire(partie: EtatPartie): boolean {
  return partie.biens.some((b) => b.usage === 'residence-principale')
}

/**
 * Après un achat ou une vente immobilière décidés par le joueur : en achetant ta résidence
 * principale, ton loyer sort de tes dépenses (le moteur l'a déjà retiré) ; en la vendant, tu
 * redeviens locataire au loyer médian de ta ville.
 */
export function apresOperationImmobiliere(c: EtatCarriere, partie: EtatPartie, p: Parametres2026): EtatCarriere {
  const suivant = { ...c, partie }
  const avant = estProprietaire(c.partie)
  const apres = estProprietaire(partie)
  if (!avant && apres) {
    suivant.loyer = 0
    if (suivant.objectifs.residencePrincipale === null) {
      suivant.objectifs = { ...suivant.objectifs, residencePrincipale: Math.floor(partie.mois / 12) }
    }
  } else if (avant && !apres) {
    const enCouple = c.couple === 'cohabitation' || c.couple === 'pacse'
    const surface = enCouple ? Math.round(c.surface * HYPOTHESES.surfaceCouple) : c.surface
    const loyer = loyerMedian(c.ville, surface, p) / (enCouple ? 2 : 1)
    suivant.partie = modifierPartie(partie, { depensesMensuelles: partie.depensesMensuelles + loyer })
    suivant.loyer = loyer
  }
  return suivant
}

/** Mise à jour des versements par le joueur (pendant une pause, elle s'applique à la reprise). */
export function modifierVersementsCarriere(c: EtatCarriere, versements: Partial<Versements>): EtatCarriere {
  if (c.versementsSuspendus) {
    return { ...c, versementsSuspendus: { ...c.versementsSuspendus, ...versements } }
  }
  return { ...c, partie: modifierVersements(c.partie, versements) }
}

/** Relit une carrière enregistrée ; null si l'objet n'en est pas une. */
export function lireCarriere(brut: unknown): EtatCarriere | null {
  if (typeof brut !== 'object' || brut === null || !('version' in brut) || !('partie' in brut)) return null
  if (brut.version !== VERSION_CARRIERE) return null
  const c = brut as EtatCarriere & { objectifs: Partial<Record<string, number | null>> }
  const partie = migrerEtat(c.partie)
  if (!partie) return null
  // Phase 4 : l'objectif « un an de salaire » laisse sa place à la résidence principale.
  return {
    ...c,
    partie,
    objectifs: {
      precaution: c.objectifs.precaution ?? null,
      residencePrincipale: c.objectifs.residencePrincipale ?? null,
      independance: c.objectifs.independance ?? null,
    },
  }
}
