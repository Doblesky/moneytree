/**
 * Les dix modules du parcours (cahier des charges, « Partie théorique ») : titre, accroche
 * de la carte de progression, contenu clé, phase de développement qui apporte le contenu,
 * et ce que chaque module ajoute au simulateur une fois son palier Découverte maîtrisé.
 * S'y ajoutent les modules propres à un profil de métier, et les variantes du tronc commun
 * pour ce profil (src/profils/metiers.ts).
 */
import { METIERS, type IdMetier } from '../profils/metiers.ts'
import glossaireBrut from './glossaire.json'
import module0 from './modules/module-0.json'
import module1 from './modules/module-1.json'
import module2 from './modules/module-2.json'
import module3 from './modules/module-3.json'
import module4 from './modules/module-4.json'
import module5 from './modules/module-5.json'
import module6 from './modules/module-6.json'
import module7 from './modules/module-7.json'
import module8 from './modules/module-8.json'
import module9 from './modules/module-9.json'
import module10 from './modules/module-10.json'
import module11 from './modules/module-11.json'
import module12 from './modules/module-12.json'
import module13 from './modules/module-13.json'
import module14 from './modules/module-14.json'
import module15 from './modules/module-15.json'
import variantesProf from './profils/prof-second-degre.json'
import {
  schemaContenuModule,
  schemaGlossaire,
  schemaVariantes,
  type ContenuModule,
  type Glossaire,
  type Palier,
  type Question,
  type VarianteModule,
} from './schema.ts'

export const NOMS_PALIERS = [
  'Découverte',
  'Investisseur autonome',
  'Investisseur averti',
  'Expert',
  'Professionnel',
] as const

export const NOMBRE_PALIERS = 5

/** Leviers du simulateur et ce qui les débloque. */
export type Levier =
  | 'detailImpot'
  | 'optionBareme'
  | 'ldds'
  | 'lep'
  | 'monteCarlo'
  | 'scenarios'
  | 'pea'
  | 'assuranceVie'
  | 'per'
  | 'epargneSalariale'
  | 'immobilier'
  | 'credit'
  | 'actionsIndividuelles'

export interface InfoLevier {
  nom: string
  module: number
  /** Palier du module qui débloque le levier (1, le palier Découverte, par défaut). */
  palier?: number
  /** Le levier existe déjà dans le moteur (sinon : phase ultérieure). */
  disponible: boolean
  description: string
}

export const LEVIERS: Record<Levier, InfoLevier> = {
  detailImpot: {
    nom: 'Détail de l’impôt',
    module: 1,
    disponible: true,
    description: 'Ton revenu imposable, ta tranche marginale, ton taux moyen et ton taux de prélèvement.',
  },
  optionBareme: {
    nom: 'Option barème',
    module: 1,
    disponible: true,
    description: 'Choisir le barème progressif plutôt que le PFU pour tes plus-values.',
  },
  ldds: {
    nom: 'LDDS',
    module: 2,
    disponible: true,
    description: 'Un deuxième livret réglementé, au même taux que le Livret A.',
  },
  lep: {
    nom: 'LEP',
    module: 2,
    disponible: true,
    description: 'Le livret le mieux rémunéré, réservé aux revenus modestes.',
  },
  monteCarlo: {
    nom: 'Monte Carlo',
    module: 3,
    disponible: true,
    description: 'Des trajectoires tirées dans l’historique pour lire une fourchette plutôt qu’une courbe.',
  },
  scenarios: {
    nom: 'Scénarios de crise',
    module: 5,
    disponible: true,
    description: 'Krach la première année, décennie perdue, inflation : tester la robustesse de ta stratégie.',
  },
  pea: {
    nom: 'PEA',
    module: 4,
    disponible: true,
    description: 'Une enveloppe dédiée aux actions, exonérée d’impôt sur le revenu après 5 ans.',
  },
  assuranceVie: {
    nom: 'Assurance-vie',
    module: 4,
    disponible: true,
    description: 'Fonds en euros et unités de compte, une fiscalité qui s’allège après 8 ans.',
  },
  per: {
    nom: 'PER',
    module: 4,
    disponible: true,
    description: 'Des versements déduits de ton revenu imposable, bloqués jusqu’à la retraite.',
  },
  epargneSalariale: {
    nom: 'Épargne salariale',
    module: 4,
    disponible: true,
    description: 'PEE, abondement de l’employeur, intéressement et participation.',
  },
  immobilier: {
    nom: 'Immobilier',
    module: 6,
    disponible: true,
    description: 'Acheter ta résidence principale ou un bien à louer.',
  },
  credit: {
    nom: 'Crédit',
    module: 6,
    disponible: true,
    description: 'Emprunter, avec les règles du HCSF vérifiées à la souscription.',
  },
  actionsIndividuelles: {
    nom: 'Actions individuelles',
    module: 3,
    palier: 4,
    disponible: true,
    description: 'Choisir des actions de sociétés fictives d’après leurs comptes simplifiés.',
  },
}

