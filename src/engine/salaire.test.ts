import { describe, expect, it } from 'vitest'
import { parametres2026 } from '../data/params/index.ts'
import { brutVersNet, netMensuelVersBrutAnnuel } from './salaire.ts'

const points = parametres2026()['cotisations.salarieCadre'].valeur

/**
 * Cas calculés avec l'API publique du simulateur officiel « Salaire brut / net » de
 * l'Urssaf (https://mon-entreprise.urssaf.fr/simulateurs/salaire-brut-net), le 17/11/2026,
 * statut cadre, autres réglages par défaut. Ces deux bruts ne font pas partie des points
 * de calage du fichier de paramètres : ils testent l'interpolation.
 */
const CAS_URSSAF = [
  { brutAnnuel: 39000, netAvantImpotMensuel: 2545.24, netImposableMensuel: 2708.59 },
  { brutAnnuel: 46000, netAvantImpotMensuel: 3006.02, netImposableMensuel: 3194.99 },
]

describe('brut → net cadre : cas du simulateur officiel de l’Urssaf (17/11/2026)', () => {
  it.each(CAS_URSSAF)('$brutAnnuel € brut par an', (cas) => {
    const s = brutVersNet(cas.brutAnnuel, points)
    // Approximation par un taux moyen interpolé : écart toléré de 0,1 %.
    expect(Math.abs(s.netAvantImpot / 12 - cas.netAvantImpotMensuel)).toBeLessThan(
      cas.netAvantImpotMensuel * 0.001,
    )
    expect(Math.abs(s.netImposable / 12 - cas.netImposableMensuel)).toBeLessThan(
      cas.netImposableMensuel * 0.001,
    )
  })

  it('retrouve exactement les points de calage', () => {
    for (const point of points) {
      const s = brutVersNet(point.brutAnnuel, points)
      expect(s.netAvantImpot).toBeCloseTo(point.netAvantImpotAnnuel, 6)
      expect(s.netImposable).toBeCloseTo(point.netImposableAnnuel, 6)
    }
  })

  it('garde un taux constant au-delà des points extrêmes et refuse un brut invalide', () => {
    const premier = points[0]
    if (!premier) throw new Error('aucun point')
    const s = brutVersNet(premier.brutAnnuel / 2, points)
    expect(s.netAvantImpot / s.brut).toBeCloseTo(premier.netAvantImpotAnnuel / premier.brutAnnuel, 10)
    expect(() => brutVersNet(-1, points)).toThrow(RangeError)
  })

  it('retrouve le brut à partir du net mensuel', () => {
    const brut = netMensuelVersBrutAnnuel(brutVersNet(42000, points).netAvantImpot / 12, points)
    expect(brut).toBeCloseTo(42000, 2)
  })
})
