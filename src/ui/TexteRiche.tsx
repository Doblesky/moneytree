import { Fragment, useMemo } from 'react'
import { analyserTexte, type Segment } from '../content/texte.ts'
import { parametres2026 } from '../data/params/index.ts'
import { faitsHistoriques } from '../engine/marches.ts'
import { Terme } from './glossaire.tsx'

function Segments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === 'gras') {
          return (
            <strong key={i}>
              <Segments segments={s.segments} />
            </strong>
          )
        }
        if (s.type === 'glossaire') {
          return (
            <Terme key={i} cle={s.cle}>
              {s.texte}
            </Terme>
          )
        }
        return <Fragment key={i}>{s.texte}</Fragment>
      })}
    </>
  )
}

/** Texte de cours : valeurs officielles, chiffres historiques, glossaire, gras et puces. */
export function TexteRiche({ texte, className }: { texte: string; className?: string }) {
  const blocs = useMemo(() => analyserTexte(texte, parametres2026(), faitsHistoriques()), [texte])
  return (
    <div className={`texte-riche ${className ?? ''}`}>
      {blocs.map((bloc, i) =>
        bloc.type === 'paragraphe' ? (
          <p key={i}>
            <Segments segments={bloc.segments} />
          </p>
        ) : (
          <ul key={i}>
            {bloc.elements.map((element, j) => (
              <li key={j}>
                <Segments segments={element} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}

/** Variante sur une ligne (énoncés, choix de réponse) : pas de paragraphes. */
export function TexteEnLigne({ texte }: { texte: string }) {
  const blocs = useMemo(() => analyserTexte(texte, parametres2026(), faitsHistoriques()), [texte])
  return (
    <>
      {blocs.map((bloc, i) =>
        bloc.type === 'paragraphe' ? <Segments key={i} segments={bloc.segments} /> : null,
      )}
    </>
  )
}
