import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import { valeurTitres } from './enveloppes.ts'
import { calculerIR, parametresIR, tauxPrelevementParDefaut } from './impots.ts'
import type { SeriesMarche } from './marches.ts'
import { brutVersNet } from './salaire.ts'
import {
  avancer,
  avancerJusquAuProchainEvenement,
  bilan,
  creerPartie,
  DUREE_PARTIE_MOIS,
  modifierPartie,
  modifierVersements,
  periodeRevelee,
  retirerDuPea,
  vendreCto,
  type ConfigPartie,
} from './simulation.ts'

const p = parametres2026()

/** Marché fictif à rendements, inflation et taux constants, pour vérifier les comptes. */
function marcheFictif(mois: number, valeurs: { r?: number; i?: number; livret?: number } = {}): SeriesMarche {
  return {
    mois: Array.from({ length: mois }, (_, k) => `${2001 + Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`),
    actionsMonde: Array<number>(mois).fill(valeurs.r ?? 0),
    inflation: Array<number>(mois).fill(valeurs.i ?? 0),
    livretA: Array<number>(mois).fill(valeurs.livret ?? 0),
    ldds: Array<number>(mois).fill(valeurs.livret ?? 0),
    lep: Array<number>(mois).fill(valeurs.livret ?? 0),
  }
}

const CONFIG: ConfigPartie = {
  brutAnnuel: 42000,
  depensesMensuelles: 1500,
  graine: 42,
  calendrier: { annee: 2027, mois: 0 },
  hausseReelleAnnuelle: 0,
  fraisAnnuelsEtf: 0,
  debutHistorique: 0,
}

describe('création d’une partie', () => {
  it('est reproductible à graine égale et cache la période', () => {
    const a = creerPartie({ ...CONFIG, debutHistorique: undefined })
    const b = creerPartie({ ...CONFIG, debutHistorique: undefined })
    expect(a.debutHistorique).toBe(b.debutHistorique)
    expect(periodeRevelee(a)).toBe(false)
    expect(a.historique).toHaveLength(1)
  })

  it('ne modifie jamais l’état reçu', () => {
    const etat = creerPartie(CONFIG)
    const copie = structuredClone(etat)
    avancer(etat, p, 13)
    expect(etat).toEqual(copie)
  })
})

describe('salaire, dépenses et prélèvement à la source', () => {
  const marche = marcheFictif(200)

  it('verse le net après prélèvement au taux par défaut la première année', () => {
    const etat = avancer(creerPartie(CONFIG, marche), p, 12, marche)
    const salaire = brutVersNet(42000, p['cotisations.salarieCadre'].valeur)
    const base = salaire.netImposable / 12
    const taux = tauxPrelevementParDefaut(base, p['pas.grilleParDefautMetropole'].valeur)
    const prelevement = Math.round(base * taux * 100) / 100
    const attendu = 12 * (salaire.netAvantImpot / 12 - prelevement - 1500)
    expect(etat.courant).toBeCloseTo(attendu, 6)
    expect(etat.fiscal.anneeEnCours.salairesImposables).toBeCloseTo(salaire.netImposable, 6)
    expect(etat.fiscal.tauxPrelevement).toBeNull()
  })

  it('régularise en septembre de l’année suivante avec le vrai calcul de l’impôt', () => {
    const avantSeptembre = avancer(creerPartie(CONFIG, marche), p, 20, marche)
    const aDeclarer = avantSeptembre.fiscal.aDeclarer
    expect(aDeclarer?.annee).toBe(2027)
    const etat = avancer(avantSeptembre, p, 1, marche)
    expect(etat.fiscal.aDeclarer).toBeNull()
    const ir = calculerIR(
      { foyer: etat.foyer, salaires: [aDeclarer?.salairesImposables ?? 0] },
      parametresIR(p, 1),
    )
    expect(etat.cumuls.impotRevenu).toBe(ir.impotNet)
    expect(etat.fiscal.tauxPrelevement).toBeCloseTo(
      Math.round((ir.impotNet / (aDeclarer?.salairesImposables ?? 1)) * 1000) / 1000,
      10,
    )
    expect(etat.journal.some((e) => e.type === 'regularisation')).toBe(true)
  })

  it('conserve l’argent : patrimoine = revenus nets − dépenses − impôt', () => {
    let etat = modifierVersements(creerPartie(CONFIG, marche), { livretA: 300, cto: 200 })
    etat = avancer(etat, p, 36, marche)
    const b = bilan(etat, p)
    // Après 36 mois (fin décembre de l'année 3), les années 1 et 2 sont régularisées :
    // leur impôt est entièrement payé ; l'année 3 n'a payé que son prélèvement à la source.
    const prelevementsAnnee3 = etat.fiscal.anneeEnCours.prelevementsPayes
    const prelevementsRegularises = etat.cumuls.prelevementsSource - prelevementsAnnee3
    const soldes = etat.cumuls.impotRevenu - prelevementsRegularises
    const attendu = etat.cumuls.salairesNets - 36 * 1500 - soldes
    // Sans rendement ni inflation ni intérêts, rien ne se crée ni ne se perd.
    expect(etat.fiscal.echeances).toHaveLength(0)
    expect(b.brut).toBeCloseTo(attendu, 4)
  })
})

