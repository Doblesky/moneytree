import { describe, expect, it } from 'vitest'
import { carteDemandee } from './carteDemandee.ts'

describe('carteDemandee', () => {
  it.each([
    ['?carte=2', 5, 2],
    ['?carte=0', 5, 0],
    ['?carte=5', 5, null],
    ['?carte=-1', 5, null],
    ['?carte=abc', 5, null],
    ['?carte=1.5', 5, null],
    ['', 5, null],
  ] as const)('%s sur %i cartes → %s', (recherche, nbCartes, attendu) => {
    expect(carteDemandee(recherche, nbCartes)).toBe(attendu)
  })
})
