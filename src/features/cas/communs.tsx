/**
 * Pièces communes aux cas d'école : sources, bouton du débrief et bloc de débrief qui renvoie
 * vers les modules concernés.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useProfil } from '../../app/donnees.ts'
import { infoModule } from '../../content/catalogue.ts'
import { metierDe } from '../../profils/metiers.ts'
import type { Source } from '../../content/schema.ts'
import { terminerCas } from '../../storage/profil.ts'


export function ListeSources({ sources }: { sources: readonly Source[] }) {
  if (sources.length === 0) return null
  return (
    <p className="note-source">
      {sources.length > 1 ? 'Sources' : 'Source'} :{' '}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 ? ' · ' : ''}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.libelle}
          </a>
        </span>
      ))}
    </p>
  )
}

export function BoutonDebrief({ id, onVoir, desactive = false }: { id: string; onVoir: () => void; desactive?: boolean }) {
  return (
    <button
      type="button"
      className="bouton bouton--plein"
      disabled={desactive}
      onClick={() => {
        onVoir()
        void terminerCas(id)
      }}
    >
      Voir le débrief
    </button>
  )
}

export function Debrief({
  titre,
  modules,
  sources,
  children,
}: {
  titre: string
  modules: readonly number[]
  sources: readonly Source[]
  children: ReactNode
}) {
  const metier = metierDe(useProfil())
  return (
    <section className="carte carte--debrief apparition" aria-labelledby="debrief">
      <span className="surtitre">Débrief</span>
      <h2 id="debrief" className="carte__titre">
        {titre}
      </h2>
      {children}
      <ListeSources sources={sources} />
      <div className="debrief__modules">
        {modules.map((id) => {
          const module = infoModule(id, metier)
          return (
            <Link key={id} to="/parcours" className="lien-tertiaire">
              Revoir le module {id}
              {module ? ` · ${module.titre}` : ''}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/** Mise en situation d'un cas : le contexte, puis la décision du joueur. */
export function MiseEnSituation({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="carte" aria-labelledby="situation">
      <span className="surtitre">Ta décision</span>
      <h2 id="situation" className="carte__titre">
        {titre}
      </h2>
      {children}
    </section>
  )
}
