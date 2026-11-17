/**
 * Web Worker du Monte Carlo de la partie : projette la stratégie en cours sur des
 * trajectoires tirées dans l'historique, sans figer l'interface.
 */
import { parametres2026 } from '../data/params/index.ts'
import { projeterStrategie, type EtatPartie } from './simulation.ts'

interface Demande {
  etat: EtatPartie
  trajectoires: number
  horizonMois: number
  graine: number
}

self.onmessage = (evenement: MessageEvent<Demande>) => {
  const { etat, ...options } = evenement.data
  self.postMessage(projeterStrategie(etat, parametres2026(), options))
}
