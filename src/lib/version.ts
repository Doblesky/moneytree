/** Remplacé au build par Vite (voir `define` dans vite.config.ts). */
declare const __MONEYTREE_VERSION__: {
  /** Commit court (7 caractères), suffixé de « -modifié » pour une version de travail locale. */
  commit: string
  /** Date et heure du build, au format ISO 8601 (UTC). */
  construiteLe: string
}

/** Version de l'appli qui tourne : à comparer avec le dernier déploiement publié. */
export const VERSION_APPLI = __MONEYTREE_VERSION__
