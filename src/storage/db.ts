/**
 * Base locale MoneyTree (IndexedDB via Dexie).
 *
 * Le schéma est versionné : toute modification (nouvelle table, nouvel index) passe par un
 * nouveau `db.version(n)` avec, si besoin, une fonction `upgrade` qui migre les données.
 * Ne jamais modifier une version déjà publiée : les données de l'utilisateur en dépendent.
 */
import { Dexie, type EntityTable } from 'dexie'

export const NOM_BASE = 'moneytree'
export const VERSION_SCHEMA = 1

/** Identifiant unique de la ligne de profil : une seule personne utilise l'appli. */
export const ID_PROFIL = 'moi'

export interface Profil {
  id: typeof ID_PROFIL
  /** Dates au format ISO 8601. */
  creeLe: string
  majLe: string
  /** Réglage « mode expert » : ouvre tous les modules et leviers (effet à partir de la phase 1). */
  modeExpert: boolean
  /** Réponses du premier lancement (phase 1). */
  salaireViseBrutAnnuel?: number
  ville?: string
  objectif?: string
}

export interface ProgressionModule {
  /** Numéro du module, de 0 à 9. */
  moduleId: number
  /** Nombre de paliers maîtrisés, de 0 à 5. */
  paliersMaitrises: number
  majLe: string
}

export interface Sauvegarde {
  /** Clé auto-incrémentée par IndexedDB. */
  id?: number
  nom: string
  creeLe: string
  majLe: string
  /** État du moteur de simulation, défini à partir de la phase 1. */
  etat: unknown
}

export type BaseMoneyTree = Dexie & {
  profil: EntityTable<Profil, 'id'>
  progression: EntityTable<ProgressionModule, 'moduleId'>
  sauvegardes: EntityTable<Sauvegarde, 'id'>
}

/** Noms des tables, dans l'ordre de l'export. */
export const TABLES = ['profil', 'progression', 'sauvegardes'] as const
export type NomTable = (typeof TABLES)[number]

export function creerBase(nom: string = NOM_BASE): BaseMoneyTree {
  const base = new Dexie(nom) as BaseMoneyTree
  base.version(1).stores({
    profil: 'id',
    progression: 'moduleId',
    sauvegardes: '++id, majLe',
  })
  return base
}

export const db = creerBase()
