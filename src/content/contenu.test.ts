import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import { economiePer, impositionGainParEnveloppe, valeurApresFrais } from '../engine/calculs.ts'
import { ouvrirDroitsAre } from '../engine/chomage.ts'
import { emolumentsNotaire, mensualiteCredit, revenuFoncierImposable } from '../engine/immobilier.ts'
import { ASSURANCE_VIE_FERMEE, racheterAssuranceVie } from '../engine/enveloppes.ts'
import { calculerIR, nombreDeParts, parametresIR } from '../engine/impots.ts'
import { faitsHistoriques } from '../engine/marches.ts'
import {
  contenuModule,
  GLOSSAIRE,
  LEVIERS,
  MODULES,
  paliersDisponibles,
  questionParId,
  toutesLesQuestions,
} from './catalogue.ts'
import type { Carte, Question } from './schema.ts'
import { analyserTexte, clesCitees, clesGlossaire, remplacerValeurs } from './texte.ts'

const p = parametres2026()
const faits = faitsHistoriques()

const contenus = MODULES.map((m) => contenuModule(m.id)).filter((c) => c !== undefined)
const cartes: Carte[] = contenus.flatMap((c) => c.paliers.flatMap((pa) => pa.cartes))
const questions: Question[] = toutesLesQuestions()

function textesDe(objet: Carte | Question): string[] {
  if ('titre' in objet) return [objet.titre, objet.texte]
  const textes = [objet.enonce, objet.explication]
  if (objet.type === 'qcm') textes.push(...objet.choix)
  return textes
}

