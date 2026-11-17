import { createHashRouter, Navigate } from 'react-router'
import { EcranAccueil } from '../features/accueil/EcranAccueil.tsx'
import { EcranCarriere } from '../features/carriere/EcranCarriere.tsx'
import { EcranPalier } from '../features/cours/EcranPalier.tsx'
import { EcranDeblocage } from '../features/deblocage/EcranDeblocage.tsx'
import { EcranGlossaire } from '../features/glossaire/EcranGlossaire.tsx'
import { EcranLancement } from '../features/lancement/EcranLancement.tsx'
import { EcranParcours } from '../features/parcours/EcranParcours.tsx'
import { EcranProgres } from '../features/progres/EcranProgres.tsx'
import { EcranQuizDuJour } from '../features/quiz/EcranQuizDuJour.tsx'
import { EcranReglages } from '../features/reglages/EcranReglages.tsx'
import { EcranComparer } from '../features/simulateur/EcranComparer.tsx'
import { EcranParties } from '../features/simulateur/EcranParties.tsx'
import { EcranSimulateur } from '../features/simulateur/EcranSimulateur.tsx'
import { NouvellePartie } from '../features/simulateur/NouvellePartie.tsx'
import { Coque, PleinEcran, Racine } from './Coque.tsx'

/**
 * Routage en mode hash (« /#/parcours ») : l'URL réelle reste toujours index.html, ce qui
 * fonctionne sur n'importe quel hébergement statique (GitHub Pages compris) sans règle de
 * réécriture, et hors ligne avec le service worker.
 */
export const routeur = createHashRouter([
  {
    element: <Racine />,
    children: [
      {
        element: <PleinEcran />,
        children: [
          { path: 'bienvenue', element: <EcranLancement /> },
          { path: 'parcours/:module/:palier', element: <EcranPalier /> },
          { path: 'quiz-du-jour', element: <EcranQuizDuJour /> },
          { path: 'deblocage/:module', element: <EcranDeblocage /> },
        ],
      },
      {
        element: <Coque />,
        children: [
          { index: true, element: <EcranAccueil /> },
          { path: 'parcours', element: <EcranParcours /> },
          { path: 'simulateur', element: <EcranSimulateur /> },
          { path: 'simulateur/nouvelle', element: <NouvellePartie /> },
          { path: 'simulateur/parties', element: <EcranParties /> },
          { path: 'simulateur/comparer/:a/:b', element: <EcranComparer /> },
          { path: 'carriere', element: <EcranCarriere /> },
          { path: 'reglages', element: <EcranReglages /> },
          { path: 'glossaire', element: <EcranGlossaire /> },
          { path: 'progres', element: <EcranProgres /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
