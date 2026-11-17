/** Simulateur (bac à sable) : reprend la partie ouverte, ou en crée une. */
import { useEffect } from 'react'
import { usePartieActive } from '../../app/donnees.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { NouvellePartie } from './NouvellePartie.tsx'
import { Partie } from './Partie.tsx'

export function EcranSimulateur() {
  const active = usePartieActive()

  useEffect(() => {
    document.title = 'Simulateur · MoneyTree'
  }, [])

  if (active === undefined) {
    return <EnTete titre="Simulateur" sousTitre="Ton bac à sable, mois après mois." />
  }
  if (active === null) return <NouvellePartie />
  // La clé recrée la partie quand on en ouvre une autre.
  return <Partie key={active.id} id={active.id} nom={active.nom} contenu={active.contenu} />
}
