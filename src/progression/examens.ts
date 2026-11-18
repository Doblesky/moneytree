/**
 * Examens de validation (cahier des charges, « Du débutant au niveau professionnel ») :
 * des questions tirées au hasard, avec un seuil de réussite élevé. Fonctions pures,
 * le hasard est injecté pour les tests.
 *
 * L'examen d'un palier reprend ses propres questions et complète avec celles des paliers
 * précédents du même module, dans un ordre nouveau et avec les choix des QCM mélangés :
 * une bonne réponse ne peut plus tenir à la place de la réponse dans la liste.
 */
import { palier as lirePalier } from '../content/catalogue.ts'
import type { Question } from '../content/schema.ts'

/** Seuil de réussite d'un examen de validation (le quiz d'un palier demande 80 %). */
export const SEUIL_EXAMEN = 0.9
export const QUESTIONS_PAR_EXAMEN = 10
/** Au plus, la part de l'examen tirée du palier lui-même (le reste vient des précédents). */
const MAX_DU_PALIER = 6

export type Hasard = () => number

/** Mélange de Fisher-Yates (renvoie une copie). */
export function melanger<T>(tableau: readonly T[], hasard: Hasard): T[] {
  const copie = [...tableau]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1))
    const tmp = copie[i] as T
    copie[i] = copie[j] as T
    copie[j] = tmp
  }
  return copie
}

/** Les mêmes choix dans un autre ordre, la bonne réponse suivant le mouvement. */
export function melangerChoix(question: Question, hasard: Hasard): Question {
  if (question.type !== 'qcm') return question
  const ordre = melanger(
    question.choix.map((_, i) => i),
    hasard,
  )
  return {
    ...question,
    choix: ordre.map((i) => question.choix[i] ?? ''),
    bonne: ordre.indexOf(question.bonne),
  }
}

/**
 * Tire les questions de l'examen du palier `numero` : jusqu'à 6 questions du palier, puis
 * des questions des paliers précédents du module jusqu'à 10, le tout mélangé.
 */
export function tirerExamen(moduleId: number, numero: number, hasard: Hasard): Question[] {
  const duPalier = melanger(lirePalier(moduleId, numero)?.questions ?? [], hasard).slice(0, MAX_DU_PALIER)
  const precedentes: Question[] = []
  for (let n = 1; n < numero; n++) precedentes.push(...(lirePalier(moduleId, n)?.questions ?? []))
  const complement = melanger(precedentes, hasard).slice(0, Math.max(0, QUESTIONS_PAR_EXAMEN - duPalier.length))
  return melanger([...duPalier, ...complement], hasard).map((q) => melangerChoix(q, hasard))
}

/** Nombre de bonnes réponses exigées (90 % arrondi au-dessus : 9 sur 10, 5 sur 5). */
export function bonnesReponsesRequises(total: number, seuil: number = SEUIL_EXAMEN): number {
  return Math.ceil(seuil * total - 1e-9)
}

export function examenReussi(justes: number, total: number, seuil: number = SEUIL_EXAMEN): boolean {
  return total > 0 && justes >= bonnesReponsesRequises(total, seuil)
}
