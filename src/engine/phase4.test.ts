/**
 * Phase 4 : crédit, frais d'acquisition, règles d'octroi, revenus fonciers, biens dans la
 * simulation. Cas de référence : l'exemple d'émoluments de service-public F17701 (vérifié
 * le 17/11/2026) et les règles des paramètres 2026.
 */
import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import {
  controleOctroi,
  coutCredit,
  echeanceCredit,
  emolumentsNotaire,
  fraisAcquisitionAncien,
  mensualiteCredit,
  ouvrirCredit,
  revenuFoncierImposable,
  type Credit,
} from './immobilier.ts'
import { apresOperationImmobiliere, creerCarriere, lireCarriere, objectifs } from './carriere.ts'
import { SERIES } from './marches.ts'
import {
  acheterBien,
  avancer,
  bilan,
  creerPartie,
  etudierAchat,
  vendreBien,
  type AchatBien,
  type ConfigPartie,
} from './simulation.ts'

const p = parametres2026()

describe('crédit amortissable', () => {
  it('calcule la mensualité constante et rembourse tout le capital', () => {
    const m = mensualiteCredit(200000, 0.03, 240)
    expect(m).toBeCloseTo((200000 * 0.0025) / (1 - 1.0025 ** -240), 9)
    let credit: Credit | null = ouvrirCredit(200000, 0.03, 0, 240)
    let capital = 0
    let interets = 0
    let mois = 0
    while (credit) {
      const e = echeanceCredit(credit)
      capital += e.capital
      interets += e.interets
      credit = e.credit
      mois++
    }
    expect(mois).toBe(240)
    expect(capital).toBeCloseTo(200000, 4)
    expect(interets).toBeCloseTo(240 * m - 200000, 2)
  })

  it('ajoute l’assurance, calculée sur le capital initial', () => {
    const c = coutCredit(200000, 0.03, 0.003, 240)
    expect(c.assurance).toBeCloseTo(200000 * 0.003 * 20, 6)
  })

  it('sans taux, la mensualité est le capital divisé par la durée', () => {
    expect(mensualiteCredit(12000, 0, 120)).toBe(100)
  })
})

describe('frais d’acquisition dans l’ancien', () => {
  it('émoluments du notaire : l’exemple de service-public pour 200 000 €', () => {
    expect(emolumentsNotaire(200000, p['notaire.emolumentsVente'].valeur)).toBeCloseTo(1995.25, 2)
  })

  it('droits de mutation à 4,5 % pour un primo-accédant, 5 % sinon', () => {
    const primo = fraisAcquisitionAncien(200000, p, { primoAccedant: true })
    // 200 000 × (4,5 % + 1,2 % + 4,5 % × 2,37 %) = 200 000 × 5,80665 % = 11 613,30 € (« 5,81 % » selon impots.gouv).
    expect(primo.droitsMutation).toBeCloseTo(11613.3, 2)
    expect(primo.contributionSecurite).toBeCloseTo(200, 6)
    expect(primo.emolumentsTTC).toBeCloseTo(1995.25 * 1.2, 2)
    expect(primo.total).toBeCloseTo(11613.3 + 200 + 2394.3, 2)
    const autre = fraisAcquisitionAncien(200000, p, { primoAccedant: false })
    expect(autre.droitsMutation).toBeCloseTo(200000 * (0.05 + 0.012 + 0.05 * 0.0237), 6)
  })
})

describe('octroi du crédit', () => {
  const base = { chargesCreditMensuelles: 1000, revenusNetsMensuels: 3000, dureeMois: 300, tauxAnnuel: 0.0332, tauxAssurance: 0.003 }

  it('accepte 33 % de taux d’effort sur 25 ans', () => {
    expect(controleOctroi(base, p).ok).toBe(true)
  })

  it('refuse plus de 35 % de taux d’effort, plus de 25 ans, ou un TAEG au-dessus de l’usure', () => {
    expect(controleOctroi({ ...base, chargesCreditMensuelles: 1200 }, p).effortOk).toBe(false)
    expect(controleOctroi({ ...base, dureeMois: 312 }, p).dureeOk).toBe(false)
    expect(controleOctroi({ ...base, tauxAnnuel: 0.055 }, p).usureOk).toBe(false)
    expect(controleOctroi({ ...base, chargesCreditMensuelles: 1200 }, p).motifs[0]).toMatch(/35 %/)
  })
})

describe('revenus fonciers', () => {
  it('micro-foncier sous 15 000 € de loyers, régime réel au-delà', () => {
    expect(revenuFoncierImposable(10000, 5000, p)).toEqual({ imposable: 7000, regime: 'micro-foncier' })
    expect(revenuFoncierImposable(20000, 8000, p)).toEqual({ imposable: 12000, regime: 'reel' })
    expect(revenuFoncierImposable(20000, 25000, p).imposable).toBe(0)
  })
})

const CONFIG: ConfigPartie = {
  brutAnnuel: 60000,
  depensesMensuelles: 1800,
  graine: 4,
  calendrier: { annee: 2027, mois: 0 },
  debutHistorique: SERIES.mois.indexOf('2010-01'),
  tresorerieInitiale: 40000,
}

