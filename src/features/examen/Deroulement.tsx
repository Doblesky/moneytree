/**
 * Déroulement commun aux examens (validation d'un palier, examen blanc) : les questions
 * s'enchaînent sans correction, puis la correction complète s'affiche à la fin.
 */
import { useEffect, useRef, useState } from 'react'
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

function formatDuree(secondes: number): string {
  const m = Math.floor(secondes / 60)
  const s = secondes % 60
  return `${String(m)} min ${String(s).padStart(2, '0')}`
}

export function Deroulement({
  titre,
  questions,
  onQuitter,
  onFini,
  dureeSecondes,
}: {
  titre: string
  questions: readonly TypeQuestion[]
  onQuitter: () => void
  onFini: (reponses: ReponseExamen[]) => void
  /** Temps imparti : à zéro, l'examen s'arrête et les questions sans réponse sont fausses. */
  dureeSecondes?: number
}) {
  const [rang, setRang] = useState(0)
  const reponses = useRef<ReponseExamen[]>([])
  const [restant, setRestant] = useState(dureeSecondes ?? 0)
  const fini = useRef(false)
  // Dernières valeurs des props, lues par la minuterie sans la relancer à chaque rendu.
  const rappel = useRef({ onFini, questions })
  useEffect(() => {
    rappel.current = { onFini, questions }
  })

  useEffect(() => {
    if (dureeSecondes === undefined) return
    const debut = Date.now()
    const minuterie = window.setInterval(() => {
      const r = Math.max(0, dureeSecondes - Math.floor((Date.now() - debut) / 1000))
      setRestant(r)
      if (r === 0 && !fini.current) {
        fini.current = true
        window.clearInterval(minuterie)
        const repondues = new Set(reponses.current.map((x) => x.question.id))
        rappel.current.onFini([
          ...reponses.current,
          ...rappel.current.questions
            .filter((q) => !repondues.has(q.id))
            .map((q) => ({ question: q, juste: false, donnee: '' })),
        ])
      }
    }, 1000)
    return () => {
      window.clearInterval(minuterie)
    }
  }, [dureeSecondes])

  const question = questions[rang]
  if (!question) return null
  const total = questions.length
  return (
    <div className="ecran-plein quiz">
      <EnTeteQuiz
        titre={dureeSecondes === undefined ? titre : `${titre} · ${formatDuree(restant)}`}
        rang={rang}
        total={total}
        onFermer={onQuitter}
      />
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
          if (rang === total - 1) {
            if (fini.current) return
            fini.current = true
            onFini(reponses.current)
          } else setRang(rang + 1)
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
        const issueDuCours = /^m\d-p\d/.test(question.id)
        const { module, palier } = origine(question.id)
        return (
          <li key={`${String(rang)}-${question.id}`} className={`correction__item correction__item--${juste ? 'juste' : 'faux'}`}>
            <span className="correction__tete">
              <Icone nom={juste ? 'coche' : 'croix'} taille={16} epaisseur={2.6} />
              Question {rang}
              {issueDuCours ? ` · module ${String(module)}, palier ${String(palier)}` : ''}
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
