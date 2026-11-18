/**
 * Phase 5 : actions individuelles des sociétés fictives (hypothèses du jeu, pas de source
 * officielle à vérifier : le modèle reprend le MEDAF du module 5).
 */
import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import { levierDebloque, type EtatProgression } from '../progression/regles.ts'
import { bpaInitial, marcheActionsInitial, moisActions, ratios, SOCIETES, societe, valeurLignes } from './actions.ts'
import { SERIES } from './marches.ts'
import { acheterTitreVif, avancer, bilan, creerPartie, vendreTitreVif, type ConfigPartie } from './simulation.ts'

const p = parametres2026()

describe('sociétés fictives', () => {
  it('fixe le cours de départ au PER × bénéfice par action', () => {
    const m = marcheActionsInitial(1)
    const hexagone = societe('hexagone')
    expect(bpaInitial(hexagone)).toBe(12)
    expect(m.cours.hexagone).toBe(336)
    const r = ratios(hexagone, m)
    expect(r.per).toBeCloseTo(28, 6)
    expect(r.rendementDividende).toBeCloseTo((12 * 0.45) / 336, 6)
    expect(r.endettement).toBeCloseTo(0.2, 6)
    expect(SOCIETES.filter((x) => x.eligiblePea).map((x) => x.zone)).toEqual(Array(6).fill('Europe'))
  })

  it('rejoue la même suite avec la même graine', () => {
    const a = moisActions(marcheActionsInitial(7), 0.01, 0.02, false)
    const b = moisActions(marcheActionsInitial(7), 0.01, 0.02, false)
    expect(a.marche.cours).toEqual(b.marche.cours)
  })

  it('ne rémunère pas le risque propre : sans prime de marché, le rendement moyen est le taux sans risque', () => {
    // 4 000 mois, marché au taux sans risque : seul l'aléa propre joue, centré sur zéro.
    let m = marcheActionsInitial(11)
    m = { ...m, faillites: [] }
    const depart = m.cours.nordlys
    let logs = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      const avant = m.cours.nordlys
      m = moisActions(m, 0.02 / 12, 0.02, false).marche
      if (m.faillites.includes('nordlys')) break
      logs += Math.log(m.cours.nordlys / avant)
    }
    expect(depart).toBeGreaterThan(0)
    // Espérance de log-rendement : ln(1 + rf/12) − σ²/2 par mois, à l'erreur d'échantillonnage près.
    const sigma = 0.24 / Math.sqrt(12)
    expect(logs / n).toBeCloseTo(Math.log(1 + 0.02 / 12) - (sigma * sigma) / 2, 2)
  })

  it('fait tomber à zéro une société en faillite', () => {
    // Avec 3 % par an, Rivage finit par faire faillite sur une très longue période.
    let m = marcheActionsInitial(3)
    let mois = 0
    while (!m.faillites.includes('rivage') && mois < 3000) {
      m = moisActions(m, 0.005, 0.02, mois % 12 === 0).marche
      mois++
    }
    expect(m.faillites).toContain('rivage')
    expect(m.cours.rivage).toBe(0)
    expect(ratios(societe('rivage'), m).enFaillite).toBe(true)
  })
})

const CONFIG: ConfigPartie = {
  brutAnnuel: 50000,
  depensesMensuelles: 1800,
  graine: 9,
  calendrier: { annee: 2027, mois: 0 },
  debutHistorique: SERIES.mois.indexOf('2010-01'),
  tresorerieInitiale: 10000,
}

describe('actions individuelles dans la partie', () => {
  it('achète des actions entières sur le compte-titres', () => {
    const etat = creerPartie(CONFIG)
    const r = acheterTitreVif(etat, 'hexagone', 1000)
    expect(r.refus).toBeNull()
    expect(r.etat.titresVifs).toEqual([{ societe: 'hexagone', quantite: 2, prixDeRevient: 672 }])
    expect(r.etat.courant).toBeCloseTo(10000 - 672, 6)
    expect(bilan(r.etat, p).cto).toBeCloseTo(672, 6)
    expect(acheterTitreVif(etat, 'hexagone', 300).refus).toBe('Le montant ne suffit pas pour une action entière.')
    expect(acheterTitreVif(etat, 'hexagone', 50000).etat.titresVifs[0]?.quantite).toBe(29)
  })

  it('déclare la plus-value à la vente', () => {
    const achat = acheterTitreVif(creerPartie(CONFIG), 'volta', 2000).etat
    const plusTard = avancer(achat, 6, p)
    const ligne = plusTard.titresVifs[0]
    if (!ligne) throw new Error('ligne attendue')
    const valeur = valeurLignes(plusTard.titresVifs, plusTard.actions)
    const vendu = vendreTitreVif(plusTard, 'volta')
    expect(vendu.titresVifs).toEqual([])
    expect(vendu.courant).toBeCloseTo(plusTard.courant + valeur, 6)
    expect(vendu.fiscal.anneeEnCours.plusValues - plusTard.fiscal.anneeEnCours.plusValues).toBeCloseTo(valeur - ligne.prixDeRevient, 6)
  })

  it('n’altère pas le reste de la partie : les actions ont leur propre aléa', () => {
    const sans = avancer(creerPartie(CONFIG), 36, p)
    const avec = avancer(acheterTitreVif(creerPartie(CONFIG), 'cobalt', 3000).etat, 36, p)
    expect(avec.salaire.brutAnnuel).toBe(sans.salaire.brutAnnuel)
    expect(avec.prixPart).toBe(sans.prixPart)
    expect(avec.actions.cours).toEqual(sans.actions.cours)
  })

  it('s’ouvre avec le palier Expert du module 3', () => {
    const base: EtatProgression = { modeExpert: false, modules: [], leviersForces: [] }
    const trois = { ...base, modules: [{ moduleId: 3, paliersMaitrises: 3 }] }
    const quatre = { ...base, modules: [{ moduleId: 3, paliersMaitrises: 4 }] }
    expect(levierDebloque(trois, 'actionsIndividuelles')).toBe(false)
    expect(levierDebloque(quatre, 'actionsIndividuelles')).toBe(true)
    expect(levierDebloque(trois, 'monteCarlo')).toBe(true)
  })
})
