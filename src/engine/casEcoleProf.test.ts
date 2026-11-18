/** Cas d'école du profil prof, calculés à la main le 18/11/2026 à partir des textes cités. */
import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import { budgetPremierTraitement, comparerAffectation, coutTempsPartiel, effetHorsClasse } from './casEcoleProf.ts'
import { traitementMensuel } from './fonctionPublique.ts'

const p = parametres2026()

describe('cas d’école prof', () => {
  it('premier traitement : le net d’élève, et une année sous le plafond du LEP', () => {
    const b = budgetPremierTraitement({ loyer: 400, autresDepenses: 600 }, p)
    expect(b.netMensuel).toBeCloseTo(1430.04, 1)
    expect(b.reste).toBeCloseTo(b.netMensuel - b.impotMensuel - 1000, 6)
    expect(b.sousPlafondLep).toBe(true)
  })

  it('affectation : l’AIP ne dépasse ni son plafond ni les dépenses engagées', () => {
    const cher = comparerAffectation({ fraisDemenagement: 1500, nouveauLoyer: 800, zoneTendue: true, trajetsMensuels: 200 }, p)
    expect(cher.coutInstallation).toBe(3100)
    expect(cher.aip).toBe(1500)
    const petit = comparerAffectation({ fraisDemenagement: 100, nouveauLoyer: 200, zoneTendue: false, trajetsMensuels: 200 }, p)
    expect(petit.aip).toBe(500)
    expect(petit.trajetsAnnuels).toBe(2400)
  })

  it('temps partiel à 80 % : 6/7 du net, quatre trimestres de moins dans la pension', () => {
    const r = coutTempsPartiel({ grade: 'classe-normale', echelon: 5 }, 826, p)
    // L'abattement « transfert primes/points » reste d'un douzième de 389 € par mois (décret
    // n° 2016-588, art. 4, sans proratisation) : le net est un peu sous les 6/7.
    expect(r.netPartiel / r.netPlein).toBeLessThan(6 / 7)
    expect(r.netPartiel / r.netPlein).toBeGreaterThan(6 / 7 - 0.005)
    expect(r.pensionAvec / r.pensionSans).toBeCloseTo(168 / 172, 6)
    expect(r.surcoutSurcotisation).toBeGreaterThan(0)
  })

  it('hors classe : du 11e échelon (678) au 4e de la hors classe (720)', () => {
    const r = effetHorsClasse(p)
    expect(r.echelonArrivee).toBe(4)
    expect(r.netHorsClasse).toBeGreaterThan(r.netClasseNormale)
    expect(r.pensionHorsClasse).toBeCloseTo(traitementMensuel(826, p) * 0.75, 6)
    expect(r.pensionClasseNormale).toBeCloseTo(traitementMensuel(678, p) * 0.75, 6)
  })
})
