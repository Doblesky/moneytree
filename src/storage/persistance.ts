/**
 * Stockage persistant : demande au navigateur de ne pas effacer les données de l'appli
 * quand l'espace disque manque. Chrome l'accorde ou le refuse sans afficher de question
 * (il tient compte de l'installation de l'appli et de son usage). En cas de refus,
 * l'export JSON des Réglages reste la sauvegarde de secours.
 */
export type EtatPersistance = 'accorde' | 'refuse' | 'indisponible'

function apiStockage(): StorageManager | undefined {
  return typeof navigator !== 'undefined' && 'storage' in navigator ? navigator.storage : undefined
}

export async function demanderStockagePersistant(): Promise<EtatPersistance> {
  const stockage = apiStockage()
  if (!stockage || typeof stockage.persist !== 'function') return 'indisponible'
  try {
    if (await stockage.persisted()) return 'accorde'
    return (await stockage.persist()) ? 'accorde' : 'refuse'
  } catch {
    return 'indisponible'
  }
}

export async function lireEtatPersistance(): Promise<EtatPersistance> {
  const stockage = apiStockage()
  if (!stockage || typeof stockage.persisted !== 'function') return 'indisponible'
  try {
    return (await stockage.persisted()) ? 'accorde' : 'refuse'
  } catch {
    return 'indisponible'
  }
}
