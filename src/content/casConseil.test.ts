import { describe, expect, it } from 'vitest'
import { casOuvert, type EtatProgression } from '../progression/regles.ts'
import { CAS_ECOLE, casParId } from './cas.ts'
import { CAS_CONSEIL } from './casConseil.ts'

describe('cas de conseil client', () => {
  it('a un cas d’école pour chaque dossier, ouvert au palier Professionnel', () => {
    const idsConseil = CAS_ECOLE.filter((c) => c.palier === 5).map((c) => c.id)
    expect(CAS_CONSEIL.map((c) => c.id)).toEqual(idsConseil)
    for (const c of CAS_CONSEIL) expect(casParId(c.id as never).disponible).toBe(true)
  })

  it('pose cinq décisions sourcées par dossier, avec des identifiants uniques', () => {
    const ids = CAS_CONSEIL.flatMap((c) => c.questions.map((q) => q.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of CAS_CONSEIL) {
      expect(c.questions).toHaveLength(5)
      for (const q of c.questions) {
        expect(q.sources.length).toBeGreaterThan(0)
        expect(q.bonne).toBeLessThan(q.choix.length)
        expect(new Set(q.choix).size).toBe(q.choix.length)
      }
    }
  })

  it('s’ouvre quand chaque module du cas a son palier 5 maîtrisé', () => {
    const base: EtatProgression = { modeExpert: false, modules: [], leviersForces: [] }
    const ifi = casParId('conseil-ifi')
    const unSeul = { ...base, modules: [{ moduleId: 1, paliersMaitrises: 5 }, { moduleId: 2, paliersMaitrises: 4 }] }
    const lesDeux = { ...base, modules: [{ moduleId: 1, paliersMaitrises: 5 }, { moduleId: 2, paliersMaitrises: 5 }] }
    expect(casOuvert(unSeul, ifi.modules, ifi.palier)).toBe(false)
    expect(casOuvert(lesDeux, ifi.modules, ifi.palier)).toBe(true)
    // Les cas des phases 3 et 4 restent ouverts avec le palier Découverte.
    expect(casOuvert({ ...base, modules: [{ moduleId: 6, paliersMaitrises: 1 }] }, [6])).toBe(true)
  })
})
