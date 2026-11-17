/**
 * Règles de progression (fonctions pures, testées) : ce qui est ouvert, ce qui est
 * débloqué, quelle est la prochaine étape.
 *
 * - Seul le module 0 est ouvert au départ.
 * - Dans un module, le palier n + 1 s'ouvre quand le palier n est maîtrisé.
 * - Un module est « terminé » quand son palier Découverte est maîtrisé : cela ouvre le
 *   module suivant et débloque ses leviers dans le simulateur. Les paliers plus profonds
 *   restent à approfondir, sans bloquer la suite du parcours.
 * - Le mode carrière s'ouvre quand les modules 0 à 2 sont terminés.
 * - « Débloquer quand même » ouvre un module, un palier ou un levier ; le mode expert ouvre tout.
 */
import { LEVIERS, MODULES, NOMBRE_PALIERS, paliersDisponibles, type Levier } from '../content/catalogue.ts'

export interface ProgressionDeModule {
  moduleId: number
  /** Paliers maîtrisés, de 0 à 5 (toujours les premiers : 1, puis 2…). */
  paliersMaitrises: number
  /** Ouvert avec « débloquer quand même ». */
  debloqueQuandMeme?: boolean
  /** Paliers ouverts avec « débloquer quand même » (le plus haut). */
  palierDebloque?: number
  /** Dernière carte vue, pour reprendre où l'on s'était arrêté. */
  enCours?: { palier: number; carte: number }
}

export interface EtatProgression {
  modeExpert: boolean
  modules: readonly ProgressionDeModule[]
  /** Leviers ouverts avec « débloquer quand même ». */
  leviersForces: readonly Levier[]
}

export function progressionDe(etat: EtatProgression, moduleId: number): ProgressionDeModule {
  return etat.modules.find((m) => m.moduleId === moduleId) ?? { moduleId, paliersMaitrises: 0 }
}

export function moduleTermine(etat: EtatProgression, moduleId: number): boolean {
  return progressionDe(etat, moduleId).paliersMaitrises >= 1
}

export function moduleOuvert(etat: EtatProgression, moduleId: number): boolean {
  if (moduleId === 0 || etat.modeExpert) return true
  if (progressionDe(etat, moduleId).debloqueQuandMeme) return true
  return moduleTermine(etat, moduleId - 1)
}

export function palierOuvert(etat: EtatProgression, moduleId: number, numero: number): boolean {
  if (!moduleOuvert(etat, moduleId)) return false
  if (numero === 1 || etat.modeExpert) return true
  const progression = progressionDe(etat, moduleId)
  return progression.paliersMaitrises >= numero - 1 || (progression.palierDebloque ?? 0) >= numero
}

export type EtatPalier = 'maitrise' | 'en-cours' | 'ouvert' | 'verrouille' | 'a-venir'

/** État d'un palier pour la carte de progression. « a-venir » : cours pas encore écrits. */
export function etatPalier(etat: EtatProgression, moduleId: number, numero: number): EtatPalier {
  const progression = progressionDe(etat, moduleId)
  if (progression.paliersMaitrises >= numero) return 'maitrise'
  if (numero > paliersDisponibles(moduleId)) return 'a-venir'
  if (!palierOuvert(etat, moduleId, numero)) return 'verrouille'
  return progression.enCours?.palier === numero ? 'en-cours' : 'ouvert'
}

export function levierDebloque(etat: EtatProgression, levier: Levier): boolean {
  return etat.modeExpert || etat.leviersForces.includes(levier) || moduleTermine(etat, LEVIERS[levier].module)
}

export function carriereOuverte(etat: EtatProgression): boolean {
  return etat.modeExpert || [0, 1, 2].every((id) => moduleTermine(etat, id))
}

/** Part du parcours accomplie : paliers maîtrisés sur les 50 paliers du programme complet. */
export function avancementGlobal(etat: EtatProgression): number {
  const maitrises = MODULES.reduce((somme, m) => somme + progressionDe(etat, m.id).paliersMaitrises, 0)
  return maitrises / (MODULES.length * NOMBRE_PALIERS)
}

export type ProchaineEtape =
  | { type: 'palier'; moduleId: number; palier: number; carte: number; reprise: boolean }
  | { type: 'quiz-du-jour' }
  | { type: 'simulateur' }

/**
 * La seule action proposée par l'accueil : reprendre un palier commencé, sinon le premier
 * palier ouvert non maîtrisé (en suivant l'ordre des modules), sinon le quiz du jour s'il
 * reste des questions à revoir, sinon le simulateur.
 */
export function prochaineEtape(
  etat: EtatProgression,
  options: { questionsARevoir: number; ordreModules?: readonly number[] },
): ProchaineEtape {
  const ordre = options.ordreModules ?? MODULES.map((m) => m.id)
  for (const id of ordre) {
    const enCours = progressionDe(etat, id).enCours
    if (enCours && progressionDe(etat, id).paliersMaitrises < enCours.palier && moduleOuvert(etat, id)) {
      return { type: 'palier', moduleId: id, palier: enCours.palier, carte: enCours.carte, reprise: true }
    }
  }
  for (const id of ordre) {
    if (!moduleOuvert(etat, id)) continue
    const suivant = progressionDe(etat, id).paliersMaitrises + 1
    // On approfondit un module seulement après avoir découvert ceux qui sont ouverts.
    if (suivant === 1 && suivant <= paliersDisponibles(id)) {
      return { type: 'palier', moduleId: id, palier: 1, carte: 0, reprise: false }
    }
  }
  if (options.questionsARevoir > 0) return { type: 'quiz-du-jour' }
  for (const id of ordre) {
    if (!moduleOuvert(etat, id)) continue
    const suivant = progressionDe(etat, id).paliersMaitrises + 1
    if (suivant <= paliersDisponibles(id) && palierOuvert(etat, id, suivant)) {
      return { type: 'palier', moduleId: id, palier: suivant, carte: 0, reprise: false }
    }
  }
  return { type: 'simulateur' }
}

/** Ordre des modules selon l'objectif choisi au premier lancement (les ouverts d'abord). */
export function ordreSelonObjectif(objectif: string | undefined): number[] {
  const tous = MODULES.map((m) => m.id)
  const priorites: Record<string, number[]> = {
    precaution: [0, 2, 1],
    immobilier: [0, 1, 2, 6],
    'long-terme': [0, 1, 2, 3, 4, 5],
    comprendre: [0, 1, 2],
  }
  const debut = priorites[objectif ?? ''] ?? []
  return [...debut, ...tous.filter((id) => !debut.includes(id))]
}