describe('épargne et marchés', () => {
  it('fait croître les parts avec le marché', () => {
    const marche = marcheFictif(200, { r: 0.01 })
    let etat = modifierVersements(creerPartie(CONFIG, marche), { cto: 500 })
    etat = avancer(etat, p, 2, marche)
    // 500 € achetés à la fin du mois 1, qui gagnent 1 % au mois 2, + 500 € achetés au mois 2.
    expect(valeurTitres(etat.cto, etat.prixPart)).toBeCloseTo(500 * 1.01 + 500, 6)
  })

  it('crédite les intérêts du Livret A au 31 décembre', () => {
    const marche = marcheFictif(200, { livret: 0.03 })
    let etat = modifierVersements(creerPartie(CONFIG, marche), { livretA: 100 })
    etat = avancer(etat, p, 12, marche)
    expect(etat.livretA.interetsCourus).toBe(0)
    expect(etat.cumuls.interets).toBeGreaterThan(0)
    expect(etat.livretA.solde).toBeCloseTo(1200 + etat.cumuls.interets, 6)
  })

  it('impose la plus-value du CTO au PFU à la régularisation suivante', () => {
    const marche = marcheFictif(200, { r: 0.02 })
    let etat = modifierVersements(creerPartie(CONFIG, marche), { cto: 500 })
    etat = avancer(etat, p, 6, marche)
    const valeur = valeurTitres(etat.cto, etat.prixPart)
    const gain = valeur - etat.cto.prixDeRevient
    etat = modifierVersements(vendreCto(etat, valeur), { cto: 0 })
    expect(etat.fiscal.anneeEnCours.plusValues).toBeCloseTo(gain, 6)
    etat = avancer(etat, p, 15, marche) // jusqu'à septembre de l'année 2
    expect(etat.cumuls.prelevementsSociaux).toBe(Math.round(gain * 0.186))
  })

  it('clôture un PEA vidé avant 5 ans', () => {
    const marche = marcheFictif(200, { r: 0.01 })
    let etat = modifierVersements(creerPartie(CONFIG, marche), { pea: 300 })
    etat = avancer(etat, p, 24, marche)
    expect(etat.pea.ouvertAuMois).toBe(0)
    etat = retirerDuPea(etat, 100, p)
    expect(etat.pea.cloture).toBe(true)
    expect(etat.cumuls.impotRevenu).toBeGreaterThan(0)
  })

  it('choisit le barème sur option', () => {
    const etat = modifierPartie(creerPartie(CONFIG), { optionBareme: true, brutAnnuel: 50000 })
    expect(etat.optionBareme).toBe(true)
    expect(etat.salaire.brutAnnuel).toBe(50000)
  })
})

describe('déroulé d’une partie historique', () => {
  it('s’arrête au prochain événement marquant', () => {
    const etat = avancerJusquAuProchainEvenement(creerPartie(CONFIG), p)
    // Départ en janvier : la première augmentation arrive douze mois plus tard.
    expect(etat.mois).toBeLessThanOrEqual(12)
    expect(etat.journal.length).toBeGreaterThan(1)
  })

  it('révèle la période après dix ans et garde un historique mensuel', () => {
    const etat = avancer(creerPartie({ ...CONFIG, debutHistorique: 72 }), p, DUREE_PARTIE_MOIS)
    expect(periodeRevelee(etat)).toBe(true)
    expect(etat.historique).toHaveLength(DUREE_PARTIE_MOIS + 1)
    expect(etat.journal.at(-1)?.detail).toContain('janvier 2007 – décembre 2016')
    expect(etat.salaire.brutAnnuel).toBeGreaterThan(42000)
  })
})
