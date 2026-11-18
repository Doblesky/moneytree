/**
 * Examen blanc, sur le format de l'examen AMF (page « Certification professionnelle » de
 * l'AMF, lue le 18/11/2026) : un QCM, deux catégories de questions qui ne se compensent pas,
 * 80 % de bonnes réponses exigées dans chacune, une minute par question en moyenne
 * (120 questions en 2 heures).
 *
 * MoneyTree le réduit à 30 questions, tirées des cours :
 * - catégorie A, « connaissances indispensables » (surtout juridiques et déontologiques) :
 *   les paliers qui traitent de réglementation, de protection du client et de conformité ;
 * - catégorie C, « culture financière » : tous les autres QCM des paliers 2 à 5.
 * La répartition des paliers entre A et C est un choix de MoneyTree, pas celle de l'AMF.
 */
import { origine, toutesLesQuestions } from '../content/catalogue.ts'
import type { Question, QuestionQcm } from '../content/schema.ts'
import { examenReussi, melanger, melangerChoix, type Hasard } from './examens.ts'
import { progressionDe, type EtatProgression } from './regles.ts'

export type CategorieAmf = 'A' | 'C'

export const SEUIL_EXAMEN_BLANC = 0.8
export const QUESTIONS_PAR_CATEGORIE = 15
/** Une minute par question, comme à l'examen AMF (120 questions, 2 heures au plus). */
export const SECONDES_PAR_QUESTION = 60

/** Paliers « connaissances indispensables » : module → paliers. */
const PALIERS_CATEGORIE_A: Readonly<Record<number, readonly number[]>> = {
  0: [5], // connaissance du client, adéquation
  2: [5], // garanties, autorités de contrôle
  3: [5], // fonctionnement des marchés, information réglementée
  7: [5], // produits complexes, protection des non-professionnels
  9: [3, 4, 5], // conseil, rémunération, information, déontologie, blanchiment
}

export function categorieAmf(questionId: string): CategorieAmf {
  const { module, palier } = origine(questionId)
  return PALIERS_CATEGORIE_A[module]?.includes(palier) ? 'A' : 'C'
}

function estQcm(q: Question): q is QuestionQcm {
  return q.type === 'qcm'
}

/** Les QCM éligibles à l'examen blanc (paliers 2 à 5), par catégorie. */
export function vivierExamenBlanc(): Record<CategorieAmf, QuestionQcm[]> {
  const vivier: Record<CategorieAmf, QuestionQcm[]> = { A: [], C: [] }
  for (const q of toutesLesQuestions().filter(estQcm)) {
    if (origine(q.id).palier < 2) continue
    vivier[categorieAmf(q.id)].push(q)
  }
  return vivier
}

/** Tire 15 questions de chaque catégorie, dans un ordre mélangé, choix mélangés. */
export function tirerExamenBlanc(hasard: Hasard): Question[] {
  const vivier = vivierExamenBlanc()
  const a = melanger(vivier.A, hasard).slice(0, QUESTIONS_PAR_CATEGORIE)
  const c = melanger(vivier.C, hasard).slice(0, QUESTIONS_PAR_CATEGORIE)
  return melanger([...a, ...c], hasard).map((q) => melangerChoix(q, hasard))
}

export interface ScoreCategorie {
  justes: number
  total: number
  reussi: boolean
}

export interface BilanExamenBlanc {
  A: ScoreCategorie
  C: ScoreCategorie
  /** Réussi si les deux catégories atteignent 80 %, sans compensation entre elles. */
  reussi: boolean
}

export function bilanExamenBlanc(reponses: readonly { questionId: string; juste: boolean }[]): BilanExamenBlanc {
  const score = (categorie: CategorieAmf): ScoreCategorie => {
    const r = reponses.filter((x) => categorieAmf(x.questionId) === categorie)
    const justes = r.filter((x) => x.juste).length
    return { justes, total: r.length, reussi: examenReussi(justes, r.length, SEUIL_EXAMEN_BLANC) }
  }
  const A = score('A')
  const C = score('C')
  return { A, C, reussi: A.reussi && C.reussi }
}

/** Conseillé une fois au moins un palier Professionnel maîtrisé (ou en mode expert). */
export function examenBlancConseille(etat: EtatProgression): boolean {
  return etat.modeExpert || etat.modules.some((m) => progressionDe(etat, m.moduleId).paliersMaitrises >= 5)
}
