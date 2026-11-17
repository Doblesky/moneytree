import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import {
  abattementFraisPro,
  calculerIR,
  nombreDeParts,
  parametresIR,
  tauxPrelevementParDefaut,
  tauxPrelevementPersonnalise,
  type Foyer,
} from './impots.ts'

const p = parametres2026()
const pIR = parametresIR(p)

/**
 * Cas calculés avec le simulateur officiel « Calcul de l'impôt 2026 sur les revenus 2025,
 * modèle simplifié » (version mars 2026) :
 * https://simulateur-ir-ifi.impots.gouv.fr/calcul_impot/2026/simplifie/index.htm
 * Saisies du 17/11/2026, montants fictifs : salaires en cases 1AJ / 1BJ, métropole, aucune
 * autre case. « pas » est le taux de prélèvement que le simulateur annonce pour septembre 2026.
 */
const CAS_OFFICIELS: {
  nom: string
  foyer: Foyer
  salaires: number[]
  rni: number
  droits: number
  decote: number
  impot: number
  tmi: number
  pas: number
}[] = [
  {
    nom: 'célibataire, 1AJ = 30 000 € (décote)',
    foyer: { situation: 'celibataire', enfantsACharge: 0 },
    salaires: [30000],
    rni: 27000,
    droits: 1694,
    decote: 130,
    impot: 1564,
    tmi: 0.11,
    pas: 0.052,
  },
  {
    nom: 'célibataire, 1AJ = 35 000 € (tranche à 30 %)',
    foyer: { situation: 'celibataire', enfantsACharge: 0 },
    salaires: [35000],
    rni: 31500,
    droits: 2554,
    decote: 0,
    impot: 2554,
    tmi: 0.3,
    pas: 0.073,
  },
  {
    nom: 'célibataire, 1AJ = 20 000 € (forte décote)',
    foyer: { situation: 'celibataire', enfantsACharge: 0 },
    salaires: [20000],
    rni: 18000,
    droits: 704,
    decote: 578,
    impot: 126,
    tmi: 0.11,
    pas: 0.006,
  },
  {
    nom: 'célibataire, 1AJ = 13 000 € (décote égale aux droits)',
    foyer: { situation: 'celibataire', enfantsACharge: 0 },
    salaires: [13000],
    rni: 11700,
    droits: 11,
    decote: 11,
    impot: 0,
    tmi: 0.11,
    pas: 0,
  },
  {
    nom: 'célibataire, 1AJ = 60 000 €',
    foyer: { situation: 'celibataire', enfantsACharge: 0 },
    salaires: [60000],
    rni: 54000,
    droits: 9304,
    decote: 0,
    impot: 9304,
    tmi: 0.3,
    pas: 0.155,
  },
  {
    nom: 'célibataire, 1AJ = 170 000 € (abattement de 10 % plafonné, tranche à 41 %)',
    foyer: { situation: 'celibataire', enfantsACharge: 0 },
    salaires: [170000],
    rni: 155445,
    droits: 47533,
    decote: 0,
    impot: 47533,
    tmi: 0.41,
    pas: 0.28,
  },
  {
    nom: 'couple marié, 1AJ = 40 000 € et 1BJ = 30 000 €',
    foyer: { situation: 'couple', enfantsACharge: 0 },
    salaires: [40000, 30000],
    rni: 63000,
    droits: 5108,
    decote: 0,
    impot: 5108,
    tmi: 0.3,
    pas: 0.073,
  },
  {
    nom: 'couple marié, 2 enfants, 1AJ = 90 000 € et 1BJ = 60 000 € (plafonnement du quotient familial)',
    foyer: { situation: 'couple', enfantsACharge: 2 },
    salaires: [90000, 60000],
    rni: 135000,
    droits: 23094,
    decote: 0,
    impot: 23094,
    tmi: 0.3,
    pas: 0.154,
  },
]

describe('impôt sur le revenu : cas du simulateur officiel impots.gouv.fr (17/11/2026)', () => {
  it.each(CAS_OFFICIELS)('$nom', (cas) => {
    const detail = calculerIR({ foyer: cas.foyer, salaires: cas.salaires }, pIR)
    expect(detail.revenuNetImposable).toBe(cas.rni)
    expect(detail.droitsSimples).toBe(cas.droits)
    expect(detail.decote).toBe(cas.decote)
    expect(detail.impotNet).toBe(cas.impot)
    expect(detail.tauxMarginal).toBe(cas.tmi)
    const salaires = cas.salaires.reduce((a, b) => a + b, 0)
    expect(tauxPrelevementPersonnalise(detail.impotNet, salaires)).toBeCloseTo(cas.pas, 10)
  })
})

describe('règles de calcul', () => {
  it('compte les parts de quotient familial', () => {
    expect(nombreDeParts({ situation: 'celibataire', enfantsACharge: 0 })).toBe(1)
    expect(nombreDeParts({ situation: 'couple', enfantsACharge: 0 })).toBe(2)
    expect(nombreDeParts({ situation: 'couple', enfantsACharge: 1 })).toBe(2.5)
    expect(nombreDeParts({ situation: 'couple', enfantsACharge: 2 })).toBe(3)
    expect(nombreDeParts({ situation: 'couple', enfantsACharge: 3 })).toBe(4)
  })

  it('borne la déduction forfaitaire de 10 %', () => {
    expect(abattementFraisPro(30000, pIR)).toBe(3000)
    expect(abattementFraisPro(3000, pIR)).toBe(509) // minimum
    expect(abattementFraisPro(300, pIR)).toBe(300) // jamais plus que le salaire
    expect(abattementFraisPro(200000, pIR)).toBe(14555) // maximum
  })

  it('indexe les limites du barème', () => {
    const indexe = parametresIR(p, 1.1)
    // Revenu et limites augmentent de 10 % : l'impôt augmente de 10 % (à l'arrondi près).
    const avant = calculerIR({ foyer: { situation: 'celibataire', enfantsACharge: 0 }, salaires: [35000] }, pIR)
    const apres = calculerIR(
      { foyer: { situation: 'celibataire', enfantsACharge: 0 }, salaires: [38500] },
      indexe,
    )
    expect(apres.impotNet).toBeCloseTo(avant.impotNet * 1.1, -1)
  })

  it('ajoute les revenus imposés au barème et retire les charges déductibles', () => {
    const detail = calculerIR(
      {
        foyer: { situation: 'celibataire', enfantsACharge: 0 },
        salaires: [35000],
        autresRevenus: 1000,
        chargesDeductibles: 200,
      },
      pIR,
    )
    expect(detail.revenuNetImposable).toBe(31500 + 1000 - 200)
  })
})

describe('prélèvement à la source, grille par défaut 2026 (BOI-BAREME-000037)', () => {
  const grille = p['pas.grilleParDefautMetropole'].valeur
  it('applique le taux de la tranche à toute la base, borne supérieure exclue', () => {
    expect(tauxPrelevementParDefaut(1634.99, grille)).toBe(0)
    expect(tauxPrelevementParDefaut(1635, grille)).toBe(0.005)
    expect(tauxPrelevementParDefaut(2900, grille)).toBe(0.075)
    expect(tauxPrelevementParDefaut(3135, grille)).toBe(0.099)
    expect(tauxPrelevementParDefaut(60000, grille)).toBe(0.43)
  })

  it('convertit la base en euros de l’année des paramètres', () => {
    expect(tauxPrelevementParDefaut(3135 * 1.02, grille, 1.02)).toBe(0.099)
    expect(tauxPrelevementParDefaut(3134 * 1.02, grille, 1.02)).toBe(0.075)
  })
})
