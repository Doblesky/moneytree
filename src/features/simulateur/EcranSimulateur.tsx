/** Simulateur (bac à sable) : crée une partie ou reprend la partie enregistrée. */
import { useEffect } from 'react'
import { usePartieEnregistree } from '../../app/donnees.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { NouvellePartie } from './NouvellePartie.tsx'
import { Partie } from './Partie.tsx'

export function EcranSimulateur() {
  const enregistree = usePartieEnregistree()

  useEffect(() => {
    document.title = 'Simulateur · MoneyTree'
  }, [])

  if (enregistree === undefined) {
    return <EnTete titre="Simulateur" sousTitre="Ton bac à sable, mois après mois." />
  }
  if (enregistree === null) return <NouvellePartie />
  return <Partie contenu={enregistree} />
}
