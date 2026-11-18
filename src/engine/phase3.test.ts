/**
 * Phase 3 : allocation chômage, événements de vie et mode carrière.
 *
 * Cas de l'ARE calculés à la main avec les règles de service-public F38881 et F2064
 * (fins de contrat à compter du 1er avril 2025, moins de 55 ans, fiche vérifiée par
 * Service-Public le 23 juillet 2026) et les retenues décrites par France Travail
 * (pages consultées le 17 novembre 2026).
 */
import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import {
  avancerAnnee,
  choisir,
  creerCarriere,
  estCarriereTerminee,
  HYPOTHESES,
  loyerMedian,
  score,
  tauxEpargne,
  type ConfigCarriere,
  type EtatCarriere,
} from './carriere.ts'
import { areDuMois, areJournaliere, ouvrirDroitsAre } from './chomage.ts'
import {
  avancer,
  creerPartie,
  migrerEtat,
  modifierFoyer,
  modifierVersements,
  perdreEmploi,
  vendreDansLaPanique,
  type ConfigPartie,
  VERSION_ETAT_PARTIE,
} from './simulation.ts'

const p = parametres2026()

describe('allocation chômage (ARE)', () => {
  it('42 000 € brut : 57 % du SJR, puis CSG et CRDS limitées au SMIC journalier', () => {
    const droits = ouvrirDroitsAre(42000, 24, false, p)
    expect(droits).not.toBeNull()
    if (!droits) return
    const sjr = 42000 / 365
    expect(droits.sjr).toBeCloseTo(sjr, 9)
    // 13,18 + 40,4 % × 115,07 = 59,67 € < 57 % × 115,07 = 65,59 € : le plancher s'applique.
    expect(droits.journalierBrut).toBeCloseTo(0.57 * sjr, 9)
    // 24 mois × 30,42 jours × 0,75 = 547,5 jours, plafonnés à 548.
    expect(droits.joursTotal).toBe(548)
    const jour = areJournaliere(droits, p)
    expect(jour.retraiteComplementaire).toBeCloseTo(0.03 * sjr, 9)
    // 65,59 − 3,45 = 62,14 € : la CSG et la CRDS ne peuvent faire descendre que jusqu'à 61,55 €.
    expect(jour.net).toBeCloseTo(61.55, 9)
  })

  it('un SJR élevé : allocation dégressive à partir du 7e mois, avec un plancher', () => {
    const droits = ouvrirDroitsAre(60000, 24, false, p)
    if (!droits) throw new Error('droits attendus')
    const sjr = 60000 / 365
    expect(sjr).toBeGreaterThan(159.68)
    expect(droits.journalierBrut).toBeCloseTo(0.57 * sjr, 9)
    expect(areJournaliere(droits, p).brut).toBeCloseTo(0.57 * sjr, 9)
    // 93,70 € × 70 % = 65,59 € < 92,57 € : le plancher après dégressivité s'applique.
    expect(areJournaliere({ ...droits, joursVerses: 180 }, p).brut).toBeCloseTo(92.57, 9)
  })

  it('exige 6 mois de travail, 5 pour un primo-entrant, et raccourcit la durée', () => {
    expect(ouvrirDroitsAre(40000, 4, false, p)).toBeNull()
    expect(ouvrirDroitsAre(40000, 5, false, p)).not.toBeNull()
    expect(ouvrirDroitsAre(40000, 5, true, p)).toBeNull()
    // 12 mois × 30,42 × 0,75 = 273,75 jours.
    expect(ouvrirDroitsAre(40000, 12, false, p)?.joursTotal).toBe(274)
  })

  it('verse 30 jours par mois, moins le délai d’attente de 7 jours le premier mois', () => {
    const droits = ouvrirDroitsAre(42000, 24, false, p)
    if (!droits) throw new Error('droits attendus')
    const premier = areDuMois(droits, p, 30 - 7)
    expect(premier.jours).toBe(23)
    const second = areDuMois(premier.droits, p)
    expect(second.jours).toBe(30)
    expect(second.net).toBeCloseTo(30 * 61.55, 6)
  })
})

const CONFIG: ConfigPartie = {
  brutAnnuel: 42000,
  depensesMensuelles: 1400,
  graine: 7,
  calendrier: { annee: 2026, mois: 0 },
  debutHistorique: 0,
}

