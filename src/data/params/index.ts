/**
 * Chargeur typé des paramètres annuels. Le fichier JSON est validé au démarrage de l'appli
 * (voir main.tsx) : une erreur de format empêche l'appli de calculer avec des valeurs
 * douteuses et s'affiche à l'écran.
 */
import brut2026 from './2026.json'
import { schemaParametres2026, type Parametres2026 } from './schema.ts'

export class ParametresInvalidesError extends Error {
  readonly problemes: string[]

  constructor(fichier: string, problemes: string[]) {
    super(`Paramètres invalides dans ${fichier} :\n- ${problemes.join('\n- ')}`)
    this.name = 'ParametresInvalidesError'
    this.problemes = problemes
  }
}

/** Valide un contenu de fichier de paramètres 2026 et le renvoie typé. */
export function validerParametres2026(brut: unknown, fichier = '2026.json'): Parametres2026 {
  const resultat = schemaParametres2026.safeParse(brut)
  if (!resultat.success) {
    throw new ParametresInvalidesError(
      fichier,
      resultat.error.issues.map((i) => `${i.path.join(' › ') || '(racine)'} : ${i.message}`),
    )
  }
  return resultat.data
}

let enCache: Parametres2026 | undefined

/** Paramètres 2026 validés (validation faite une seule fois). */
export function parametres2026(): Parametres2026 {
  enCache ??= validerParametres2026(brut2026)
  return enCache
}

export type { CleParametre, Parametres2026 } from './schema.ts'
