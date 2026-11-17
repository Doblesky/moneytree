/**
 * Répétition espacée (système de Leitner) : chaque question répondue entre dans une boîte.
 * Juste : elle monte d'une boîte et revient plus tard. Fausse : elle retourne en boîte 1
 * et revient dès le lendemain. Le quiz du jour pioche d'abord les questions à revoir.
 */

/** Intervalle avant la prochaine révision, en jours, pour les boîtes 1 à 5. */
export const INTERVALLES_JOURS = [1, 2, 4, 8, 16] as const
export const BOITE_MAX = INTERVALLES_JOURS.length

export interface EntreeLeitner {
  questionId: string
  boite: number
  /** Date de la prochaine révision, AAAA-MM-JJ (date locale). */
  prochaineRevision: string
  vues: number
  justes: number
  majLe: string
}

/** Date locale AAAA-MM-JJ. */
export function jourLocal(date: Date = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`
}

export function ajouterJours(jour: string, jours: number): string {
  const [a, m, j] = jour.split('-').map(Number)
  return jourLocal(new Date(a ?? 2000, (m ?? 1) - 1, (j ?? 1) + jours))
}

export function apresReponse(
  entree: EntreeLeitner | undefined,
  questionId: string,
  juste: boolean,
  maintenant: Date = new Date(),
): EntreeLeitner {
  const boite = juste ? Math.min(BOITE_MAX, (entree?.boite ?? 0) + 1) : 1
  return {
    questionId,
    boite,
    prochaineRevision: ajouterJours(jourLocal(maintenant), INTERVALLES_JOURS[boite - 1] ?? 1),
    vues: (entree?.vues ?? 0) + 1,
    justes: (entree?.justes ?? 0) + (juste ? 1 : 0),
    majLe: maintenant.toISOString(),
  }
}

export function aRevoir(entrees: readonly EntreeLeitner[], aujourdhui: string): EntreeLeitner[] {
  return entrees
    .filter((e) => e.prochaineRevision <= aujourdhui)
    .sort((a, b) => a.boite - b.boite || a.prochaineRevision.localeCompare(b.prochaineRevision))
}

/**
 * Les questions du quiz du jour : d'abord celles à revoir, puis des questions jamais vues
 * des paliers ouverts, enfin des questions déjà vues (les moins bien sues d'abord).
 * `melange` reçoit un tableau et le renvoie dans un ordre aléatoire (injecté pour les tests).
 */
export function questionsDuJour(
  entrees: readonly EntreeLeitner[],
  disponibles: readonly string[],
  aujourdhui: string,
  nombre = 3,
  melange: <T>(t: T[]) => T[] = (t) => t,
): string[] {
  const permises = new Set(disponibles)
  const choisies: string[] = []
  const ajouter = (ids: string[]) => {
    for (const id of ids) {
      if (choisies.length >= nombre) return
      if (permises.has(id) && !choisies.includes(id)) choisies.push(id)
    }
  }
  ajouter(aRevoir(entrees, aujourdhui).map((e) => e.questionId))
  const vues = new Set(entrees.map((e) => e.questionId))
  ajouter(melange(disponibles.filter((id) => !vues.has(id))))
  ajouter(
    [...entrees]
      .sort((a, b) => a.boite - b.boite || a.justes / a.vues - b.justes / b.vues)
      .map((e) => e.questionId),
  )
  return choisies
}