const RESIDENCE: AchatBien = {
  usage: 'residence-principale',
  nom: 'Appartement',
  prix: 200000,
  apport: 30000,
  dureeMois: 300,
  tauxCredit: 0.0332,
  tauxAssurance: 0.003,
  chargesMensuelles: 100,
  taxeFonciereAnnuelle: 900,
  loyerQuitte: 700,
}

describe('un bien dans la simulation', () => {
  it('achète une résidence principale : apport, frais, crédit, loyer en moins', () => {
    const depart = creerPartie(CONFIG)
    const { etat, refus, detail } = acheterBien(depart, p, RESIDENCE)
    expect(refus).toEqual([])
    expect(etat.courant).toBeCloseTo(depart.courant - 30000, 6)
    expect(detail.capitalEmprunte).toBeCloseTo(200000 + detail.frais - 30000, 6)
    expect(etat.depensesMensuelles).toBe(1100)
    const b = bilan(etat, p)
    expect(b.immobilier).toBe(200000)
    expect(b.dettes).toBeCloseTo(detail.capitalEmprunte, 6)
  })

  it('fait suivre la valeur à l’indice des prix et paie chaque mois l’échéance', () => {
    const { etat } = acheterBien(creerPartie(CONFIG), p, RESIDENCE)
    const apres = avancer(etat, p, 12)
    const bien = apres.biens[0]
    expect(bien?.valeur).not.toBe(200000)
    expect(apres.cumuls.interetsCredit).toBeGreaterThan(0)
    expect(apres.cumuls.taxeFonciere).toBeGreaterThan(899)
    expect(bien?.credit?.moisRestants).toBe(288)
  })

  it('refuse un achat qui dépasse 35 % de taux d’effort, sans rien changer', () => {
    const depart = creerPartie({ ...CONFIG, brutAnnuel: 30000 })
    const r = acheterBien(depart, p, { ...RESIDENCE, prix: 400000 })
    expect(r.refus.length).toBeGreaterThan(0)
    expect(r.etat).toBe(depart)
    expect(etudierAchat(depart, p, { ...RESIDENCE, apport: 1e6 }).motifs[0]).toMatch(/Apport/)
  })

  it('revend au prix du marché et solde le crédit', () => {
    const { etat } = acheterBien(creerPartie(CONFIG), p, RESIDENCE)
    const avant = avancer(etat, p, 24)
    const bien = avant.biens[0]
    if (!bien) throw new Error('bien attendu')
    const vendu = vendreBien(avant, bien.id)
    expect(vendu.biens).toHaveLength(0)
    expect(vendu.courant).toBeCloseTo(avant.courant + bien.valeur - (bien.credit?.capitalRestant ?? 0), 6)
  })

  it('une location nue : loyers encaissés, imposés au micro-foncier avec 17,2 % de prélèvements sociaux', () => {
    const { etat, refus } = acheterBien(creerPartie(CONFIG), p, {
      ...RESIDENCE,
      usage: 'locatif',
      nom: 'Studio',
      prix: 120000,
      loyerQuitte: 0,
      loyerMensuel: 550,
      vacance: 0,
    })
    expect(refus).toEqual([])
    const apres = avancer(etat, p, 21)
    expect(apres.cumuls.loyersPercus).toBeGreaterThan(550 * 21)
    const regularisation = apres.journal.find((e) => e.type === 'regularisation' && e.detail.includes('Loyers'))
    expect(regularisation?.detail).toMatch(/micro-foncier/)
  })
})

describe('immobilier en mode carrière', () => {
  it('acheter sa résidence principale arrête le loyer et atteint l’objectif ; la vendre le ramène', () => {
    let c = creerCarriere(
      { brutAnnuel: 55000, ville: 'Toulouse', surface: 30, depensesHorsLoyer: 900, graine: 2, mode: 'monte-carlo', calendrier: { annee: 2027, mois: 0 } },
      p,
    )
    c = { ...c, partie: { ...c.partie, courant: 40000 } }
    const loyer = c.loyer
    const depensesAvant = c.partie.depensesMensuelles
    const { etat, refus } = acheterBien(c.partie, p, { ...RESIDENCE, loyerQuitte: c.loyer })
    expect(refus).toEqual([])
    c = apresOperationImmobiliere(c, etat, p)
    expect(c.loyer).toBe(0)
    expect(c.partie.depensesMensuelles).toBe(depensesAvant - loyer)
    expect(objectifs(c, p).find((o) => o.cle === 'residencePrincipale')?.atteint).toBe(true)
    const id = c.partie.biens[0]?.id ?? 0
    c = apresOperationImmobiliere(c, vendreBien(c.partie, id), p)
    expect(c.loyer).toBe(loyer)
    expect(c.partie.depensesMensuelles).toBe(depensesAvant)
  })

  it('relit une carrière de la phase 3 : « un an de salaire » devient la résidence principale', () => {
    const c = creerCarriere(
      { brutAnnuel: 40000, ville: 'Lyon', surface: 30, depensesHorsLoyer: 900, graine: 3, mode: 'monte-carlo', calendrier: { annee: 2027, mois: 0 } },
      p,
    )
    const ancienne = { ...c, partie: { ...c.partie, version: 3 }, objectifs: { precaution: 2, unAn: 4, independance: null } }
    const relue = lireCarriere(JSON.parse(JSON.stringify(ancienne)))
    expect(relue?.objectifs).toEqual({ precaution: 2, residencePrincipale: null, independance: null })
    expect(relue?.partie.version).toBe(4)
  })
})
