import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import { economiePer, impositionGainParEnveloppe, plafondPer, valeurApresFrais } from './calculs.ts'

const p = parametres2026()
const seul = { situation: 'celibataire' as const, enfantsACharge: 0 }

describe('plafond et économie PER', () => {
  it('borne le plafond entre le minimum et le maximum', () => {
    expect(plafondPer(0, 1, p)).toBe(p['per.plafondDeductionMin'].valeur)
    expect(plafondPer(10_000_000, 1, p)).toBe(p['per.plafondDeductionMax'].valeur)
    expect(plafondPer(60000, 1, p)).toBeCloseTo(60000 * p['per.tauxPlafondDeduction'].valeur, 6)
  })

  it('ne déduit pas au-delà du plafond', () => {
    const r = economiePer({ foyer: seul, salaires: [40000], versement: 20000 }, p)
    expect(r.deduit).toBe(r.plafond)
    expect(r.economie).toBe(r.impotSans - r.impotAvec)
  })

  it('n’économise rien sans impôt à payer', () => {
    expect(economiePer({ foyer: seul, salaires: [12000], versement: 1000 }, p).economie).toBe(0)
  })
})

describe('imposition d’un gain par enveloppe', () => {
  it('double l’abattement de l’assurance-vie pour un couple', () => {
    const seulAv = impositionGainParEnveloppe(12000, p).assuranceVie
    const couple = impositionGainParEnveloppe(12000, p, { couple: true }).assuranceVie
    const taux = p['assuranceVie.tauxImpotApres8Ans'].valeur
    expect(seulAv.impotRevenu).toBeCloseTo((12000 - p['assuranceVie.abattementApres8Ans.personneSeule'].valeur) * taux, 6)
    expect(couple.impotRevenu).toBeCloseTo((12000 - p['assuranceVie.abattementApres8Ans.couple'].valeur) * taux, 6)
    expect(couple.prelevementsSociaux).toBe(seulAv.prelevementsSociaux)
  })
})

describe('valeur après frais', () => {
  it('sans frais, retrouve les intérêts composés', () => {
    const r = valeurApresFrais({ montant: 1000, rendement: 0.05, fraisEntree: 0, fraisAnnuels: 0, fraisFixes: 0, annees: 10 })
    expect(r.avecFrais).toBeCloseTo(r.sansFrais, 9)
    expect(r.rendementNet).toBeCloseTo(0.05, 9)
  })

  it('ne descend jamais sous zéro', () => {
    const r = valeurApresFrais({ montant: 100, rendement: 0, fraisEntree: 0, fraisAnnuels: 0, fraisFixes: 50, annees: 5 })
    expect(r.avecFrais).toBe(0)
  })
})
