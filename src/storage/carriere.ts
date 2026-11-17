/**
 * Parties du mode carrière (phase 3). Elles vivent dans la même table que les parties du
 * simulateur, avec un contenu de la forme `{ carriere: EtatCarriere }` : pas de nouvelle
 * table, et l'export les emporte avec le reste. Le profil retient la carrière ouverte en dernier.
 */
import { lireCarriere, type EtatCarriere } from '../engine/carriere.ts'
import { db, ID_PROFIL, type BaseMoneyTree, type Sauvegarde } from './db.ts'
import { lireProfil, modifierProfil } from './profil.ts'

export interface ResumeCarriere {
  id: number
  nom: string
  majLe: string
  carriere: EtatCarriere
}

function lireContenuCarriere(etat: unknown): EtatCarriere | null {
  if (typeof etat !== 'object' || etat === null || !('carriere' in etat)) return null
  return lireCarriere(etat.carriere)
}

export async function listerCarrieres(base: BaseMoneyTree = db): Promise<ResumeCarriere[]> {
  const sauvegardes = await base.sauvegardes.orderBy('majLe').reverse().toArray()
  return sauvegardes.flatMap((s) => {
    const carriere = lireContenuCarriere(s.etat)
    return carriere && s.id !== undefined ? [{ id: s.id, nom: s.nom, majLe: s.majLe, carriere }] : []
  })
}

/** La carrière ouverte en dernier (ou la plus récente). */
export async function lireCarriereActive(base: BaseMoneyTree = db): Promise<ResumeCarriere | null> {
  const profil = await lireProfil(base)
  const carrieres = await listerCarrieres(base)
  return carrieres.find((c) => c.id === profil.carriereActive) ?? carrieres[0] ?? null
}

export async function creerSauvegardeCarriere(
  nom: string,
  carriere: EtatCarriere,
  base: BaseMoneyTree = db,
): Promise<number> {
  const maintenant = new Date().toISOString()
  const ligne: Sauvegarde = { nom, creeLe: maintenant, majLe: maintenant, etat: { carriere } }
  const id = await base.sauvegardes.add(ligne)
  if (id === undefined) throw new Error('La carrière n’a pas pu être créée')
  await modifierProfil({ carriereActive: id }, base)
  return id
}

export async function enregistrerCarriere(id: number, carriere: EtatCarriere, base: BaseMoneyTree = db): Promise<void> {
  await base.sauvegardes.update(id, { etat: { carriere }, majLe: new Date().toISOString() })
}

export async function ouvrirCarriere(id: number, base: BaseMoneyTree = db): Promise<void> {
  await modifierProfil({ carriereActive: id }, base)
}

export async function supprimerCarriere(id: number, base: BaseMoneyTree = db): Promise<void> {
  await base.transaction('rw', base.sauvegardes, base.profil, async () => {
    await base.sauvegardes.delete(id)
    const profil = await base.profil.get(ID_PROFIL)
    if (profil?.carriereActive === id) await base.profil.update(ID_PROFIL, { carriereActive: undefined })
  })
}
