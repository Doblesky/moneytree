import { Outlet, ScrollRestoration } from 'react-router'
import { BarreNavigation } from '../ui/BarreNavigation.tsx'
import { FournisseurGlossaire } from '../ui/glossaire.tsx'

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

/** Racine : le glossaire est accessible depuis tous les écrans. */
export function Racine() {
  return (
    <FournisseurGlossaire>
      <Outlet />
    </FournisseurGlossaire>
  )
}
