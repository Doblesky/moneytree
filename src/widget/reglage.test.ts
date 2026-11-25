import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { creerBase, type BaseMoneyTree } from '../storage/db.ts'
import { lireProfil } from '../storage/profil.ts'
import { modifierReglageWidget, noterEnvoi, noterIntrouvable, reglageWidget } from './reglage.ts'

let base: BaseMoneyTree
let compteur = 0

beforeEach(async () => {
  compteur += 1
  base = creerBase(`moneytree-widget-${compteur}`)
  await base.open()
})

afterEach(async () => {
  await base.delete()
})

describe('réglage du widget', () => {
  it('a un réglage par défaut', async () => {
    expect(reglageWidget(await lireProfil(base))).toEqual({ actif: false, intervalleMinutes: 10 })
  })

  it('activer efface « compagnon introuvable »', async () => {
    await modifierReglageWidget({ actif: true }, base)
    await noterIntrouvable(new Date('2026-11-25T10:00:00.000Z'), base)
    expect(reglageWidget(await lireProfil(base)).introuvableLe).toBe('2026-11-25T10:00:00.000Z')
    const reglage = await modifierReglageWidget({ actif: true }, base)
    expect(reglage.introuvableLe).toBeUndefined()
    expect(reglageWidget(await lireProfil(base)).introuvableLe).toBeUndefined()
  })

  it('noterEnvoi enregistre la signature, le nombre de cartes et la date', async () => {
    await modifierReglageWidget({ actif: true, intervalleMinutes: 30 }, base)
    await noterEnvoi('0a1b2c3d', 42, new Date('2026-11-25T11:00:00.000Z'), base)
    expect(reglageWidget(await lireProfil(base))).toEqual({
      actif: true,
      intervalleMinutes: 30,
      derniereSignature: '0a1b2c3d',
      nbCartes: 42,
      dernierEnvoiLe: '2026-11-25T11:00:00.000Z',
    })
  })
})
