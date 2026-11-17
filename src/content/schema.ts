/**
 * Format des contenus de cours (src/content/modules/module-<n>.json) et du glossaire.
 *
 * Balises dans les textes :
 * - `[[texte affiché|clé]]` : mot souligné qui ouvre la fiche du glossaire `clé` ;
 * - `{p:clé}` : valeur d'un paramètre officiel de l'année (src/data/params) ;
 * - `{h:clé}` : chiffre calculé sur les séries historiques embarquées ;
 * - `**gras**` ; une ligne vide sépare deux paragraphes ; « - » en début de ligne fait une puce.
 *
 * Règle n° 1 de CLAUDE.md : toute carte ou question qui avance un fait cite au moins une
 * source officielle ; seules les cartes à exemple fictif (calcul pur) peuvent s'en passer.
 */
import { z } from 'zod'

export const CALCULATEURS = [
  'brut-net',
  'interets-composes',
  'inflation',
  'rendement-reel',
  'regle-72',
  'bareme',
  'impot',
  'quotient-familial',
  'livret-a',
  'pfu-bareme',
  'per-economie',
  'fiscalite-enveloppes',
  'frais',
] as const
export type NomCalculateur = (typeof CALCULATEURS)[number]

const source = z.strictObject({
  libelle: z.string().min(3),
  url: z.url({ protocol: /^https$/ }),
})
export type Source = z.infer<typeof source>

function sourceExigee(objet: { sources: Source[]; exempleFictif?: boolean | undefined }): boolean {
  return objet.exempleFictif === true || objet.sources.length > 0
}

const carte = z
  .strictObject({
    id: z.string().regex(/^m\d-p\d-c\d+$/),
    titre: z.string().min(3),
    texte: z.string().min(10),
    calculateur: z.enum(CALCULATEURS).optional(),
    exempleFictif: z.boolean().optional(),
    sources: z.array(source),
  })
  .refine(sourceExigee, { message: 'Carte sans source ni exemple fictif', path: ['sources'] })
export type Carte = z.infer<typeof carte>

const baseQuestion = {
  id: z.string().regex(/^m\d-p\d-q\d+$/),
  enonce: z.string().min(10),
  explication: z.string().min(10),
  /** Carte à revoir après une erreur. */
  carte: z.string().optional(),
  exempleFictif: z.boolean().optional(),
  sources: z.array(source),
}

const qcm = z
  .strictObject({
    ...baseQuestion,
    type: z.literal('qcm'),
    choix: z.array(z.string().min(1)).min(2).max(4),
    bonne: z.number().int().min(0),
  })
  .refine((q) => q.bonne < q.choix.length, { message: 'Bonne réponse hors des choix', path: ['bonne'] })
  .refine(sourceExigee, { message: 'Question sans source ni exemple fictif', path: ['sources'] })

const calcul = z
  .strictObject({
    ...baseQuestion,
    type: z.literal('calcul'),
    reponse: z.number(),
    /** Écart accepté, dans l'unité de la réponse. */
    tolerance: z.number().nonnegative(),
    unite: z.enum(['€', '%', 'ans', 'parts']),
  })
  .refine(sourceExigee, { message: 'Question sans source ni exemple fictif', path: ['sources'] })

export const schemaQuestion = z.union([qcm, calcul])
export type Question = z.infer<typeof schemaQuestion>
export type QuestionQcm = z.infer<typeof qcm>
export type QuestionCalcul = z.infer<typeof calcul>

const palier = z.strictObject({
  numero: z.number().int().min(1).max(5),
  objectif: z.string().min(5),
  minutes: z.number().int().min(3).max(15),
  cartes: z.array(carte).min(3).max(10),
  questions: z.array(schemaQuestion).min(4),
})
export type Palier = z.infer<typeof palier>

export const schemaContenuModule = z.strictObject({
  module: z.number().int().min(0).max(9),
  paliers: z.array(palier).min(1),
})
export type ContenuModule = z.infer<typeof schemaContenuModule>

export const schemaGlossaire = z.record(
  z.string().regex(/^[a-z0-9-]+$/),
  z.strictObject({
    terme: z.string().min(2),
    definition: z.string().min(10),
    exemple: z.string().optional(),
    voirAussi: z.array(z.string()).optional(),
    source: source.optional(),
  }),
)
export type Glossaire = z.infer<typeof schemaGlossaire>
export type EntreeGlossaire = Glossaire[string]
