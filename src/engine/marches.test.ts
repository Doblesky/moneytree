import { describe, expect, it } from 'vitest'
import {
  libelleMois,
  nombreDeDepartsPossibles,
  rendementAnnualise,
  rendementsReels,
  SERIES,
} from './marches.ts'
import { projeterVersements, quantile } from './projection.ts'

describe('séries historiques embarquées', () => {
  it('ont toutes la même longueur et des mois consécutifs', () => {
    const n = SERIES.mois.length
    expect(n).toBeGreaterThan(300)
    for (const serie of [SERIES.actionsMonde, SERIES.inflation, SERIES.livretA, SERIES.ldds, SERIES.lep]) {
      expect(serie).toHaveLength(n)
      expect(serie.every(Number.isFinite)).toBe(true)
    }
    for (let i = 1; i < n; i++) {
      const [a, m] = (SERIES.mois[i - 1] ?? '').split('-').map(Number)
      const attendu = m === 12 ? `${(a ?? 0) + 1}-01` : `${a}-${String((m ?? 0) + 1).padStart(2, '0')}`
      expect(SERIES.mois[i]).toBe(attendu)
    }
  })

  it('reproduit des faits connus des sources', () => {
    const indice = (mois: string) => SERIES.mois.indexOf(mois)
    // Banque de France : Livret A à 0,5 % en 2021, 3 % en 2024.
    expect(SERIES.livretA[indice('2021-06')]).toBeCloseTo(0.005, 10)
    expect(SERIES.livretA[indice('2024-06')]).toBeCloseTo(0.03, 10)
    // MSCI World en euros : forte baisse en mars 2020.
    expect(SERIES.actionsMonde[indice('2020-03')]).toBeLessThan(-0.1)
  })

  it('permet de nombreuses périodes de dix ans', () => {
    expect(nombreDeDepartsPossibles(120)).toBe(SERIES.mois.length - 119)
  })

  it('calcule un rendement réel annualisé plausible', () => {
    const reel = rendementAnnualise(rendementsReels())
    expect(reel).toBeGreaterThan(0)
    expect(reel).toBeLessThan(0.1)
  })

  it('écrit les mois en français', () => {
    expect(libelleMois('2007-03')).toBe('mars 2007')
  })
})

describe('projection par bootstrap', () => {
  it('rend le total versé quand les rendements sont nuls', () => {
    const r = projeterVersements({ versementMensuel: 200, mois: 360, rendements: [0, 0, 0], trajectoires: 10 })
    expect(r.final.p50).toBeCloseTo(72000, 6)
    expect(r.final.verse).toBe(72000)
    expect(r.annees).toHaveLength(31)
  })

  it('ordonne P10 ≤ P50 ≤ P90 et reste reproductible', () => {
    const options = { versementMensuel: 200, mois: 360, rendements: rendementsReels(), trajectoires: 300, graine: 7 }
    const a = projeterVersements(options)
    const b = projeterVersements(options)
    expect(a.final).toEqual(b.final)
    a.p50.forEach((v, i) => {
      expect(a.p10[i]).toBeLessThanOrEqual(v)
      expect(v).toBeLessThanOrEqual(a.p90[i] ?? 0)
    })
  })

  it('calcule les quantiles', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(quantile([0, 10], 0.1)).toBeCloseTo(1, 10)
  })
})
