/**
 * Web Worker du Monte Carlo : les trajectoires se calculent hors du fil principal, sans
 * figer l'interface (cahier des charges, « Architecture technique »).
 */
import { projeterVersements, type OptionsProjection } from './projection.ts'

self.onmessage = (evenement: MessageEvent<OptionsProjection>) => {
  self.postMessage(projeterVersements(evenement.data))
}