describe('événements de vie dans le moteur', () => {
  it('une perte d’emploi après deux ans ouvre des droits, versés chaque mois, puis on reprend un poste', () => {
    let etat = avancer(creerPartie(CONFIG), p, 24)
    expect(etat.emploi.moisTravailles).toBe(24)
    etat = perdreEmploi(etat, p, { moisRecherche: 3, brutReprise: 45000, titre: 'Licenciement', detail: '' })
    expect(etat.emploi.enPoste).toBe(false)
    expect(etat.emploi.droitsAre?.joursTotal).toBe(548)
    const avant = etat.cumuls.salairesNets
    etat = avancer(etat, p, 3)
    expect(etat.cumuls.salairesNets).toBe(avant)
    expect(etat.cumuls.allocationsChomage).toBeGreaterThan(0)
    expect(etat.emploi.enPoste).toBe(true)
    expect(etat.salaire.brutAnnuel).toBe(45000)
    expect(etat.emploi.dejaIndemnise).toBe(true)
  })

  it('sans emploi précédent, pas d’allocation', () => {
    let etat = perdreEmploi(creerPartie(CONFIG), p, { moisRecherche: 2, brutReprise: 42000, titre: '', detail: '' })
    expect(etat.emploi.droitsAre).toBeNull()
    etat = avancer(etat, p, 2)
    expect(etat.cumuls.allocationsChomage).toBe(0)
    expect(etat.cumuls.salairesNets).toBe(0)
    expect(etat.emploi.enPoste).toBe(true)
  })

  it('vendre dans la panique fige la valeur des parts, puis les réinvestit', () => {
    let etat = modifierVersements(creerPartie(CONFIG), { pea: 300 })
    etat = avancer(etat, p, 12)
    const prix = etat.prixPart
    etat = vendreDansLaPanique(etat, 6)
    etat = avancer(etat, p, 6)
    expect(etat.prixPart).toBe(prix)
    expect(etat.horsMarcheJusquAuMois).toBeNull()
    etat = avancer(etat, p, 1)
    expect(etat.prixPart).not.toBe(prix)
  })

  it('un couple pacsé paie sa part de l’impôt commun, moins que seul quand le conjoint gagne moins', () => {
    const seul = avancer(creerPartie(CONFIG), p, 21)
    const pacse = avancer(
      modifierFoyer(creerPartie(CONFIG), { situation: 'couple', enfantsACharge: 0 }, 15000),
      p,
      21,
    )
    expect(pacse.cumuls.impotRevenu).toBeGreaterThan(0)
    expect(pacse.cumuls.impotRevenu).toBeLessThan(seul.cumuls.impotRevenu)
  })

  it('migre une partie de la phase 2 vers la version courante', () => {
    const v2 = { ...creerPartie(CONFIG), version: 2 } as unknown
    const migree = migrerEtat(v2)
    expect(migree?.version).toBe(VERSION_ETAT_PARTIE)
    expect(migree?.biens).toEqual([])
    expect(migree?.emploi.enPoste).toBe(true)
    expect(migree?.dureeMois).toBe(120)
  })
})

const CONFIG_CARRIERE: ConfigCarriere = {
  brutAnnuel: 40000,
  ville: 'Toulouse',
  surface: 35,
  depensesHorsLoyer: 900,
  graine: 11,
  mode: 'monte-carlo',
  calendrier: { annee: 2026, mois: 8 },
}

function jouerJusquAuBout(c: EtatCarriere, strategie: (c: EtatCarriere) => 'a' | 'b' | 'c'): EtatCarriere {
  let carriere = c
  for (let k = 0; k < 200 && !estCarriereTerminee(carriere); k++) {
    carriere = carriere.evenement ? choisir(carriere, strategie(carriere), p) : avancerAnnee(carriere, p)
  }
  return carriere
}

describe('mode carrière', () => {
  it('calcule le loyer à partir du loyer médian au m²', () => {
    expect(loyerMedian('Paris', 30, p)).toBe(Math.round(27.3 * 30))
    expect(loyerMedian('Toulouse', 35, p)).toBe(Math.round(11.9 * 35))
  })

  it('crée une carrière avec un événement à résoudre et le loyer dans les dépenses', () => {
    const c = creerCarriere(CONFIG_CARRIERE, p)
    expect(c.evenement).not.toBeNull()
    expect(c.loyer).toBe(loyerMedian('Toulouse', 35, p))
    expect(c.partie.depensesMensuelles).toBe(900 + c.loyer)
    expect(avancerAnnee(c, p)).toBe(c)
  })

  it('se joue jusqu’au bout : vingt bilans, un score entre 0 et 1 000', () => {
    for (const graine of [1, 2, 3, 4]) {
      const fin = jouerJusquAuBout(creerCarriere({ ...CONFIG_CARRIERE, graine }, p), (c) =>
        c.evenement?.type === 'krach' ? 'c' : 'a',
      )
      expect(estCarriereTerminee(fin)).toBe(true)
      expect(fin.bilans).toHaveLength(20)
      const s = score(fin, p)
      expect(s.total).toBeGreaterThanOrEqual(0)
      expect(s.total).toBeLessThanOrEqual(1000)
      expect(Number.isFinite(s.total)).toBe(true)
      expect(tauxEpargne(fin.partie)).toBeGreaterThanOrEqual(0)
    }
  })

  it('un krach se déclenche quand les actions perdent 20 %, et vendre fait baisser le sang-froid', () => {
    // Historique depuis janvier 2001 : le krach de 2001-2003 arrive vite.
    let c = creerCarriere({ ...CONFIG_CARRIERE, mode: 'historique', graine: 3, debutHistorique: 0 }, p)
    c = { ...c, partie: modifierVersements(c.partie, { pea: 400 }) }
    let krach: EtatCarriere | null = null
    for (let k = 0; k < 60 && !estCarriereTerminee(c); k++) {
      if (c.evenement?.type === 'krach') {
        krach = c
        break
      }
      c = c.evenement ? choisir(c, 'a', p) : avancerAnnee(c, p)
    }
    expect(krach).not.toBeNull()
    if (!krach) return
    const vendu = choisir(krach, 'a', p)
    expect(vendu.sangFroid).toBe(krach.sangFroid + HYPOTHESES.sangFroid.vendre)
    expect(vendu.partie.horsMarcheJusquAuMois).not.toBeNull()
    const tenu = choisir(krach, 'c', p)
    expect(tenu.sangFroid).toBe(Math.min(100, krach.sangFroid + HYPOTHESES.sangFroid.continuer))
    const attente = choisir(krach, 'b', p)
    expect(attente.partie.versements.pea).toBe(0)
    expect(attente.versementsSuspendus?.pea).toBe(400)
  })

  it('est déterministe pour une même graine', () => {
    const a = jouerJusquAuBout(creerCarriere(CONFIG_CARRIERE, p), () => 'b')
    const b = jouerJusquAuBout(creerCarriere(CONFIG_CARRIERE, p), () => 'b')
    expect(score(a, p)).toEqual(score(b, p))
  })
})
