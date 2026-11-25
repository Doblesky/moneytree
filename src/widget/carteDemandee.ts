/** Carte demandée par le widget (« ?carte=2 » dans la route du palier), ou null si absente ou invalide. */
export function carteDemandee(recherche: string, nbCartes: number): number | null {
  const valeur = new URLSearchParams(recherche).get('carte')
  if (valeur === null || !/^\d+$/.test(valeur)) return null
  const rang = Number(valeur)
  return rang < nbCartes ? rang : null
}
