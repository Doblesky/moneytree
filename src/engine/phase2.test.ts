import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import {
  ASSURANCE_VIE_FERMEE,
  acheter,
  disponiblePee,
  PEE_VIDE,
  racheterAssuranceVie,
  retirerPee,
  TITRES_VIDES,
  valeurPee,
  verserPee,
} from './enveloppes.ts'
import { calculerIR, parametresIR } from './impots.ts'
import { SERIES, SOURCES_FONDS_EUROS, type SeriesMarche } from './marches.ts'
import { DUREE_TRAJECTOIRE_MOIS, ligneDuMois } from './modesMarche.ts'
import {
  avancer,
  bilan,
  creerPartie,
  migrerEtat,
  modifierEpargneSalariale,
  modifierPartUniteDeCompte,
  modifierVersements,
  projeterStrategie,
  racheterDeLAssuranceVie,
  type ConfigPartie,
  VERSION_ETAT_PARTIE,
} from './simulation.ts'

const p = parametres2026()

function marcheFictif(mois: number, v: { r?: number; fondsEuros?: number } = {}): SeriesMarche {
  return {
    mois: Array.from({ length: mois }, (_, k) => `${2001 + Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`),
    actionsMonde: Array<number>(mois).fill(v.r ?? 0),
    inflation: Array<number>(mois).fill(0),
    livretA: Array<number>(mois).fill(0),
    ldds: Array<number>(mois).fill(0),
    lep: Array<number>(mois).fill(0),
    fondsEuros: Array<number>(mois).fill(v.fondsEuros ?? 0),
    fondsEurosEstime: Array<boolean>(mois).fill(false),
  }
}

const CONFIG: ConfigPartie = {
  brutAnnuel: 42000,
  depensesMensuelles: 1500,
  graine: 7,
  calendrier: { annee: 2027, mois: 0 },
  hausseReelleAnnuelle: 0,
  fraisAnnuelsEtf: 0,
  debutHistorique: 0,
}

describe('série des fonds en euros (ACPR)', () => {
  it('reprend les taux publiés et signale les années estimées', () => {
    const i2015 = SERIES.mois.indexOf('2015-06')
    expect(SERIES.fondsEuros?.[i2015]).toBeCloseTo(0.0227, 10)
    expect(SERIES.fondsEurosEstime?.[i2015]).toBe(false)
    const i2003 = SERIES.mois.indexOf('2003-06')
    expect(SERIES.fondsEurosEstime?.[i2003]).toBe(true)
    expect(SOURCES_FONDS_EUROS.annees.every((a) => a.source.startsWith('https://acpr.banque-france.fr/'))).toBe(true)
  })
})

describe('modes de marché', () => {
  it('Monte Carlo : une trajectoire de trente ans, reproductible, faite de vrais mois', () => {
    const a = creerPartie({ ...CONFIG, mode: 'monte-carlo', debutHistorique: undefined })
    const b = creerPartie({ ...CONFIG, mode: 'monte-carlo', debutHistorique: undefined })
    expect(a.dureeDisponible).toBe(DUREE_TRAJECTOIRE_MOIS)
    expect(a.marche.indices).toEqual(b.marche.indices)
    expect(a.marche.indices?.every((i) => i >= 0 && i < SERIES.mois.length)).toBe(true)
  })

  it('scénario krach : −40 % sur la première année', () => {
    const etat = creerPartie({ ...CONFIG, mode: 'scenario', scenario: 'krach' })
    const cumul = Array.from({ length: 12 }, (_, m) => ligneDuMois(etat.marche, 0, m, SERIES).actions).reduce(
      (acc, r) => acc * (1 + r),
      1,
    )
    expect(cumul).toBeCloseTo(0.6, 10)
  })

  it('scénario décennie perdue : rejoue 2001-2010', () => {
    const etat = creerPartie({ ...CONFIG, mode: 'scenario', scenario: 'decennie-perdue' })
    const debut = SERIES.mois.indexOf('2001-01')
    expect(etat.marche.indices?.slice(0, 120)).toEqual(Array.from({ length: 120 }, (_, k) => debut + k))
  })

  it('scénario inflation : 10 % par an pendant dix ans', () => {
    const etat = creerPartie({ ...CONFIG, mode: 'scenario', scenario: 'inflation' })
    const ligne = ligneDuMois(etat.marche, 0, 5, SERIES)
    expect((1 + ligne.inflation) ** 12).toBeCloseTo(1.1, 10)
    expect(ligne.livretA).toBe(0.06)
  })

  it('projette la stratégie : P10 ≤ P50 ≤ P90 à chaque horizon', () => {
    const etat = modifierVersements(creerPartie(CONFIG), { cto: 300 })
    const r = projeterStrategie(etat, p, { trajectoires: 40, horizonMois: 36, graine: 3 })
    expect(r.mois).toEqual([0, 12, 24, 36])
    r.p50.forEach((v, i) => {
      expect(r.p10[i]).toBeLessThanOrEqual(v)
      expect(v).toBeLessThanOrEqual(r.p90[i] ?? 0)
    })
  })
})

