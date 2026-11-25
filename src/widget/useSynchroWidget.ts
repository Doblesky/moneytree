import { useEffect } from 'react'
import { retirerParamAbsent } from './lien.ts'
import { noterIntrouvable } from './reglage.ts'
import { synchroniserWidget } from './synchro.ts'

/**
 * Au premier appui qui suit un lancement ou un retour au premier plan, renvoie le paquet au
 * widget si besoin. Repère aussi le repli de Chrome (compagnon absent) et le retire de l'URL.
 */
export function useSynchroWidget(): void {
  useEffect(() => {
    let arme = true
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') arme = true
    }
    const surClic = () => {
      if (!arme) return
      arme = false
      void synchroniserWidget('retour')
    }
    const surFragment = () => {
      const nettoye = retirerParamAbsent(window.location.hash)
      if (nettoye === null) return
      window.history.replaceState(window.history.state, '', nettoye)
      void noterIntrouvable(new Date())
    }
    surFragment()
    document.addEventListener('visibilitychange', surVisibilite)
    document.addEventListener('click', surClic, true)
    window.addEventListener('hashchange', surFragment)
    return () => {
      document.removeEventListener('visibilitychange', surVisibilite)
      document.removeEventListener('click', surClic, true)
      window.removeEventListener('hashchange', surFragment)
    }
  }, [])
}
