import { describe, expect, it } from 'vitest'
import { evaluerExpression, resultatEnTexte } from './calculatrice.ts'

describe('mini-calculatrice', () => {
  it('respecte les priorités et les parenthèses', () => {
    expect(evaluerExpression('2 + 3 × 4')).toBe(14)
    expect(evaluerExpression('(2 + 3) × 4')).toBe(20)
    expect(evaluerExpression('10 − 4 − 3')).toBe(3)
    expect(evaluerExpression('100 ÷ 4 ÷ 5')).toBe(5)
  })

  it('lit la virgule, le point et les espaces de milliers', () => {
    expect(evaluerExpression('1,5 + 2.5')).toBe(4)
    expect(evaluerExpression('10 000 × 3')).toBe(30000)
    expect(evaluerExpression('10 000 x 2')).toBe(20000)
  })

  it('traite le pourcentage comme une division par 100', () => {
    expect(evaluerExpression('3000 × 30 %')).toBeCloseTo(900, 9)
    expect(evaluerExpression('10000 × 31,4%')).toBeCloseTo(3140, 9)
  })

  it('calcule la formule du rachat d’assurance-vie', () => {
    expect(evaluerExpression('5000 − 20000 × (5000 ÷ 25000)')).toBeCloseTo(1000, 9)
  })

  it('accepte le signe moins devant un nombre', () => {
    expect(evaluerExpression('-5 + 2')).toBe(-3)
    expect(evaluerExpression('3 × -2')).toBe(-6)
  })

  it('refuse une expression incomplète, invalide ou une division par zéro', () => {
    expect(evaluerExpression('')).toBeNull()
    expect(evaluerExpression('2 +')).toBeNull()
    expect(evaluerExpression('(2 + 3')).toBeNull()
    expect(evaluerExpression('2 ÷ 0')).toBeNull()
    expect(evaluerExpression('1,2,3')).toBeNull()
    expect(evaluerExpression('alert(1)')).toBeNull()
  })

  it('reporte le résultat avec une virgule et deux décimales au plus', () => {
    expect(resultatEnTexte(900)).toBe('900')
    expect(resultatEnTexte(1090.256)).toBe('1090,26')
    expect(resultatEnTexte(-0.001)).toBe('0')
  })
})
