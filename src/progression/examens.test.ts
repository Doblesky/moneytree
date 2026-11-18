import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { origine, palier } from '../content/catalogue.ts'
import { Aleatoire } from '../engine/aleatoire.ts'
import { lireEtatProgression, terminerExamen, terminerQuizPalier, type ReponseQuiz } from '../storage/apprentissage.ts'
import { creerBase, type BaseMoneyTree } from '../storage/db.ts'
import { lireProfil } from '../storage/profil.ts'
import { bonnesReponsesRequises, examenReussi, melanger, melangerChoix, QUESTIONS_PAR_EXAMEN, tirerExamen } from './examens.ts'
import {
  avancementGlobal,
  etatExamen,
  niveauAtteint,
  paliersValides,
  prochaineEtape,
  type EtatProgression,
} from './regles.ts'

const hasard = () => {
  const a = new Aleatoire(42)
  return () => a.suivant()
}

describe('tirage d’un examen', () => {
  it('mélange sans perdre ni dupliquer', () => {
    const t = [1, 2, 3, 4, 5, 6, 7]
    const m = melanger(t, hasard())
    expect([...m].sort()).toEqual(t)
    expect(t).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('mélange les choix d’un QCM en suivant la bonne réponse', () => {
    const q = palier(0, 1, 'ingenieur')?.questions.find((x) => x.type === 'qcm')
    if (q?.type !== 'qcm') throw new Error('QCM attendu')
    const melangee = melangerChoix(q, hasard())
    if (melangee.type !== 'qcm') throw new Error('QCM attendu')
    expect(melangee.choix[melangee.bonne]).toBe(q.choix[q.bonne])
    expect([...melangee.choix].sort()).toEqual([...q.choix].sort())
  })

  it('reprend les questions du palier et complète avec les paliers précédents', () => {
    const p1 = tirerExamen(3, 1, hasard(), 'ingenieur')
    expect(p1.every((q) => origine(q.id).palier === 1 && origine(q.id).module === 3)).toBe(true)
    expect(p1).toHaveLength(palier(3, 1, 'ingenieur')?.questions.length ?? 0)

    const p3 = tirerExamen(3, 3, hasard(), 'ingenieur')
    expect(p3).toHaveLength(QUESTIONS_PAR_EXAMEN)
    expect(new Set(p3.map((q) => q.id)).size).toBe(QUESTIONS_PAR_EXAMEN)
    const duPalier = p3.filter((q) => origine(q.id).palier === 3)
    expect(duPalier).toHaveLength(palier(3, 3, 'ingenieur')?.questions.length ?? 0)
    expect(p3.every((q) => origine(q.id).module === 3 && origine(q.id).palier <= 3)).toBe(true)
  })

  it('exige 90 % arrondi au-dessus', () => {
    expect(bonnesReponsesRequises(10)).toBe(9)
    expect(bonnesReponsesRequises(5)).toBe(5)
    expect(bonnesReponsesRequises(6)).toBe(6)
    expect(examenReussi(9, 10)).toBe(true)
    expect(examenReussi(8, 10)).toBe(false)
    expect(examenReussi(0, 0)).toBe(false)
  })
})

const depart: EtatProgression = { metier: 'ingenieur', modeExpert: false, modules: [], leviersForces: [] }

describe('règles des examens', () => {
  it('ouvre l’examen le lendemain de la maîtrise', () => {
    const etat = { ...depart, modules: [{ moduleId: 0, paliersMaitrises: 1, maitrisesLe: { '1': '2026-11-18' } }] }
    expect(etatExamen(depart, 0, 1, '2026-11-18')).toBe('verrouille')
    expect(etatExamen(etat, 0, 1, '2026-11-18')).toBe('demain')
    expect(etatExamen(etat, 0, 1, '2026-11-19')).toBe('ouvert')
    // Palier maîtrisé avant la phase 5 (sans date) : ouvert tout de suite.
    expect(etatExamen({ ...depart, modules: [{ moduleId: 0, paliersMaitrises: 1 }] }, 0, 1, '2026-11-18')).toBe('ouvert')
  })

  it('compte les examens pour moitié dans l’avancement', () => {
    const maitrise: EtatProgression = { ...depart, modules: [{ moduleId: 0, paliersMaitrises: 2 }] }
    expect(avancementGlobal(maitrise)).toBeCloseTo(2 / 100)
    const valide: EtatProgression = {
      ...depart,
      modules: [
        {
          moduleId: 0,
          paliersMaitrises: 2,
          examens: { '1': { tentatives: 2, meilleurScore: 1, valideLe: '2026-11-18' }, '2': { tentatives: 1, meilleurScore: 0.7 } },
        },
      ],
    }
    expect(paliersValides(valide, 0)).toBe(1)
    expect(avancementGlobal(valide)).toBeCloseTo(3 / 100)
    expect(etatExamen(valide, 0, 1, '2026-11-18')).toBe('valide')
    expect(etatExamen(valide, 0, 2, '2026-11-18')).toBe('ouvert')
  })

  it('donne le niveau atteint dans les dix modules', () => {
    const examen = { tentatives: 1, meilleurScore: 1, valideLe: '2026-11-18' }
    const tous: EtatProgression = {
      ...depart,
      modules: Array.from({ length: 10 }, (_, id) => {
        const examens: Record<string, typeof examen> = id < 4 ? { '1': examen, '2': examen } : { '1': examen }
        return { moduleId: id, paliersMaitrises: 2, examens }
      }),
    }
    expect(niveauAtteint(depart)).toEqual({ palier: 0, modulesAuSuivant: 0 })
    expect(niveauAtteint(tous)).toEqual({ palier: 1, modulesAuSuivant: 4 })
  })

  it('propose un examen ouvert après la découverte et le quiz du jour', () => {
    const etat: EtatProgression = {
      ...depart,
      modules: [
        { moduleId: 0, paliersMaitrises: 1, maitrisesLe: { '1': '2026-11-17' } },
        { moduleId: 1, paliersMaitrises: 1, maitrisesLe: { '1': '2026-11-18' } },
        { moduleId: 2, paliersMaitrises: 1 },
      ],
    }
    // Le module 3 est ouvert et pas découvert : il passe d'abord.
    expect(prochaineEtape(etat, { questionsARevoir: 0, aujourdhui: '2026-11-18' })).toMatchObject({ type: 'palier', moduleId: 3 })
    const sansDecouverte = { ...etat, modules: [...etat.modules, { moduleId: 3, paliersMaitrises: 1 }].map((m) => ({ ...m })) }
    const tousDecouverts = {
      ...sansDecouverte,
      modules: Array.from({ length: 10 }, (_, id) => sansDecouverte.modules.find((m) => m.moduleId === id) ?? { moduleId: id, paliersMaitrises: 1 }),
    }
    expect(prochaineEtape(tousDecouverts, { questionsARevoir: 2, aujourdhui: '2026-11-18' })).toEqual({ type: 'quiz-du-jour' })
    expect(prochaineEtape(tousDecouverts, { questionsARevoir: 0, aujourdhui: '2026-11-18' })).toEqual({
      type: 'examen',
      moduleId: 0,
      palier: 1,
    })
    // Sans date du jour, pas d'examen proposé.
    expect(prochaineEtape(tousDecouverts, { questionsARevoir: 0 }).type).toBe('palier')
  })
})

describe('enregistrement des examens', () => {
  let base: BaseMoneyTree
  let compteur = 0
  beforeEach(async () => {
    compteur += 1
    base = creerBase(`moneytree-examens-${compteur}`)
    await base.open()
  })
  afterEach(async () => {
    await base.delete()
  })

  const reponses = (justes: number, total: number): ReponseQuiz[] =>
    Array.from({ length: total }, (_, i) => ({ questionId: `m0-p1-q${i + 1}`, juste: i < justes, type: 'qcm' as const }))

  it('date la première maîtrise d’un palier', async () => {
    await terminerQuizPalier(0, 1, reponses(5, 5), base, new Date(2026, 10, 18, 10))
    await terminerQuizPalier(0, 1, reponses(5, 5), base, new Date(2026, 10, 20, 10))
    const etat = await lireEtatProgression(base)
    expect(etat.modules[0]?.maitrisesLe).toEqual({ '1': '2026-11-18' })
    expect(etatExamen(etat, 0, 1, '2026-11-18')).toBe('demain')
  })

  it('valide le palier à la première réussite, sans pénaliser les échecs', async () => {
    await terminerQuizPalier(0, 1, reponses(5, 5), base, new Date(2026, 10, 17, 10))
    const xpAvant = (await lireProfil(base)).xp ?? 0

    const echec = await terminerExamen(0, 1, reponses(4, 5), base, new Date(2026, 10, 18, 10))
    expect(echec).toMatchObject({ reussi: false, requis: 5, nouvelleValidation: false })
    let etat = await lireEtatProgression(base)
    expect(etat.modules[0]?.examens?.['1']).toEqual({ tentatives: 1, meilleurScore: 0.8 })

    const reussite = await terminerExamen(0, 1, reponses(5, 5), base, new Date(2026, 10, 19, 10))
    expect(reussite).toMatchObject({ reussi: true, nouvelleValidation: true })
    expect(reussite.nouveauxBadges).toContain('premier-examen')
    expect(reussite.xpGagne).toBe(5 * 10 + 100)

    const encore = await terminerExamen(0, 1, reponses(3, 5), base, new Date(2026, 10, 21, 10))
    expect(encore.nouvelleValidation).toBe(false)
    etat = await lireEtatProgression(base)
    expect(etat.modules[0]?.examens?.['1']).toEqual({ tentatives: 3, meilleurScore: 1, valideLe: '2026-11-19' })
    expect((await lireProfil(base)).xp).toBe(xpAvant + 4 * 10 + 150 + 3 * 10)
  })
})
