/**
 * Remarques sur l'appli, écrites dans les Réglages : un mot à ajouter au glossaire, un écran
 * à revoir, une idée. Elles restent sur l'appareil : pour les faire traiter, on envoie la liste
 * sur son Google Drive, où Claude peut la lire, ou on la colle dans une conversation.
 */
import { db, type BaseMoneyTree, type Note } from './db.ts'

export const LONGUEUR_MAX_NOTE = 2000

/** Ajoute une remarque. Un texte vide n'ajoute rien et renvoie null. */
export async function ajouterNote(
  texte: string,
  base: BaseMoneyTree = db,
  maintenant: Date = new Date(),
): Promise<number | null> {
  const propre = texte.trim().slice(0, LONGUEUR_MAX_NOTE)
  if (propre === '') return null
  return (await base.notes.add({ texte: propre, creeLe: maintenant.toISOString() })) ?? null
}

/** Toutes les remarques, de la plus récente à la plus ancienne. */
export async function listerNotes(base: BaseMoneyTree = db): Promise<Note[]> {
  return base.notes.orderBy('creeLe').reverse().toArray()
}

/** Marque une remarque comme traitée, ou la remet à traiter. */
export async function marquerNote(
  id: number,
  traitee: boolean,
  base: BaseMoneyTree = db,
  maintenant: Date = new Date(),
): Promise<void> {
  await base.transaction('rw', base.notes, async () => {
    const note = await base.notes.get(id)
    if (!note) return
    const copie: Note = { ...note }
    if (traitee) copie.traiteeLe = maintenant.toISOString()
    else delete copie.traiteeLe
    await base.notes.put(copie)
  })
}

export async function supprimerNote(id: number, base: BaseMoneyTree = db): Promise<void> {
  await base.notes.delete(id)
}

/** Nom du fichier envoyé sur Drive : un préfixe fixe pour que Claude le retrouve, et le jour local. */
export function nomFichierNotes(maintenant: Date = new Date()): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  const jourLocal = `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`
  return `moneytree-remarques-${jourLocal}.txt`
}

/** Texte à envoyer à Claude : les remarques à traiter, de la plus ancienne à la plus récente. */
export function texteNotesPourClaude(notes: Note[]): string {
  const aTraiter = notes
    .filter((n) => n.traiteeLe === undefined)
    .sort((a, b) => a.creeLe.localeCompare(b.creeLe))
  const lignes = aTraiter.map((n, i) => {
    const date = new Date(n.creeLe).toLocaleDateString('fr-FR')
    return `${i + 1}. (${date}) ${n.texte}`
  })
  return `Voici mes remarques sur l’appli MoneyTree. Peux-tu travailler dessus ?\n\n${lignes.join('\n')}\n`
}
