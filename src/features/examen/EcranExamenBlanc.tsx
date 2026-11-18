/**
 * Examen blanc sur le format de l'examen AMF : deux catégories qui ne se compensent pas,
 * 80 % exigés dans chacune, une minute par question. MoneyTree le ramène à 30 questions.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useEtatProgression, useProfil } from '../../app/donnees.ts'
import type { Question } from '../../content/schema.ts'
import { formatPourcentage } from '../../lib/format.ts'
import {
  examenBlancConseille,
  QUESTIONS_PAR_CATEGORIE,
  SECONDES_PAR_QUESTION,
  SEUIL_EXAMEN_BLANC,
  tirerExamenBlanc,
  type BilanExamenBlanc,
} from '../../progression/examenBlanc.ts'
import { BADGES, type Badge } from '../../progression/gamification.ts'
import { terminerExamenBlanc } from '../../storage/apprentissage.ts'
import { Icone } from '../../ui/Icone.tsx'
import { JetonXP } from '../../ui/JetonXP.tsx'
import { Correction, Deroulement, type ReponseExamen } from './Deroulement.tsx'

const SOURCE_AMF = 'https://www.amf-france.org/fr/actualites-publications/dossiers-thematiques/certification-professionnelle'

type Phase =
  | { type: 'accueil' }
  | { type: 'questions'; questions: Question[] }
  | { type: 'resultat'; bilan: BilanExamenBlanc; reponses: ReponseExamen[]; xp: number; badges: Badge[] }

function EnTeteExamen({ onFermer }: { onFermer: () => void }) {
  return (
    <header className="entete-cours sur-vert">
      <button type="button" className="bouton-icone" aria-label="Fermer l’examen blanc" onClick={onFermer}>
        <Icone nom="fermer" />
      </button>
      <div className="entete-cours__titres">
        <span className="surtitre surtitre--or">Niveau Professionnel</span>
        <span className="entete-cours__palier">Examen blanc · format AMF</span>
      </div>
      <span />
    </header>
  )
}

function LigneCategorie({ nom, score }: { nom: string; score: { justes: number; total: number; reussi: boolean } }) {
  return (
    <p className="carte__texte chiffres">
      <Icone nom={score.reussi ? 'coche' : 'croix'} taille={16} epaisseur={2.6} /> {nom} : {score.justes} / {score.total}
      {score.total > 0 ? ` (${formatPourcentage(score.justes / score.total, { decimales: 0 })})` : ''}
    </p>
  )
}

export function EcranExamenBlanc() {
  const etat = useEtatProgression()
  const profil = useProfil()
  const naviguer = useNavigate()
  const [phase, setPhase] = useState<Phase>({ type: 'accueil' })

  useEffect(() => {
    document.title = 'Examen blanc · MoneyTree'
  }, [])

  const finir = useCallback((reponses: ReponseExamen[]) => {
    void terminerExamenBlanc(reponses.map((r) => ({ questionId: r.question.id, juste: r.juste, type: r.question.type }))).then(
      (r) => {
        setPhase({ type: 'resultat', bilan: r.bilan, reponses, xp: r.xpGagne, badges: r.nouveauxBadges })
      },
    )
  }, [])

  const fermer = () => void naviguer('/progres')
  const commencer = () => {
    setPhase({ type: 'questions', questions: tirerExamenBlanc(Math.random) })
  }

  if (phase.type === 'questions') {
    return (
      <Deroulement
        titre="Examen blanc"
        questions={phase.questions}
        dureeSecondes={phase.questions.length * SECONDES_PAR_QUESTION}
        onQuitter={() => {
          setPhase({ type: 'accueil' })
        }}
        onFini={finir}
      />
    )
  }

  if (phase.type === 'resultat') {
    const { bilan, reponses } = phase
    return (
      <div className="ecran-plein">
        <EnTeteExamen onFermer={fermer} />
        <main className="ecran apparition">
          <section className="carte carte--importante sur-vert carte-etape" aria-labelledby="blanc-resultat">
            <span className="surtitre surtitre--or">Examen blanc</span>
            <h1 id="blanc-resultat" className="carte__titre">
              {bilan.reussi ? 'Réussi' : 'Pas encore'}
            </h1>
            <LigneCategorie nom="Connaissances indispensables" score={bilan.A} />
            <LigneCategorie nom="Culture financière" score={bilan.C} />
            <p className="carte__texte">
              {bilan.reussi
                ? 'Au moins 80 % dans les deux catégories : le niveau attendu à l’examen AMF.'
                : 'Il faut 80 % dans chaque catégorie, sans compensation : une catégorie forte ne rattrape pas l’autre.'}
            </p>
            {phase.xp > 0 ? <JetonXP xp={phase.xp} /> : null}
            {phase.badges.length > 0 ? (
              <ul className="badges-gagnes">
                {phase.badges.map((b) => (
                  <li key={b}>
                    <Icone nom="medaille" taille={18} />
                    <span>
                      <strong>{BADGES[b].nom}</strong> · {BADGES[b].description}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <section className="section" aria-labelledby="blanc-correction">
            <h2 id="blanc-correction" className="section__titre">
              Correction
            </h2>
            <Correction reponses={reponses} />
          </section>
          <div className="pile-boutons">
            <button type="button" className="bouton bouton--plein" onClick={commencer}>
              Nouvel examen blanc
            </button>
            <Link to="/progres" className="lien-tertiaire">
              Retour à tes progrès
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const historique = profil?.examensBlancs ?? []
  const conseille = etat ? examenBlancConseille(etat) : false
  const total = QUESTIONS_PAR_CATEGORIE * 2
  return (
    <div className="ecran-plein">
      <EnTeteExamen onFermer={fermer} />
      <main className="ecran apparition">
        <section className="carte" aria-labelledby="blanc-titre">
          <span className="surtitre surtitre--or">Format de l’examen AMF</span>
          <h1 id="blanc-titre" className="carte__titre">
            Te mettre en condition
          </h1>
          <p className="carte__texte">
            L’examen AMF est un QCM de 120 questions en 2 heures au plus. Il faut 80 % de bonnes réponses en culture
            financière, et 80 % sur les connaissances indispensables au métier, surtout juridiques et déontologiques.
          </p>
          <ul className="liste-conditions">
            <li>
              <Icone nom="coche" taille={16} />
              {total} questions : {QUESTIONS_PAR_CATEGORIE} par catégorie, tirées de tes cours
            </li>
            <li>
              <Icone nom="coche" taille={16} />
              {total} minutes, une par question comme à l’examen
            </li>
            <li>
              <Icone nom="coche" taille={16} />
              {formatPourcentage(SEUIL_EXAMEN_BLANC, { decimales: 0 })} dans chaque catégorie, sans compensation
            </li>
          </ul>
          <p className="note-source">
            Source :{' '}
            <a href={SOURCE_AMF} target="_blank" rel="noreferrer">
              AMF, certification professionnelle
            </a>
            . Les questions de l’examen officiel ne sont pas publiques : celles-ci viennent des cours de MoneyTree, et leur
            classement entre les deux catégories est un choix de l’appli.
          </p>
          {conseille ? null : (
            <p className="carte__texte">
              Conseillé après un premier palier Professionnel : une partie des questions porte sur ce niveau.
            </p>
          )}
        </section>
        {historique.length > 0 ? (
          <section className="section" aria-labelledby="blanc-historique">
            <h2 id="blanc-historique" className="section__titre">
              Tes derniers examens blancs
            </h2>
            <ul className="liste-resultats chiffres">
              {[...historique]
                .reverse()
                .slice(0, 5)
                .map((r) => (
                  <li key={r.le}>
                    <span>
                      {new Date(r.le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      <small className="calculateur__detail">
                        Indispensables {r.A.justes}/{r.A.total} · culture financière {r.C.justes}/{r.C.total}
                      </small>
                    </span>
                    <strong>{r.reussi ? 'Réussi' : 'Échoué'}</strong>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}
        <div className="pile-boutons">
          <button type="button" className="bouton bouton--plein" onClick={commencer}>
            {conseille ? 'Commencer l’examen blanc' : 'Le passer quand même'}
            <Icone nom="suivant" taille={20} epaisseur={2} />
          </button>
        </div>
      </main>
    </div>
  )
}
