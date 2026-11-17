/**
 * Les dix modules du parcours (cahier des charges, « Partie théorique ») : titre, accroche
 * de la carte de progression, contenu clé, phase de développement qui apporte le contenu,
 * et ce que chaque module ajoute au simulateur une fois son palier Découverte maîtrisé.
 */
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
import {
  schemaContenuModule,
  schemaGlossaire,
  type ContenuModule,
  type Glossaire,
  type Palier,
  type Question,
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

export interface InfoLevier {
  nom: string
  module: number
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

/** Contenus validés au chargement : une erreur de format fait échouer les tests et le build. */
const CONTENUS = new Map<number, ContenuModule>(
  [module0, module1, module2, module3, module4, module5, module6, module7, module8, module9].map((brut) => {
    const contenu = schemaContenuModule.parse(brut)
    return [contenu.module, contenu]
  }),
)

export const GLOSSAIRE: Glossaire = schemaGlossaire.parse(glossaireBrut)

export function contenuModule(id: number): ContenuModule | undefined {
  return CONTENUS.get(id)
}

export function palier(moduleId: number, numero: number): Palier | undefined {
  return CONTENUS.get(moduleId)?.paliers.find((p) => p.numero === numero)
}

/** Nombre de paliers dont les cours existent déjà pour ce module. */
export function paliersDisponibles(moduleId: number): number {
  return CONTENUS.get(moduleId)?.paliers.length ?? 0
}

export function toutesLesQuestions(): Question[] {
  return [...CONTENUS.values()].flatMap((m) => m.paliers.flatMap((p) => p.questions))
}

export function questionParId(id: string): Question | undefined {
  return toutesLesQuestions().find((q) => q.id === id)
}

/** Module et palier d'une question ou d'une carte, d'après son identifiant « m0-p2-q3 ». */
export function origine(id: string): { module: number; palier: number } {
  const [, module, palierNumero] = /^m(\d)-p(\d)/.exec(id) ?? []
  return { module: Number(module), palier: Number(palierNumero) }
}
