import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toutesLesQuestions } from '../content/catalogue.ts'
import { PARAGRAPHES_AMF, paragrapheDeQuestion, THEMES_AMF } from '../content/programmeAmf.ts'
import { Aleatoire } from '../engine/aleatoire.ts'
import { terminerExamenBlanc } from '../storage/apprentissage.ts'
import { creerBase, type BaseMoneyTree } from '../storage/db.ts'
import { lireProfil } from '../storage/profil.ts'
import {
  bilanExamenBlanc,
  categorieAmf,
  couvertureProgramme,
  EXAMEN_OFFICIEL,
  examenBlancConseille,
  QUESTIONS_EXAMEN_BLANC,
  REPARTITION_EXAMEN_BLANC,
  tirerExamenBlanc,
  vivierExamenBlanc,
} from './examenBlanc.ts'

describe('programme officiel de l’examen AMF', () => {
  it('totalise 120 questions sur 12 thèmes, dont 33 en catégorie A', () => {
    // Instruction DOC-2010-09, annexe 1, applicable au 1er janvier 2027.
    expect(EXAMEN_OFFICIEL).toEqual({ total: 120, categorieA: 33 })
    expect(Object.keys(THEMES_AMF)).toHaveLength(12)
    expect(new Set(PARAGRAPHES_AMF.map((x) => x.id)).size).toBe(PARAGRAPHES_AMF.length)
    expect(PARAGRAPHES_AMF.every((x) => x.theme in THEMES_AMF)).toBe(true)
  })

  it('rattache les questions aux paragraphes, et laisse de côté le hors-programme', () => {
    expect(paragrapheDeQuestion('m9-p5-q3')?.id).toBe('3')
    expect(categorieAmf('m3-p5-q2')).toBe('A') // typologie des ordres
    expect(categorieAmf('m7-p5-q3')).toBe('C') // produits spéculatifs : culture financière
    expect(categorieAmf('m0-p1-q1')).toBeNull() // fiche de paie : hors programme
    expect(categorieAmf('m9-p3-q5')).toBeNull()
    // Toute exception et tout palier rattaché désignent un paragraphe existant.
    for (const q of toutesLesQuestions()) {
      const paragraphe = paragrapheDeQuestion(q.id)
      if (paragraphe) expect(PARAGRAPHES_AMF).toContain(paragraphe)
    }
  })

  it('mesure ce que les cours couvrent', () => {
    const c = couvertureProgramme()
    expect(c.paragraphesCouverts + c.paragraphesNonCouverts.length).toBe(PARAGRAPHES_AMF.length)
    // Tout le programme officiel est couvert : chaque paragraphe a au moins une question.
    expect(c.themesNonCouverts).toEqual([])
    expect(c.paragraphesNonCouverts).toEqual([])
    expect(c.questionsOfficiellesCouvertes).toBe(120)
  })

  it('a des questions dans chaque paragraphe de catégorie A', () => {
    const vivier = vivierExamenBlanc()
    const sansQuestion = PARAGRAPHES_AMF.filter((x) => x.categorie === 'A' && !vivier.has(x.id)).map((x) => x.id)
    expect(sansQuestion).toEqual([])
  })
})

describe('examen blanc', () => {
  it('garde la part officielle de catégorie A', () => {
    expect(REPARTITION_EXAMEN_BLANC).toEqual({ A: 8, C: 22 })
  })

  it('a assez de QCM dans chaque catégorie', () => {
    const vivier = [...vivierExamenBlanc().values()].flat()
    expect(vivier.filter((q) => categorieAmf(q.id) === 'A').length).toBeGreaterThanOrEqual(REPARTITION_EXAMEN_BLANC.A)
    expect(vivier.filter((q) => categorieAmf(q.id) === 'C').length).toBeGreaterThanOrEqual(REPARTITION_EXAMEN_BLANC.C)
  })

  it('tire 30 questions sans doublon, avec la bonne répartition', () => {
    const a = new Aleatoire(5)
    const questions = tirerExamenBlanc(() => a.suivant())
    expect(questions).toHaveLength(QUESTIONS_EXAMEN_BLANC)
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length)
    expect(questions.filter((q) => categorieAmf(q.id) === 'A')).toHaveLength(REPARTITION_EXAMEN_BLANC.A)
  })

  it('exige 80 % dans chaque catégorie, sans compensation, et note chaque thème', () => {
    const reponses = (ids: string[], justes: number) => ids.map((questionId, i) => ({ questionId, juste: i < justes }))
    const a = ['m9-p5-q3', 'm9-p5-q1', 'm3-p5-q2', 'm3-p5-q3', 'm0-p5-q1']
    const c = ['m5-p4-q3', 'm5-p4-q4', 'm7-p4-q3', 'm7-p4-q5', 'm2-p4-q1']
    const echec = bilanExamenBlanc([...reponses(a, 3), ...reponses(c, 5)])
    expect(echec.A).toEqual({ justes: 3, total: 5, reussi: false })
    expect(echec.C.reussi).toBe(true)
    expect(echec.reussi).toBe(false)
    expect(echec.parTheme.find((t) => t.theme === 3)).toEqual({ theme: 3, justes: 1, total: 1 })
    expect(bilanExamenBlanc([...reponses(a, 4), ...reponses(c, 4)]).reussi).toBe(true)
  })

  it('est conseillé après un premier palier Professionnel', () => {
    const base = { modeExpert: false, leviersForces: [] }
    expect(examenBlancConseille({ ...base, modules: [{ moduleId: 2, paliersMaitrises: 4 }] })).toBe(false)
    expect(examenBlancConseille({ ...base, modules: [{ moduleId: 2, paliersMaitrises: 5 }] })).toBe(true)
  })
})

describe('enregistrement des examens blancs', () => {
  let base: BaseMoneyTree
  let compteur = 0
  beforeEach(async () => {
    compteur += 1
    base = creerBase(`moneytree-examen-blanc-${String(compteur)}`)
    await base.open()
  })
  afterEach(async () => {
    await base.delete()
  })

  it('garde l’historique et attribue le badge à la réussite', async () => {
    const reponses = [
      ...['m9-p5-q3', 'm9-p5-q1', 'm3-p5-q2', 'm3-p5-q3', 'm0-p5-q1'].map((questionId) => ({ questionId, juste: true, type: 'qcm' as const })),
      ...['m5-p4-q3', 'm5-p4-q4', 'm7-p4-q3', 'm7-p4-q5', 'm2-p4-q1'].map((questionId, i) => ({ questionId, juste: i < 4, type: 'qcm' as const })),
    ]
    const r = await terminerExamenBlanc(reponses, base, new Date(2026, 10, 18, 10))
    expect(r.bilan.reussi).toBe(true)
    expect(r.nouveauxBadges).toEqual(['examen-blanc'])
    expect(r.xpGagne).toBe(9 * 10 + 100)
    const profil = await lireProfil(base)
    expect(profil.examensBlancs?.[0]).toMatchObject({ A: { justes: 5, total: 5 }, C: { justes: 4, total: 5 }, reussi: true })
  })
})
