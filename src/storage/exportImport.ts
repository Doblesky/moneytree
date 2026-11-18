/**
 * Export et import de toutes les données en JSON, pour ne rien perdre si le navigateur
 * vide son stockage. L'import remplace la totalité des données locales, en une seule
 * transaction : en cas d'erreur, rien n'est modifié.
 *
 * Format 2 (schéma 2, phase 1) : + reponses et journees. Un fichier au format 1 (phase 0)
 * reste importable : les tables absentes sont considérées comme vides.
 */
import { z } from 'zod'
import {
  db,
  ID_PROFIL,
  TABLES,
  VERSION_SCHEMA,
  type BaseMoneyTree,
  type Journee,
  type Profil,
  type ProgressionModule,
  type Sauvegarde,
} from './db.ts'
import type { EntreeLeitner } from '../progression/leitner.ts'
import type { Badge } from '../progression/gamification.ts'
import type { Levier } from '../content/catalogue.ts'
import { ETAPES_PROF, IDS_METIER } from '../profils/metiers.ts'

export const APPLICATION = 'MoneyTree'
/** Version du format du fichier d'export (distincte de la version du schéma Dexie). */
export const FORMAT_EXPORT = 2

const dateIso = z.iso.datetime()
const jour = z.iso.date()

const BADGES = [
  'premier-palier',
  'bases',
  'sans-faute',
  'trois-modules',
  'serie-7',
  'premiere-annee',
  'dix-ans',
  'premier-examen',
  'module-valide',
  'cent-pour-cent',
  'examen-blanc',
] as const satisfies readonly Badge[]

const LEVIERS = [
  'detailImpot',
  'optionBareme',
  'ldds',
  'lep',
  'monteCarlo',
  'scenarios',
  'pea',
  'assuranceVie',
  'per',
  'epargneSalariale',
  'immobilier',
  'credit',
  'actionsIndividuelles',
] as const satisfies readonly Levier[]

const schemaProfil = z.strictObject({
  id: z.literal(ID_PROFIL),
  creeLe: dateIso,
  majLe: dateIso,
  modeExpert: z.boolean(),
  metier: z.enum(IDS_METIER).optional(),
  etapeProf: z.enum(ETAPES_PROF).optional(),
  salaireViseBrutAnnuel: z.number().nonnegative().optional(),
  ville: z.string().optional(),
  objectif: z.string().optional(),
  lancementTermine: z.boolean().optional(),
  xp: z.number().int().nonnegative().optional(),
  badges: z.array(z.enum(BADGES)).optional(),
  leviersForces: z.array(z.enum(LEVIERS)).optional(),
  quizDuJourFaitLe: jour.optional(),
  partieActive: z.number().int().positive().optional(),
  carriereActive: z.number().int().positive().optional(),
  casTermines: z.array(z.string().min(1)).optional(),
  examensBlancs: z
    .array(
      z.strictObject({
        le: dateIso,
        A: z.strictObject({ justes: z.number().int().nonnegative(), total: z.number().int().nonnegative() }),
        C: z.strictObject({ justes: z.number().int().nonnegative(), total: z.number().int().nonnegative() }),
        reussi: z.boolean(),
      }),
    )
    .optional(),
})

const schemaProgression = z.strictObject({
  moduleId: z.number().int().min(0).max(99),
  paliersMaitrises: z.number().int().min(0).max(5),
  majLe: dateIso,
  debloqueQuandMeme: z.boolean().optional(),
  palierDebloque: z.number().int().min(1).max(5).optional(),
  enCours: z
    .strictObject({ palier: z.number().int().min(1).max(5), carte: z.number().int().nonnegative() })
    .optional(),
  meilleursScores: z.record(z.string(), z.number().min(0).max(1)).optional(),
  maitrisesLe: z.record(z.string(), jour).optional(),
  examens: z
    .record(
      z.string(),
      z.strictObject({
        tentatives: z.number().int().nonnegative(),
        meilleurScore: z.number().min(0).max(1),
        valideLe: jour.optional(),
      }),
    )
    .optional(),
})

const schemaSauvegarde = z.strictObject({
  id: z.number().int().positive(),
  nom: z.string(),
  creeLe: dateIso,
  majLe: dateIso,
  etat: z.unknown(),
})

const schemaReponse = z.strictObject({
  questionId: z.string().min(1),
  boite: z.number().int().min(1).max(5),
  prochaineRevision: jour,
  vues: z.number().int().nonnegative(),
  justes: z.number().int().nonnegative(),
  majLe: dateIso,
})

const schemaJournee = z.strictObject({
  date: jour,
  xp: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
  paliers: z.number().int().nonnegative(),
})

function sansDoublon<T>(lignes: T[], cle: (ligne: T) => unknown): boolean {
  return new Set(lignes.map(cle)).size === lignes.length
}

