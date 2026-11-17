/**
 * Les cas d'école du cahier des charges : un scénario court, une question précise, un
 * débrief qui renvoie au module concerné. Chaque cas s'ouvre avec son module (tous ses
 * modules, s'il en cite plusieurs).
 */
export const IDS_CAS = [
  'premier-salaire',
  'pea-ou-per',
  'abondement',
  'investir-2007',
  'mars-2020',
  'frais',
  'heritage',
  'louer-ou-acheter',
] as const
export type IdCas = (typeof IDS_CAS)[number]

export interface CasEcole {
  id: IdCas
  titre: string
  question: string
  modules: readonly number[]
  /** Faux tant que le cas n'est pas développé (phase indiquée dans `aVenir`). */
  disponible: boolean
  aVenir?: string
}

export const CAS_ECOLE: readonly CasEcole[] = [
  {
    id: 'premier-salaire',
    titre: 'Premier salaire',
    question: '39 k€ brut à Toulouse : quel budget et quelle épargne de précaution ?',
    modules: [0],
    disponible: true,
  },
  {
    id: 'pea-ou-per',
    titre: 'PEA ou PER',
    question: 'À une tranche de 30 %, où placer 3 000 € par an pendant 30 ans ?',
    modules: [1, 4],
    disponible: true,
  },
  {
    id: 'abondement',
    titre: 'L’abondement',
    question: 'L’employeur abonde le PEE à 100 % : faut-il le remplir en priorité ?',
    modules: [4],
    disponible: true,
  },
  {
    id: 'investir-2007',
    titre: 'Investir en 2007',
    question: '20 000 € en une fois juste avant la crise, ou étalés sur 24 mois ?',
    modules: [5],
    disponible: true,
  },
  {
    id: 'mars-2020',
    titre: 'Mars 2020',
    question: 'Ton portefeuille chute en un mois : vendre, tenir ou renforcer ?',
    modules: [5],
    disponible: true,
  },
  {
    id: 'frais',
    titre: 'Les frais',
    question: 'Un fonds à 2 % de frais contre un ETF à 0,2 % sur 30 ans.',
    modules: [5],
    disponible: true,
  },
  {
    id: 'heritage',
    titre: 'Héritage',
    question: '50 000 € reçus à 30 ans : qu’en faire ?',
    modules: [4, 5],
    disponible: true,
  },
  {
    id: 'louer-ou-acheter',
    titre: 'Louer ou acheter',
    question: 'Un appartement à Bordeaux, avec un horizon de 6 ans.',
    modules: [6],
    disponible: false,
    aVenir: 'Avec le module 6 · Immobilier (phase 4)',
  },
]

export function estIdCas(texte: string | undefined): texte is IdCas {
  return (IDS_CAS as readonly string[]).includes(texte ?? '')
}

export function casParId(id: IdCas): CasEcole {
  const cas = CAS_ECOLE.find((c) => c.id === id)
  if (!cas) throw new Error(`Cas inconnu : ${id}`)
  return cas
}
