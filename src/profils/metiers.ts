/**
 * Profils de métier. Le profil, choisi au premier lancement et modifiable dans les réglages,
 * décide :
 * - des modules du parcours et de leur ordre (le premier est ouvert d'emblée, chacun ouvre
 *   le suivant) : le tronc commun, plus les modules propres au métier ;
 * - des variantes de cartes et de questions du tronc commun (src/content/profils/<id>/) ;
 * - des modules à terminer pour ouvrir le mode carrière ;
 * - des leviers du simulateur sans objet pour ce métier ;
 * - des cas d'école proposés.
 *
 * Ajouter un profil : une entrée ici, ses fichiers de contenu, sa carrière dans le moteur.
 * Le profil ingénieur n'a aucune variante : son contenu est celui des fichiers du tronc commun.
 */
import type { IdCas } from '../content/cas.ts'
import type { Levier } from '../content/catalogue.ts'
import type { NomIcone } from '../ui/Icone.tsx'

export const IDS_METIER = ['ingenieur', 'prof-second-degre'] as const
export type IdMetier = (typeof IDS_METIER)[number]

/** Profil d'une installation antérieure au choix de profil : l'appli ne change pas pour elle. */
export const METIER_PAR_DEFAUT: IdMetier = 'ingenieur'

export type ObjectifParcours = 'precaution' | 'immobilier' | 'long-terme' | 'comprendre'

/** Profil prof : étape du parcours au premier lancement. */
export const ETAPES_PROF = ['concours', 'eleve', 'stagiaire', 'titulaire'] as const
export type EtapeProf = (typeof ETAPES_PROF)[number]

export function estEtapeProf(texte: unknown): texte is EtapeProf {
  return typeof texte === 'string' && (ETAPES_PROF as readonly string[]).includes(texte)
}

export interface DefinitionMetier {
  id: IdMetier
  /** Libellé de l'écran de choix et des réglages. */
  libelle: string
  detail: string
  icone: NomIcone
  /**
   * Suffixe des identifiants propres au profil dans les variantes du tronc commun : la carte
   * « m0-p1-c1-prof » remplace « m0-p1-c1 ». null : aucune variante.
   */
  suffixe: string | null
  /** Modules du parcours, dans l'ordre. */
  modules: readonly number[]
  /** Modules à terminer (palier Découverte) pour ouvrir le mode carrière. */
  modulesCarriere: readonly number[]
  /** Annonce de l'ouverture du mode carrière. */
  annonceCarriere: string
  /** Modules à voir en premier selon l'objectif choisi au premier lancement. */
  priorites: Readonly<Record<ObjectifParcours, readonly number[]>>
  /** Leviers du simulateur sans objet pour ce métier : ils ne s'affichent pas. */
  leviersAbsents: readonly Levier[]
  cas: readonly IdCas[]
}

const CAS_COMMUNS: readonly IdCas[] = [
  'pea-ou-per',
  'investir-2007',
  'mars-2020',
  'frais',
  'heritage',
  'louer-ou-acheter',
  'conseil-premier-client',
  'conseil-transmission',
  'conseil-ifi',
  'conseil-levier',
]

export const METIERS: Readonly<Record<IdMetier, DefinitionMetier>> = {
  ingenieur: {
    id: 'ingenieur',
    libelle: 'Futur·e ingénieur·e',
    detail: 'Un premier salaire de cadre dans le privé, l’épargne salariale, la retraite du régime général.',
    icone: 'calculatrice',
    suffixe: null,
    modules: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    modulesCarriere: [0, 1, 2],
    annonceCarriere: 'Les modules 0 à 2 sont terminés : vingt ans de carrière, un événement à choix chaque année.',
    priorites: {
      precaution: [0, 2, 1],
      immobilier: [0, 1, 2, 6],
      'long-terme': [0, 1, 2, 3, 4, 5],
      comprendre: [0, 1, 2],
    },
    leviersAbsents: [],
    cas: [
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
    ],
  },
  'prof-second-degre': {
    id: 'prof-second-degre',
    libelle: 'Futur·e prof (2nd degré)',
    detail: 'Le concours, le M2E, la fiche de paie de fonctionnaire, la grille, les mutations et la retraite.',
    icone: 'crayon',
    suffixe: 'prof',
    modules: [0, 10, 11, 1, 2, 3, 4, 5, 8, 12, 13, 14, 6, 15, 7, 9],
    modulesCarriere: [0, 10, 11],
    annonceCarriere:
      'Tes trois premiers modules sont terminés : ta carrière de prof, du master à la retraite, une année à la fois.',
    priorites: {
      precaution: [0, 10, 11, 2, 1, 14],
      immobilier: [0, 10, 11, 1, 2, 6, 14],
      'long-terme': [0, 10, 11, 1, 2, 3, 4, 5],
      comprendre: [0, 10, 11, 1, 2],
    },
    // L'épargne salariale (PEE, intéressement, participation) relève du Code du travail :
    // le simulateur ne la propose pas à un fonctionnaire (voir la variante du module 4).
    leviersAbsents: ['epargneSalariale'],
    cas: ['premier-traitement', 'affectation-loin', 'temps-partiel', 'hors-classe', ...CAS_COMMUNS],
  },
}

export function estIdMetier(texte: unknown): texte is IdMetier {
  return typeof texte === 'string' && (IDS_METIER as readonly string[]).includes(texte)
}

/** Profil enregistré, ou celui par défaut pour une installation antérieure au choix. */
export function metierDe(profil: { metier?: string | undefined } | undefined): IdMetier {
  const metier = profil?.metier
  return estIdMetier(metier) ? metier : METIER_PAR_DEFAUT
}

export function definitionMetier(id: IdMetier): DefinitionMetier {
  return METIERS[id]
}
