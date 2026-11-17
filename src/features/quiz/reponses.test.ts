import { describe, expect, it } from 'vitest'
import { questionParId } from '../../content/catalogue.ts'
import { estJuste, lireNombre } from './reponses.ts'

describe('lecture des réponses chiffrées', () => {
  it('accepte les écritures françaises', () => {
    expect(lireNombre('952')).toBe(952)
    expect(lireNombre('1 102,50')).toBe(1102.5)
    expect(lireNombre('1 102,5 €')).toBe(1102.5)
    expect(lireNombre('0,97 %')).toBe(0.97)
    expect(lireNombre('-3')).toBe(-3)
  })

  it('refuse ce qui n’est pas un nombre', () => {
    expect(lireNombre('')).toBeNull()
    expect(lireNombre('abc')).toBeNull()
    expect(lireNombre('-')).toBeNull()
    expect(lireNombre('1.2.3')).toBeNull()
  })

  it('applique la tolérance de la question', () => {
    const q = questionParId('m0-p2-q3') // 952 € à 1 € près
    if (!q) throw new Error('question manquante')
    expect(estJuste(q, '952')).toBe(true)
    expect(estJuste(q, '953')).toBe(true)
    expect(estJuste(q, '955')).toBe(false)
    const qcm = questionParId('m0-p2-q2')
    if (!qcm) throw new Error('question manquante')
    expect(estJuste(qcm, 1)).toBe(true)
    expect(estJuste(qcm, 0)).toBe(false)
  })
})
