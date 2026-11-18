/**
 * Les chiffres écrits en toutes lettres dans les cours du profil prof sont ceux du moteur
 * (src/engine/fonctionPublique.ts) et des paramètres officiels : si un texte réglementaire
 * change, ces tests signalent les cartes à réécrire.
 */
import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import { bulletinMensuel, grilleDe, positionStagiaire, traitementMensuel } from '../engine/fonctionPublique.ts'
import { formatMontant } from '../lib/format.ts'
import { contenuModule, questionParId } from './catalogue.ts'
import type { Carte } from './schema.ts'

const p = parametres2026()
const PROF = 'prof-second-degre' as const
/** Espaces fines et insécables de la typographie française. */
const ESPACES_SPECIALES = new RegExp('[\\u202F\\u00A0]', 'g')

/** Texte d'une carte, espaces insécables ramenées à des espaces simples. */
function texte(id: string): string {
  const module = Number(/^m(\d+)/.exec(id)?.[1])
  const carte = contenuModule(module, PROF)
    ?.paliers.flatMap((pa) => pa.cartes)
    .find((c: Carte) => c.id === id)
  if (!carte) throw new Error(`Carte introuvable : ${id}`)
  return carte.texte.replace(ESPACES_SPECIALES, ' ')
}

const euros = (x: number, decimales = 2) => formatMontant(x, { decimales }).replace(ESPACES_SPECIALES, ' ')

function reponse(id: string): number {
  const q = questionParId(id, PROF)
  if (q?.type !== 'calcul') throw new Error(`Question chiffrée introuvable : ${id}`)
  return q.reponse
}

const eleve = bulletinMensuel({ statut: 'eleve', position: { grade: 'classe-normale', echelon: 1 } }, p)
const cn1 = bulletinMensuel({ statut: 'titulaire', position: { grade: 'classe-normale', echelon: 1 } }, p)

describe('module 10 : devenir prof', () => {
  it('le traitement et le net de l’élève fonctionnaire', () => {
    expect(texte('m10-p1-c3')).toContain(euros(eleve.traitementIndiciaire))
    expect(texte('m10-p1-c3')).toContain(`environ **${euros(Math.round(eleve.netAvantImpot), 0)} net**`)
    expect(reponse('m10-p1-q3')).toBe(Math.round(eleve.traitementIndiciaire))
  })
})

describe('module 11 : la fiche de paie', () => {
  it('le traitement du 1er et du 2e échelon', () => {
    expect(texte('m11-p1-c1')).toContain(euros(traitementMensuel(395, p)))
    expect(reponse('m11-p1-q1')).toBe(Math.round(traitementMensuel(446, p)))
  })

  it('la grille de la classe normale et ses 26 ans', () => {
    const grille = grilleDe('classe-normale', p)
    const t = texte('m11-p1-c2')
    expect(t).toContain(`indice majoré ${String(grille[0]?.indiceMajore)}`)
    expect(t).toContain(`l’indice ${String(grille.at(-1)?.indiceMajore)}`)
    const mois = grille.reduce((s, e) => s + (e.dureeMois ?? 0), 0)
    expect(t).toContain(`**${String(mois / 12)} ans**`)
  })

  it('les montants de la prime d’attractivité cités', () => {
    const montants = p['enseignants.primeAttractivite'].valeur.map((x) => x.montant)
    const t = texte('m11-p1-c3')
    expect(t).toContain(euros(montants[0] ?? 0, 0))
    expect(t).toContain(euros(Math.max(...montants), 0))
    expect(t).toContain(euros(Math.min(...montants), 0))
  })

  it('le bulletin du 1er échelon, ligne à ligne', () => {
    const t = texte('m11-p1-c5')
    for (const montant of [cn1.traitementIndiciaire, cn1.primeAttractivite, cn1.isoe, cn1.transfertPrimesPoints, cn1.brut]) {
      expect(t).toContain(euros(montant))
    }
    expect(t).toContain(`environ **${euros(Math.round(cn1.netAvantImpot), 0)} net**`)
  })
})

describe('variantes du tronc commun', () => {
  it('le LEP : une année d’élève fonctionnaire en net imposable, puis après 10 %', () => {
    const annuel = eleve.netImposable * 12
    const t = texte('m2-p1-c4-prof')
    expect(t).toContain(`environ ${euros(Math.round(annuel / 100) * 100, 0)} de net imposable`)
    expect(t).toContain(`environ ${euros(Math.round((annuel * 0.9) / 1000) * 1000, 0)} après`)
    // Et c'est bien sous le plafond du LEP cité par la carte.
    expect(annuel * 0.9).toBeLessThan(p['lep.plafondRevenuFiscalReference1Part'].valeur)
  })

  it('le point d’indice de 2002 à 2023', () => {
    const serie = p['fp.historiquePoint'].valeur
    const premier = serie[0]?.valeur ?? 0
    const dernier = serie.at(-1)?.valeur ?? 0
    const t = texte('m8-p1-c5-prof')
    expect(t).toContain(euros(premier))
    expect(t).toContain(euros(dernier))
    expect(t).toContain(`+${String(Math.round((dernier / premier - 1) * 100))} %`)
    expect(reponse('m8-p1-q5-prof')).toBe(Math.round((dernier / premier - 1) * 100))
  })

  it('les bornes des grilles hors classe et classe exceptionnelle', () => {
    expect(texte('m8-p1-c3-prof')).toContain(String(grilleDe('hors-classe', p).at(-1)?.indiceMajore))
    expect(texte('m8-p1-c3-prof')).toContain(String(grilleDe('classe-normale', p).at(-1)?.indiceMajore))
    const ce = grilleDe('classe-exceptionnelle', p)
    expect(texte('m8-p1-c4-prof')).toContain(`de l’indice majoré ${String(ce[0]?.indiceMajore)} à ${String(ce.at(-1)?.indiceMajore)}`)
  })
})

describe('modules 12 à 15', () => {
  it('rapprochement de conjoints avec deux enfants', () => {
    expect(reponse('m12-p1-q3')).toBeCloseTo(p['mutation.rapprochementConjoints'].valeur + 2 * p['mutation.parEnfant'].valeur, 9)
  })

  it('temps partiel à 80 % : 6/7 de la paie', () => {
    expect(reponse('m14-p1-q1')).toBeCloseTo(2100 * p['fp.tempsPartiel.remuneration80'].valeur, 6)
  })

  it('l’AIP : 30 000 € dépassent le plafond d’une part', () => {
    expect(30000).toBeGreaterThan(p['aip.plafondRfr1Part'].valeur)
  })

  it('le stagiaire du moteur est au 1er échelon, comme le dit l’hypothèse affichée', () => {
    expect(positionStagiaire(p)).toEqual({ grade: 'classe-normale', echelon: 1 })
    expect(p['m2e.stagiaireEchelon'].verifie).toBe(false)
  })
})
