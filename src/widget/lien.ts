/**
 * Lien vers le compagnon Android du widget : paquet compressé (deflate-raw) en base64url,
 * dans un lien `intent:` que Chrome n'ouvre qu'à la suite d'un appui de l'utilisateur.
 * Le repli garde la page en place si le compagnon est absent : il n'ajoute qu'un paramètre
 * dans le fragment, puisque l'appli utilise un routeur par fragment (createHashRouter).
 */
import type { PaquetWidget } from './paquet.ts'

export const PAQUET_ANDROID = 'io.github.doblesky.moneytree.widget'
/** Paramètre ajouté au fragment quand Chrome a suivi le repli : le compagnon est absent. */
export const PARAM_ABSENT = 'widget-absent'
/** Taille maximale du paquet décodé, en octets, au-delà de laquelle le compagnon le refuse. */
export const TAILLE_MAX_DECODEE = 512_000

function base64url(octets: Uint8Array): string {
  let binaire = ''
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000))
  }
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function encoderPaquet(paquet: PaquetWidget): Promise<string> {
  const flux = new Blob([JSON.stringify(paquet)]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return base64url(new Uint8Array(await new Response(flux).arrayBuffer()))
}

/**
 * Longueur maximale du paramètre « d ». Mesure sur l'émulateur (Chrome 156, Android 17) : un lien
 * passe avec 65 400 caractères, plus avec 66 000 (limite non documentée). On garde une marge.
 */
export const LIMITE_LIEN = 60_000

/**
 * Encode le paquet sous LIMITE_LIEN : texte complet s'il tient, sinon le seul premier paragraphe
 * de chaque carte, et en dernier recours moins de cartes (les dernières du parcours).
 */
export async function encoderPaquetBorne(paquet: PaquetWidget): Promise<{ donnees: string; nbCartes: number }> {
  const complet = await encoderPaquet(paquet)
  if (complet.length <= LIMITE_LIEN) return { donnees: complet, nbCartes: paquet.cartes.length }
  let cartes = paquet.cartes.map((c) => ({ ...c, texte: c.texte.split('\n\n')[0] ?? '' }))
  for (;;) {
    const donnees = await encoderPaquet({ ...paquet, cartes })
    if (donnees.length <= LIMITE_LIEN || cartes.length === 0) return { donnees, nbCartes: cartes.length }
    cartes = cartes.slice(0, Math.floor(((cartes.length * LIMITE_LIEN) / donnees.length) * 0.95))
  }
}

export function lienIntent(donnees: string, repli: string): string {
  return (
    `intent://sync?d=${donnees}#Intent;scheme=moneytree-widget;package=${PAQUET_ANDROID};` +
    `S.browser_fallback_url=${encodeURIComponent(repli)};end`
  )
}

export function urlRepli(href: string, maintenantMs: number): string {
  const parametre = `${PARAM_ABSENT}=${maintenantMs}`
  const diese = href.indexOf('#')
  if (diese < 0) return `${href}#/?${parametre}`
  return `${href}${href.slice(diese).includes('?') ? '&' : '?'}${parametre}`
}

/** Fragment sans le paramètre du repli, ou null s'il n'y figure pas. */
export function retirerParamAbsent(hash: string): string | null {
  const interrogation = hash.indexOf('?')
  if (interrogation < 0) return null
  const recherche = new URLSearchParams(hash.slice(interrogation + 1))
  if (!recherche.has(PARAM_ABSENT)) return null
  recherche.delete(PARAM_ABSENT)
  const reste = recherche.toString()
  return reste === '' ? hash.slice(0, interrogation) : `${hash.slice(0, interrogation)}?${reste}`
}

export function estAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent)
}