export interface InfoModule {
  id: number
  titre: string
  accroche: string
  contenuCle: string
  /** Phase du cahier des charges qui apporte les cours de ce module. */
  phase: number
  leviers: Levier[]
}

export const MODULES: readonly InfoModule[] = [
  {
    id: 0,
    titre: 'Bases',
    accroche: 'Budget, intérêts, inflation : le socle de tout le reste.',
    contenuCle: 'Brut et net, budget, épargne de précaution, intérêts composés, inflation et rendement réel.',
    phase: 1,
    leviers: [],
  },
  {
    id: 1,
    titre: 'Fiscalité perso',
    accroche: 'Ce que l’impôt prélève vraiment sur ta fiche de paie.',
    contenuCle: 'Barème de l’impôt, quotient familial, tranche marginale et taux moyen, prélèvement à la source, PFU.',
    phase: 1,
    leviers: ['detailImpot', 'optionBareme'],
  },
  {
    id: 2,
    titre: 'Épargne réglementée',
    accroche: 'Les livrets : à quoi ils servent, et à quoi ils ne servent pas.',
    contenuCle: 'Livret A, LDDS, LEP, PEL et CEL, fonds en euros.',
    phase: 1,
    leviers: ['ldds', 'lep'],
  },
  {
    id: 3,
    titre: 'Marchés financiers',
    accroche: 'Actions, obligations, indices : ce qui se passe derrière une courbe.',
    contenuCle:
      'Actions, obligations, indices, ETF, couple risque/rendement, volatilité, drawdown, diversification, devises.',
    phase: 2,
    leviers: ['monteCarlo'],
  },
  {
    id: 4,
    titre: 'Enveloppes',
    accroche: 'Le même placement, des règles différentes selon l’enveloppe.',
    contenuCle:
      'CTO, PEA, assurance-vie, PER, épargne salariale (PEE, PERCOL, intéressement, participation, abondement).',
    phase: 2,
    leviers: ['pea', 'assuranceVie', 'per', 'epargneSalariale'],
  },
  {
    id: 5,
    titre: 'Stratégies',
    accroche: 'Investir régulièrement, rééquilibrer, tenir dans la durée.',
    contenuCle:
      'Investissement progressif ou en une fois, allocation selon l’horizon, rééquilibrage, frais, biais comportementaux.',
    phase: 2,
    leviers: ['scenarios'],
  },
  {
    id: 6,
    titre: 'Immobilier',
    accroche: 'Acheter, louer, emprunter : refaire les calculs soi-même.',
    contenuCle:
      'Louer ou acheter, crédit et assurance emprunteur, règles HCSF, frais de notaire, PTZ, location nue ou LMNP, SCPI.',
    phase: 4,
    leviers: ['immobilier', 'credit'],
  },
  {
    id: 7,
    titre: 'Autres actifs',
    accroche: 'Or, cryptos, non coté : regarder les risques en face.',
    contenuCle: 'Or, cryptos, obligations d’entreprise, financement participatif, capital-investissement.',
    phase: 4,
    leviers: [],
  },
  {
    id: 8,
    titre: 'Carrière et vie',
    accroche: 'Mobilité, enfants, pauses : ce qui change vraiment tes finances.',
    contenuCle:
      'Évolution du salaire, négociation, changement d’employeur, chômage, couple, enfants, retraite.',
    phase: 3,
    leviers: [],
  },
  {
    id: 9,
    titre: 'Pièges',
    accroche: 'Frais cachés, promesses de rendement, biais : apprendre à les repérer.',
    contenuCle:
      'Arnaques et listes noires de l’AMF, frais cachés, produits structurés, conseillers payés à la commission.',
    phase: 4,
    leviers: [],
  },
]

/**
 * Modules propres au profil « futur·e prof » (src/profils/metiers.ts) : ils n'apparaissent
 * que dans le parcours de ce profil.
 */
