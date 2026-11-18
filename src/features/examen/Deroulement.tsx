/**
 * Déroulement commun aux examens (validation d'un palier, examen blanc) : les questions
 * s'enchaînent sans correction, puis la correction complète s'affiche à la fin.
 */
import { useRef, useState } from 'react'
import { origine } from '../../content/catalogue.ts'
import type { Question as TypeQuestion } from '../../content/schema.ts'
import { remplacerValeurs } from '../../content/texte.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { faitsHistoriques } from '../../engine/marches.ts'
import { formatNombre } from '../../lib/format.ts'
import { Icone } from '../../ui/Icone.tsx'
import { TexteEnLigne, TexteRiche } from '../../ui/TexteRiche.tsx'
import { EnTeteQuiz } from '../cours/EcranPalier.tsx'
import { Question } from '../quiz/Question.tsx'

export interface ReponseExamen {
  question: TypeQuestion
  juste: boolean
  donnee: string
}

export function Deroulement({
  titre,
  questions,
  onQuitter,
  onFini,
}: {
  titre: string
  questions: readonly TypeQuestion[]
  onQuitter: () => void
  onFini: (reponses: ReponseExamen[]) => void
}) {
  const [rang, setRang] = useState(0)
  const reponses = useRef<ReponseExamen[]>([])
  const question = questions[rang]
  if (!question) return null
  const total = questions.length
  return (
    <div className="ecran-plein quiz">
      <EnTeteQuiz titre={titre} rang={rang} total={total} onFermer={onQuitter} />
      <Question
        key={`${String(rang)}-${question.id}`}
        question={question}
        rang={rang + 1}
        total={total}
        dernier={rang === total - 1}
        sansCorrection
        onRepondu={(juste, donnee) => {
          reponses.current = [...reponses.current, { question, juste, donnee }]
        }}
        onSuivante={() => {
          if (rang === total - 1) onFini(reponses.current)
          else setRang(rang + 1)
        }}
      />
    </div>
  )
}

function bonneReponse(question: TypeQuestion): string {
  const p = parametres2026()
  const f = faitsHistoriques()
  if (question.type === 'qcm') return remplacerValeurs(question.choix[question.bonne] ?? '', p, f)
  const decimales = Number.isInteger(question.reponse) ? 0 : 2
  return `${formatNombre(question.reponse, { decimales })} ${question.unite}`
}

/** Correction d'un examen : les erreurs d'abord, avec l'explication et la source. */
export function Correction({ reponses }: { reponses: readonly ReponseExamen[] }) {
  const ordonnees = [...reponses.map((r, i) => ({ ...r, rang: i + 1 }))].sort((a, b) => Number(a.juste) - Number(b.juste))
  return (
    <ol className="correction">
      {ordonnees.map(({ question, juste, donnee, rang }) => {
        const { module, palier } = origine(question.id)
        return (
          <li key={`${String(rang)}-${question.id}`} className={`correction__item correction__item--${juste ? 'juste' : 'faux'}`}>
            <span className="correction__tete">
              <Icone nom={juste ? 'coche' : 'croix'} taille={16} epaisseur={2.6} />
              Question {rang} · module {module}, palier {palier}
            </span>
            <p className="correction__enonce">
              <TexteEnLigne texte={question.enonce} />
            </p>
            <p className="texte-secondaire">
              Ta réponse : <strong className="chiffres">{donnee || '—'}</strong>
              {question.type === 'calcul' ? ` ${question.unite}` : ''}
              {juste ? null : (
                <>
                  {' · '}attendu : <strong className="chiffres">{bonneReponse(question)}</strong>
                </>
              )}
            </p>
            {juste ? null : (
              <>
                <TexteRiche texte={question.explication} />
                {question.sources.length > 0 ? (
                  <p className="note-source">
                    Source :{' '}
                    {question.sources.map((s, i) => (
                      <span key={s.url}>
                        {i > 0 ? ' · ' : ''}
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.libelle}
                        </a>
                      </span>
                    ))}
                  </p>
                ) : null}
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}
