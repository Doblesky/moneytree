import { Outlet, ScrollRestoration } from 'react-router'
import { BarreNavigation } from '../ui/BarreNavigation.tsx'

/** Coque commune à tous les écrans : contenu de la route + barre de navigation basse. */
export function Coque() {
  return (
    <div className="appli">
      <Outlet />
      <BarreNavigation />
      <ScrollRestoration />
    </div>
  )
}
