import { useEffect, useState } from 'react'
import type { OptionsProjection, ResultatProjection } from '../engine/projection.ts'

/** Lance une projection Monte Carlo dans un Web Worker et renvoie son résultat. */
export function useProjection(options: OptionsProjection | null): ResultatProjection | null {
  const [resultat, setResultat] = useState<ResultatProjection | null>(null)

  useEffect(() => {
    if (!options) return
    const travailleur = new Worker(new URL('../engine/projection.worker.ts', import.meta.url), {
      type: 'module',
    })
    travailleur.onmessage = (evenement: MessageEvent<ResultatProjection>) => {
      setResultat(evenement.data)
      travailleur.terminate()
    }
    travailleur.postMessage(options)
    return () => {
      travailleur.terminate()
    }
  }, [options])

  return resultat
}
