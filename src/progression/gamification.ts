/**
 * XP, niveaux, série de jours et badges. Les récompenses marquent un progrès, jamais de
 * l'argent : les jetons d'XP n'ont aucun signe monétaire (planche, section 08).
 */
import { ajouterJours } from './leitner.ts'

export const XP = {
  bonneReponseQcm: 10,
  bonneReponseCalcul: 20,
  palierMaitrise: 50,
  moduleTermine: 100,
  quizDuJour: 30,
  examenValide: 100,
} as const

/** Seuil de réussite d'un quiz de palier. */
export const SEUIL_MAITRISE = 0.8

/** Niveau n atteint à 50 × (n − 1)² XP : 1 à 0 XP, 2 à 50, 3 à 200, 4 à 450… */
export function niveau(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1
}

export function seuilNiveau(n: number): number {
  return 50 * (n - 1) ** 2
}

/** Avancement vers le niveau suivant, entre 0 et 1. */
export function progressionNiveau(xp: number): number {
  const n = niveau(xp)
  return (xp - seuilNiveau(n)) / (seuilNiveau(n + 1) - seuilNiveau(n))
}

/**
 * Série : nombre de jours consécutifs avec au moins une activité, jusqu'à aujourd'hui
 * (ou hier, si la journée n'a pas encore commencé : la série n'est perdue qu'à minuit).
 */
export function serieDeJours(joursActifs: readonly string[], aujourdhui: string): number {
  const actifs = new Set(joursActifs)
  let jour = actifs.has(aujourdhui) ? aujourdhui : ajouterJours(aujourdhui, -1)
  let serie = 0
  while (actifs.has(jour)) {
    serie++
    jour = ajouterJours(jour, -1)
  }
  return serie
}

/** Les 7 jours de la semaine en cours (lundi → dimanche), avec activité ou non. */
export function semaine(joursActifs: readonly string[], aujourdhui: string): { jour: string; actif: boolean; futur: boolean }[] {
  const [a, m, j] = aujourdhui.split('-').map(Number)
  const date = new Date(a ?? 2000, (m ?? 1) - 1, j ?? 1)
  const decalage = (date.getDay() + 6) % 7 // lundi = 0
  const lundi = ajouterJours(aujourdhui, -decalage)
  const actifs = new Set(joursActifs)
  return Array.from({ length: 7 }, (_, i) => {
    const jour = ajouterJours(lundi, i)
    return { jour, actif: actifs.has(jour), futur: jour > aujourdhui }
  })
}

export type Badge =
  | 'premier-palier'
  | 'bases'
  | 'sans-faute'
  | 'trois-modules'
  | 'serie-7'
  | 'premiere-annee'
  | 'dix-ans'
  | 'premier-examen'
  | 'module-valide'
  | 'cent-pour-cent'

export const BADGES: Record<Badge, { nom: string; description: string }> = {
  'premier-palier': { nom: 'Premier secteur', description: 'Ton premier palier maîtrisé.' },
  bases: { nom: 'Les bases', description: 'Le palier Découverte du module 0 maîtrisé.' },
  'sans-faute': { nom: 'Sans faute', description: 'Un quiz de palier réussi à 100 %.' },
  'trois-modules': { nom: 'Trois modules', description: 'Les modules 0 à 2 terminés : le mode carrière t’attend.' },
  'serie-7': { nom: 'Une semaine', description: 'Sept jours d’affilée.' },
  'premiere-annee': { nom: 'Première année', description: 'Une année entière dans le simulateur.' },
  'dix-ans': { nom: 'Dix ans', description: 'Une partie de dix ans menée jusqu’au bout.' },
  'premier-examen': { nom: 'Premier examen', description: 'Un palier validé par son examen.' },
  'module-valide': { nom: 'Module validé', description: 'Les cinq examens d’un module réussis.' },
  'cent-pour-cent': { nom: 'Cent pour cent', description: 'Les 50 examens réussis : le programme complet.' },
}
