import { describe, expect, it } from 'vitest'
import { contenuModule, NOMS_PALIERS } from '../content/catalogue.ts'
import { parametres2026 } from '../data/params/index.ts'
import { faitsHistoriques } from '../engine/marches.ts'
import { IDS_METIER, METIERS, type IdMetier } from '../profils/metiers.ts'
import type { EtatProgression, ProgressionDeModule } from '../progression/regles.ts'
import { cartesMaitrisees, construirePaquet, signaturePaquet, texteBrut } from './paquet.ts'

function etat(metier: IdMetier, modules: ProgressionDeModule[], modeExpert = false): EtatProgression {
  return { metier, modeExpert, leviersForces: [], modules }
}

function toutMaitrise(metier: IdMetier): EtatProgression {
  return etat(
    metier,
    METIERS[metier].modules.map((moduleId) => ({ moduleId, paliersMaitrises: 5 })),
  )
}

describe('cartesMaitrisees', () => {
  it('aucune carte sans palier maîtrisé', () => {
    expect(cartesMaitrisees(etat('ingenieur', []))).toEqual([])
  })

  it('cartes des paliers maîtrisés, dans l’ordre', () => {
    const cartes = cartesMaitrisees(etat('ingenieur', [{ moduleId: 0, paliersMaitrises: 2 }]))
    const contenu = contenuModule(0, 'ingenieur')
    const attendus = [1, 2].flatMap((n) => contenu?.paliers.find((p) => p.numero === n)?.cartes ?? [])
    expect(cartes.map((c) => c.id)).toEqual(attendus.map((c) => c.id))
    for (const c of cartes) {
      const palier = contenu?.paliers.find((p) => p.numero === c.palier)
      expect(c.module).toBe(0)
      expect(c.rang).toBe(palier?.cartes.findIndex((x) => x.id === c.id))
      expect(c.palierNom).toBe(NOMS_PALIERS[c.palier - 1])
      expect(c.moduleTitre).toBe('Bases')
    }
    expect(cartes.filter((c) => c.palier === 1).map((c) => c.rang)).toEqual(
      cartes.filter((c) => c.palier === 1).map((_, i) => i),
    )
  })

  it('les déblocages ne comptent pas', () => {
    const cartes = cartesMaitrisees(
      etat(
        'ingenieur',
        [
          {
            moduleId: 1,
            paliersMaitrises: 0,
            debloqueQuandMeme: true,
            palierDebloque: 3,
            enCours: { palier: 1, carte: 2 },
          },
        ],
        true,
      ),
    )
    expect(cartes.filter((c) => c.module === 1)).toEqual([])
  })

  it('variantes et modules du profil prof', () => {
    const modules = [
      { moduleId: 0, paliersMaitrises: 1 },
      { moduleId: 10, paliersMaitrises: 1 },
    ]
    const prof = cartesMaitrisees(etat('prof-second-degre', modules))
    expect(prof.some((c) => c.id.endsWith('-prof'))).toBe(true)
    expect(prof.some((c) => c.module === 10)).toBe(true)
    const ingenieur = cartesMaitrisees(etat('ingenieur', modules))
    expect(ingenieur.some((c) => c.module === 10)).toBe(false)
  })

  it('titre de module selon le profil', () => {
    const cartes = cartesMaitrisees(etat('prof-second-degre', [{ moduleId: 8, paliersMaitrises: 1 }]))
    expect(cartes.length).toBeGreaterThan(0)
    expect(cartes.every((c) => c.moduleTitre === 'Carrière et vie de prof')).toBe(true)
  })

  it.each(IDS_METIER)('aucune balise ne subsiste (%s)', (metier) => {
    const cartes = cartesMaitrisees(toutMaitrise(metier))
    expect(cartes.length).toBeGreaterThan(0)
    for (const c of cartes) {
      for (const texte of [c.titre, c.texte]) {
        for (const balise of ['{p:', '{h:', '[[', ']]', '**']) expect(texte).not.toContain(balise)
        expect(texte.split('\n').some((ligne) => ligne.startsWith('- '))).toBe(false)
      }
    }
    expect(cartes.some((c) => c.texte.split('\n').some((ligne) => ligne.startsWith('• ')))).toBe(true)
  })

  it.each(IDS_METIER)('fictif suit exempleFictif (%s)', (metier) => {
    const sources = new Map(
      METIERS[metier].modules.flatMap(
        (id) => contenuModule(id, metier)?.paliers.flatMap((p) => p.cartes.map((c) => [c.id, c] as const)) ?? [],
      ),
    )
    for (const c of cartesMaitrisees(toutMaitrise(metier))) {
      expect(c.fictif).toBe(sources.get(c.id)?.exempleFictif === true)
    }
  })
})

describe('texteBrut', () => {
  it('retire le glossaire et le gras, et change les tirets en puces', () => {
    expect(texteBrut('Le [[taux|livret-a]] est **net**.\n\n- un\n- deux', parametres2026(), faitsHistoriques())).toBe(
      'Le taux est net.\n\n• un\n• deux',
    )
  })

  it('retire un lien de glossaire placé dans du gras', () => {
    expect(texteBrut('Elle compte **onze [[échelons|echelon]]**.', parametres2026(), faitsHistoriques())).toBe(
      'Elle compte onze échelons.',
    )
  })
})

describe('signaturePaquet', () => {
  const base = etat('ingenieur', [{ moduleId: 0, paliersMaitrises: 2 }])

  it('est stable et change avec le paquet', () => {
    const paquet = construirePaquet(base, 10)
    const signature = signaturePaquet(paquet)
    expect(signature).toMatch(/^[0-9a-f]{8}$/)
    expect(signaturePaquet(construirePaquet(base, 10))).toBe(signature)
    expect(signaturePaquet(construirePaquet(base, 15))).not.toBe(signature)
    expect(signaturePaquet({ ...paquet, cartes: paquet.cartes.slice(1) })).not.toBe(signature)
  })

  it('construirePaquet porte la version, le profil et l’intervalle', () => {
    const paquet = construirePaquet(base, 30)
    expect(paquet.v).toBe(1)
    expect(paquet.profil).toBe('ingenieur')
    expect(paquet.intervalle).toBe(30)
    expect(paquet.cartes).toEqual(cartesMaitrisees(base))
  })
})
