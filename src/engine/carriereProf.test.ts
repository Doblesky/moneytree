/** Mode carrière du profil prof : statuts, grille, point d'indice, événements du métier. */
import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import {
  avancerAnnee,
  brutProf,
  choisir,
  creerCarriere,
  estCarriereTerminee,
  score,
  type ConfigCarriere,
  type EtatCarriere,
} from './carriere.ts'
import { bulletinMensuel, positionStagiaire } from './fonctionPublique.ts'
import { SERIES } from './marches.ts'

const p = parametres2026()

const CONFIG: ConfigCarriere = {
  brutAnnuel: 0,
  ville: 'Toulouse',
  surface: 25,
  depensesHorsLoyer: 700,
  graine: 7,
  mode: 'monte-carlo',
  calendrier: { annee: 2027, mois: 8 },
  prof: true,
}

function jouer(c: EtatCarriere, choix: (c: EtatCarriere) => 'a' | 'b' | 'c', annees = 99): EtatCarriere {
  let carriere = c
  for (let k = 0; k < 400 && !estCarriereTerminee(carriere) && carriere.bilans.length < annees; k++) {
    carriere = carriere.evenement ? choisir(carriere, choix(carriere), p) : avancerAnnee(carriere, p)
  }
  return carriere
}

describe('carrière prof', () => {
  it('commence en élève fonctionnaire, au régime de la fonction publique', () => {
    const c = creerCarriere(CONFIG, p)
    expect(c.prof?.statut).toBe('eleve')
    expect(c.partie.salaire.regime).toBe('fonctionnaire')
    const eleve = bulletinMensuel({ statut: 'eleve', position: positionStagiaire(p) }, p)
    expect(c.partie.salaire.brutAnnuel).toBeCloseTo(eleve.brut * 12, 6)
    expect(c.ageDepart).toBe(22)
  })

  it('stagiaire la deuxième année, titulaire la troisième, avec l’affectation tranchée', () => {
    // Le nouveau statut s'affiche dès la fin de l'année écoulée.
    const un = jouer(creerCarriere(CONFIG, p), () => 'b', 1)
    expect(un.prof?.statut).toBe('stagiaire')
    const deux = jouer(un, () => 'b', 2)
    expect(deux.prof?.statut).toBe('titulaire')
    const trois = jouer(deux, () => 'b', 3)
    expect(trois.prof?.affectationFaite).toBe(true)
  })

  it('se joue jusqu’au bout : vingt bilans, la grille monte, le score reste entre 0 et 1 000', () => {
    for (const graine of [1, 2, 3, 4, 5]) {
      const fin = jouer(creerCarriere({ ...CONFIG, graine }, p), (c) => (c.evenement?.type === 'krach' ? 'c' : 'a'))
      expect(estCarriereTerminee(fin)).toBe(true)
      expect(fin.bilans).toHaveLength(20)
      const v = fin.prof
      expect(v?.statut).toBe('titulaire')
      // Dix-neuf ans d'ancienneté depuis le stage : au moins le 8e échelon de la classe normale.
      if (v?.avancement.position.grade === 'classe-normale') expect(v.avancement.position.echelon).toBeGreaterThanOrEqual(8)
      const s = score(fin, p)
      expect(s.total).toBeGreaterThanOrEqual(0)
      expect(s.total).toBeLessThanOrEqual(1000)
    }
  })

  it('en mode historique, le point d’indice rejoue la série officielle', () => {
    // Départ en juillet 2010 : le point n'a pas bougé avant juillet 2016.
    const depart = SERIES.mois.indexOf('2010-07')
    expect(depart).toBeGreaterThanOrEqual(0)
    const c = creerCarriere({ ...CONFIG, mode: 'historique', debutHistorique: depart }, p)
    const cinqAns = jouer(c, () => 'b', 5)
    expect(cinqAns.prof?.facteurPoint).toBe(1)
    const huitAns = jouer(cinqAns, () => 'b', 8)
    expect(huitAns.prof?.facteurPoint).toBeCloseTo(5623.23 / 5556.35, 9)
  })

  it('temps partiel et professeur principal changent le brut', () => {
    let c = jouer(creerCarriere({ ...CONFIG, graine: 21 }, p), () => 'b', 3)
    const v = c.prof
    if (!v) throw new Error('volet prof attendu')
    const evenement = (type: 'temps-partiel' | 'professeur-principal') => ({
      type,
      titre: '',
      texte: '',
      choix: [
        { id: 'a' as const, titre: '', detail: '' },
        { id: 'b' as const, titre: '', detail: '' },
      ],
      valeurs: {},
    })
    c = { ...c, evenement: evenement('temps-partiel') }
    const partiel = choisir(c, 'a', p)
    expect(partiel.prof?.quotite).toBeCloseTo(6 / 7, 9)
    expect(partiel.partie.salaire.brutAnnuel).toBeCloseTo(brutProf({ ...v, quotite: 6 / 7 }, p), 6)
    const pp = choisir({ ...c, evenement: evenement('professeur-principal') }, 'a', p)
    expect(pp.partie.salaire.brutAnnuel - brutProf(v, p)).toBeCloseTo(p['enseignants.isoe.partModulableCollege'].valeur, 6)
  })

  it('est déterministe pour une même graine', () => {
    const a = jouer(creerCarriere(CONFIG, p), () => 'a')
    const b = jouer(creerCarriere(CONFIG, p), () => 'a')
    expect(score(a, p)).toEqual(score(b, p))
  })
})
