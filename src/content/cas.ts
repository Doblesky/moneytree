/**
 * Les cas d'école du cahier des charges : un scénario court, une question précise, un
 * débrief qui renvoie au module concerné. Chaque cas s'ouvre avec son module (tous ses
 * modules, s'il en cite plusieurs). Chaque profil de métier propose sa liste de cas
 * (src/profils/metiers.ts) : les cas « prof » s'ajoutent à la suite, sans toucher aux autres.
 */
import { METIERS, type IdMetier } from '../profils/metiers.ts'

export const IDS_CAS = [
  'premier-salaire',
  'pea-ou-per',
  'abondement',
  'investir-2007',
  'mars-2020',
  'frais',
  'heritage',
  'louer-ou-acheter',
  'conseil-premier-client',
  'conseil-transmission',
  'conseil-ifi',
  'conseil-levier',
  'premier-traitement',
  'affectation-loin',
  'temps-partiel',
  'hors-classe',
] as const
export type IdCas = (typeof IDS_CAS)[number]

export interface CasEcole {
  id: IdCas
  titre: string
  question: string
  modules: readonly number[]
  /** Palier à maîtriser dans chacun des modules (1 par défaut ; 5 pour le conseil client). */
  palier?: number
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
    disponible: true,
  },
  {
    id: 'conseil-premier-client',
    titre: 'Conseil : la première cliente',
    question: 'Une jeune ingénieure veut tout miser sur les cryptos : que lui conseiller ?',
    modules: [0, 9],
    palier: 5,
    disponible: true,
  },
  {
    id: 'conseil-transmission',
    titre: 'Conseil : transmettre aux enfants',
    question: 'Un couple de soixantenaires veut aider ses enfants sans se démunir.',
    modules: [4, 6, 8],
    palier: 5,
    disponible: true,
  },
  {
    id: 'conseil-ifi',
    titre: 'Conseil : le seuil de l’IFI',
    question: 'Une dirigeante veut acheter un appartement de plus : quelles conséquences ?',
    modules: [1, 2],
    palier: 5,
    disponible: true,
  },
  {
    id: 'conseil-levier',
    titre: 'Conseil : le client qui veut se refaire',
    question: 'Il a perdu sur les CFD et veut plus de levier : comment réagir ?',
    modules: [7, 9],
    palier: 5,
    disponible: true,
  },
  {
    id: 'premier-traitement',
    titre: 'Premier traitement',
    question: 'Élève fonctionnaire en M1 : quel budget, et faut-il déjà épargner ?',
    modules: [0, 11],
    disponible: false,
    aVenir: 'profil prof',
  },
  {
    id: 'affectation-loin',
    titre: 'Affectée loin de chez toi',
    question: 'Une première affectation à l’autre bout de la France : ce que ça coûte, ce qui aide.',
    modules: [12],
    disponible: false,
    aVenir: 'profil prof',
  },
  {
    id: 'temps-partiel',
    titre: 'Temps partiel à 80 %',
    question: 'Un jour libre par semaine : combien ça coûte vraiment, aujourd’hui et à la retraite ?',
    modules: [14],
    disponible: false,
    aVenir: 'profil prof',
  },
  {
    id: 'hors-classe',
    titre: 'Le passage à la hors classe',
    question: 'Ce que la hors classe change sur ton salaire et sur ta pension.',
    modules: [8],
    disponible: false,
    aVenir: 'profil prof',
  },
]

/** Cas proposés à un profil, dans son ordre. */
export function casDuMetier(metier: IdMetier): CasEcole[] {
  return METIERS[metier].cas.map(casParId)
}

export function estIdCas(texte: string | undefined): texte is IdCas {
  return (IDS_CAS as readonly string[]).includes(texte ?? '')
}

export function casParId(id: IdCas): CasEcole {
  const cas = CAS_ECOLE.find((c) => c.id === id)
  if (!cas) throw new Error(`Cas inconnu : ${id}`)
  return cas
}