const schemaExport = z.strictObject({
  application: z.literal(APPLICATION),
  formatExport: z.union([z.literal(1), z.literal(FORMAT_EXPORT)]),
  versionSchema: z.number().int().min(1).max(VERSION_SCHEMA),
  exporteLe: dateIso,
  tables: z.strictObject({
    profil: z.array(schemaProfil).max(1),
    progression: z
      .array(schemaProgression)
      .refine((lignes) => sansDoublon(lignes, (l) => l.moduleId), 'module en double'),
    sauvegardes: z
      .array(schemaSauvegarde)
      .refine((lignes) => sansDoublon(lignes, (l) => l.id), 'sauvegarde en double'),
    // Absentes des exports au format 1.
    reponses: z
      .array(schemaReponse)
      .refine((lignes) => sansDoublon(lignes, (l) => l.questionId), 'question en double')
      .default([]),
    journees: z
      .array(schemaJournee)
      .refine((lignes) => sansDoublon(lignes, (l) => l.date), 'journée en double')
      .default([]),
  }),
})

export interface ExportMoneyTree {
  application: typeof APPLICATION
  formatExport: number
  versionSchema: number
  exporteLe: string
  tables: {
    profil: Profil[]
    progression: ProgressionModule[]
    sauvegardes: Sauvegarde[]
    reponses: EntreeLeitner[]
    journees: Journee[]
  }
}

export interface ResumeExport {
  exporteLe: string
  profil: boolean
  modules: number
  sauvegardes: number
  reponses: number
}

export type ResultatAnalyse =
  | { ok: true; donnees: ExportMoneyTree; resume: ResumeExport }
  | { ok: false; erreur: string }

export async function exporterDonnees(
  base: BaseMoneyTree = db,
  maintenant: Date = new Date(),
): Promise<ExportMoneyTree> {
  return base.transaction('r', [...TABLES], async () => ({
    application: APPLICATION,
    formatExport: FORMAT_EXPORT,
    versionSchema: VERSION_SCHEMA,
    exporteLe: maintenant.toISOString(),
    tables: {
      profil: await base.profil.toArray(),
      progression: await base.progression.toArray(),
      sauvegardes: await base.sauvegardes.toArray(),
      reponses: await base.reponses.toArray(),
      journees: await base.journees.toArray(),
    },
  }))
}

export function serialiserExport(donnees: ExportMoneyTree): string {
  return `${JSON.stringify(donnees, null, 2)}\n`
}

/** « moneytree-2026-11-16.json », à la date locale. */
export function nomFichierExport(maintenant: Date = new Date()): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  const jourLocal = `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`
  return `moneytree-${jourLocal}.json`
}

/** Vérifie un fichier d'export avant tout import. Ne touche pas à la base. */
export function analyserFichierExport(texte: string): ResultatAnalyse {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return { ok: false, erreur: 'Ce fichier n’est pas un fichier JSON valide.' }
  }

  if (typeof brut !== 'object' || brut === null || !('application' in brut)) {
    return { ok: false, erreur: 'Ce fichier ne vient pas de MoneyTree.' }
  }
  const entete = brut as { application?: unknown; versionSchema?: unknown }
  if (entete.application !== APPLICATION) {
    return { ok: false, erreur: 'Ce fichier ne vient pas de MoneyTree.' }
  }
  if (typeof entete.versionSchema === 'number' && entete.versionSchema > VERSION_SCHEMA) {
    return {
      ok: false,
      erreur:
        'Ce fichier vient d’une version plus récente de MoneyTree. Mets l’appli à jour avant de l’importer.',
    }
  }

  const resultat = schemaExport.safeParse(brut)
  if (!resultat.success) {
    const premier = resultat.error.issues[0]
    const chemin = premier?.path.join('.') ?? ''
    return {
      ok: false,
      erreur: `Le fichier est incomplet ou abîmé${chemin ? ` (champ « ${chemin} »)` : ''}.`,
    }
  }

  const lu = resultat.data
  const donnees: ExportMoneyTree = {
    ...lu,
    // Un ancien fichier est converti au format courant.
    formatExport: FORMAT_EXPORT,
    versionSchema: VERSION_SCHEMA,
  }
  return {
    ok: true,
    donnees,
    resume: {
      exporteLe: donnees.exporteLe,
      profil: donnees.tables.profil.length > 0,
      modules: donnees.tables.progression.length,
      sauvegardes: donnees.tables.sauvegardes.length,
      reponses: donnees.tables.reponses.length,
    },
  }
}

/** Remplace toutes les données locales par celles de l'export, en une transaction. */
export async function importerDonnees(
  donnees: ExportMoneyTree,
  base: BaseMoneyTree = db,
): Promise<void> {
  await base.transaction('rw', [...TABLES], async () => {
    await Promise.all(TABLES.map((table) => base[table].clear()))
    await base.profil.bulkPut(donnees.tables.profil)
    await base.progression.bulkPut(donnees.tables.progression)
    await base.sauvegardes.bulkPut(donnees.tables.sauvegardes)
    await base.reponses.bulkPut(donnees.tables.reponses)
    await base.journees.bulkPut(donnees.tables.journees)
  })
}
