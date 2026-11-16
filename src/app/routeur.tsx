import { createHashRouter, Navigate } from 'react-router'
import { EcranAccueil } from '../features/accueil/EcranAccueil.tsx'
import { EcranCarriere } from '../features/carriere/EcranCarriere.tsx'
import { EcranParcours } from '../features/parcours/EcranParcours.tsx'
import { EcranReglages } from '../features/reglages/EcranReglages.tsx'
import { EcranSimulateur } from '../features/simulateur/EcranSimulateur.tsx'
import { Coque } from './Coque.tsx'

/**
 * Routage en mode hash (« /#/parcours ») : l'URL réelle reste toujours index.html, ce qui
 * fonctionne sur n'importe quel hébergement statique (GitHub Pages compris) sans règle de
 * réécriture, et hors ligne avec le service worker.
 */
export const routeur = createHashRouter([
  {
    element: <Coque />,
    children: [
      { index: true, element: <EcranAccueil /> },
      { path: 'parcours', element: <EcranParcours /> },
      { path: 'simulateur', element: <EcranSimulateur /> },
      { path: 'carriere', element: <EcranCarriere /> },
      { path: 'reglages', element: <EcranReglages /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
