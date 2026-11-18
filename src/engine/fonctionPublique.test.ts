/**
 * Moteur de la fonction publique. Aucun simulateur officiel de paie des fonctionnaires n'a
 * été trouvé : les cas sont calculés à la main, le 18/11/2026, à partir des textes cités
 * dans src/data/params/2026.json (décret n° 85-1148, décret n° 72-581, décret n° 2017-789,
 * barème A du décret n° 82-1105, arrêtés de la prime d'attractivité et de l'ISOE, décret
 * n° 2016-588, fiche Service-Public F468, fiches F21142 et F20349).
 */
import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import {
  avancerUnMois,
  bulletinMensuel,
  echelonAvecRendezVous,
  elasticitePointInflation,
  grilleDe,
  pensionDeBase,
  pointsCalageProf,
  positionStagiaire,
  promouvableHorsClasse,
  promouvoir,
  traitementMensuel,
  valeurPointA,
  type Avancement,
} from './fonctionPublique.ts'
import { brutVersNet } from './salaire.ts'
import { SERIES } from './marches.ts'
import { creerPartie, pointsDeCotisation } from './simulation.ts'

const p = parametres2026()
const CN1 = { grade: 'classe-normale' as const, echelon: 1 }

describe('traitement indiciaire', () => {
  it('indice majoré × 5 907,34 € / 1 200 (décret n° 85-1148, art. 3)', () => {
    expect(traitementMensuel(100, p)).toBeCloseTo(492.278, 3)
    expect(traitementMensuel(395, p)).toBeCloseTo(1944.499, 3)
  })

  it('les trois grilles des certifiés, en indices majorés au 1er janvier 2024', () => {
    expect(grilleDe('classe-normale', p).map((e) => e.indiceMajore)).toEqual([395, 446, 453, 466, 481, 497, 524, 562, 595, 634, 678])
    expect(grilleDe('hors-classe', p).map((e) => e.indiceMajore)).toEqual([595, 629, 673, 720, 768, 811, 826])
    expect(grilleDe('classe-exceptionnelle', p).map((e) => e.indiceMajore)).toEqual([700, 740, 780, 835])
  })
})

describe('bulletin de paie', () => {
  it('élève fonctionnaire : indice majoré 366, ni prime ni RAFP', () => {
    const b = bulletinMensuel({ statut: 'eleve', position: CN1 }, p)
    // 366 × 5 907,34 / 1 200 = 1 801,74 € ; pension 11,10 % ; CSG + CRDS 9,7 % de 98,25 %.
    expect(b.indiceMajore).toBe(366)
    expect(b.traitementIndiciaire).toBeCloseTo(1801.739, 2)
    expect(b.retenuePension).toBeCloseTo(199.993, 2)
    expect(b.rafp).toBe(0)
    expect(b.csg + b.crds).toBeCloseTo(171.709, 2)
    expect(b.netAvantImpot).toBeCloseTo(1430.04, 1)
    // Net imposable : on rajoute la CSG non déductible (2,4 %) et la CRDS.
    expect(b.netImposable).toBeCloseTo(1481.37, 1)
  })

  it('stagiaire au 1er échelon (hypothèse) : prime d’attractivité, ISOE, abattement de 389 €', () => {
    const b = bulletinMensuel({ statut: 'stagiaire', position: positionStagiaire(p) }, p)
    expect(b.primeAttractivite).toBeCloseTo(2130 / 12, 6)
    expect(b.isoe).toBeCloseTo(2550 / 12, 6)
    expect(b.transfertPrimesPoints).toBeCloseTo(389 / 12, 6)
    // 1 944,50 + 177,50 + 212,50 − 32,42 = 2 302,08 € brut.
    expect(b.brut).toBeCloseTo(2302.083, 2)
    // RAFP : 5 % des primes versées (357,58 €), sous le plafond de 20 % du traitement.
    expect(b.rafp).toBeCloseTo(17.879, 2)
    expect(b.netAvantImpot).toBeCloseTo(1848.97, 1)
  })

  it('l’indemnité de résidence de la zone 1 (3 %) s’ajoute au brut et entre dans la RAFP', () => {
    const z3 = bulletinMensuel({ statut: 'titulaire', position: CN1, zone: 3 }, p)
    const z1 = bulletinMensuel({ statut: 'titulaire', position: CN1, zone: 1 }, p)
    expect(z1.indemniteResidence).toBeCloseTo(z3.traitementIndiciaire * 0.03, 6)
    expect(z1.brut - z3.brut).toBeCloseTo(z1.indemniteResidence, 6)
    expect(z1.rafp).toBeGreaterThan(z3.rafp)
  })

  it('pas de prime d’attractivité hors de la classe normale, ni aux 10e et 11e échelons', () => {
    expect(bulletinMensuel({ statut: 'titulaire', position: { grade: 'hors-classe', echelon: 1 } }, p).primeAttractivite).toBe(0)
    expect(bulletinMensuel({ statut: 'titulaire', position: { grade: 'classe-normale', echelon: 10 } }, p).primeAttractivite).toBe(0)
  })

  it('temps partiel à 80 % : 6/7 de la paie ; la surcotisation se calcule sur le temps plein', () => {
    const plein = bulletinMensuel({ statut: 'titulaire', position: CN1 }, p)
    const partiel = bulletinMensuel({ statut: 'titulaire', position: CN1, quotite: 6 / 7 }, p)
    expect(partiel.traitementIndiciaire).toBeCloseTo((plein.traitementIndiciaire * 6) / 7, 6)
    const surco = bulletinMensuel({ statut: 'titulaire', position: CN1, quotite: 6 / 7, surcotisation: true }, p)
    expect(surco.retenuePension).toBeCloseTo(plein.traitementIndiciaire * 0.1668, 6)
  })
})

