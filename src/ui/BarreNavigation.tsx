import { NavLink } from 'react-router'
import { Icone, type NomIcone } from './Icone.tsx'

const DESTINATIONS: { chemin: string; libelle: string; icone: NomIcone; epaisseur: number }[] = [
  { chemin: '/', libelle: 'Accueil', icone: 'accueil', epaisseur: 1.8 },
  { chemin: '/parcours', libelle: 'Parcours', icone: 'parcours', epaisseur: 2.1 },
  { chemin: '/simulateur', libelle: 'Simulateur', icone: 'simulateur', epaisseur: 1.8 },
  { chemin: '/carriere', libelle: 'Carrière', icone: 'carriere', epaisseur: 1.8 },
]

/** Barre basse à quatre destinations, comme dans les maquettes. */
export function BarreNavigation() {
  return (
    <nav className="barre-nav" aria-label="Navigation principale">
      {DESTINATIONS.map(({ chemin, libelle, icone, epaisseur }) => (
        <NavLink key={chemin} to={chemin} end className="barre-nav__lien">
          <span className="barre-nav__pastille">
            <Icone nom={icone} epaisseur={epaisseur} />
          </span>
          <span className="barre-nav__libelle">{libelle}</span>
        </NavLink>
      ))}
    </nav>
  )
}
