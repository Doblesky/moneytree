import { describe, expect, it } from 'vitest'
import { parametres2026, ParametresInvalidesError, validerParametres2026 } from './index.ts'

// Tous les fichiers de paramètres annuels du dossier (2026.json, 2027.json…).
const modules = import.meta.glob<Record<string, unknown>>('./[0-9][0-9][0-9][0-9].json', {
  eager: true,
  import: 'default',
})
const contenus = new Map(
  Object.entries(modules).map(([chemin, contenu]) => [chemin.replace('./', ''), contenu]),
)
const fichiers = [...contenus.keys()]

/** Copie modifiable du contenu d'un fichier. */
function lire(nom: string): Record<string, unknown> {
  const contenu = contenus.get(nom)
  if (!contenu) throw new Error(`Fichier de paramètres introuvable : ${nom}`)
  return structuredClone(contenu)
}

function estDateIsoValide(texte: unknown): boolean {
  if (typeof texte !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false
  const date = new Date(`${texte}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(texte)
}

/**
 * Règle n° 1 de CLAUDE.md, vérifiée sur chaque fichier de paramètres, indépendamment du
 * schéma zod : tout paramètre a une source, une date de vérification et un champ verifie.
 */
describe.each(fichiers)('règle des sources : %s', (nom) => {
  const contenu = lire(nom)
  const entrees = Object.entries(contenu)

  it('contient des paramètres', () => {
    expect(entrees.length).toBeGreaterThan(0)
  })

  it.each(entrees)('%s a une source, une date de vérification et un champ verifie', (_cle, p) => {
    expect(p).toBeTypeOf('object')
    const parametre = p as Record<string, unknown>
    expect(parametre, 'champ « source » manquant').toHaveProperty('source')
    expect(parametre.source).toMatch(/^https:\/\/\S+$/)
    expect(parametre, 'champ « verifie_le » manquant').toHaveProperty('verifie_le')
    expect(estDateIsoValide(parametre.verifie_le), 'verifie_le doit être une date AAAA-MM-JJ').toBe(
      true,
    )
    expect(parametre, 'champ « verifie » manquant').toHaveProperty('verifie')
    expect(parametre.verifie).toBeTypeOf('boolean')
    expect(parametre, 'champ « valeur » manquant').toHaveProperty('valeur')
  })
})

describe('chargeur des paramètres 2026', () => {
  it('valide le fichier embarqué', () => {
    expect(() => parametres2026()).not.toThrow()
  })

  it('donne un accès typé aux valeurs', () => {
    const p = parametres2026()
    expect(p['ir.anneeRevenus'].valeur).toBe(2025)
    expect(p['ir.bareme'].valeur.at(-1)?.jusqua).toBeNull()
    expect(p['pfu.tauxGlobal'].valeur).toBeCloseTo(
      p['pfu.tauxImpotRevenu'].valeur + p['prelevementsSociaux.tauxGeneral'].valeur,
      10,
    )
    expect(p['pfu.tauxGlobalAssuranceVie'].valeur).toBeCloseTo(
      p['pfu.tauxImpotRevenu'].valeur + p['prelevementsSociaux.tauxAssuranceVie'].valeur,
      10,
    )
  })

  it('refuse un paramètre sans source', () => {
    const copie = lire('2026.json')
    delete (copie['livretA.taux'] as Record<string, unknown>).source
    expect(() => validerParametres2026(copie)).toThrow(ParametresInvalidesError)
  })

  it('refuse un paramètre sans date de vérification ou sans champ verifie', () => {
    const sansDate = lire('2026.json')
    delete (sansDate['lep.taux'] as Record<string, unknown>).verifie_le
    expect(() => validerParametres2026(sansDate)).toThrow(/lep\.taux › verifie_le/)

    const sansVerifie = lire('2026.json')
    delete (sansVerifie['lep.taux'] as Record<string, unknown>).verifie
    expect(() => validerParametres2026(sansVerifie)).toThrow(/lep\.taux › verifie/)
  })

  it('exige une note pour un paramètre non vérifié', () => {
    const copie = lire('2026.json')
    const parametre = copie['pel.taux2026'] as Record<string, unknown>
    parametre.verifie = false
    delete parametre.note
    expect(() => validerParametres2026(copie)).toThrow(/note/)
  })

  it('refuse une clé inconnue, une clé manquante ou une valeur mal typée', () => {
    const enTrop = { ...lire('2026.json'), 'livretB.taux': {} }
    expect(() => validerParametres2026(enTrop)).toThrow(ParametresInvalidesError)

    const manquante = lire('2026.json')
    delete manquante['ldds.plafond']
    expect(() => validerParametres2026(manquante)).toThrow(/ldds\.plafond/)

    const malType = lire('2026.json')
    ;(malType['livretA.taux'] as Record<string, unknown>).valeur = '1,7 %'
    expect(() => validerParametres2026(malType)).toThrow(/livretA\.taux › valeur/)
  })

  it('refuse un barème non croissant', () => {
    const copie = lire('2026.json')
    const bareme = copie['ir.bareme'] as { valeur: { jusqua: number | null; taux: number }[] }
    const [premiere, deuxieme] = bareme.valeur
    if (!premiere || !deuxieme) throw new Error('barème vide')
    ;[premiere.jusqua, deuxieme.jusqua] = [deuxieme.jusqua, premiere.jusqua]
    expect(() => validerParametres2026(copie)).toThrow(/croissantes/)
  })
})
