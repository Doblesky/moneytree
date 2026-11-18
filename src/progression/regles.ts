/**
 * Règles de progression (fonctions pures, testées) : ce qui est ouvert, ce qui est
 * débloqué, quelle est la prochaine étape.
 *
 * - Seul le premier module du parcours du profil est ouvert au départ (le module 0).
 * - Dans un module, le palier n + 1 s'ouvre quand le palier n est maîtrisé.
 * - Un module est « terminé » quand son palier Découverte est maîtrisé : cela ouvre le
 *   module suivant du parcours et débloque ses leviers dans le simulateur. Les paliers plus profonds
 *   restent à approfondir, sans bloquer la suite du parcours.
 * - Le mode carrière s'ouvre quand les premiers modules du profil sont terminés (0 à 2 pour
 *   l'ingénieur).
 * - « Débloquer quand même » ouvre un module, un palier ou un levier ; le mode expert ouvre tout.
 * - Un palier maîtrisé se valide ensuite par un examen (src/progression/examens.ts) : c'est
 *   l'examen, pas la lecture, qui compte pour les 100 %.
 */
import { LEVIERS, modulePrecedent, NOMBRE_PALIERS, paliersDisponibles, type Levier } from '../content/catalogue.ts'
import { METIERS, type IdMetier, type ObjectifParcours } from '../profils/metiers.ts'

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
  /** Jour (AAAA-MM-JJ) où chaque palier a été maîtrisé la première fois, par numéro. */
  maitrisesLe?: Record<string, string>
  /** Examens de validation, par numéro de palier. */
  examens?: Record<string, ResultatExamenStocke>
}

export interface ResultatExamenStocke {
  tentatives: number
  /** Meilleure part de bonnes réponses. */
  meilleurScore: number
  /** Jour (AAAA-MM-JJ) de la première réussite. */
  valideLe?: string
}

