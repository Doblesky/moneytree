import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { origine } from '../content/catalogue.ts'
import { Aleatoire } from '../engine/aleatoire.ts'
import { terminerExamenBlanc } from '../storage/apprentissage.ts'
import { creerBase, type BaseMoneyTree } from '../storage/db.ts'
import { lireProfil } from '../storage/profil.ts'
import {
  bilanExamenBlanc,
  categorieAmf,
  examenBlancConseille,
  QUESTIONS_PAR_CATEGORIE,
  tirerExamenBlanc,
  vivierExamenBlanc,
} from './examenBlanc.ts'

describe('examen blanc', () => {
  it('classe les paliers réglementaires en connaissances indispensables', () => {
    expect(categorieAmf('m9-p5-q1')).toBe('A')
    expect(categorieAmf('m0-p5-q1')).toBe('A')
    expect(categorieAmf('m3-p4-q1')).toBe('C')
    expect(categorieAmf('m5-p5-q1')).toBe('C')
  })

  it('a assez de QCM dans chaque catégorie', () => {
    const v = vivierExamenBlanc()
    expect(v.A.length).toBeGreaterThanOrEqual(QUESTIONS_PAR_CATEGORIE)
    expect(v.C.length).toBeGreaterThanOrEqual(QUESTIONS_PAR_CATEGORIE)
    expect([...v.A, ...v.C].every((q) => origine(q.id).palier >= 2)).toBe(true)
  })

  it('tire 15 questions par catégorie, sans doublon', () => {
    const a = new Aleatoire(5)
    const questions = tirerExamenBlanc(() => a.suivant())
    expect(questions).toHaveLength(QUESTIONS_PAR_CATEGORIE * 2)
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length)
    expect(questions.filter((q) => categorieAmf(q.id) === 'A')).toHaveLength(QUESTIONS_PAR_CATEGORIE)
  })

  it('exige 80 % dans chaque catégorie, sans compensation', () => {
    const reponses = (prefixe: string, justes: number, total: number) =>
      Array.from({ length: total }, (_, i) => ({ questionId: `${prefixe}-q${String(i + 1)}`, juste: i < justes }))
    // 15/15 en culture financière ne rattrape pas 11/15 en connaissances indispensables.
    const echec = bilanExamenBlanc([...reponses('m9-p5', 11, 15), ...reponses('m5-p4', 15, 15)])
    expect(echec.A).toEqual({ justes: 11, total: 15, reussi: false })
    expect(echec.C.reussi).toBe(true)
    expect(echec.reussi).toBe(false)
    expect(bilanExamenBlanc([...reponses('m9-p5', 12, 15), ...reponses('m5-p4', 12, 15)]).reussi).toBe(true)
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
      ...Array.from({ length: 5 }, (_, i) => ({ questionId: `m9-p5-q${String(i + 1)}`, juste: true, type: 'qcm' as const })),
      ...Array.from({ length: 5 }, (_, i) => ({ questionId: `m5-p4-q${String(i + 1)}`, juste: i < 4, type: 'qcm' as const })),
    ]
    const r = await terminerExamenBlanc(reponses, base, new Date(2026, 10, 18, 10))
    expect(r.bilan.reussi).toBe(true)
    expect(r.nouveauxBadges).toEqual(['examen-blanc'])
    expect(r.xpGagne).toBe(9 * 10 + 100)
    const profil = await lireProfil(base)
    expect(profil.examensBlancs).toHaveLength(1)
    expect(profil.examensBlancs?.[0]).toMatchObject({ A: { justes: 5, total: 5 }, C: { justes: 4, total: 5 }, reussi: true })
  })
})
