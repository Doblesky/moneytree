import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
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

  it('fournit les paliers 1 à 3 des modules 0, 1 et 2 (phase 1)', () => {
    for (const id of [0, 1, 2]) {
      expect(paliersDisponibles(id)).toBe(3)
      expect(contenuModule(id)?.paliers.map((pa) => pa.numero)).toEqual([1, 2, 3])
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
})
