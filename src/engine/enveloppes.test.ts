import { describe, expect, it } from 'vitest'
import {
  acheter,
  crediterInterets,
  LIVRET_VIDE,
  moisLivret,
  PEA_FERME,
  retirerLivret,
  retirerPea,
  TITRES_VIDES,
  valeurTitres,
  vendre,
} from './enveloppes.ts'

describe('livrets réglementés', () => {
  it('compte une quinzaine d’intérêts sur le versement du mois, puis le mois entier', () => {
    const premier = moisLivret(LIVRET_VIDE, 1200, 5000, 22950, 0.03)
    expect(premier.verse).toBe(1200)
    expect(premier.livret.interetsCourus).toBeCloseTo(1200 * 0.03 / 24, 10)
    const second = moisLivret(premier.livret, 0, 5000, 22950, 0.03)
    expect(second.livret.interetsCourus).toBeCloseTo(1200 * 0.03 / 24 + 1200 * 0.03 / 12, 10)
  })

  it('arrête les versements au plafond et à l’argent disponible', () => {
    const presquePlein = { solde: 22900, interetsCourus: 0 }
    expect(moisLivret(presquePlein, 500, 5000, 22950, 0.017).verse).toBe(50)
    expect(moisLivret(LIVRET_VIDE, 500, 120, 22950, 0.017).verse).toBe(120)
    expect(moisLivret(LIVRET_VIDE, 500, 0, 22950, 0.017).verse).toBe(0)
  })

  it('crédite les intérêts au 31 décembre, même au-delà du plafond', () => {
    const plein = { solde: 22950, interetsCourus: 390 }
    const { livret, credites } = crediterInterets(plein)
    expect(credites).toBe(390)
    expect(livret).toEqual({ solde: 23340, interetsCourus: 0 })
  })

  it('donne environ le taux annuel sur une somme placée toute l’année', () => {
    let livret = moisLivret(LIVRET_VIDE, 10000, 10000, 22950, 0.017).livret
    for (let m = 1; m < 12; m++) livret = moisLivret(livret, 0, 0, 22950, 0.017).livret
    // Versement en début d'année : une quinzaine perdue le premier mois.
    expect(livret.interetsCourus).toBeCloseTo(10000 * 0.017 * (11.5 / 12), 6)
  })

  it('ne retire pas plus que le solde', () => {
    const { livret, retire } = retirerLivret({ solde: 300, interetsCourus: 2 }, 1000, 0.017)
    expect(retire).toBe(300)
    expect(livret.solde).toBe(0)
  })
})

describe('titres (CTO)', () => {
  it('suit le prix de revient et calcule la plus-value au prorata', () => {
    let titres = acheter(TITRES_VIDES, 1000, 100) // 10 parts
    titres = acheter(titres, 1000, 200) // + 5 parts
    expect(titres.parts).toBeCloseTo(15, 10)
    expect(valeurTitres(titres, 200)).toBeCloseTo(3000, 10)
    const { titres: reste, vendu, plusValue } = vendre(titres, 1500, 200)
    expect(vendu).toBe(1500)
    // La moitié de la valeur vendue : la moitié du prix de revient (1 000 €).
    expect(plusValue).toBeCloseTo(500, 10)
    expect(reste.prixDeRevient).toBeCloseTo(1000, 10)
  })
})

describe('PEA', () => {
  const regles = { dureeExonerationMois: 60, tauxImpot: 0.128, tauxPrelevementsSociaux: 0.186 }
  const pea = {
    ...PEA_FERME,
    ouvertAuMois: 0,
    versements: 10000,
    titres: acheter(TITRES_VIDES, 10000, 100),
  }

  it('avant 5 ans, un retrait clôture le plan et le gain supporte impôt et prélèvements sociaux', () => {
    const r = retirerPea(pea, 1000, 150, 36, regles)
    expect(r.cloture).toBe(true)
    expect(r.gain).toBeCloseTo(5000, 6)
    expect(r.impotRevenu).toBeCloseTo(640, 6)
    expect(r.prelevementsSociaux).toBeCloseTo(930, 6)
    expect(r.net).toBeCloseTo(15000 - 640 - 930, 6)
    expect(r.pea.cloture).toBe(true)
  })

  it('après 5 ans, un retrait partiel garde le plan et ne supporte que les prélèvements sociaux', () => {
    const r = retirerPea(pea, 3000, 150, 61, regles)
    expect(r.cloture).toBe(false)
    expect(r.gain).toBeCloseTo(1000, 6) // 3 000 € retirés, dont 2 000 € de versements
    expect(r.impotRevenu).toBe(0)
    expect(r.prelevementsSociaux).toBeCloseTo(186, 6)
    expect(r.pea.versements).toBeCloseTo(8000, 6)
    expect(valeurTitres(r.pea.titres, 150)).toBeCloseTo(12000, 6)
  })
})
