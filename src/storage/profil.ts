import { db, ID_PROFIL, type BaseMoneyTree, type Profil } from './db.ts'

export function profilParDefaut(maintenant: Date = new Date()): Profil {
  const date = maintenant.toISOString()
  return { id: ID_PROFIL, creeLe: date, majLe: date, modeExpert: false }
}

/** Lit le profil ; s'il n'existe pas encore, renvoie les valeurs par défaut sans écrire. */
export async function lireProfil(base: BaseMoneyTree = db): Promise<Profil> {
  return (await base.profil.get(ID_PROFIL)) ?? profilParDefaut()
}

/** Modifie le profil (le crée au premier appel). */
export async function modifierProfil(
  modifications: Partial<Omit<Profil, 'id' | 'creeLe' | 'majLe'>>,
  base: BaseMoneyTree = db,
): Promise<Profil> {
  return base.transaction('rw', base.profil, async () => {
    const actuel = await lireProfil(base)
    const nouveau: Profil = {
      ...actuel,
      ...modifications,
      majLe: new Date().toISOString(),
    }
    await base.profil.put(nouveau)
    return nouveau
  })
}

/** Note un cas d'école comme terminé (débrief vu). */
export async function terminerCas(id: string, base: BaseMoneyTree = db): Promise<void> {
  const profil = await lireProfil(base)
  const deja = profil.casTermines ?? []
  if (!deja.includes(id)) await modifierProfil({ casTermines: [...deja, id] }, base)
}