describe('assurance-vie', () => {
  const regles = {
    dureeFiscaleMois: 96,
    tauxImpotAvant: 0.128,
    tauxImpotApres: 0.075,
    plafondPrimesTauxReduit: 150000,
    abattementRestant: 4600,
    tauxPrelevementsSociaux: 0.172,
  }

  it('calcule le gain d’un rachat partiel avec la formule du BOFiP', () => {
    // 10 000 € de primes, contrat valant 12 000 € : rachat de 3 000 €.
    const av = { ...ASSURANCE_VIE_FERMEE, ouvertAuMois: 0, fondsEuros: { solde: 12000, interetsCourus: 0 }, primes: 10000 }
    const r = racheterAssuranceVie(av, 3000, 100, 24, regles)
    // 3 000 − 10 000 × (3 000 / 12 000) = 500 € de gain.
    expect(r.gain).toBeCloseTo(500, 8)
    expect(r.impotRevenu).toBeCloseTo(64, 8) // 12,8 % avant 8 ans
    expect(r.prelevementsSociaux).toBe(0) // déjà prélevés sur le fonds en euros
    expect(r.av.primes).toBeCloseTo(7500, 8)
  })

  it('après 8 ans : abattement puis 7,5 %, prélèvements sociaux sur les gains des unités de compte', () => {
    const av = {
      ...ASSURANCE_VIE_FERMEE,
      ouvertAuMois: 0,
      uc: acheter(TITRES_VIDES, 10000, 100),
      primes: 10000,
    }
    const r = racheterAssuranceVie(av, Number.POSITIVE_INFINITY, 200, 100, regles)
    expect(r.gain).toBeCloseTo(10000, 8)
    expect(r.abattementUtilise).toBe(4600)
    expect(r.impotRevenu).toBeCloseTo((10000 - 4600) * 0.075, 8)
    expect(r.prelevementsSociaux).toBeCloseTo(1720, 8)
  })

  it('crédite le fonds en euros au 31 décembre, net des prélèvements sociaux', () => {
    const marche = marcheFictif(200, { fondsEuros: 0.03 })
    let etat = modifierVersements(creerPartie(CONFIG, marche), { assuranceVie: 1000 })
    etat = avancer(etat, p, 12, marche)
    const brut = 1000 * 0.03 * ((11 * 12) / 2 + 12 * 0.5) / 12 // versements mensuels, quinzaine au versement
    expect(etat.cumuls.interetsFondsEuros).toBeCloseTo(brut * (1 - 0.172), 6)
    expect(etat.assuranceVie.ouvertAuMois).toBe(0)
  })

  it('répartit les versements entre fonds en euros et unités de compte', () => {
    const marche = marcheFictif(200)
    let etat = modifierPartUniteDeCompte(modifierVersements(creerPartie(CONFIG, marche), { assuranceVie: 1000 }), 0.3)
    etat = avancer(etat, p, 1, marche)
    expect(etat.assuranceVie.fondsEuros.solde).toBeCloseTo(700, 8)
    expect(etat.assuranceVie.uc.prixDeRevient).toBeCloseTo(300, 8)
    etat = racheterDeLAssuranceVie(etat, 500, p)
    expect(etat.assuranceVie.primes).toBeCloseTo(500, 6)
  })
})

