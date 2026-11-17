/**
 * La partie du simulateur (phase 1 : une seule sauvegarde), avec son point de sauvegarde.
 */
import { VERSION_ETAT_PARTIE, type EtatPartie } from '../engine/simulation.ts'
import { db, ID_PARTIE, type BaseMoneyTree, type ContenuSauvegarde } from './db.ts'

function estContenu(etat: unknown): etat is ContenuSauvegarde {
  if (typeof etat !== 'object' || etat === null || !('partie' in etat)) return false
  const { partie } = etat
  return (
    typeof partie === 'object' &&
    partie !== null &&
    (partie as { version?: unknown }).version === VERSION_ETAT_PARTIE
  )
}

export async function lirePartie(base: BaseMoneyTree = db): Promise<ContenuSauvegarde | null> {
  const sauvegarde = await base.sauvegardes.get(ID_PARTIE)
  return sauvegarde && estContenu(sauvegarde.etat) ? sauvegarde.etat : null
}

export async function enregistrerPartie(
  partie: EtatPartie,
  pointDeSauvegarde: EtatPartie | null,
  base: BaseMoneyTree = db,
): Promise<void> {
  const maintenant = new Date().toISOString()
  const existante = await base.sauvegardes.get(ID_PARTIE)
  const contenu: ContenuSauvegarde = { partie, pointDeSauvegarde }
  await base.sauvegardes.put({
    id: ID_PARTIE,
    nom: 'Ma partie',
    creeLe: existante?.creeLe ?? maintenant,
    majLe: maintenant,
    etat: contenu,
  })
}

export async function supprimerPartie(base: BaseMoneyTree = db): Promise<void> {
  await base.sauvegardes.delete(ID_PARTIE)
}
