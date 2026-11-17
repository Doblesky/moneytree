import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import {
  abondementPee,
  budgetPremierSalaire,
  capitalAvecFrais,
  comparerPeaPer,
  investir2007,
  mars2020,
  projeterHeritage,
} from './casEcole.ts'
import { faitsHistoriques } from './marches.ts'

const p = parametres2026()

describe('cas d’école', () => {
  it('premier salaire : le reste, la fourchette de précaution et le temps pour l’atteindre', () => {
    const b = budgetPremierSalaire({ brutAnnuel: 39000, loyer: 357, autresDepenses: 800 }, p)
    expect(b.reste).toBeCloseTo(b.disponible - 357 - 800, 9)
    expect(b.precaution.basse).toBeCloseTo(3 * b.netMensuel, 9)
    expect(b.precaution.haute).toBeCloseTo(6 * b.netMensuel, 9)
    expect(b.moisPourPrecaution).toBe(Math.ceil(b.precaution.basse / b.reste))
    expect(budgetPremierSalaire({ brutAnnuel: 39000, loyer: 2500, autresDepenses: 800 }, p).moisPourPrecaution).toBeNull()
  })

  it('PEA ou PER : à rendement nul, l’impôt du PER est la tranche de sortie sur les versements', () => {
    const r = comparerPeaPer({ versementAnnuel: 3000, annees: 30, rendement: 0, tmiEntree: 0.3, tmiSortie: 0.11 }, p)
    expect(r.pea.net).toBeCloseTo(90000, 6)
    expect(r.per.net).toBeCloseTo(90000 * 0.89, 6)
    expect(r.economieAnnuelle).toBeCloseTo(900, 9)
    expect(r.economiePlacee.net).toBeCloseTo(27000, 6)
    // Tranche plus basse à la sortie et économie placée : le PER l'emporte.
    expect(r.per.net + r.economiePlacee.net).toBeGreaterThan(r.pea.net)
    // Même tranche à l'entrée et à la sortie, économie dépensée : le PEA l'emporte.
    const meme = comparerPeaPer({ versementAnnuel: 3000, annees: 30, rendement: 0.05, tmiEntree: 0.3, tmiSortie: 0.3 }, p)
    expect(meme.pea.net).toBeGreaterThan(meme.per.net)
  })

  it('abondement à 100 % : CSG et CRDS de 9,7 % sur l’abondement, puis 5 ans de blocage', () => {
    const r = abondementPee({ versement: 1000, taux: 1, plafondEntreprise: 1500 }, p)
    expect(r.abondementBrut).toBe(1000)
    expect(r.csgCrds).toBeCloseTo(1000 * p['csgCrds.revenusActivite'].valeur, 9)
    expect(r.netPlace).toBeCloseTo(2000 - r.csgCrds, 9)
    expect(r.rendementEquivalent).toBeCloseTo((r.netPlace / 1000) ** (1 / 5) - 1, 9)
    expect(abondementPee({ versement: 3000, taux: 1, plafondEntreprise: 1500 }, p).abondementBrut).toBe(1500)
  })

  it('investir en 2007 : mêmes chiffres que les faits cités par le module 5', () => {
    const t = investir2007()
    const f = faitsHistoriques()
    expect(t.mois[0]).toBe('2007-01')
    expect(t.mois.at(-1)).toBe('2016-12')
    expect(t.enUneFois.at(-1)).toBeCloseTo(f.cas2007.enUneFois, 6)
    expect(t.en24Mois.at(-1)).toBeCloseTo(f.cas2007.en24Mois, 6)
    expect(t.verse24.at(-1)).toBeCloseTo(20000, 6)
  })

  it('mars 2020 : vendre fige la valeur de fin mars, renforcer ajoute 5 000 € qui suivent le marché', () => {
    const r = mars2020()
    expect(r.baisseMars).toBeCloseTo(faitsHistoriques().covid.baisse, 9)
    expect(r.valeurs.vendre).toBeCloseTo(r.valeurFinMars, 9)
    expect(r.valeurs.tenir).toBeGreaterThan(r.valeurs.vendre)
    const croissance = r.valeurs.tenir / r.valeurFinMars
    expect(r.valeurs.renforcer).toBeCloseTo((r.valeurFinMars + 5000) * croissance, 6)
    expect(r.mois.at(-1)).toBe('2021-12')
  })

  it('les frais : sans rendement ni frais, on retrouve la somme versée', () => {
    const v = capitalAvecFrais({ mensuel: 200, annees: 30, rendement: 0, frais: 0 })
    expect(v).toHaveLength(31)
    expect(v.at(-1)).toBeCloseTo(72000, 6)
    const etf = capitalAvecFrais({ mensuel: 200, annees: 30, rendement: 0.05, frais: 0.002 }).at(-1) ?? 0
    const fonds = capitalAvecFrais({ mensuel: 200, annees: 30, rendement: 0.05, frais: 0.02 }).at(-1) ?? 0
    expect(etf).toBeGreaterThan(fonds)
  })

  it('héritage : une fourchette ordonnée, qui part de la somme reçue', () => {
    const r = projeterHeritage({ montant: 50000, partActions: 0.6, annees: 20 })
    expect(r.p50[0]).toBe(50000)
    expect(r.annees).toHaveLength(21)
    expect(r.final.p10).toBeLessThanOrEqual(r.final.p50)
    expect(r.final.p50).toBeLessThanOrEqual(r.final.p90)
    const prudent = projeterHeritage({ montant: 50000, partActions: 0, annees: 20 })
    expect(prudent.final.p90 - prudent.final.p10).toBeLessThan(r.final.p90 - r.final.p10)
  })
})
