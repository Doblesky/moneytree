import { describe, expect, it } from 'vitest'
import { niveau, progressionNiveau, semaine, serieDeJours, seuilNiveau } from './gamification.ts'
import {
  ajouterJours,
  apresReponse,
  aRevoir,
  intercalerRevisions,
  questionsDeRevision,
  questionsDuJour,
  type EntreeLeitner,
} from './leitner.ts'
import {
  carriereOuverte,
  etatPalier,
  levierDebloque,
  moduleOuvert,
  palierOuvert,
  prochaineEtape,
  type EtatProgression,
} from './regles.ts'

const depart: EtatProgression = { modeExpert: false, modules: [], leviersForces: [] }

describe('ouvertures', () => {
  it('n’ouvre que le module 0 au départ', () => {
    expect(moduleOuvert(depart, 0)).toBe(true)
    expect(moduleOuvert(depart, 1)).toBe(false)
    expect(palierOuvert(depart, 0, 1)).toBe(true)
    expect(palierOuvert(depart, 0, 2)).toBe(false)
    expect(etatPalier(depart, 0, 4)).toBe('a-venir')
  })

  it('ouvre le palier suivant et le module suivant après le palier Découverte', () => {
    const etat = { ...depart, modules: [{ moduleId: 0, paliersMaitrises: 1 }] }
    expect(palierOuvert(etat, 0, 2)).toBe(true)
    expect(moduleOuvert(etat, 1)).toBe(true)
    expect(moduleOuvert(etat, 2)).toBe(false)
    expect(etatPalier(etat, 0, 1)).toBe('maitrise')
  })

  it('débloque les leviers avec leur module, et le mode carrière après les modules 0 à 2', () => {
    const etat = {
      ...depart,
      modules: [0, 1, 2].map((moduleId) => ({ moduleId, paliersMaitrises: 1 })),
    }
    expect(levierDebloque(depart, 'ldds')).toBe(false)
    expect(levierDebloque(etat, 'ldds')).toBe(true)
    expect(levierDebloque(etat, 'pea')).toBe(false)
    expect(carriereOuverte(depart)).toBe(false)
    expect(carriereOuverte(etat)).toBe(true)
  })

  it('respecte « débloquer quand même » et le mode expert', () => {
    const force: EtatProgression = {
      ...depart,
      modules: [{ moduleId: 4, paliersMaitrises: 0, debloqueQuandMeme: true }],
      leviersForces: ['pea'],
    }
    expect(moduleOuvert(force, 4)).toBe(true)
    expect(levierDebloque(force, 'pea')).toBe(true)
    const expert = { ...depart, modeExpert: true }
    expect(moduleOuvert(expert, 9)).toBe(true)
    expect(palierOuvert(expert, 0, 3)).toBe(true)
    expect(levierDebloque(expert, 'lep')).toBe(true)
  })
})

describe('prochaine étape', () => {
  it('propose le palier Découverte du module 0 au départ', () => {
    expect(prochaineEtape(depart, { questionsARevoir: 0 })).toEqual({
      type: 'palier',
      moduleId: 0,
      palier: 1,
      carte: 0,
      reprise: false,
    })
  })

  it('reprend d’abord un palier commencé', () => {
    const etat = { ...depart, modules: [{ moduleId: 0, paliersMaitrises: 1, enCours: { palier: 2, carte: 2 } }] }
    expect(prochaineEtape(etat, { questionsARevoir: 3 })).toMatchObject({ palier: 2, carte: 2, reprise: true })
  })

  it('découvre les modules ouverts avant d’approfondir, puis propose le quiz du jour', () => {
    const etat = { ...depart, modules: [{ moduleId: 0, paliersMaitrises: 1 }] }
    expect(prochaineEtape(etat, { questionsARevoir: 2 })).toMatchObject({ moduleId: 1, palier: 1 })
    // Modules 0 à 2 maîtrisés : le module 3 s'ouvre et passe avant l'approfondissement.
    const troisModules = { ...depart, modules: [0, 1, 2].map((moduleId) => ({ moduleId, paliersMaitrises: 3 })) }
    expect(prochaineEtape(troisModules, { questionsARevoir: 2 })).toMatchObject({ moduleId: 3, palier: 1 })
    // Tous les paliers rédigés (modules 0 à 5) maîtrisés : place aux révisions.
    const tout = { ...depart, modules: [0, 1, 2, 3, 4, 5].map((moduleId) => ({ moduleId, paliersMaitrises: 3 })) }
    expect(prochaineEtape(tout, { questionsARevoir: 2 })).toEqual({ type: 'quiz-du-jour' })
    expect(prochaineEtape(tout, { questionsARevoir: 0 })).toEqual({ type: 'simulateur' })
  })
})