export const MODULES_PROF: readonly InfoModule[] = [
  {
    id: 10,
    titre: 'Devenir prof',
    accroche: 'Le concours, le master, deux années payées, puis la titularisation.',
    contenuCle:
      'Concours dès la licence, master M2E, élève fonctionnaire puis fonctionnaire stagiaire, titularisation, engagement de servir.',
    phase: 6,
    leviers: [],
  },
  {
    id: 11,
    titre: 'Ta fiche de paie',
    accroche: 'Traitement, indice, primes : lire chaque ligne de ton bulletin.',
    contenuCle: 'Traitement indiciaire, point d’indice, grille et échelons, cotisations, primes et indemnités.',
    phase: 6,
    leviers: [],
  },
  {
    id: 12,
    titre: 'Mutations',
    accroche: 'Où tu enseignes, et ce que ça change pour ton budget.',
    contenuCle: 'Mouvements inter et intra-académique, barème, remplacement, frais de changement de résidence, logement.',
    phase: 6,
    leviers: [],
  },
  {
    id: 13,
    titre: 'Protection sociale',
    accroche: 'Santé, prévoyance, arrêts maladie : ce qui te couvre vraiment.',
    contenuCle: 'Complémentaire santé et prévoyance, congés de maladie et rémunération, jour de carence.',
    phase: 6,
    leviers: [],
  },
  {
    id: 14,
    titre: 'Finances de prof',
    accroche: 'Sécurité de l’emploi, crédit, activités en plus : tes cartes de fonctionnaire.',
    contenuCle:
      'Épargne de précaution, crédit immobilier, cumul d’activités, temps partiel, disponibilité, détachement, frais réels.',
    phase: 6,
    leviers: [],
  },
  {
    id: 15,
    titre: 'Aides et avantages',
    accroche: 'Les aides de ton employeur, que beaucoup oublient de demander.',
    contenuCle: 'Action sociale, aides à l’installation, prestations pour la famille, Pass Éducation.',
    phase: 6,
    leviers: [],
  },
]

/** Titre et présentation d'un module du tronc commun qui changent avec le profil. */
const INFOS_PAR_METIER: Readonly<Record<IdMetier, Readonly<Record<number, Partial<InfoModule>>>>> = {
  ingenieur: {},
  'prof-second-degre': {
    8: {
      titre: 'Carrière et vie de prof',
      accroche: 'Échelons, hors classe, couple, retraite : ta carrière sur quarante ans.',
      contenuCle:
        'Avancement d’échelon, rendez-vous de carrière, hors classe, classe exceptionnelle, couple et impôt, retraite de la fonction publique, transmission.',
    },
  },
}

const TOUS_LES_MODULES: readonly InfoModule[] = [...MODULES, ...MODULES_PROF]

/** Présentation d'un module pour un profil (undefined : module inconnu). */
export function infoModule(id: number, metier: IdMetier): InfoModule | undefined {
  const base = TOUS_LES_MODULES.find((m) => m.id === id)
  return base ? { ...base, ...INFOS_PAR_METIER[metier][id] } : undefined
}

/** Les modules du parcours d'un profil, dans l'ordre. */
export function modulesDuMetier(metier: IdMetier): InfoModule[] {
  return METIERS[metier].modules.flatMap((id) => {
    const info = infoModule(id, metier)
    return info ? [info] : []
  })
}

/** Module suivant dans le parcours du profil (null après le dernier). */
export function moduleSuivant(moduleId: number, metier: IdMetier): InfoModule | null {
  const ordre = METIERS[metier].modules
  const rang = ordre.indexOf(moduleId)
  const suivant = rang >= 0 ? ordre[rang + 1] : undefined
  return suivant === undefined ? null : (infoModule(suivant, metier) ?? null)
}

/** Module précédent dans le parcours du profil (null pour le premier). */
export function modulePrecedent(moduleId: number, metier: IdMetier): number | null {
  const ordre = METIERS[metier].modules
  const rang = ordre.indexOf(moduleId)
  return rang > 0 ? (ordre[rang - 1] ?? null) : null
}

/** Contenus validés au chargement : une erreur de format fait échouer les tests et le build. */
const CONTENUS = new Map<number, ContenuModule>(
  [
    module0,
    module1,
    module2,
    module3,
    module4,
    module5,
    module6,
    module7,
    module8,
    module9,
    module10,
    module11,
    module12,
    module13,
    module14,
    module15,
  ].map((brut) => {
    const contenu = schemaContenuModule.parse(brut)
    return [contenu.module, contenu]
  }),
)

const VARIANTES: Readonly<Record<IdMetier, ReadonlyMap<number, VarianteModule>>> = {
  ingenieur: new Map(),
  'prof-second-degre': new Map(schemaVariantes.parse(variantesProf).map((v) => [v.module, v])),
}

