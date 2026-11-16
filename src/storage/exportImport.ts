/**
 * Export et import de toutes les données en JSON, pour ne rien perdre si le navigateur
 * vide son stockage. L'import remplace la totalité des données locales, en une seule
 * transaction : en cas d'erreur, rien n'est modifié.
 */
import { z } from 'zod'
import {
  db,
  ID_PROFIL,
  TABLES,
  VERSION_SCHEMA,
  type BaseMoneyTree,
  type Profil,
  type ProgressionModule,
  type Sauvegarde,
} from './db.ts'

export const APPLICATION = 'MoneyTree'
/** Version du format du fichier d'export (distincte de la version du schéma Dexie). */
export const FORMAT_EXPORT = 1

const dateIso = z.iso.datetime()

const schemaProfil = z.strictObject({
  id: z.literal(ID_PROFIL),
  creeLe: dateIso,
  majLe: dateIso,
  modeExpert: z.boolean(),
  salaireViseBrutAnnuel: z.number().nonnegative().optional(),
  ville: z.string().optional(),
  objectif: z.string().optional(),
})

const schemaProgression = z.strictObject({
  moduleId: z.number().int().min(0).max(9),
  paliersMaitrises: z.number().int().min(0).max(5),
  majLe: dateIso,
})

const schemaSauvegarde = z.strictObject({
  id: z.number().int().positive(),
  nom: z.string(),
  creeLe: dateIso,
  majLe: dateIso,
  etat: z.unknown(),
})

function sansDoublon<T>(lignes: T[], cle: (ligne: T) => unknown): boolean {
  return new Set(lignes.map(cle)).size === lignes.length
}

const schemaExport = z.strictObject({
  application: z.literal(APPLICATION),
  formatExport: z.literal(FORMAT_EXPORT),
  versionSchema: z.literal(VERSION_SCHEMA),
  exporteLe: dateIso,
  tables: z.strictObject({
    profil: z.array(schemaProfil).max(1),
    progression: z
      .array(schemaProgression)
      .refine((lignes) => sansDoublon(lignes, (l) => l.moduleId), 'module en double'),
    sauvegardes: z
      .array(schemaSauvegarde)
      .refine((lignes) => sansDoublon(lignes, (l) => l.id), 'sauvegarde en double'),
  }),
})

export interface ExportMoneyTree {
  application: typeof APPLICATION
  formatExport: typeof FORMAT_EXPORT
  versionSchema: number
  exporteLe: string
  tables: {
    profil: Profil[]
    progression: ProgressionModule[]
    sauvegardes: Sauvegarde[]
  }
}

export interface ResumeExport {
  exporteLe: string
  profil: boolean
  modules: number
  sauvegardes: number
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
    },
  }))
}

export function serialiserExport(donnees: ExportMoneyTree): string {
  return `${JSON.stringify(donnees, null, 2)}\n`
}

/** « moneytree-2026-11-16.json », à la date locale. */
export function nomFichierExport(maintenant: Date = new Date()): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  const jour = `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`
  return `moneytree-${jour}.json`
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
  // Quand le schéma passera en version 2, convertir ici les exports en version 1 au lieu
  // de les refuser.

  const resultat = schemaExport.safeParse(brut)
  if (!resultat.success) {
    const premier = resultat.error.issues[0]
    const chemin = premier?.path.join('.') ?? ''
    return {
      ok: false,
      erreur: `Le fichier est incomplet ou abîmé${chemin ? ` (champ « ${chemin} »)` : ''}.`,
    }
  }

  const donnees: ExportMoneyTree = resultat.data
  return {
    ok: true,
    donnees,
    resume: {
      exporteLe: donnees.exporteLe,
      profil: donnees.tables.profil.length > 0,
      modules: donnees.tables.progression.length,
      sauvegardes: donnees.tables.sauvegardes.length,
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
  })
}
