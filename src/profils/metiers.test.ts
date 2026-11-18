import { describe, expect, it } from 'vitest'
import { casParId } from '../content/cas.ts'
import {
  contenuModule,
  idDeBase,
  infoModule,
  LEVIERS,
  MODULES,
  modulesDuMetier,
  moduleSuivant,
  origine,
  paliersDisponibles,
  questionParId,
  toutesLesQuestions,
  variantesDuMetier,
} from '../content/catalogue.ts'
import { schemaContenuModule } from '../content/schema.ts'
import module0 from '../content/modules/module-0.json'
import module1 from '../content/modules/module-1.json'
import module2 from '../content/modules/module-2.json'
import module3 from '../content/modules/module-3.json'
import module4 from '../content/modules/module-4.json'
import module5 from '../content/modules/module-5.json'
import module6 from '../content/modules/module-6.json'
import module7 from '../content/modules/module-7.json'
import module8 from '../content/modules/module-8.json'
import module9 from '../content/modules/module-9.json'
import {
  avancementGlobal,
  carriereOuverte,
  levierDebloque,
  moduleOuvert,
  ordreSelonObjectif,
  type EtatProgression,
} from '../progression/regles.ts'
import { IDS_METIER, METIER_PAR_DEFAUT, METIERS, metierDe } from './metiers.ts'

const ingenieur: EtatProgression = { metier: 'ingenieur', modeExpert: false, modules: [], leviersForces: [] }
const prof: EtatProgression = { ...ingenieur, metier: 'prof-second-degre' }
const termines = (ids: number[]) => ids.map((moduleId) => ({ moduleId, paliersMaitrises: 1 }))

describe('profils de métier', () => {
  it('une installation sans profil reste en ingénieur', () => {
    expect(METIER_PAR_DEFAUT).toBe('ingenieur')
    expect(metierDe(undefined)).toBe('ingenieur')
    expect(metierDe({})).toBe('ingenieur')
    expect(metierDe({ metier: 'inconnu' })).toBe('ingenieur')
    expect(metierDe({ metier: 'prof-second-degre' })).toBe('prof-second-degre')
  })

  it.each(IDS_METIER)('%s : des modules existants, sans doublon, qui commencent par le module 0', (id) => {
    const m = METIERS[id]
    expect(new Set(m.modules).size).toBe(m.modules.length)
    expect(m.modules[0]).toBe(0)
    for (const moduleId of m.modules) expect(infoModule(moduleId, id), String(moduleId)).toBeDefined()
    for (const moduleId of m.modulesCarriere) expect(m.modules).toContain(moduleId)
    for (const liste of Object.values(m.priorites)) for (const moduleId of liste) expect(m.modules).toContain(moduleId)
    for (const cas of m.cas) for (const moduleId of casParId(cas).modules) expect(m.modules).toContain(moduleId)
    for (const levier of m.leviersAbsents) expect(LEVIERS[levier]).toBeDefined()
  })

  it('le parcours ingénieur est celui d’avant les profils : modules 0 à 9, dans l’ordre', () => {
    expect(METIERS.ingenieur.modules).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(modulesDuMetier('ingenieur')).toEqual(MODULES)
    expect(METIERS.ingenieur.suffixe).toBeNull()
    expect(variantesDuMetier('ingenieur')).toEqual([])
  })

  it('le contenu ingénieur est exactement celui des fichiers du tronc commun', () => {
    const fichiers = [module0, module1, module2, module3, module4, module5, module6, module7, module8, module9]
    for (const brut of fichiers) {
      const attendu = schemaContenuModule.parse(brut)
      expect(contenuModule(attendu.module, 'ingenieur')).toEqual(attendu)
    }
  })
})

