/** Lectures réactives de la base locale : l'écran se met à jour dès qu'une donnée change. */
import { useLiveQuery } from 'dexie-react-hooks'
import type { EntreeLeitner } from '../progression/leitner.ts'
import type { EtatProgression } from '../progression/regles.ts'
import { lireEtatProgression } from '../storage/apprentissage.ts'
import { db, type Journee, type Profil } from '../storage/db.ts'
import { lireCarriereActive, listerCarrieres, type ResumeCarriere } from '../storage/carriere.ts'
import { lirePartieActive, listerParties, type ResumePartie } from '../storage/partie.ts'
import { lireProfil } from '../storage/profil.ts'

export function useProfil(): Profil | undefined {
  return useLiveQuery(() => lireProfil())
}

export function useEtatProgression(): EtatProgression | undefined {
  return useLiveQuery(() => lireEtatProgression())
}

export function useJournees(): Journee[] | undefined {
  return useLiveQuery(() => db.journees.toArray())
}

export function useReponses(): EntreeLeitner[] | undefined {
  return useLiveQuery(() => db.reponses.toArray())
}

/** La partie ouverte ; `null` s'il n'y en a pas, `undefined` pendant la lecture. */
export function usePartieActive(): Awaited<ReturnType<typeof lirePartieActive>> | undefined {
  return useLiveQuery(() => lirePartieActive())
}

export function useParties(): ResumePartie[] | undefined {
  return useLiveQuery(() => listerParties())
}

/** Carrière ouverte en dernier ; null s'il n'y en a pas, undefined pendant le chargement. */
export function useCarriereActive(): ResumeCarriere | null | undefined {
  return useLiveQuery(() => lireCarriereActive())
}

export function useCarrieres(): ResumeCarriere[] | undefined {
  return useLiveQuery(() => listerCarrieres())
}
