import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import { avancer, creerPartie, VERSION_ETAT_PARTIE } from '../engine/simulation.ts'
import { moduleOuvert } from '../progression/regles.ts'
import {
  badgesDuSimulateur,
  debloquerLevier,
  debloquerModule,
  lireEtatProgression,
  noterCarte,
  questionsDisponibles,
  terminerQuizDuJour,
  terminerQuizPalier,
  type ReponseQuiz,
} from './apprentissage.ts'
import { creerBase, type BaseMoneyTree } from './db.ts'
import {
  creerSauvegarde,
  dupliquerPartie,
  enregistrerPartie,
  lirePartie,
  lirePartieActive,
  listerParties,
  ouvrirPartie,
  renommerPartie,
  supprimerPartie,
} from './partie.ts'
import { lireProfil } from './profil.ts'

let base: BaseMoneyTree
let compteur = 0

beforeEach(async () => {
  compteur += 1
  base = creerBase(`moneytree-apprentissage-${compteur}`)
  await base.open()
})

afterEach(async () => {
  await base.delete()
})

const reponses = (justes: number, total: number): ReponseQuiz[] =>
  Array.from({ length: total }, (_, i) => ({
    questionId: `m0-p1-q${i + 1}`,
    juste: i < justes,
    type: 'qcm' as const,
  }))

const MAINTENANT = new Date(2026, 10, 17, 12)

describe('quiz de palier', () => {
  it('maîtrise le palier à 80 %, termine le module et ouvre le suivant', async () => {
    await noterCarte(0, 1, 3, base)
    const r = await terminerQuizPalier(0, 1, reponses(5, 6), base, MAINTENANT)
    expect(r.maitrise).toBe(true)
    expect(r.nouveauPalier).toBe(true)
    expect(r.moduleTermine).toBe(0)
    expect(r.moduleOuvert).toBe(1)
    // 5 bonnes réponses × 10 + palier 50 + module 100.
    expect(r.xpGagne).toBe(200)
    expect(r.nouveauxBadges).toEqual(expect.arrayContaining(['premier-palier', 'bases']))

    const etat = await lireEtatProgression(base)
    expect(moduleOuvert(etat, 1)).toBe(true)
    expect(etat.modules.find((m) => m.moduleId === 0)?.enCours).toBeUndefined()
    expect((await lireProfil(base)).xp).toBe(200)
    expect(await base.reponses.count()).toBe(6)
    expect((await base.journees.get('2026-11-17'))?.paliers).toBe(1)
  })

  it('ne compte pas les révisions dans la maîtrise, mais les note pour la répétition espacée', async () => {
    const revisions: ReponseQuiz[] = [
      { questionId: 'm1-p1-q1', juste: false, type: 'qcm', revision: true },
      { questionId: 'm1-p1-q2', juste: false, type: 'qcm', revision: true },
    ]
    const r = await terminerQuizPalier(0, 1, [...reponses(4, 5), ...revisions], base, MAINTENANT)
    expect(r.total).toBe(5)
    expect(r.score).toBe(0.8)
    expect(r.maitrise).toBe(true)
    expect(r.revisions).toEqual({ justes: 0, total: 2 })
    expect((await base.reponses.get('m1-p1-q1'))?.boite).toBe(1)
    expect((await base.journees.get('2026-11-17'))?.questions).toBe(7)
  })

  it('ne maîtrise pas le palier sous 80 % et garde la reprise', async () => {
    await noterCarte(0, 1, 4, base)
    const r = await terminerQuizPalier(0, 1, reponses(3, 5), base, MAINTENANT)
    expect(r.maitrise).toBe(false)
    expect(r.xpGagne).toBe(30)
    const etat = await lireEtatProgression(base)
    expect(etat.modules[0]?.paliersMaitrises).toBe(0)
    expect(etat.modules[0]?.enCours).toEqual({ palier: 1, carte: 4 })
  })

  it('ne redonne pas le bonus de palier une deuxième fois', async () => {
    await terminerQuizPalier(0, 1, reponses(5, 5), base, MAINTENANT)
    const second = await terminerQuizPalier(0, 1, reponses(5, 5), base, MAINTENANT)
    expect(second.nouveauPalier).toBe(false)
    expect(second.xpGagne).toBe(50)
  })
})

