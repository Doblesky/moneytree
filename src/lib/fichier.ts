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
