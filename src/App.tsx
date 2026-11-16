import { RouterProvider } from 'react-router/dom'
import { routeur } from './app/routeur.tsx'

export function App() {
  return <RouterProvider router={routeur} />
}