/** Variantes brutes d'un profil (pour les tests). */
export function variantesDuMetier(metier: IdMetier): VarianteModule[] {
  return [...VARIANTES[metier].values()]
}

export const GLOSSAIRE: Glossaire = schemaGlossaire.parse(glossaireBrut)

/** Identifiant de base d'une variante : « m0-p1-c1-prof » → « m0-p1-c1 ». */
export function idDeBase(id: string, suffixe: string | null): string {
  return suffixe !== null && id.endsWith(`-${suffixe}`) ? id.slice(0, -(suffixe.length + 1)) : id
}

/** Remplace les éléments de même identifiant de base, ajoute les autres à la fin. */
function fusionner<T extends { id: string }>(liste: readonly T[], variantes: readonly T[], suffixe: string | null): T[] {
  const resultat = [...liste]
  for (const v of variantes) {
    const i = resultat.findIndex((x) => x.id === idDeBase(v.id, suffixe))
    if (i >= 0) resultat[i] = v
    else resultat.push(v)
  }
  return resultat
}

function appliquerVariante(
  base: ContenuModule,
  variante: VarianteModule | undefined,
  suffixe: string | null,
): ContenuModule {
  if (!variante) return base
  const numeros = [...new Set([...base.paliers, ...(variante.paliers ?? [])].map((p) => p.numero))].sort(
    (a, b) => a - b,
  )
  const limite = variante.paliersDisponibles ?? Infinity
  const paliers = numeros.flatMap((numero) => {
    const p = variante.paliers?.find((x) => x.numero === numero) ?? base.paliers.find((x) => x.numero === numero)
    if (!p || numero > limite) return []
    const duPalier = <T extends { id: string }>(liste: readonly T[] | undefined) =>
      (liste ?? []).filter((x) => origine(x.id).palier === numero)
    const cartes = fusionner(p.cartes, duPalier(variante.cartes), suffixe)
    const ids = new Set(cartes.map((c) => c.id))
    // Une question qui renvoie à une carte remplacée renvoie à la variante de cette carte.
    const questions = fusionner(p.questions, duPalier(variante.questions), suffixe).map((q) =>
      q.carte !== undefined && suffixe !== null && !ids.has(q.carte) && ids.has(`${q.carte}-${suffixe}`)
        ? { ...q, carte: `${q.carte}-${suffixe}` }
        : q,
    )
    return [{ ...p, cartes, questions }]
  })
  return { ...base, paliers }
}

const CACHE = new Map<string, ContenuModule | undefined>()

/**
 * Contenu d'un module pour un profil : le tronc commun, avec les variantes du profil. Pour le
 * profil ingénieur, qui n'a aucune variante, c'est exactement le contenu des fichiers.
 */
export function contenuModule(id: number, metier: IdMetier): ContenuModule | undefined {
  const cle = `${metier}:${id}`
  if (!CACHE.has(cle)) {
    const base = CONTENUS.get(id)
    CACHE.set(cle, base ? appliquerVariante(base, VARIANTES[metier].get(id), METIERS[metier].suffixe) : undefined)
  }
  return CACHE.get(cle)
}

export function palier(moduleId: number, numero: number, metier: IdMetier): Palier | undefined {
  return contenuModule(moduleId, metier)?.paliers.find((p) => p.numero === numero)
}

/** Nombre de paliers dont les cours existent déjà pour ce module, dans ce profil. */
export function paliersDisponibles(moduleId: number, metier: IdMetier): number {
  return contenuModule(moduleId, metier)?.paliers.length ?? 0
}

/** Toutes les questions du parcours d'un profil. */
export function toutesLesQuestions(metier: IdMetier): Question[] {
  return METIERS[metier].modules.flatMap(
    (id) => contenuModule(id, metier)?.paliers.flatMap((p) => p.questions) ?? [],
  )
}

/** Une question du parcours du profil (undefined si elle n'en fait pas partie). */
export function questionParId(id: string, metier: IdMetier): Question | undefined {
  const { module } = origine(id)
  if (!METIERS[metier].modules.includes(module)) return undefined
  return contenuModule(module, metier)
    ?.paliers.flatMap((p) => p.questions)
    .find((q) => q.id === id)
}

/** Module et palier d'une question ou d'une carte, d'après son identifiant « m0-p2-q3 ». */
export function origine(id: string): { module: number; palier: number } {
  const [, module, palierNumero] = /^m(\d{1,2})-p(\d)/.exec(id) ?? []
  return { module: Number(module), palier: Number(palierNumero) }
}