describe('PER et épargne salariale', () => {
  it('déduit les versements PER du revenu imposable, dans la limite du plafond minimal la première année', () => {
    const marche = marcheFictif(200)
    const sans = avancer(creerPartie(CONFIG, marche), p, 21, marche)
    const avec = avancer(modifierVersements(creerPartie(CONFIG, marche), { per: 500 }), p, 21, marche)
    // Année 1 : 6 000 € versés, déduits jusqu'au plafond minimal (10 % du PASS 2025).
    expect(avec.per.versementsDeduits).toBeCloseTo(p['per.plafondDeductionMin'].valeur + 4500, 6)
    expect(avec.cumuls.impotRevenu).toBeLessThan(sans.cumuls.impotRevenu)
    const pIR = parametresIR(p)
    const salaires = sans.fiscal.anneeEnCours.salairesImposables
    expect(salaires).toBeGreaterThan(0)
    expect(calculerIR({ foyer: avec.foyer, salaires: [1] }, pIR).impotNet).toBe(0)
  })

  it('abonde le PEE, retient la CSG et la CRDS, et bloque les sommes 5 ans', () => {
    const marche = marcheFictif(200)
    let etat = creerPartie(CONFIG, marche)
    etat = modifierEpargneSalariale(modifierVersements(etat, { pee: 100 }), {
      abondementTaux: 1,
      abondementPlafond: 600,
    })
    etat = avancer(etat, p, 12, marche)
    // 1 200 € versés, abondement plafonné à 600 € par l'entreprise, CSG-CRDS de 9,7 % dessus.
    expect(etat.cumuls.abondement).toBeCloseTo(600, 6)
    expect(etat.cumuls.csgCrdsEpargneSalariale).toBeCloseTo(600 * 0.097, 6)
    expect(valeurPee(etat.pee, etat.prixPart)).toBeCloseTo(1200 + 600 * (1 - 0.097), 6)
    expect(disponiblePee(etat.pee, etat.prixPart, etat.mois)).toBe(0)
  })

  it('impose l’intéressement perçu, pas l’intéressement placé', () => {
    const marche = marcheFictif(200)
    const base = modifierEpargneSalariale(creerPartie(CONFIG, marche), { interessementAnnuel: 2000 })
    const place = avancer(base, p, 12, marche)
    const percu = avancer(modifierEpargneSalariale(base, { placerInteressement: false }), p, 12, marche)
    expect(percu.fiscal.anneeEnCours.salairesImposables - place.fiscal.anneeEnCours.salairesImposables).toBeCloseTo(
      2000 * (1 - 0.097),
      6,
    )
    expect(valeurPee(place.pee, place.prixPart)).toBeCloseTo(2000 * (1 - 0.097), 6)
  })

  it('retire du PEE les seules tranches débloquées, gains aux prélèvements sociaux', () => {
    let pee = verserPee(PEE_VIDE, 1000, 100, 60)
    pee = verserPee(pee, 1000, 200, 72)
    const r = retirerPee(pee, 5000, 300, 65, 0.186)
    expect(r.gain).toBeCloseTo(2000, 8) // 10 parts achetées 1 000 €, valant 3 000 €
    expect(r.prelevementsSociaux).toBeCloseTo(372, 8)
    expect(r.pee.tranches).toHaveLength(1)
  })
})

describe('compatibilité des parties enregistrées', () => {
  it('migre une partie de la phase 1', () => {
    const v2 = creerPartie(CONFIG)
    const v1 = {
      ...Object.fromEntries(Object.entries(structuredClone(v2)).filter(([cle]) => !['marche', 'assuranceVie', 'per', 'pee', 'epargneSalariale'].includes(cle))),
      version: 1,
      versements: { livretA: 150, ldds: 0, lep: 0, pea: 0, cto: 200 },
    }
    const migree = migrerEtat(structuredClone(v1))
    expect(migree?.version).toBe(VERSION_ETAT_PARTIE)
    expect(migree?.marche.mode).toBe('historique')
    expect(migree?.versements.assuranceVie).toBe(0)
    if (!migree) return
    expect(() => avancer(migree, p, 13)).not.toThrow()
    expect(bilan(avancer(migree, p, 13), p).brut).toBeGreaterThan(0)
    expect(migrerEtat({ version: 99 })).toBeNull()
  })
})
