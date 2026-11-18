/**
 * Cas d'école : la liste (chaque cas s'ouvre avec ses modules) et l'écran d'un cas.
 */
import type { JSX } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useEtatProgression, useProfil } from '../../app/donnees.ts'
import { casDuMetier, casParId, estIdCas, type IdCas } from '../../content/cas.ts'
import { infoModule } from '../../content/catalogue.ts'
import { casOuvert } from '../../progression/regles.ts'
import { METIERS, metierDe, type IdMetier } from '../../profils/metiers.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { CasAbondement, CasHeritage, CasPeaOuPer, CasPremierSalaire } from './CasFinances.tsx'
import { CasConseilVue } from './CasConseil.tsx'
import { CasAffectationLoin, CasHorsClasse, CasPremierTraitement, CasTempsPartiel } from './CasProf.tsx'
import { CasLouerAcheter } from './CasImmobilier.tsx'
import { CasFrais, CasInvestir2007, CasMars2020 } from './CasMarches.tsx'

const COMPOSANTS: Partial<Record<IdCas, () => JSX.Element>> = {
  'premier-salaire': CasPremierSalaire,
  'pea-ou-per': CasPeaOuPer,
  abondement: CasAbondement,
  'investir-2007': CasInvestir2007,
  'mars-2020': CasMars2020,
  frais: CasFrais,
  heritage: CasHeritage,
  'louer-ou-acheter': CasLouerAcheter,
  'conseil-premier-client': () => <CasConseilVue id="conseil-premier-client" />,
  'conseil-transmission': () => <CasConseilVue id="conseil-transmission" />,
  'conseil-ifi': () => <CasConseilVue id="conseil-ifi" />,
  'conseil-levier': () => <CasConseilVue id="conseil-levier" />,
  'premier-traitement': CasPremierTraitement,
  'affectation-loin': CasAffectationLoin,
  'temps-partiel': CasTempsPartiel,
  'hors-classe': CasHorsClasse,
}

function nomsModules(modules: readonly number[], metier: IdMetier): string {
  return modules
    .map((id) => {
      const m = infoModule(id, metier)
      return m ? `module ${id} · ${m.titre}` : `module ${id}`
    })
    .join(', ')
}

export function EcranListeCas() {
  const etat = useEtatProgression()
  const profil = useProfil()
  const termines = profil?.casTermines ?? []
  const metier = etat?.metier ?? metierDe(profil)
  return (
    <>
      <EnTete titre="Cas d’école" sousTitre="Une question précise, un débrief." retour />
      <main className="ecran apparition">
        <p className="carte__texte">
          Des scénarios courts, chacun corrigé par un débrief qui renvoie au module concerné. Un cas s’ouvre quand ses
          modules sont terminés ; les cas de conseil client, avec le palier Professionnel de leurs modules.
        </p>
        <div className="choix-liste">
          {casDuMetier(metier).map((cas) => {
            const ouvert = cas.disponible && etat !== undefined && casOuvert(etat, cas.modules, cas.palier)
            const fait = termines.includes(cas.id)
            const contenu = (
              <>
                <span className="choix__texte">
                  <span className="choix__titre">
                    {cas.titre}
                    {fait ? <span className="etiquette etiquette--nouveau cas__fait">Fait</span> : null}
                  </span>
                  <span className="texte-secondaire">{cas.question}</span>
                  {!ouvert ? (
                    <span className="texte-secondaire">
                      <Icone nom="cadenas" taille={12} /> {cas.aVenir ??
                        ((cas.palier ?? 1) >= 5
                          ? `Avec le palier Professionnel : ${nomsModules(cas.modules, metier)}`
                          : `Avec le ${nomsModules(cas.modules, metier)}`)}
                    </span>
                  ) : null}
                </span>
                {ouvert ? <Icone nom="suivant" taille={18} epaisseur={2} /> : null}
              </>
            )
            return ouvert ? (
              <Link key={cas.id} to={`/cas/${cas.id}`} className="choix">
                {contenu}
              </Link>
            ) : (
              <div key={cas.id} className="choix choix--verrouille" aria-disabled="true">
                {contenu}
              </div>
            )
          })}
        </div>
      </main>
    </>
  )
}

export function EcranUnCas() {
  const { id } = useParams()
  const etat = useEtatProgression()
  if (!estIdCas(id)) return <Navigate to="/cas" replace />
  const cas = casParId(id)
  const Composant = COMPOSANTS[id]
  if (etat === undefined) return null
  const duProfil = METIERS[etat.metier].cas.includes(id)
  if (!Composant || !duProfil || !cas.disponible || !casOuvert(etat, cas.modules, cas.palier)) {
    return <Navigate to="/cas" replace />
  }
  return (
    <>
      <EnTete titre={cas.titre} sousTitre={cas.question} retour />
      <main className="ecran apparition">
        <Composant />
      </main>
    </>
  )
}

/** Lien vers les cas d'école, affiché dans l'onglet Carrière. */
export function LienCasEcole() {
  const etat = useEtatProgression()
  const ouverts = etat
    ? casDuMetier(etat.metier).filter((c) => c.disponible && casOuvert(etat, c.modules, c.palier)).length
    : 0
  return (
    <Link to="/cas" className="choix">
      <span className="choix__icone">
        <Icone nom="livre" taille={20} />
      </span>
      <span className="choix__texte">
        <span className="choix__titre">Cas d’école</span>
        <span className="texte-secondaire">
          {ouverts > 0
            ? `${ouverts} scénario${ouverts > 1 ? 's' : ''} court${ouverts > 1 ? 's' : ''} ouvert${ouverts > 1 ? 's' : ''}, avec un débrief.`
            : 'Des scénarios courts, qui s’ouvrent avec les modules.'}
        </span>
      </span>
      <Icone nom="suivant" taille={18} epaisseur={2} />
    </Link>
  )
}
