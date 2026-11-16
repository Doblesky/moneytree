import { describe, expect, it } from 'vitest'
import {
  ESPACE_FINE_INSECABLE as FINE,
  ESPACE_INSECABLE as INSEC,
  SIGNE_MOINS as MOINS,
  formatMontant,
  formatNombre,
} from './format.ts'

describe('constantes typographiques', () => {
  it('utilise les bons caractères Unicode', () => {
    expect(FINE).toBe(' ')
    expect(INSEC).toBe(' ')
    expect(MOINS).toBe('−')
  })
})

describe('formatMontant', () => {
  it('reprend les exemples de la planche de direction artistique', () => {
    expect(formatMontant(18450)).toBe(`18${FINE}450${INSEC}€`)
    expect(formatMontant(1111)).toBe(`1${FINE}111${INSEC}€`)
    expect(formatMontant(-7200)).toBe(`${MOINS}7${FINE}200${INSEC}€`)
  })

  it('ne groupe pas en dessous de 1 000', () => {
    expect(formatMontant(0)).toBe(`0${INSEC}€`)
    expect(formatMontant(7)).toBe(`7${INSEC}€`)
    expect(formatMontant(999)).toBe(`999${INSEC}€`)
    expect(formatMontant(1000)).toBe(`1${FINE}000${INSEC}€`)
  })

  it('groupe correctement les grands nombres', () => {
    expect(formatMontant(1_234_567)).toBe(`1${FINE}234${FINE}567${INSEC}€`)
    expect(formatMontant(100_000)).toBe(`100${FINE}000${INSEC}€`)
    expect(formatMontant(1e15)).toBe(`1${FINE}000${FINE}000${FINE}000${FINE}000${FINE}000${INSEC}€`)
  })

  it('arrondit à l’euro par défaut', () => {
    expect(formatMontant(2639.5)).toBe(`2${FINE}640${INSEC}€`)
    expect(formatMontant(2639.49)).toBe(`2${FINE}639${INSEC}€`)
    expect(formatMontant(-2639.5)).toBe(`${MOINS}2${FINE}640${INSEC}€`)
  })

  it('affiche les centimes avec une virgule', () => {
    expect(formatMontant(1234567.891, { decimales: 2 })).toBe(`1${FINE}234${FINE}567,89${INSEC}€`)
    expect(formatMontant(0.1 + 0.2, { decimales: 2 })).toBe(`0,30${INSEC}€`)
    expect(formatMontant(1.005, { decimales: 2 })).toBe(`1,01${INSEC}€`)
    expect(formatMontant(-12.5, { decimales: 2 })).toBe(`${MOINS}12,50${INSEC}€`)
  })

  it('n’affiche jamais « −0 »', () => {
    expect(formatMontant(-0)).toBe(`0${INSEC}€`)
    expect(formatMontant(-0.4)).toBe(`0${INSEC}€`)
    expect(formatMontant(-0.004, { decimales: 2 })).toBe(`0,00${INSEC}€`)
    expect(formatMontant(-0.4, { signe: true })).toBe(`0${INSEC}€`)
  })

  it('affiche le signe + pour une variation positive si demandé', () => {
    expect(formatMontant(320, { signe: true })).toBe(`+320${INSEC}€`)
    expect(formatMontant(-320, { signe: true })).toBe(`${MOINS}320${INSEC}€`)
    expect(formatMontant(0, { signe: true })).toBe(`0${INSEC}€`)
    expect(formatMontant(320)).toBe(`320${INSEC}€`)
  })

  it('peut omettre le symbole €', () => {
    expect(formatMontant(18450, { devise: false })).toBe(`18${FINE}450`)
  })

  it('n’utilise ni espace ordinaire ni trait d’union', () => {
    for (const valeur of [-1_234_567.89, -7200, 0, 42, 18450, 1e9]) {
      const texte = formatMontant(valeur, { decimales: 2, signe: true })
      expect(texte).not.toMatch(/[ -]/)
    }
  })

  it('gère les très petites valeurs écrites en notation scientifique', () => {
    expect(formatMontant(1e-7)).toBe(`0${INSEC}€`)
    expect(formatMontant(-1e-7, { decimales: 2 })).toBe(`0,00${INSEC}€`)
    expect(formatMontant(5e-7, { decimales: 6 })).toBe(`0,000001${INSEC}€`)
  })

  it('refuse les valeurs non finies ou trop grandes et les décimales invalides', () => {
    expect(() => formatMontant(Number.NaN)).toThrow(RangeError)
    expect(() => formatMontant(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => formatMontant(1e21)).toThrow(RangeError)
    expect(() => formatMontant(10, { decimales: -1 })).toThrow(RangeError)
    expect(() => formatMontant(10, { decimales: 1.5 })).toThrow(RangeError)
  })
})

describe('formatNombre', () => {
  it('formate sans devise, par exemple pour les XP', () => {
    expect(formatNombre(1240)).toBe(`1${FINE}240`)
    expect(formatNombre(-7200.25, { decimales: 1 })).toBe(`${MOINS}7${FINE}200,3`)
  })
})
