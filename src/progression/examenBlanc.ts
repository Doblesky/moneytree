/**
 * Examen blanc sur le programme officiel de l'examen AMF (instruction DOC-2010-09, annexe 1,
 * applicable au 1er janvier 2027 : voir src/content/programmeAmf.ts). Un QCM, deux
 * catégories qui ne se compensent pas, 80 % requis dans chacune, une minute par question.
 *
 * MoneyTree le ramène à 30 questions, avec la même part de catégorie A que l'examen officiel
 * (33 questions sur 120). Dans chaque catégorie, un paragraphe du programme est tiré au
 * hasard en proportion de son nombre de questions officiel, parmi ceux que les cours couvrent.
 */
import { toutesLesQuestions } from '../content/catalogue.ts'
import {
  PARAGRAPHES_AMF,
  paragrapheDeQuestion,
  THEMES_AMF,
  type CategorieAmf,
  type ParagrapheAmf,
} from '../content/programmeAmf.ts'
import type { Question, QuestionQcm } from '../content/schema.ts'
import { examenReussi, melanger, melangerChoix, type Hasard } from './examens.ts'
import { progressionDe, type EtatProgression } from './regles.ts'

export type { CategorieAmf } from '../content/programmeAmf.ts'

export const SEUIL_EXAMEN_BLANC = 0.8
export const QUESTIONS_EXAMEN_BLANC = 30
/** Une minute par question, comme à l'examen AMF (120 questions, 2 heures au plus). */
export const SECONDES_PAR_QUESTION = 60

const somme = (paragraphes: readonly ParagrapheAmf[]) => paragraphes.reduce((s, x) => s + x.nb, 0)

/** Questions de l'examen officiel : 120 au total, dont celles de catégorie A. */
export const EXAMEN_OFFICIEL = {
  total: somme(PARAGRAPHES_AMF),
  categorieA: somme(PARAGRAPHES_AMF.filter((x) => x.categorie === 'A')),
}

/** Répartition de l'examen blanc : la même part de catégorie A qu'à l'examen officiel. */
export const REPARTITION_EXAMEN_BLANC: Record<CategorieAmf, number> = (() => {
  const a = Math.round((QUESTIONS_EXAMEN_BLANC * EXAMEN_OFFICIEL.categorieA) / EXAMEN_OFFICIEL.total)
  return { A: a, C: QUESTIONS_EXAMEN_BLANC - a }
})()

export function categorieAmf(questionId: string): CategorieAmf | null {
  return paragrapheDeQuestion(questionId)?.categorie ?? null
}

function estQcm(q: Question): q is QuestionQcm {
  return q.type === 'qcm'
}

/** Les QCM rattachés au programme, regroupés par paragraphe. */
export function vivierExamenBlanc(): Map<string, QuestionQcm[]> {
  const vivier = new Map<string, QuestionQcm[]>()
  for (const q of toutesLesQuestions().filter(estQcm)) {
    const paragraphe = paragrapheDeQuestion(q.id)
    if (!paragraphe) continue
    vivier.set(paragraphe.id, [...(vivier.get(paragraphe.id) ?? []), q])
  }
  return vivier
}

/** Ce que les cours couvrent du programme officiel. */
export function couvertureProgramme(): {
  paragraphesCouverts: number
  questionsOfficiellesCouvertes: number
  themesNonCouverts: number[]
  paragraphesNonCouverts: ParagrapheAmf[]
} {
  const vivier = vivierExamenBlanc()
  const couverts = PARAGRAPHES_AMF.filter((x) => vivier.has(x.id))
  const nonCouverts = PARAGRAPHES_AMF.filter((x) => !vivier.has(x.id))
  const themesCouverts = new Set(couverts.map((x) => x.theme))
  return {
    paragraphesCouverts: couverts.length,
    questionsOfficiellesCouvertes: somme(couverts),
    themesNonCouverts: Object.keys(THEMES_AMF)
      .map(Number)
      .filter((t) => !themesCouverts.has(t)),
    paragraphesNonCouverts: nonCouverts,
  }
}

/** Tire `nombre` questions d'une catégorie, paragraphe par paragraphe, au prorata des poids officiels. */
function tirerCategorie(categorie: CategorieAmf, nombre: number, hasard: Hasard): QuestionQcm[] {
  const vivier = vivierExamenBlanc()
  const restants = new Map<ParagrapheAmf, QuestionQcm[]>()
  for (const paragraphe of PARAGRAPHES_AMF) {
    const questions = vivier.get(paragraphe.id)
    if (paragraphe.categorie === categorie && questions) restants.set(paragraphe, melanger(questions, hasard))
  }
  const choisies: QuestionQcm[] = []
  while (choisies.length < nombre && restants.size > 0) {
    const poids = [...restants.keys()]
    let tirage = hasard() * somme(poids)
    let elu = poids[poids.length - 1]
    for (const paragraphe of poids) {
      tirage -= paragraphe.nb
      if (tirage < 0) {
        elu = paragraphe
        break
      }
    }
    if (!elu) break
    const file = restants.get(elu) ?? []
    const question = file.shift()
    if (question) choisies.push(question)
    if (file.length === 0) restants.delete(elu)
  }
  return choisies
}

/** Tire l'examen blanc : 8 questions de catégorie A, 22 de catégorie C, choix mélangés. */
export function tirerExamenBlanc(hasard: Hasard): Question[] {
  const a = tirerCategorie('A', REPARTITION_EXAMEN_BLANC.A, hasard)
  const c = tirerCategorie('C', REPARTITION_EXAMEN_BLANC.C, hasard)
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
  /** Bonnes réponses par thème du programme. */
  parTheme: { theme: number; justes: number; total: number }[]
  /** Réussi si les deux catégories atteignent 80 %, sans compensation entre elles. */
  reussi: boolean
}

export function bilanExamenBlanc(reponses: readonly { questionId: string; juste: boolean }[]): BilanExamenBlanc {
  const score = (categorie: CategorieAmf): ScoreCategorie => {
    const r = reponses.filter((x) => categorieAmf(x.questionId) === categorie)
    const justes = r.filter((x) => x.juste).length
    return { justes, total: r.length, reussi: examenReussi(justes, r.length, SEUIL_EXAMEN_BLANC) }
  }
  const themes = new Map<number, { justes: number; total: number }>()
  for (const r of reponses) {
    const theme = paragrapheDeQuestion(r.questionId)?.theme
    if (theme === undefined) continue
    const actuel = themes.get(theme) ?? { justes: 0, total: 0 }
    themes.set(theme, { justes: actuel.justes + (r.juste ? 1 : 0), total: actuel.total + 1 })
  }
  const A = score('A')
  const C = score('C')
  return {
    A,
    C,
    parTheme: [...themes.entries()].sort((x, y) => x[0] - y[0]).map(([theme, s]) => ({ theme, ...s })),
    reussi: A.reussi && C.reussi,
  }
}

/** Conseillé une fois au moins un palier Professionnel maîtrisé (ou en mode expert). */
export function examenBlancConseille(etat: EtatProgression): boolean {
  return etat.modeExpert || etat.modules.some((m) => progressionDe(etat, m.moduleId).paliersMaitrises >= 5)
}
