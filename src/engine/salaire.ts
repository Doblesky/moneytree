/**
 * Salaire brut → net d'un cadre. Les cotisations sont approchées par un taux moyen
 * (limite assumée par le cahier des charges), calé sur le simulateur officiel de l'Urssaf :
 * le fichier de paramètres donne, pour plusieurs bruts annuels, le net avant impôt et le
 * net imposable calculés par mon-entreprise.urssaf.fr. Entre deux points, le rapport
 * net / brut est interpolé linéairement ; au-delà des extrémités, il reste constant.
 */
import type { PointBrutNet } from '../data/params/schema.ts'

export interface SalaireAnnuel {
  brut: number
  /** Net à payer avant impôt sur le revenu. */
  netAvantImpot: number
  /** Net imposable : base du prélèvement à la source et de la déclaration. */
  netImposable: number
  /** Cotisations et contributions salariales (brut − net avant impôt). */
  cotisations: number
}

function rapports(brut: number, points: readonly PointBrutNet[]): { net: number; imposable: number } {
  const premier = points[0]
  const dernier = points.at(-1)
  if (!premier || !dernier) throw new Error('Points de calage brut → net manquants')
  const rapport = (p: PointBrutNet) => ({
    net: p.netAvantImpotAnnuel / p.brutAnnuel,
    imposable: p.netImposableAnnuel / p.brutAnnuel,
  })
  if (brut <= premier.brutAnnuel) return rapport(premier)
  if (brut >= dernier.brutAnnuel) return rapport(dernier)
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a && b && brut <= b.brutAnnuel) {
      const t = (brut - a.brutAnnuel) / (b.brutAnnuel - a.brutAnnuel)
      const ra = rapport(a)
      const rb = rapport(b)
      return {
        net: ra.net + t * (rb.net - ra.net),
        imposable: ra.imposable + t * (rb.imposable - ra.imposable),
      }
    }
  }
  return rapport(dernier)
}

export function brutVersNet(brutAnnuel: number, points: readonly PointBrutNet[]): SalaireAnnuel {
  if (!Number.isFinite(brutAnnuel) || brutAnnuel < 0) {
    throw new RangeError(`Salaire brut invalide : ${brutAnnuel}`)
  }
  const r = rapports(brutAnnuel, points)
  const netAvantImpot = brutAnnuel * r.net
  return {
    brut: brutAnnuel,
    netAvantImpot,
    netImposable: brutAnnuel * r.imposable,
    cotisations: brutAnnuel - netAvantImpot,
  }
}

/** Brut annuel qui donne ce net mensuel avant impôt (recherche par dichotomie). */
export function netMensuelVersBrutAnnuel(netMensuel: number, points: readonly PointBrutNet[]): number {
  if (!Number.isFinite(netMensuel) || netMensuel <= 0) {
    throw new RangeError(`Salaire net invalide : ${netMensuel}`)
  }
  const cible = netMensuel * 12
  let bas = cible
  let haut = cible * 2
  for (let i = 0; i < 60; i++) {
    const milieu = (bas + haut) / 2
    if (brutVersNet(milieu, points).netAvantImpot < cible) bas = milieu
    else haut = milieu
  }
  return (bas + haut) / 2
}
