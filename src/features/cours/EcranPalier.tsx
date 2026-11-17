/**
 * Un palier d'un module : les cartes du cours (une idée par carte, glissables), puis le
 * quiz, puis le résultat. Le palier est maîtrisé à 80 % de bonnes réponses.
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useEtatProgression } from '../../app/donnees.ts'
import { MODULES, NOMS_PALIERS, palier as lirePalier } from '../../content/catalogue.ts'
import { formatPourcentage } from '../../lib/format.ts'
import { BADGES, SEUIL_MAITRISE } from '../../progression/gamification.ts'
import { palierOuvert } from '../../progression/regles.ts'
import { debloquerPalier, noterCarte, terminerQuizPalier, type ReponseQuiz, type ResultatQuiz } from '../../storage/apprentissage.ts'
import { Icone } from '../../ui/Icone.tsx'
import { JetonXP } from '../../ui/JetonXP.tsx'
import { Rosace } from '../../ui/Rosace.tsx'
import { TexteRiche } from '../../ui/TexteRiche.tsx'
import { Question } from '../quiz/Question.tsx'
import { Calculateur } from './Calculateurs.tsx'

type Phase = { type: 'cours'; carte: number } | { type: 'quiz'; rang: number } | { type: 'resultat'; resultat: ResultatQuiz }

const SEUIL_GLISSE = 60

export function EcranPalier() {
  const params = useParams()
  const moduleId = Number(params.module)
  const numero = Number(params.palier)
  const etat = useEtatProgression()
  const naviguer = useNavigate()
  const module = MODULES.find((m) => m.id === moduleId)
  const contenu = lirePalier(moduleId, numero)
  const [phaseChoisie, setPhase] = useState<Phase | null>(null)
  const reponses = useRef<ReponseQuiz[]>([])
  const debutGlisse = useRef<number | null>(null)
  const [decalage, setDecalage] = useState(0)

  useEffect(() => {
    if (module) document.title = `${module.titre} · palier ${numero} · MoneyTree`
  }, [module, numero])

  if (!module || !contenu || !Number.isInteger(numero)) return <Navigate to="/parcours" replace />
  if (!etat) return null
  // À l'ouverture, reprend à la carte mémorisée.
  const enCoursMemorise = etat.modules.find((m) => m.moduleId === moduleId)?.enCours
  const phase: Phase = phaseChoisie ?? {
    type: 'cours',
    carte: enCoursMemorise?.palier === numero ? Math.min(enCoursMemorise.carte, contenu.cartes.length - 1) : 0,
  }

  if (!palierOuvert(etat, moduleId, numero)) {
    return (
      <div className="ecran-plein">
        <EnTeteCours moduleId={moduleId} numero={numero} onFermer={() => void naviguer('/parcours')} />
        <main className="ecran">
          <section className="carte carte--verrouillee">
            <Icone nom="cadenas" />
            <div className="carte__corps">
              <h1 className="carte__titre">Palier verrouillé</h1>
              <p className="carte__texte">Il s’ouvre quand le palier précédent est maîtrisé.</p>
              <button
                type="button"
                className="lien-debloquer"
                onClick={() => {
                  void debloquerPalier(moduleId, numero)
                }}
              >
                Débloquer quand même
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  const nbCartes = contenu.cartes.length
  const nbQuestions = contenu.questions.length

  function allerCarte(i: number) {
    const borne = Math.max(0, Math.min(nbCartes - 1, i))
    setPhase({ type: 'cours', carte: borne })
    void noterCarte(moduleId, numero, borne)
  }

  function commencerQuiz() {
    reponses.current = []
    setPhase({ type: 'quiz', rang: 0 })
  }

  async function finirQuiz() {
    const resultat = await terminerQuizPalier(moduleId, numero, reponses.current)
    setPhase({ type: 'resultat', resultat })
  }

  if (phase.type === 'cours') {
    const carte = contenu.cartes[phase.carte]
    if (!carte) return null
    const derniere = phase.carte === nbCartes - 1
    const debut = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('input, button, a, select')) return
      debutGlisse.current = e.clientX
    }
    const deplacement = (e: PointerEvent) => {
      if (debutGlisse.current !== null) setDecalage(e.clientX - debutGlisse.current)
    }
    const fin = () => {
      if (debutGlisse.current === null) return
      if (decalage < -SEUIL_GLISSE && !derniere) allerCarte(phase.carte + 1)
      else if (decalage > SEUIL_GLISSE) allerCarte(phase.carte - 1)
      debutGlisse.current = null
      setDecalage(0)
    }
    return (
      <div className="ecran-plein cours">
        <EnTeteCours moduleId={moduleId} numero={numero} onFermer={() => void naviguer('/parcours')} />
        <main className="cours__pile">
          <span className="cours__carte-fantome" aria-hidden="true" />
          <article
            key={carte.id}
            className="carte-cours apparition"
            aria-labelledby={`${carte.id}-titre`}
            style={decalage ? { transform: `translateX(${decalage}px) rotate(${Math.max(-7, Math.min(7, decalage / 25))}deg)` } : undefined}
            onPointerDown={debut}
            onPointerMove={deplacement}
            onPointerUp={fin}
            onPointerCancel={fin}
          >
            <div className="carte-cours__entete">
              <span className="surtitre chiffres">
                Carte {phase.carte + 1} sur {nbCartes}
              </span>
              {carte.exempleFictif ? <span className="etiquette etiquette--fictif">Exemple fictif</span> : null}
            </div>
            <h1 id={`${carte.id}-titre`} className="carte-cours__titre">
              {carte.titre}
            </h1>
            <TexteRiche texte={carte.texte} />
            {carte.calculateur ? <Calculateur nom={carte.calculateur} /> : null}
            {carte.sources.length > 0 ? (
              <p className="note-source">
                {carte.sources.length > 1 ? 'Sources' : 'Source'} :{' '}
                {carte.sources.map((s, i) => (
                  <span key={s.url}>
                    {i > 0 ? ' · ' : ''}
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.libelle}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}
          </article>
        </main>
        <footer className="cours__pied">
          <div className="cours__navigation">
            <button
              type="button"
              className="lien-tertiaire"
              disabled={phase.carte === 0}
              onClick={() => {
                allerCarte(phase.carte - 1)
              }}
            >
              <Icone nom="retour" taille={18} epaisseur={2} />
              Précédente
            </button>
            <span className="texte-secondaire">Glisse la carte</span>
            {derniere ? (
              <span />
            ) : (
              <button
                type="button"
                className="lien-tertiaire"
                onClick={() => {
                  allerCarte(phase.carte + 1)
                }}
              >
                Suivante
                <Icone nom="suivant" taille={18} epaisseur={2} />
              </button>
            )}
          </div>
          {derniere ? (
            <button type="button" className="bouton bouton--plein" onClick={commencerQuiz}>
              Passer au quiz · {nbQuestions} questions
              <Icone nom="suivant" taille={20} epaisseur={2} />
            </button>
          ) : null}
        </footer>
      </div>
    )
  }

  if (phase.type === 'quiz') {
    const question = contenu.questions[phase.rang]
    if (!question) return null
    return (
      <div className="ecran-plein quiz">
        <EnTeteQuiz
          titre={`${module.titre} · palier ${numero}`}
          rang={phase.rang}
          total={nbQuestions}
          onFermer={() => {
            allerCarte(0)
          }}
        />
        <Question
          key={question.id}
          question={question}
          rang={phase.rang + 1}
          total={nbQuestions}
          dernier={phase.rang === nbQuestions - 1}
          onRepondu={(juste) => {
            reponses.current = [...reponses.current, { questionId: question.id, juste, type: question.type }]
          }}
          onSuivante={() => {
            if (phase.rang === nbQuestions - 1) void finirQuiz()
            else setPhase({ type: 'quiz', rang: phase.rang + 1 })
          }}
          onRevoirCarte={(carteId) => {
            const i = contenu.cartes.findIndex((c) => c.id === carteId)
            if (i >= 0) allerCarte(i)
          }}
        />
      </div>
    )
  }

  const { resultat } = phase
  return (
    <div className="ecran-plein resultat sur-vert">
      <Rosace taille={300} className="resultat__rosace" opacite={0.12} />
      <main className="resultat__contenu apparition">
        <span className="surtitre surtitre--or">
          Module {moduleId} · {NOMS_PALIERS[numero - 1]}
        </span>
        <h1 className="resultat__titre">{resultat.maitrise ? 'Palier maîtrisé' : 'Presque !'}</h1>
        <p className="resultat__score chiffres">
          {resultat.justes} / {resultat.total} bonnes réponses
        </p>
        <p className="texte-secondaire">
          {resultat.maitrise
            ? resultat.nouveauPalier
              ? 'Un nouveau secteur de ta rosace se dore.'
              : 'Déjà maîtrisé : tes réponses alimentent la répétition espacée.'
            : `Il faut ${formatPourcentage(SEUIL_MAITRISE, { decimales: 0 })} de bonnes réponses. Les questions ratées reviendront dans ton quiz du jour.`}
        </p>
        {resultat.xpGagne > 0 ? <JetonXP xp={resultat.xpGagne} /> : null}
        {resultat.nouveauxBadges.length > 0 ? (
          <ul className="badges-gagnes">
            {resultat.nouveauxBadges.map((b) => (
              <li key={b}>
                <Icone nom="medaille" taille={18} />
                <span>
                  <strong>{BADGES[b].nom}</strong> · {BADGES[b].description}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
      <footer className="resultat__pied">
        {resultat.moduleTermine !== null ? (
          <Link to={`/deblocage/${moduleId}`} className="bouton bouton--sur-vert">
            Voir ce que ça débloque
            <Icone nom="suivant" taille={20} epaisseur={2} />
          </Link>
        ) : resultat.maitrise ? (
          <Link to="/parcours" className="bouton bouton--sur-vert">
            Retour au parcours
            <Icone nom="suivant" taille={20} epaisseur={2} />
          </Link>
        ) : (
          <button type="button" className="bouton bouton--sur-vert" onClick={commencerQuiz}>
            Recommencer le quiz
          </button>
        )}
        {!resultat.maitrise ? (
          <button
            type="button"
            className="lien-tertiaire lien-tertiaire--sur-vert"
            onClick={() => {
              allerCarte(0)
            }}
          >
            Revoir les cartes
          </button>
        ) : null}
      </footer>
    </div>
  )
}

function EnTeteCours({ moduleId, numero, onFermer }: { moduleId: number; numero: number; onFermer: () => void }) {
  const module = MODULES.find((m) => m.id === moduleId)
  return (
    <header className="entete-cours sur-vert">
      <button type="button" className="bouton-icone" aria-label="Fermer le cours" onClick={onFermer}>
        <Icone nom="fermer" />
      </button>
      <div className="entete-cours__titres">
        <span className="surtitre surtitre--or">
          Module {moduleId} · {module?.titre}
        </span>
        <span className="entete-cours__palier">
          Palier {numero} · {NOMS_PALIERS[numero - 1]}
        </span>
      </div>
      <Link to="/glossaire" className="bouton-icone" aria-label="Glossaire">
        <Icone nom="livre" />
      </Link>
    </header>
  )
}

export function EnTeteQuiz({
  titre,
  rang,
  total,
  onFermer,
  serie,
}: {
  titre: string
  rang: number
  total: number
  onFermer: () => void
  serie?: number
}) {
  return (
    <header className="entete-quiz">
      <div className="entete-quiz__barre">
        <button type="button" className="bouton-icone bouton-icone--clair" aria-label="Quitter le quiz" onClick={onFermer}>
          <Icone nom="fermer" />
        </button>
        <span className="entete-quiz__titre">{titre}</span>
        {serie !== undefined ? (
          <span className="pastille-serie chiffres">
            <Icone nom="calendrier" taille={16} />
            {serie} jour{serie > 1 ? 's' : ''}
          </span>
        ) : (
          <span />
        )}
      </div>
      <div className="progression-quiz" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < rang ? 'fait' : i === rang ? 'actif' : ''} />
        ))}
      </div>
    </header>
  )
}
