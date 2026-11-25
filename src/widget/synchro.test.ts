import { describe, expect, it } from 'vitest'
import type { ReglageWidget } from '../storage/db.ts'
import { doitEnvoyer, RATTRAPAGE_MS, type RaisonEnvoi } from './synchro.ts'

const maintenantMs = Date.parse('2026-11-25T12:00:00.000Z')
const ilYa = (ms: number) => new Date(maintenantMs - ms).toISOString()
const UNE_HEURE = 60 * 60 * 1000

const reglageBase: ReglageWidget = {
  actif: true,
  intervalleMinutes: 10,
  derniereSignature: 'bbbbbbbb',
  dernierEnvoiLe: ilYa(UNE_HEURE),
}

function cas(
  modif: {
    raison?: RaisonEnvoi
    reglage?: Partial<ReglageWidget>
    signature?: string
    dernierEssaiMs?: number | null
    android?: boolean
  } = {},
): boolean {
  return doitEnvoyer({
    raison: modif.raison ?? 'palier',
    reglage: { ...reglageBase, ...modif.reglage },
    signature: modif.signature ?? 'aaaaaaaa',
    maintenantMs,
    dernierEssaiMs: modif.dernierEssaiMs ?? null,
    android: modif.android ?? true,
  })
}

describe('doitEnvoyer', () => {
  it.each([
    ['palier, paquet changé', {}, true],
    ['widget inactif', { reglage: { actif: false } }, false],
    ['hors Android', { android: false }, false],
    ['compagnon introuvable', { reglage: { introuvableLe: ilYa(1000) } }, false],
    ['moins de 10 s après le dernier essai', { dernierEssaiMs: maintenantMs - 9_999 }, false],
    ['palier, paquet identique', { signature: 'bbbbbbbb' }, false],
    ['retour, paquet identique, envoi il y a 1 h', { raison: 'retour', signature: 'bbbbbbbb' }, false],
    [
      'retour, paquet identique, envoi il y a plus de 6 h',
      { raison: 'retour', signature: 'bbbbbbbb', reglage: { dernierEnvoiLe: ilYa(RATTRAPAGE_MS + 1) } },
      true,
    ],
    ['retour, paquet changé', { raison: 'retour' }, true],
    ['réglage, paquet identique', { raison: 'reglage', signature: 'bbbbbbbb' }, true],
  ] as const)('%s', (_nom, modif, attendu) => {
    expect(cas(modif)).toBe(attendu)
  })

  it('retour sans envoi précédent', () => {
    const reglage: ReglageWidget = { actif: true, intervalleMinutes: 10, derniereSignature: 'bbbbbbbb' }
    expect(
      doitEnvoyer({ raison: 'retour', reglage, signature: 'bbbbbbbb', maintenantMs, dernierEssaiMs: null, android: true }),
    ).toBe(true)
  })
})
