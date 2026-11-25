/**
 * Envoi du paquet de cartes au compagnon Android. Chrome n'ouvre le lien qu'à la suite d'un
 * appui : synchroniserWidget n'est appelé que depuis un appui de l'utilisateur, ou juste après.
 */
import { lireEtatProgression } from '../storage/apprentissage.ts'
import type { ReglageWidget } from '../storage/db.ts'
import { lireProfil } from '../storage/profil.ts'
import { encoderPaquet, estAndroid, lienIntent, urlRepli } from './lien.ts'
import { construirePaquet, signaturePaquet } from './paquet.ts'
import { noterEnvoi, reglageWidget } from './reglage.ts'

/** palier : un palier vient d'être maîtrisé ; reglage : réglage ou profil changé ; retour : retour dans l'appli. */
export type RaisonEnvoi = 'palier' | 'reglage' | 'retour'

/** Un second envoi trop rapproché s'est perdu pendant l'essai sur émulateur. */
export const DELAI_MIN_ENVOI_MS = 10_000
/** Au retour dans l'appli, le paquet est renvoyé même inchangé après ce délai (envoi perdu, compagnon réinstallé). */
export const RATTRAPAGE_MS = 6 * 60 * 60 * 1000

export function doitEnvoyer(c: {
  raison: RaisonEnvoi
  reglage: ReglageWidget
  signature: string
  maintenantMs: number
  dernierEssaiMs: number | null
  android: boolean
}): boolean {
  if (!c.android || !c.reglage.actif || c.reglage.introuvableLe !== undefined) return false
  if (c.dernierEssaiMs !== null && c.maintenantMs - c.dernierEssaiMs < DELAI_MIN_ENVOI_MS) return false
  if (c.raison === 'reglage') return true
  const change = c.signature !== c.reglage.derniereSignature
  if (c.raison === 'palier') return change
  const dernierEnvoi = c.reglage.dernierEnvoiLe === undefined ? null : Date.parse(c.reglage.dernierEnvoiLe)
  return change || dernierEnvoi === null || c.maintenantMs - dernierEnvoi > RATTRAPAGE_MS
}

let dernierEssaiMs: number | null = null

export async function synchroniserWidget(raison: RaisonEnvoi): Promise<void> {
  try {
    const maintenantMs = Date.now()
    const reglage = reglageWidget(await lireProfil())
    const android = estAndroid(navigator.userAgent)
    // Sortie rapide avant de construire le paquet : c'est le cas de la plupart des appuis.
    if (!reglage.actif || !android) return
    const paquet = construirePaquet(await lireEtatProgression(), reglage.intervalleMinutes)
    const signature = signaturePaquet(paquet)
    if (!doitEnvoyer({ raison, reglage, signature, maintenantMs, dernierEssaiMs, android })) return
    dernierEssaiMs = maintenantMs
    const donnees = await encoderPaquet(paquet)
    window.location.href = lienIntent(donnees, urlRepli(window.location.href, maintenantMs))
    await noterEnvoi(signature, paquet.cartes.length, new Date(maintenantMs))
  } catch (erreur) {
    console.warn('Widget : envoi impossible', erreur)
  }
}
