export type ResultatPartage = 'partage' | 'annule' | 'indisponible'

type Partageur = {
  canShare?: (donnees: ShareData) => boolean
  share?: (donnees: ShareData) => Promise<void>
}

/**
 * Ouvre le menu de partage du téléphone avec un fichier texte (Drive, e-mail…).
 * À appeler directement depuis un geste de l'utilisateur, sinon le navigateur refuse.
 */
export async function partagerFichierTexte(
  nomFichier: string,
  contenu: string,
  partageur: Partageur = navigator,
): Promise<ResultatPartage> {
  const donnees: ShareData = { files: [new File([contenu], nomFichier, { type: 'text/plain' })] }
  if (!partageur.share || !partageur.canShare?.(donnees)) return 'indisponible'
  try {
    await partageur.share(donnees)
    return 'partage'
  } catch (erreur) {
    return erreur instanceof DOMException && erreur.name === 'AbortError' ? 'annule' : 'indisponible'
  }
}

/** Propose au navigateur d'enregistrer un fichier texte (dossier Téléchargements sur Android). */
export function telechargerTexte(
  nomFichier: string,
  contenu: string,
  type = 'application/json',
): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  lien.rel = 'noopener'
  document.body.append(lien)
  lien.click()
  lien.remove()
  // Laisse au navigateur le temps de lancer le téléchargement avant de libérer l'URL.
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 10_000)
}
