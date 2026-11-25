import { Outlet, ScrollRestoration } from 'react-router'
import { BarreNavigation } from '../ui/BarreNavigation.tsx'
import { FournisseurGlossaire } from '../ui/glossaire.tsx'
import { useSynchroWidget } from '../widget/useSynchroWidget.ts'

/** Coque commune aux écrans principaux : contenu de la route + barre de navigation basse. */
export function Coque() {
  return (
    <div className="appli">
      <Outlet />
      <BarreNavigation />
      <ScrollRestoration />
    </div>
  )
}

/** Écrans plein écran (sans barre de navigation) : introduction, cours, quiz, déblocage. */
export function PleinEcran() {
  return (
    <div className="appli appli--plein-ecran">
      <Outlet />
      <ScrollRestoration />
    </div>
  )
}

/** Racine : le glossaire est accessible depuis tous les écrans ; le widget se met à jour depuis chacun. */
export function Racine() {
  useSynchroWidget()
  return (
    <FournisseurGlossaire>
      <Outlet />
    </FournisseurGlossaire>
  )
}