describe('ouverture des modules selon le profil', () => {
  it('ingénieur : chaque module ouvre le suivant, comme avant', () => {
    expect(moduleOuvert(ingenieur, 0)).toBe(true)
    expect(moduleOuvert(ingenieur, 1)).toBe(false)
    expect(moduleOuvert({ ...ingenieur, modules: termines([0]) }, 1)).toBe(true)
    expect(moduleOuvert({ ...ingenieur, modules: termines([0, 1, 2, 3, 4, 5, 6, 7]) }, 8)).toBe(true)
    // Les modules prof ne font pas partie de son parcours, même en mode expert.
    expect(moduleOuvert({ ...ingenieur, modeExpert: true }, 10)).toBe(false)
    expect(moduleSuivant(2, 'ingenieur')?.id).toBe(3)
  })

  it('prof : le module 0 ouvre « Devenir prof », qui ouvre la fiche de paie, puis le tronc commun', () => {
    expect(moduleOuvert(prof, 0)).toBe(true)
    expect(moduleOuvert(prof, 10)).toBe(false)
    expect(moduleOuvert({ ...prof, modules: termines([0]) }, 10)).toBe(true)
    expect(moduleOuvert({ ...prof, modules: termines([0]) }, 1)).toBe(false)
    expect(moduleOuvert({ ...prof, modules: termines([0, 10, 11]) }, 1)).toBe(true)
    expect(moduleSuivant(11, 'prof-second-degre')?.id).toBe(1)
    expect(moduleSuivant(9, 'prof-second-degre')).toBeNull()
  })

  it('prof : le mode carrière s’ouvre avec les modules 0, 10 et 11', () => {
    expect(carriereOuverte({ ...prof, modules: termines([0, 1, 2]) })).toBe(false)
    expect(carriereOuverte({ ...prof, modules: termines([0, 10, 11]) })).toBe(true)
    expect(carriereOuverte({ ...ingenieur, modules: termines([0, 1, 2]) })).toBe(true)
  })

  it('prof : l’épargne salariale n’existe pas, même en mode expert', () => {
    expect(levierDebloque({ ...prof, modeExpert: true }, 'epargneSalariale')).toBe(false)
    expect(levierDebloque({ ...prof, modeExpert: true }, 'per')).toBe(true)
    expect(levierDebloque({ ...ingenieur, modeExpert: true }, 'epargneSalariale')).toBe(true)
  })

  it('l’avancement se calcule sur les modules du profil', () => {
    const tout = (ids: readonly number[]) => ids.map((moduleId) => ({ moduleId, paliersMaitrises: 5 }))
    expect(avancementGlobal({ ...prof, modules: tout(METIERS.ingenieur.modules) })).toBeCloseTo(
      (10 * 5) / (16 * 5 * 2),
      9,
    )
    expect(avancementGlobal({ ...ingenieur, modules: tout(METIERS.ingenieur.modules) })).toBeCloseTo(0.5, 9)
  })

  it('l’ordre selon l’objectif reste dans le parcours du profil', () => {
    expect(ordreSelonObjectif('precaution', 'ingenieur')).toEqual([0, 2, 1, 3, 4, 5, 6, 7, 8, 9])
    const ordre = ordreSelonObjectif('precaution', 'prof-second-degre')
    expect([...ordre].sort((a, b) => a - b)).toEqual([...METIERS['prof-second-degre'].modules].sort((a, b) => a - b))
    expect(ordre.slice(0, 3)).toEqual([0, 10, 11])
    expect(ordreSelonObjectif('inconnu', 'prof-second-degre')).toEqual(METIERS['prof-second-degre'].modules)
  })
})

describe('variantes du profil prof', () => {
  const suffixe = METIERS['prof-second-degre'].suffixe ?? ''

  it('portent le suffixe du profil et le bon module', () => {
    for (const v of variantesDuMetier('prof-second-degre')) {
      const objets = [...(v.cartes ?? []), ...(v.questions ?? []), ...(v.paliers ?? []).flatMap((p) => [...p.cartes, ...p.questions])]
      for (const o of objets) {
        expect(o.id.endsWith(`-${suffixe}`), o.id).toBe(true)
        expect(origine(o.id).module, o.id).toBe(v.module)
      }
      for (const p of v.paliers ?? []) {
        for (const o of [...p.cartes, ...p.questions]) expect(origine(o.id).palier, o.id).toBe(p.numero)
      }
    }
  })

  it('remplacent la carte ou la question de base, sans laisser l’ancienne', () => {
    for (const v of variantesDuMetier('prof-second-degre')) {
      const contenu = contenuModule(v.module, 'prof-second-degre')
      const ids = new Set(contenu?.paliers.flatMap((p) => [...p.cartes, ...p.questions].map((o) => o.id)))
      for (const o of [...(v.cartes ?? []), ...(v.questions ?? [])]) {
        if (origine(o.id).palier <= (v.paliersDisponibles ?? 5)) expect(ids.has(o.id), o.id).toBe(true)
        expect(ids.has(idDeBase(o.id, suffixe)), o.id).toBe(false)
      }
    }
  })

  it('les questions prof ne sont pas proposées à l’ingénieur, et inversement', () => {
    const idsProf = new Set(toutesLesQuestions('prof-second-degre').map((q) => q.id))
    for (const q of toutesLesQuestions('ingenieur')) {
      if (!idsProf.has(q.id)) expect(questionParId(q.id, 'prof-second-degre'), q.id).toBeUndefined()
    }
    for (const id of idsProf) {
      if (id.endsWith(`-${suffixe}`) || origine(id).module >= 10) expect(questionParId(id, 'ingenieur'), id).toBeUndefined()
    }
  })

  it('chaque module du parcours prof propose au moins son palier Découverte', () => {
    for (const id of METIERS['prof-second-degre'].modules) {
      expect(paliersDisponibles(id, 'prof-second-degre'), `module ${String(id)}`).toBeGreaterThanOrEqual(1)
    }
  })
})