describe('catalogue des modules', () => {
  it('liste les dix modules dans l’ordre', () => {
    expect(MODULES.map((m) => m.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('fournit les paliers 1 à 3 de chaque module, et le palier Expert des modules 0 à 4 (phase 5)', () => {
    const attendus: Record<number, number> = { 0: 4, 1: 4, 2: 4, 3: 4, 4: 4, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3 }
    for (const id of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const n = attendus[id] ?? 0
      expect(paliersDisponibles(id)).toBe(n)
      // Numérotés 1, 2, 3… sans trou : un palier ne s'ouvre qu'après le précédent.
      expect(contenuModule(id)?.paliers.map((pa) => pa.numero)).toEqual(Array.from({ length: n }, (_, i) => i + 1))
    }
  })

  it('rattache chaque levier à un module existant', () => {
    for (const levier of Object.values(LEVIERS)) {
      expect(MODULES.some((m) => m.id === levier.module)).toBe(true)
    }
  })
})

describe('cartes et questions', () => {
  it('ont des identifiants uniques, cohérents avec leur module et leur palier', () => {
    const ids = [...cartes.map((c) => c.id), ...questions.map((q) => q.id)]
    expect(new Set(ids).size).toBe(ids.length)
    for (const contenu of contenus) {
      for (const pa of contenu.paliers) {
        for (const objet of [...pa.cartes, ...pa.questions]) {
          expect(objet.id.startsWith(`m${contenu.module}-p${pa.numero}-`)).toBe(true)
        }
      }
    }
  })

  it('renvoient vers des cartes du même palier', () => {
    for (const q of questions) {
      if (q.carte) {
        expect(cartes.some((c) => c.id === q.carte), `${q.id} → ${q.carte}`).toBe(true)
        expect(q.carte.slice(0, 5)).toBe(q.id.slice(0, 5))
      }
    }
  })

  it('ne citent que des paramètres et des chiffres historiques existants', () => {
    for (const objet of [...cartes, ...questions]) {
      for (const texte of textesDe(objet)) {
        expect(() => remplacerValeurs(texte, p, faits), objet.id).not.toThrow()
        expect(remplacerValeurs(texte, p, faits)).not.toMatch(/\{[ph]:/)
      }
    }
  })

  it('n’ouvrent que des fiches de glossaire existantes', () => {
    for (const objet of [...cartes, ...questions]) {
      for (const texte of textesDe(objet)) {
        for (const cle of clesGlossaire(texte)) expect(GLOSSAIRE[cle], `${objet.id} → ${cle}`).toBeDefined()
      }
    }
    for (const [cle, entree] of Object.entries(GLOSSAIRE)) {
      for (const lien of entree.voirAussi ?? []) expect(GLOSSAIRE[lien], `${cle} → ${lien}`).toBeDefined()
    }
  })

  it('citent une source dès qu’un texte utilise un paramètre officiel ou un chiffre historique', () => {
    for (const objet of [...cartes, ...questions]) {
      const cites = textesDe(objet).map(clesCitees)
      const citeUneValeur = cites.some((c) => c.parametres.length + c.faits.length > 0)
      if (citeUneValeur) expect(objet.sources.length, objet.id).toBeGreaterThan(0)
    }
  })

  it('proposent des choix distincts une fois les valeurs remplacées', () => {
    for (const q of questions) {
      if (q.type === 'qcm') {
        const choix = q.choix.map((c) => remplacerValeurs(c, p, faits))
        expect(new Set(choix).size, q.id).toBe(choix.length)
      }
    }
  })

  it('appliquent la typographie française et calculent les valeurs dérivées', () => {
    expect(remplacerValeurs('1 000 € à 3 % : 30 €', p, faits)).toBe('1\u202F000\u00A0€ à 3\u00A0%\u00A0: 30\u00A0€')
    // 1 000 € × taux du Livret A, à partir du paramètre officiel.
    expect(remplacerValeurs('{p:livretA.taux*1000}', p, faits)).toBe(
      `${Math.round(p['livretA.taux'].valeur * 1000)}\u00A0€`,
    )
    // Une année n'est pas un nombre à grouper.
    expect(remplacerValeurs('en 2008 et 2022', p, faits)).toBe('en 2008 et 2022')
  })

  it('se découpent en paragraphes et en puces', () => {
    const blocs = analyserTexte('Un **mot** et un [[lien|inflation]].\n\n- a\n- b', p, faits)
    expect(blocs).toHaveLength(2)
    expect(blocs[0]).toEqual({
      type: 'paragraphe',
      segments: [
        { type: 'texte', texte: 'Un ' },
        { type: 'gras', texte: 'mot' },
        { type: 'texte', texte: ' et un ' },
        { type: 'glossaire', texte: 'lien', cle: 'inflation' },
        { type: 'texte', texte: '.' },
      ],
    })
    expect(blocs[1]?.type).toBe('liste')
  })
})

describe('les réponses chiffrées sur des règles réelles sont celles du moteur', () => {
  const pIR = parametresIR(p)
  const seul = { situation: 'celibataire' as const, enfantsACharge: 0 }
  const reponse = (id: string) => {
    const q = questionParId(id)
    if (q?.type !== 'calcul') throw new Error(`Question chiffrée introuvable : ${id}`)
    return q.reponse
  }

  it('m1-p1-q1 : impôt brut pour 27 000 € de revenu imposable', () => {
    // 30 000 € de salaires donnent 27 000 € de revenu net imposable.
    expect(calculerIR({ foyer: seul, salaires: [30000] }, pIR).droitsSimples).toBe(reponse('m1-p1-q1'))
  })

  it('m1-p1-q2 : revenu net imposable pour 35 000 € de salaires', () => {
    expect(calculerIR({ foyer: seul, salaires: [35000] }, pIR).revenuNetImposable).toBe(reponse('m1-p1-q2'))
  })

  it('m1-p2-q1 : parts d’un couple avec deux enfants', () => {
    expect(nombreDeParts({ situation: 'couple', enfantsACharge: 2 })).toBe(reponse('m1-p2-q1'))
  })

  it('m1-p2-q2 : décote pour 704 € d’impôt brut', () => {
    expect(calculerIR({ foyer: seul, salaires: [20000] }, pIR).decote).toBe(reponse('m1-p2-q2'))
  })

  it('m1-p2-q5 et carte m1-p2-c2 : exemples de Service-Public sur le quotient familial', () => {
    const couple1Enfant = { situation: 'couple' as const, enfantsACharge: 1 }
    // Revenu net imposable de 63 000 € et de 80 000 € : salaires avant la déduction de 10 %.
    expect(calculerIR({ foyer: couple1Enfant, salaires: [70000] }, pIR).droitsSimples).toBe(
      reponse('m1-p2-q5'),
    )
    const plafonne = calculerIR({ foyer: couple1Enfant, salaires: [80000 / 0.9] }, pIR)
    expect(plafonne.revenuNetImposable).toBe(80000)
    expect(plafonne.droitsSimples).toBe(8401)
  })

  it('m1-p3-q1 : PFU sur 1 000 € de plus-value', () => {
    expect(Math.round(1000 * p['pfu.tauxGlobal'].valeur)).toBe(reponse('m1-p3-q1'))
  })

  it('m4-p1-q5 : 3 000 € de gains d’assurance-vie de plus de 8 ans, sous l’abattement', () => {
    expect(impositionGainParEnveloppe(3000, p).assuranceVie.impotRevenu).toBe(reponse('m4-p1-q5'))
  })

  it('m4-p2-q1 : 2 000 € versés sur un PER dans la tranche à 30 %', () => {
    // 60 000 € de salaires : 54 000 € de revenu imposable, bien dans la tranche à 30 %.
    const r = economiePer({ foyer: seul, salaires: [60000], versement: 2000 }, p)
    expect(r.tauxMarginal).toBe(0.3)
    expect(r.deduit).toBe(2000)
    expect(r.economie).toBe(reponse('m4-p2-q1'))
  })

  it('m4-p2-q3 : abondement de 300 % sur 1 000 €, sous les plafonds', () => {
    const abondement = Math.min(
      1000 * p['epargneSalariale.abondementRatioMax'].valeur,
      p['epargneSalariale.abondementPeeMax'].valeur,
    )
    expect(abondement).toBe(reponse('m4-p2-q3'))
  })

  it('m4-p3-q1 : part de gain d’un rachat partiel (formule du BOFiP)', () => {
    const regles = {
      dureeFiscaleMois: 96,
      tauxImpotAvant: p['pfu.tauxImpotRevenu'].valeur,
      tauxImpotApres: p['assuranceVie.tauxImpotApres8Ans'].valeur,
      plafondPrimesTauxReduit: p['assuranceVie.plafondPrimesTauxReduit'].valeur,
      abattementRestant: 0,
      tauxPrelevementsSociaux: p['prelevementsSociaux.tauxAssuranceVie'].valeur,
    }
    // 20 000 € de primes sur le fonds en euros, contrat valant 25 000 €.
    const av = {
      ...ASSURANCE_VIE_FERMEE,
      ouvertAuMois: 0,
      fondsEuros: { solde: 25000, interetsCourus: 0 },
      primes: 20000,
    }
    expect(racheterAssuranceVie(av, 5000, 1, 12, regles).gain).toBeCloseTo(reponse('m4-p3-q1'), 6)
  })

  it('m4-p3-q2 et m4-p3-q3 : 10 000 € de gains au PFU puis dans un PEA de plus de 5 ans', () => {
    const r = impositionGainParEnveloppe(10000, p)
    expect(Math.round(r.cto.total)).toBe(reponse('m4-p3-q2'))
    expect(Math.round(r.pea.total)).toBe(reponse('m4-p3-q3'))
  })
})

describe('les réponses chiffrées du module 8 sont celles du moteur et des paramètres', () => {
  const reponse = (id: string) => {
    const q = questionParId(id)
    if (q?.type !== 'calcul') throw new Error(`Question chiffrée introuvable : ${id}`)
    return q.reponse
  }

  it('m8-p1-q2 : allocation brute pour un SJR de 100 €', () => {
    // Un brut annuel de 36 500 € donne un SJR de 100 €.
    expect(ouvrirDroitsAre(36500, 24, false, p)?.journalierBrut).toBeCloseTo(reponse('m8-p1-q2'), 9)
  })

  it('m8-p1-q4 : durée maximale après deux ans de travail', () => {
    expect(ouvrirDroitsAre(42000, 24, false, p)?.joursTotal).toBe(reponse('m8-p1-q4'))
  })

  it('m8-p2-q4 : impôt brut d’un couple pacsé avec 40 000 € de revenu net imposable', () => {
    const pIR = parametresIR(p)
    const couple = calculerIR({ foyer: { situation: 'couple', enfantsACharge: 0 }, salaires: [40000 / 0.9] }, pIR)
    expect(couple.revenuNetImposable).toBe(40000)
    expect(couple.droitsSimples).toBe(reponse('m8-p2-q4'))
    const seul = calculerIR({ foyer: { situation: 'celibataire', enfantsACharge: 0 }, salaires: [40000 / 0.9] }, pIR)
    expect(seul.droitsSimples).toBe(5104)
  })

  it('m8-p3-q2 : trimestres validés par 6 000 € de salaire brut en 2026', () => {
    const trimestres = Math.min(
      p['retraite.trimestresMaxParAn'].valeur,
      Math.floor(6000 / p['retraite.revenuParTrimestre'].valeur),
    )
    expect(trimestres).toBe(reponse('m8-p3-q2'))
  })
})

describe('les réponses chiffrées du module 6 sont celles du moteur', () => {
  const reponse = (id: string) => {
    const q = questionParId(id)
    if (q?.type !== 'calcul') throw new Error('Question chiffrée introuvable : ' + id)
    return q
  }

  it('m6-p1-q5 : émoluments du notaire pour 100 000 €', () => {
    expect(emolumentsNotaire(100000, p['notaire.emolumentsVente'].valeur)).toBeCloseTo(reponse('m6-p1-q5').reponse, 2)
  })

  it('m6-p2-q3 : total remboursé sur 200 000 € à 3,32 % pendant 25 ans', () => {
    const q = reponse('m6-p2-q3')
    expect(Math.abs(300 * mensualiteCredit(200000, 0.0332, 300) - q.reponse)).toBeLessThanOrEqual(q.tolerance)
  })

  it('m6-p3-q1 : micro-foncier sur 10 000 € de loyers', () => {
    expect(revenuFoncierImposable(10000, 0, p).imposable).toBe(reponse('m6-p3-q1').reponse)
  })
})

describe('les réponses chiffrées du module 7 sont celles des paramètres', () => {
  const reponse = (id: string) => {
    const q = questionParId(id)
    if (q?.type !== 'calcul') throw new Error('Question chiffrée introuvable : ' + id)
    return q.reponse
  }

  it('m7-p1-q1 : taxe forfaitaire et CRDS sur 10 000 € d’or', () => {
    expect(Math.round(10000 * (p['or.taxeForfaitaire'].valeur + p['or.crds'].valeur))).toBe(reponse('m7-p1-q1'))
  })

  it('m7-p2-q3 : 250 € de ventes de crypto-actifs, sous le seuil d’exonération', () => {
    expect(250 <= p['cryptos.seuilExonerationCessions'].valeur ? 0 : 80).toBe(reponse('m7-p2-q3'))
  })
})

describe('les exemples chiffrés des cours de stratégie', () => {
  it('m5-p1-c4 : l’exemple de frais de l’AMF (1 000 € → 1 090 €, 1,7 % par an, 1 276 € sans frais)', () => {
    const r = valeurApresFrais({
      montant: 1000,
      rendement: 0.05,
      fraisEntree: 0.02,
      fraisAnnuels: 0.015 + 0.003,
      fraisFixes: 10,
      annees: 5,
    })
    expect(Math.round(r.sansFrais)).toBe(1276)
    expect(Math.abs(r.avecFrais - 1090)).toBeLessThan(5)
    expect(r.rendementNet).toBeCloseTo(0.017, 3)
  })

  it('m5-p2-c3 : 10 000 € sur 30 ans à 5 %, avec 0,2 % ou 2 % de frais par an', () => {
    const avec = (frais: number) =>
      valeurApresFrais({ montant: 10000, rendement: 0.05, fraisEntree: 0, fraisAnnuels: frais, fraisFixes: 0, annees: 30 })
        .avecFrais
    expect(Math.round(avec(0.002) / 100) * 100).toBe(40700)
    expect(Math.round(avec(0.02) / 100) * 100).toBe(23600)
    expect(1 - avec(0.02) / avec(0.002)).toBeGreaterThan(0.4)
  })

  it('m5-p1 : les cas réels citent des écarts qui vont dans le sens annoncé', () => {
    // Étaler en 2007 a mieux résisté ; tenir a retrouvé le capital, vendre au creux l'a figé.
    expect(faits.cas2007.en24Mois).toBeGreaterThan(faits.cas2007.enUneFois)
    expect(faits.tenirOuVendre.tenir).toBeGreaterThan(10000)
    expect(faits.tenirOuVendre.vendreAuCreux).toBeLessThan(faits.tenirOuVendre.tenir)
    // « Une partie des périodes de dix ans a fini en perte réelle » (m5-p3-c4, m5-p3-q3).
    expect(faits.dixAnsPartNegatives).toBeGreaterThan(0)
  })

  it('m5-p2-q1 : part des actions après une hausse de 40 % (50/50 au départ)', () => {
    const q = questionParId('m5-p2-q1')
    expect(q?.type === 'calcul' ? q.reponse : null).toBe(Math.round((5000 * 1.4) / (5000 * 1.4 + 5000) * 100))
  })

  it('écrit les baisses en valeur absolue après « a perdu »', () => {
    expect(remplacerValeurs('{h:krach2008Baisse} et {h:covidBaisse}', p, faits)).not.toMatch(/−/)
  })
})
