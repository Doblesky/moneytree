import { createContext, use } from 'react'

export interface ContexteGlossaire {
  ouvrir: (cle: string) => void
}

export const Contexte = createContext<ContexteGlossaire>({ ouvrir: () => undefined })

/** Ouvre une fiche du glossaire depuis n'importe quel écran. */
export function useGlossaire(): ContexteGlossaire {
  return use(Contexte)
}