describe('quiz du jour, déblocages et vivier de questions', () => {
  it('donne le bonus du quiz du jour une fois par jour', async () => {
    const premier = await terminerQuizDuJour(reponses(2, 3), base, MAINTENANT)
    expect(premier.xpGagne).toBe(20 + 30)
    const second = await terminerQuizDuJour(reponses(1, 3), base, MAINTENANT)
    expect(second.xpGagne).toBe(10)
  })

  it('débloque un module et un levier quand même', async () => {
    await debloquerModule(4, base)
    await debloquerLevier('pea', base)
    const etat = await lireEtatProgression(base)
    expect(moduleOuvert(etat, 4)).toBe(true)
    expect(etat.leviersForces).toEqual(['pea'])
  })

  it('ne propose au quiz du jour que des questions des paliers vus', async () => {
    expect(questionsDisponibles(await lireEtatProgression(base))).toEqual([])
    await noterCarte(0, 1, 0, base)
    const ids = questionsDisponibles(await lireEtatProgression(base))
    expect(ids.length).toBeGreaterThan(3)
    expect(ids.every((id) => id.startsWith('m0-p1-'))).toBe(true)
  })
})

describe('partie du simulateur', () => {
  it('enregistre, relit et supprime la partie et son point de sauvegarde', async () => {
    const p = parametres2026()
    const depart = creerPartie({
      brutAnnuel: 42000,
      depensesMensuelles: 1500,
      graine: 1,
      calendrier: { annee: 2027, mois: 0 },
      debutHistorique: 0,
    })
    const id = await creerSauvegarde('Ma partie', depart, base)
    const plusTard = avancer(depart, p, 12)
    await enregistrerPartie(id, plusTard, depart, base)
    const lue = await lirePartie(id, base)
    expect(lue?.partie.mois).toBe(12)
    expect(lue?.pointDeSauvegarde?.mois).toBe(0)
    expect((await lirePartieActive(base))?.id).toBe(id)
    expect(await badgesDuSimulateur(12, base)).toEqual(['premiere-annee'])
    await supprimerPartie(id, base)
    expect(await lirePartie(id, base)).toBeNull()
    expect(await lirePartieActive(base)).toBeNull()
  })

  it('gère plusieurs parties et en duplique une', async () => {
    const config = {
      brutAnnuel: 42000,
      depensesMensuelles: 1500,
      graine: 1,
      calendrier: { annee: 2027, mois: 0 },
    }
    const a = await creerSauvegarde('Prudente', creerPartie(config), base)
    const b = await creerSauvegarde('Actions', creerPartie({ ...config, mode: 'monte-carlo' }), base)
    expect((await lirePartieActive(base))?.id).toBe(b)
    await ouvrirPartie(a, base)
    expect((await lirePartieActive(base))?.nom).toBe('Prudente')
    const copie = await dupliquerPartie(a, 'Prudente (copie)', base)
    expect(copie).not.toBeNull()
    await renommerPartie(b, 'Tout en actions', base)
    const noms = (await listerParties(base)).map((partie) => partie.nom).sort()
    expect(noms).toEqual(['Prudente', 'Prudente (copie)', 'Tout en actions'])
  })

  it('relit une partie enregistrée par la phase 1', async () => {
    const v2 = creerPartie({ brutAnnuel: 42000, depensesMensuelles: 1500, graine: 1, calendrier: { annee: 2027, mois: 0 } })
    const reste = Object.fromEntries(Object.entries(structuredClone(v2)).filter(([cle]) => !['marche', 'assuranceVie', 'per', 'pee', 'epargneSalariale'].includes(cle)))
    await base.sauvegardes.put({
      id: 1,
      nom: 'Ma partie',
      creeLe: '2026-11-17T10:00:00.000Z',
      majLe: '2026-11-17T10:00:00.000Z',
      etat: { partie: { ...reste, version: 1 }, pointDeSauvegarde: null },
    })
    const lue = await lirePartie(1, base)
    expect(lue?.partie.version).toBe(VERSION_ETAT_PARTIE)
    expect(lue?.partie.marche.mode).toBe('historique')
  })
})
