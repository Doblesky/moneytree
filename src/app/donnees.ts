/** Lectures réactives de la base locale : l'écran se met à jour dès qu'une donnée change. */
import { useLiveQuery } from 'dexie-react-hooks'
import type { EntreeLeitner } from '../progression/leitner.ts'
import type { EtatProgression } from '../progression/regles.ts'
import { lireEtatProgression } from '../storage/apprentissage.ts'
import { db, type ContenuSauvegarde, type Journee, type Profil } from '../storage/db.ts'
import { lirePartie } from '../storage/partie.ts'
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

/** La partie enregistrée ; `null` s'il n'y en a pas, `undefined` pendant la lecture. */
export function usePartieEnregistree(): ContenuSauvegarde | null | undefined {
  return useLiveQuery(() => lirePartie())
}
