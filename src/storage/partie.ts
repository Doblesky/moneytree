/**
 * Parties du simulateur : autant de sauvegardes que l'on veut (phase 2), chacune avec son
 * point de sauvegarde. Le profil retient la partie ouverte en dernier. Les parties de la
 * phase 1 sont converties à la lecture (voir migrerEtat).
 */
import { migrerEtat, type EtatPartie } from '../engine/simulation.ts'
import { db, ID_PROFIL, type BaseMoneyTree, type ContenuSauvegarde, type Sauvegarde } from './db.ts'
import { lireProfil, modifierProfil } from './profil.ts'

function lireContenu(etat: unknown): ContenuSauvegarde | null {
  if (typeof etat !== 'object' || etat === null || !('partie' in etat)) return null
  const brut = etat as { partie: unknown; pointDeSauvegarde?: unknown }
  const partie = migrerEtat(brut.partie)
  if (!partie) return null
  return { partie, pointDeSauvegarde: brut.pointDeSauvegarde ? migrerEtat(brut.pointDeSauvegarde) : null }
}

export interface ResumePartie {
  id: number
  nom: string
  majLe: string
  contenu: ContenuSauvegarde
}

/** Toutes les parties lisibles, la plus récente d'abord. */
export async function listerParties(base: BaseMoneyTree = db): Promise<ResumePartie[]> {
  const sauvegardes = await base.sauvegardes.orderBy('majLe').reverse().toArray()
  return sauvegardes.flatMap((s) => {
    const contenu = lireContenu(s.etat)
    return contenu && s.id !== undefined ? [{ id: s.id, nom: s.nom, majLe: s.majLe, contenu }] : []
  })
}

export async function lirePartie(id: number, base: BaseMoneyTree = db): Promise<ContenuSauvegarde | null> {
  const sauvegarde = await base.sauvegardes.get(id)
  return sauvegarde ? lireContenu(sauvegarde.etat) : null
}

/** La partie ouverte en dernier (ou la plus récente), avec son identifiant. */
export async function lirePartieActive(
  base: BaseMoneyTree = db,
): Promise<{ id: number; nom: string; contenu: ContenuSauvegarde } | null> {
  const profil = await lireProfil(base)
  const parties = await listerParties(base)
  const active = parties.find((p) => p.id === profil.partieActive) ?? parties[0]
  return active ? { id: active.id, nom: active.nom, contenu: active.contenu } : null
}

/** Crée une partie et l'ouvre. */
export async function creerSauvegarde(
  nom: string,
  partie: EtatPartie,
  base: BaseMoneyTree = db,
): Promise<number> {
  const maintenant = new Date().toISOString()
  const contenu: ContenuSauvegarde = { partie, pointDeSauvegarde: null }
  const ligne: Sauvegarde = { nom, creeLe: maintenant, majLe: maintenant, etat: contenu }
  const id = await base.sauvegardes.add(ligne)
  if (id === undefined) throw new Error('La partie n’a pas pu être créée')
  await modifierProfil({ partieActive: id }, base)
  return id
}

export async function enregistrerPartie(
  id: number,
  partie: EtatPartie,
  pointDeSauvegarde: EtatPartie | null,
  base: BaseMoneyTree = db,
): Promise<void> {
  const contenu: ContenuSauvegarde = { partie, pointDeSauvegarde }
  await base.sauvegardes.update(id, { etat: contenu, majLe: new Date().toISOString() })
}

export async function ouvrirPartie(id: number, base: BaseMoneyTree = db): Promise<void> {
  await modifierProfil({ partieActive: id }, base)
}

export async function renommerPartie(id: number, nom: string, base: BaseMoneyTree = db): Promise<void> {
  await base.sauvegardes.update(id, { nom: nom.trim() || 'Partie sans nom' })
}

export async function supprimerPartie(id: number, base: BaseMoneyTree = db): Promise<void> {
  await base.transaction('rw', base.sauvegardes, base.profil, async () => {
    await base.sauvegardes.delete(id)
    const profil = await base.profil.get(ID_PROFIL)
    if (profil?.partieActive === id) await base.profil.update(ID_PROFIL, { partieActive: undefined })
  })
}

/** Duplique une partie, pour tester une autre stratégie à partir du même point. */
export async function dupliquerPartie(id: number, nom: string, base: BaseMoneyTree = db): Promise<number | null> {
  const contenu = await lirePartie(id, base)
  if (!contenu) return null
  const nouvelle = await creerSauvegarde(nom, contenu.partie, base)
  await enregistrerPartie(nouvelle, contenu.partie, contenu.pointDeSauvegarde, base)
  return nouvelle
}