describe('répétition espacée (Leitner)', () => {
  const maintenant = new Date(2026, 10, 17, 10)

  it('fait monter une bonne réponse et redescendre une erreur en boîte 1', () => {
    const premiere = apresReponse(undefined, 'q', true, maintenant)
    expect(premiere).toMatchObject({ boite: 1, prochaineRevision: '2026-11-18', vues: 1, justes: 1 })
    const seconde = apresReponse(premiere, 'q', true, maintenant)
    expect(seconde).toMatchObject({ boite: 2, prochaineRevision: '2026-11-19' })
    const erreur = apresReponse(seconde, 'q', false, maintenant)
    expect(erreur).toMatchObject({ boite: 1, prochaineRevision: '2026-11-18', vues: 3, justes: 2 })
  })

  it('choisit d’abord les questions à revoir, puis les nouvelles', () => {
    const entrees: EntreeLeitner[] = [
      { questionId: 'a', boite: 3, prochaineRevision: '2026-11-20', vues: 3, justes: 3, majLe: '' },
      { questionId: 'b', boite: 1, prochaineRevision: '2026-11-17', vues: 1, justes: 0, majLe: '' },
    ]
    expect(aRevoir(entrees, '2026-11-17').map((e) => e.questionId)).toEqual(['b'])
    expect(questionsDuJour(entrees, ['a', 'b', 'c', 'd'], '2026-11-17')).toEqual(['b', 'c', 'd'])
    expect(questionsDuJour(entrees, ['a', 'b'], '2026-11-17')).toEqual(['b', 'a'])
  })

  it('passe les fins de mois', () => {
    expect(ajouterJours('2026-11-30', 1)).toBe('2026-12-01')
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('XP, niveaux et série', () => {
  it('calcule les niveaux', () => {
    expect(niveau(0)).toBe(1)
    expect(niveau(49)).toBe(1)
    expect(niveau(50)).toBe(2)
    expect(niveau(1240)).toBe(5)
    expect(seuilNiveau(5)).toBe(800)
    expect(progressionNiveau(800)).toBe(0)
  })

  it('compte les jours consécutifs, sans perdre la série avant minuit', () => {
    const jours = ['2026-11-14', '2026-11-15', '2026-11-16']
    expect(serieDeJours(jours, '2026-11-16')).toBe(3)
    expect(serieDeJours(jours, '2026-11-17')).toBe(3)
    expect(serieDeJours(jours, '2026-11-18')).toBe(0)
  })

  it('affiche la semaine du lundi au dimanche', () => {
    // Le 17 novembre 2026 est un mardi.
    const s = semaine(['2026-11-16', '2026-11-17'], '2026-11-17')
    expect(s.map((j) => j.jour)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ])
    expect(s.filter((j) => j.actif)).toHaveLength(2)
    expect(s.filter((j) => j.futur)).toHaveLength(5)
  })
})

describe('révisions dans les quiz de palier', () => {
  const entree = (questionId: string, boite: number, prochaineRevision: string, majLe: string): EntreeLeitner => ({
    questionId,
    boite,
    prochaineRevision,
    vues: 1,
    justes: boite > 1 ? 1 : 0,
    majLe,
  })
  const entrees = [
    entree('m0-p1-q1', 4, '2026-12-01', '2026-11-01T10:00:00.000Z'),
    entree('m0-p1-q2', 1, '2026-11-18', '2026-11-16T10:00:00.000Z'),
    entree('m1-p1-q1', 3, '2026-11-17', '2026-11-10T10:00:00.000Z'),
    entree('m1-p1-q2', 2, '2026-11-25', '2026-11-12T10:00:00.000Z'),
    entree('m2-p1-q1', 1, '2026-11-17', '2026-11-15T10:00:00.000Z'),
  ]
  const toutes = entrees.map((e) => e.questionId)

  it('reprend d’abord les questions à revoir, puis les moins bien sues, hors du palier en cours', () => {
    expect(questionsDeRevision(entrees, toutes, [], '2026-11-17', 2)).toEqual(['m2-p1-q1', 'm1-p1-q1'])
    expect(questionsDeRevision(entrees, toutes, ['m2-p1-q1'], '2026-11-17', 2)).toEqual(['m1-p1-q1', 'm0-p1-q2'])
  })

  it('ne propose que des questions déjà répondues et encore au catalogue', () => {
    expect(questionsDeRevision([], toutes, [], '2026-11-17')).toEqual([])
    expect(questionsDeRevision(entrees, ['m0-p1-q1'], [], '2026-11-17')).toEqual(['m0-p1-q1'])
  })

  it('glisse les révisions au milieu du quiz, jamais en premier', () => {
    expect(intercalerRevisions<number | string>([1, 2, 3, 4, 5], ['a', 'b'])).toEqual([1, 2, 'a', 3, 4, 'b', 5])
    expect(intercalerRevisions<number | string>([1, 2, 3, 4, 5], ['a'])).toEqual([1, 2, 'a', 3, 4, 5])
    expect(intercalerRevisions([1, 2, 3], [])).toEqual([1, 2, 3])
  })
})