export interface EtatProgression {
  /** Profil de métier : il fixe les modules du parcours et leur ordre. */
  metier: IdMetier
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

/** Le module fait partie du parcours du profil. */
export function moduleDuParcours(etat: EtatProgression, moduleId: number): boolean {
  return METIERS[etat.metier].modules.includes(moduleId)
}

export function moduleOuvert(etat: EtatProgression, moduleId: number): boolean {
  if (!moduleDuParcours(etat, moduleId)) return false
  const precedent = modulePrecedent(moduleId, etat.metier)
  if (precedent === null || etat.modeExpert) return true
  if (progressionDe(etat, moduleId).debloqueQuandMeme) return true
  return moduleTermine(etat, precedent)
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
  if (numero > paliersDisponibles(moduleId, etat.metier)) return 'a-venir'
  if (!palierOuvert(etat, moduleId, numero)) return 'verrouille'
  return progression.enCours?.palier === numero ? 'en-cours' : 'ouvert'
}

/** Le levier a un sens pour ce profil (l'épargne salariale n'en a pas pour un fonctionnaire). */
export function levierDuMetier(etat: Pick<EtatProgression, 'metier'>, levier: Levier): boolean {
  return !METIERS[etat.metier].leviersAbsents.includes(levier)
}

export function levierDebloque(etat: EtatProgression, levier: Levier): boolean {
  if (!levierDuMetier(etat, levier)) return false
  const { module, palier = 1 } = LEVIERS[levier]
  return etat.modeExpert || etat.leviersForces.includes(levier) || progressionDe(etat, module).paliersMaitrises >= palier
}

export function carriereOuverte(etat: EtatProgression): boolean {
  return etat.modeExpert || METIERS[etat.metier].modulesCarriere.every((id) => moduleTermine(etat, id))
}

export function palierValide(etat: EtatProgression, moduleId: number, numero: number): boolean {
  return progressionDe(etat, moduleId).examens?.[String(numero)]?.valideLe !== undefined
}

/** Nombre de paliers du module validés par leur examen. */
export function paliersValides(etat: EtatProgression, moduleId: number): number {
  let n = 0
  for (let numero = 1; numero <= NOMBRE_PALIERS; numero++) if (palierValide(etat, moduleId, numero)) n++
  return n
}

/**
 * Part du parcours accomplie, sur les modules du profil. Chacun des paliers (50 pour
 * l'ingénieur) compte deux fois : une moitié quand son
 * quiz est maîtrisé, l'autre quand son examen de validation est réussi. Le 100 % ne
 * s'obtient donc qu'avec tous les examens (cahier des charges, « Du débutant au niveau
 * professionnel »).
 */
export function avancementGlobal(etat: EtatProgression): number {
  const modules = METIERS[etat.metier].modules
  const points = modules.reduce(
    (somme, id) => somme + progressionDe(etat, id).paliersMaitrises + paliersValides(etat, id),
    0,
  )
  return points / (modules.length * NOMBRE_PALIERS * 2)
}

/**
 * Niveau de connaissances atteint : le palier le plus haut validé dans tous les modules du profil
 * (0 tant qu'un module n'a pas son palier Découverte validé), et le nombre de modules déjà
 * validés au palier suivant.
 */
export function niveauAtteint(etat: EtatProgression): { palier: number; modulesAuSuivant: number } {
  const valides = (id: number) => {
    let n = 0
    while (n < NOMBRE_PALIERS && palierValide(etat, id, n + 1)) n++
    return n
  }
  const parModule = METIERS[etat.metier].modules.map(valides)
  const palier = Math.min(...parModule)
  return { palier, modulesAuSuivant: parModule.filter((n) => n > palier).length }
}

export type EtatExamen = 'verrouille' | 'demain' | 'ouvert' | 'valide'

/**
 * État de l'examen de validation d'un palier : il faut d'abord maîtriser le palier, puis
 * l'examen s'ouvre le lendemain, pour vérifier ce qui reste après une nuit (on peut le
 * passer plus tôt). Un palier maîtrisé avant la phase 5, sans date, s'ouvre tout de suite.
 */
export function etatExamen(etat: EtatProgression, moduleId: number, numero: number, aujourdhui: string): EtatExamen {
  if (palierValide(etat, moduleId, numero)) return 'valide'
  const progression = progressionDe(etat, moduleId)
  if (progression.paliersMaitrises < numero) return 'verrouille'
  const le = progression.maitrisesLe?.[String(numero)]
  return le !== undefined && le >= aujourdhui ? 'demain' : 'ouvert'
}

export type ProchaineEtape =
  | { type: 'palier'; moduleId: number; palier: number; carte: number; reprise: boolean }
  | { type: 'quiz-du-jour' }
  | { type: 'examen'; moduleId: number; palier: number }
  | { type: 'simulateur' }

/**
 * La seule action proposée par l'accueil : reprendre un palier commencé, sinon le premier
 * palier ouvert non maîtrisé (en suivant l'ordre des modules), sinon le quiz du jour s'il
 * reste des questions à revoir, sinon un examen de validation ouvert (si `aujourdhui` est
 * donné), sinon le palier suivant d'un module, sinon le simulateur.
 */
export function prochaineEtape(
  etat: EtatProgression,
  options: { questionsARevoir: number; ordreModules?: readonly number[]; aujourdhui?: string },
): ProchaineEtape {
  const ordre = options.ordreModules ?? METIERS[etat.metier].modules
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
    if (suivant === 1 && suivant <= paliersDisponibles(id, etat.metier)) {
      return { type: 'palier', moduleId: id, palier: 1, carte: 0, reprise: false }
    }
  }
  if (options.questionsARevoir > 0) return { type: 'quiz-du-jour' }
  if (options.aujourdhui !== undefined) {
    for (const id of ordre) {
      for (let numero = 1; numero <= progressionDe(etat, id).paliersMaitrises; numero++) {
        if (etatExamen(etat, id, numero, options.aujourdhui) === 'ouvert') return { type: 'examen', moduleId: id, palier: numero }
      }
    }
  }
  for (const id of ordre) {
    if (!moduleOuvert(etat, id)) continue
    const suivant = progressionDe(etat, id).paliersMaitrises + 1
    if (suivant <= paliersDisponibles(id, etat.metier) && palierOuvert(etat, id, suivant)) {
      return { type: 'palier', moduleId: id, palier: suivant, carte: 0, reprise: false }
    }
  }
  return { type: 'simulateur' }
}

/** Ordre des modules selon l'objectif choisi au premier lancement (les ouverts d'abord). */
export function ordreSelonObjectif(objectif: string | undefined, metier: IdMetier): number[] {
  const { modules, priorites } = METIERS[metier]
  const debut: readonly number[] = Object.hasOwn(priorites, objectif ?? '') ? priorites[objectif as ObjectifParcours] : []
  return [...debut, ...modules.filter((id) => !debut.includes(id))]
}

/**
 * Un cas d'école s'ouvre quand tous ses modules sont terminés (ou en mode expert) ; un cas de
 * conseil client demande le palier Professionnel (`palier` = 5) de chacun de ses modules.
 */
export function casOuvert(etat: EtatProgression, modules: readonly number[], palier = 1): boolean {
  return etat.modeExpert || modules.every((id) => progressionDe(etat, id).paliersMaitrises >= palier)
}
