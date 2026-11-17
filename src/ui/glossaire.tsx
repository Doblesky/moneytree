/**
 * Glossaire commun aux cours et au simulateur : un mot souligné en pointillé ouvre la même
 * feuille, depuis n'importe quel écran (planche, « Étiquettes et glossaire »).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { GLOSSAIRE } from '../content/catalogue.ts'
import { Contexte, useGlossaire } from './contexteGlossaire.ts'
import { Icone } from './Icone.tsx'

export function FournisseurGlossaire({ children }: { children: ReactNode }) {
  const [cle, setCle] = useState<string | null>(null)
  const ouvrir = useCallback((nouvelle: string) => {
    setCle(nouvelle)
  }, [])
  const valeur = useMemo(() => ({ ouvrir }), [ouvrir])
  return (
    <Contexte value={valeur}>
      {children}
      {cle ? (
        <FeuilleGlossaire
          cle={cle}
          onChanger={setCle}
          onFermer={() => {
            setCle(null)
          }}
        />
      ) : null}
    </Contexte>
  )
}

/** Mot souligné qui ouvre sa fiche. */
export function Terme({ cle, children }: { cle: string; children: ReactNode }) {
  const { ouvrir } = useGlossaire()
  return (
    <button
      type="button"
      className="terme terme--bouton"
      onClick={() => {
        ouvrir(cle)
      }}
    >
      {children}
    </button>
  )
}

function FeuilleGlossaire({
  cle,
  onChanger,
  onFermer,
}: {
  cle: string
  onChanger: (cle: string) => void
  onFermer: () => void
}) {
  const entree = GLOSSAIRE[cle]
  const boutonFermer = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    boutonFermer.current?.focus()
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
    }
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('keydown', touche)
    }
  }, [cle, onFermer])

  if (!entree) return null
  return (
    <div className="voile" onClick={onFermer} role="presentation">
      <section
        className="feuille"
        role="dialog"
        aria-modal="true"
        aria-labelledby="glossaire-terme"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <span className="feuille__poignee" aria-hidden="true" />
        <div className="feuille__entete">
          <span className="surtitre">Glossaire</span>
          <button
            ref={boutonFermer}
            type="button"
            className="bouton-icone bouton-icone--clair"
            aria-label="Fermer le glossaire"
            onClick={onFermer}
          >
            <Icone nom="fermer" />
          </button>
        </div>
        <h2 id="glossaire-terme" className="feuille__titre">
          {entree.terme}
        </h2>
        <p>{entree.definition}</p>
        {entree.exemple ? <p className="feuille__exemple">{entree.exemple}</p> : null}
        {entree.voirAussi && entree.voirAussi.length > 0 ? (
          <div className="feuille__voir-aussi">
            <span className="texte-secondaire">Voir aussi</span>
            {entree.voirAussi.map((lien) => (
              <button
                key={lien}
                type="button"
                className="puce"
                onClick={() => {
                  onChanger(lien)
                }}
              >
                {GLOSSAIRE[lien]?.terme ?? lien}
              </button>
            ))}
          </div>
        ) : null}
        {entree.source ? (
          <a className="lien-source" href={entree.source.url} target="_blank" rel="noreferrer">
            Source : {entree.source.libelle}
          </a>
        ) : null}
        <button type="button" className="bouton bouton--contour" onClick={onFermer}>
          Revenir
        </button>
      </section>
    </div>
  )
}