describe('calage pour le simulateur', () => {
  it('reproduit le bulletin à chaque échelon', () => {
    const points = pointsCalageProf(p)
    const b = bulletinMensuel({ statut: 'titulaire', position: { grade: 'classe-normale', echelon: 5 } }, p)
    expect(brutVersNet(b.brut * 12, points).netAvantImpot / 12).toBeCloseTo(b.netAvantImpot, 6)
  })

  it('une partie au régime fonctionnaire utilise ce calage, une partie de cadre le sien', () => {
    const config = { brutAnnuel: 30000, depensesMensuelles: 1000, graine: 1, calendrier: { annee: 2027, mois: 8 } }
    expect(pointsDeCotisation(creerPartie(config), p)).toBe(p['cotisations.salarieCadre'].valeur)
    expect(pointsDeCotisation(creerPartie({ ...config, regime: 'fonctionnaire' }), p)).toEqual(pointsCalageProf(p))
  })
})

describe('avancement', () => {
  it('26 ans de la 1re à la 11e échelon de la classe normale sans bonification (décret n° 72-581, art. 32)', () => {
    let a: Avancement = { position: CN1, ancienneteMois: 0, bonificationMois: 0 }
    let mois = 0
    while (a.position.echelon < 11) {
      a = avancerUnMois(a, p).avancement
      mois++
    }
    expect(mois).toBe(12 + 12 + 24 + 24 + 30 + 36 + 36 + 42 + 48 + 48)
  })

  it('la bonification d’un an raccourcit l’échelon', () => {
    const a: Avancement = { position: { grade: 'classe-normale', echelon: 6 }, ancienneteMois: 23, bonificationMois: 12 }
    expect(echelonAvecRendezVous(a.position)).toBe(true)
    expect(avancerUnMois(a, p).promu).toBe(true)
  })

  it('hors classe : deux ans au 9e échelon, puis 2e échelon de la hors classe (art. 34 et 35)', () => {
    const a: Avancement = { position: { grade: 'classe-normale', echelon: 9 }, ancienneteMois: 30, bonificationMois: 0 }
    expect(promouvableHorsClasse({ ...a, ancienneteMois: 23 }, p)).toBe(false)
    expect(promouvableHorsClasse(a, p)).toBe(true)
    expect(promouvoir(a, 'hors-classe', p)).toEqual({ position: { grade: 'hors-classe', echelon: 2 }, ancienneteMois: 6, bonificationMois: 0 })
    // Du 11e échelon (indice 678), l'échelon d'indice égal ou immédiatement supérieur : 4e (720).
    const onze: Avancement = { position: { grade: 'classe-normale', echelon: 11 }, ancienneteMois: 0, bonificationMois: 0 }
    expect(promouvoir(onze, 'hors-classe', p).position).toEqual({ grade: 'hors-classe', echelon: 4 })
  })
})

describe('point d’indice', () => {
  it('rejoue la série officielle', () => {
    const serie = p['fp.historiquePoint'].valeur
    expect(valeurPointA('2015-06', serie)).toBe(5556.35)
    expect(valeurPointA('2023-07', serie)).toBe(5907.34)
    expect(valeurPointA('1999-01', serie)).toBe(5181.75)
  })

  it('a moins monté que les prix depuis 2002 (élasticité entre 0 et 1)', () => {
    const k = elasticitePointInflation(p['fp.historiquePoint'].valeur, SERIES.mois, SERIES.inflation)
    expect(k).toBeGreaterThan(0)
    expect(k).toBeLessThan(1)
  })
})

describe('pension de base', () => {
  it('75 % du dernier traitement avec la durée requise, à l’âge du taux plein', () => {
    const r = pensionDeBase({ indiceMajore: 826, trimestresLiquidables: 172, trimestresAssurance: 172, ageDepart: 64 }, p)
    expect(r.decote).toBe(0)
    expect(r.mensuelleBrute).toBeCloseTo(traitementMensuel(826, p) * 0.75, 6)
  })

  it('décote de 1,25 % par trimestre manquant, au plus 20 (fiche F20349)', () => {
    // 162 trimestres sur 172 à 64 ans : 10 manquants (moins que les 12 jusqu'à 67 ans).
    const r = pensionDeBase({ indiceMajore: 826, trimestresLiquidables: 162, trimestresAssurance: 162, ageDepart: 64 }, p)
    expect(r.trimestresManquants).toBe(10)
    expect(r.mensuelleBrute).toBeCloseTo(traitementMensuel(826, p) * 0.75 * (162 / 172) * (1 - 0.125), 6)
  })
})
