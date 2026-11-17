/**
 * Base locale MoneyTree (IndexedDB via Dexie).
 *
 * Le schéma est versionné : toute modification (nouvelle table, nouvel index) passe par un
 * nouveau `db.version(n)` avec, si besoin, une fonction `upgrade` qui migre les données.
 * Ne jamais modifier une version déjà publiée : les données de l'utilisateur en dépendent.
 *
 * - Version 1 (phase 0) : profil, progression, sauvegardes.
 * - Version 2 (phase 1) : + reponses (répétition espacée), + journees (série, XP du jour).
 *   Les nouveaux champs du profil et de la progression sont facultatifs : pas de migration.
 */
import { Dexie, type EntityTable } from 'dexie'
import type { Levier } from '../content/catalogue.ts'
import type { EtatPartie } from '../engine/simulation.ts'
import type { Badge } from '../progression/gamification.ts'
import type { EntreeLeitner } from '../progression/leitner.ts'

export const NOM_BASE = 'moneytree'
export const VERSION_SCHEMA = 2

/** Identifiant unique de la ligne de profil : une seule personne utilise l'appli. */
export const ID_PROFIL = 'moi'
/** Phase 1 : une seule sauvegarde de partie. */
export const ID_PARTIE = 1

export type Objectif = 'precaution' | 'immobilier' | 'long-terme' | 'comprendre'

export interface Profil {
  id: typeof ID_PROFIL
  /** Dates au format ISO 8601. */
  creeLe: string
  majLe: string
  /** Réglage « mode expert » : ouvre tous les modules, paliers et leviers. */
  modeExpert: boolean
  /** Réponses du premier lancement. */
  salaireViseBrutAnnuel?: number
  ville?: string
  objectif?: string
  /** Le premier lancement (trois questions et révélation) a été vu ou passé. */
  lancementTermine?: boolean
  xp?: number
  badges?: Badge[]
  /** Leviers du simulateur ouverts avec « débloquer quand même ». */
  leviersForces?: Levier[]
  /** Dernier jour (AAAA-MM-JJ) où le quiz du jour a été terminé. */
  quizDuJourFaitLe?: string
}

export interface ProgressionModule {
  /** Numéro du module, de 0 à 9. */
  moduleId: number
  /** Nombre de paliers maîtrisés, de 0 à 5. */
  paliersMaitrises: number
  majLe: string
  debloqueQuandMeme?: boolean
  palierDebloque?: number
  enCours?: { palier: number; carte: number }
  /** Meilleur score par palier (part de bonnes réponses). */
  meilleursScores?: Record<string, number>
}

/** Contenu d'une sauvegarde de partie. */
export interface ContenuSauvegarde {
  partie: EtatPartie
  /** Point de sauvegarde pour revenir en arrière et tester une autre décision. */
  pointDeSauvegarde: EtatPartie | null
}

export interface Sauvegarde {
  /** Clé auto-incrémentée par IndexedDB. */
  id?: number
  nom: string
  creeLe: string
  majLe: string
  /** État du moteur de simulation (ContenuSauvegarde depuis la phase 1). */
  etat: unknown
}

export interface Journee {
  /** AAAA-MM-JJ, date locale. */
  date: string
  xp: number
  questions: number
  paliers: number
}

export type BaseMoneyTree = Dexie & {
  profil: EntityTable<Profil, 'id'>
  progression: EntityTable<ProgressionModule, 'moduleId'>
  sauvegardes: EntityTable<Sauvegarde, 'id'>
  reponses: EntityTable<EntreeLeitner, 'questionId'>
  journees: EntityTable<Journee, 'date'>
}

/** Noms des tables, dans l'ordre de l'export. */
export const TABLES = ['profil', 'progression', 'sauvegardes', 'reponses', 'journees'] as const
export type NomTable = (typeof TABLES)[number]

export function creerBase(nom: string = NOM_BASE): BaseMoneyTree {
  const base = new Dexie(nom) as BaseMoneyTree
  base.version(1).stores({
    profil: 'id',
    progression: 'moduleId',
    sauvegardes: '++id, majLe',
  })
  base.version(2).stores({
    reponses: 'questionId, prochaineRevision',
    journees: 'date',
  })
  return base
}

export const db = creerBase()
