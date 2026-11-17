/**
 * Projection d'un versement mensuel régulier par bootstrap par blocs : on recolle des blocs
 * de mois consécutifs tirés au hasard dans l'historique réel, ce qui conserve les krachs et
 * l'enchaînement des mois. Le résultat est une fourchette (P10 / P50 / P90), jamais une
 * prédiction. Les rendements utilisés sont réels (corrigés de l'inflation) : les montants
 * sont en euros d'aujourd'hui.
 */
import { Aleatoire } from './aleatoire.ts'

export interface OptionsProjection {
  versementMensuel: number
  mois: number
  /** Rendements mensuels historiques réels dans lesquels on tire les blocs. */
  rendements: readonly number[]
  trajectoires?: number
  /** Longueur des blocs, en mois. */
  bloc?: number
  graine?: number
}

export interface ResultatProjection {
  /** Une valeur par année (indice 0 = départ), en euros constants. */
  annees: number[]
  p10: number[]
  p50: number[]
  p90: number[]
  verse: number[]
  final: { p10: number; p50: number; p90: number; verse: number }
}

/** Quantile d'un tableau trié (interpolation linéaire). */
export function quantile(trie: readonly number[], q: number): number {
  if (trie.length === 0) return Number.NaN
  const position = (trie.length - 1) * q
  const bas = Math.floor(position)
  const haut = Math.ceil(position)
  const a = trie[bas] ?? 0
  const b = trie[haut] ?? a
  return a + (b - a) * (position - bas)
}

export function projeterVersements(options: OptionsProjection): ResultatProjection {
  const { versementMensuel, mois, rendements } = options
  const trajectoires = options.trajectoires ?? 1000
  const bloc = options.bloc ?? 12
  const alea = new Aleatoire(options.graine ?? 20261117)
  const n = rendements.length
  if (n === 0) throw new Error('Aucun rendement historique')

  const nbAnnees = Math.floor(mois / 12)
  // valeurs[annee][trajectoire]
  const valeurs: number[][] = Array.from({ length: nbAnnees + 1 }, () => [])

  for (let t = 0; t < trajectoires; t++) {
    let valeur = 0
    let debutBloc = alea.entier(n)
    let positionDansBloc = 0
    valeurs[0]?.push(0)
    for (let m = 1; m <= mois; m++) {
      if (positionDansBloc === bloc) {
        debutBloc = alea.entier(n)
        positionDansBloc = 0
      }
      // Bootstrap circulaire : un bloc qui dépasse la fin de l'historique reprend au début.
      const r = rendements[(debutBloc + positionDansBloc) % n] ?? 0
      positionDansBloc++
      valeur = (valeur + versementMensuel) * (1 + r)
      if (m % 12 === 0) valeurs[m / 12]?.push(valeur)
    }
  }

  const p10: number[] = []
  const p50: number[] = []
  const p90: number[] = []
  const verse: number[] = []
  const annees: number[] = []
  valeurs.forEach((serie, annee) => {
    const trie = [...serie].sort((a, b) => a - b)
    annees.push(annee)
    p10.push(quantile(trie, 0.1))
    p50.push(quantile(trie, 0.5))
    p90.push(quantile(trie, 0.9))
    verse.push(versementMensuel * 12 * annee)
  })
  return {
    annees,
    p10,
    p50,
    p90,
    verse,
    final: {
      p10: p10.at(-1) ?? 0,
      p50: p50.at(-1) ?? 0,
      p90: p90.at(-1) ?? 0,
      verse: verse.at(-1) ?? 0,
    },
  }
}
