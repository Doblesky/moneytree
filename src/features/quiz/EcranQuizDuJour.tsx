/**
 * Quiz du jour : trois questions tirées de la répétition espacée (questions ratées et à
 * revoir d'abord), puis la série de jours de la semaine.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useEtatProgression, useJournees, useReponses } from '../../app/donnees.ts'
import { questionParId } from '../../content/catalogue.ts'
import { melangerChoix } from '../../progression/examens.ts'
import { semaine, serieDeJours } from '../../progression/gamification.ts'
import { jourLocal, questionsDuJour, type EntreeLeitner } from '../../progression/leitner.ts'
import type { EtatProgression } from '../../progression/regles.ts'
import { questionsDisponibles, terminerQuizDuJour, type ReponseQuiz } from '../../storage/apprentissage.ts'
import { Icone } from '../../ui/Icone.tsx'
import { JetonXP } from '../../ui/JetonXP.tsx'
import { EnTeteQuiz } from '../cours/EcranPalier.tsx'
import { Question } from './Question.tsx'

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function melanger<T>(tableau: T[]): T[] {
  const copie = [...tableau]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = copie[i]
    const b = copie[j]
    if (a !== undefined && b !== undefined) {
      copie[i] = b
      copie[j] = a
    }
  }
  return copie
}

export function EcranQuizDuJour() {
  const etat = useEtatProgression()
  const entrees = useReponses()

  useEffect(() => {
    document.title = 'Quiz du jour · MoneyTree'
  }, [])

  // Les questions se tirent une seule fois, quand les données sont lues.
  if (!etat || !entrees) return null
  return <Quiz etat={etat} entrees={entrees} />
}

function Quiz({ etat, entrees }: { etat: EtatProgression; entrees: EntreeLeitner[] }) {
  const naviguer = useNavigate()
  const journees = useJournees()
  const aujourdhui = jourLocal()
  const [ids] = useState(() => questionsDuJour(entrees, questionsDisponibles(etat), aujourdhui, 3, melanger))
  // Choix mélangés une fois pour toutes : la bonne réponse ne tient pas à sa place dans la liste.
  const [questions] = useState(() =>
    ids.flatMap((id) => {
      const q = questionParId(id)
      return q ? [melangerChoix(q, Math.random)] : []
    }),
  )
  const [rang, setRang] = useState(0)
  const [fin, setFin] = useState<{ xp: number; justes: number } | null>(null)
  const reponses = useRef<ReponseQuiz[]>([])

  const serie = useMemo(() => serieDeJours((journees ?? []).map((j) => j.date), aujourdhui), [journees, aujourdhui])

  if (ids.length === 0) {
    return (
      <div className="ecran-plein">
        <EnTeteQuiz titre="Quiz du jour" rang={0} total={3} onFermer={() => void naviguer('/')} />
        <main className="ecran">
          <section className="carte">
            <h1 className="carte__titre">Pas encore de questions</h1>
            <p className="carte__texte">
              Le quiz du jour reprend les questions des paliers que tu as commencés. Termine ton premier palier, et il
              t’attendra ici chaque jour.
            </p>
            <Link to="/parcours/0/1" className="bouton bouton--plein">
              Commencer le module 0
            </Link>
          </section>
        </main>
      </div>
    )
  }

  if (fin) {
    const jours = semaine([...(journees ?? []).map((j) => j.date), aujourdhui], aujourdhui)
    return (
      <div className="ecran-plein resultat sur-vert">
        <main className="resultat__contenu apparition">
          <span className="surtitre surtitre--or">Quiz du jour</span>
          <h1 className="resultat__titre">C’est fait pour aujourd’hui</h1>
          <p className="resultat__score chiffres">
            {fin.justes} / {ids.length} bonnes réponses
          </p>
          <JetonXP xp={fin.xp} />
          <div className="semaine" aria-label={`Série : ${Math.max(serie, 1)} jours`}>
            {jours.map((j, i) => (
              <span key={j.jour} className={`semaine__jour ${j.actif ? 'actif' : ''}`}>
                <span className="semaine__pastille" aria-hidden="true">
                  {j.actif ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
                </span>
                {JOURS[i]}
              </span>
            ))}
          </div>
          <p className="texte-secondaire">Les questions ratées reviendront demain ; les autres, un peu plus tard.</p>
        </main>
        <footer className="resultat__pied">
          <Link to="/" className="bouton bouton--sur-vert">
            Retour à l’accueil
          </Link>
        </footer>
      </div>
    )
  }

  const question = questions[rang]
  if (!question) return null
  return (
    <div className="ecran-plein quiz">
      <EnTeteQuiz titre="Quiz du jour" rang={rang} total={ids.length} serie={serie} onFermer={() => void naviguer('/')} />
      <Question
        key={question.id}
        question={question}
        rang={rang + 1}
        total={ids.length}
        dernier={rang === ids.length - 1}
        onRepondu={(juste) => {
          reponses.current = [...reponses.current, { questionId: question.id, juste, type: question.type }]
        }}
        onSuivante={() => {
          if (rang < ids.length - 1) {
            setRang(rang + 1)
            return
          }
          void terminerQuizDuJour(reponses.current).then(({ xpGagne }) => {
            setFin({ xp: xpGagne, justes: reponses.current.filter((r) => r.juste).length })
          })
        }}
      />
    </div>
  )
}
