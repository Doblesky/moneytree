/**
 * Examen blanc sur le programme officiel de l'examen AMF (instruction DOC-2010-09, annexe 1) :
 * deux catégories qui ne se compensent pas, 80 % exigés dans chacune, une minute par
 * question. MoneyTree le ramène à 30 questions et dit ce que ses cours ne couvrent pas encore.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useEtatProgression, useProfil } from '../../app/donnees.ts'
import { PARAGRAPHES_AMF, SOURCE_PROGRAMME_AMF, THEMES_AMF } from '../../content/programmeAmf.ts'
import type { Question } from '../../content/schema.ts'
import { formatPourcentage } from '../../lib/format.ts'
import {
  couvertureProgramme,
  EXAMEN_OFFICIEL,
  examenBlancConseille,
  QUESTIONS_EXAMEN_BLANC,
  REPARTITION_EXAMEN_BLANC,
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
import { metierDe } from '../../profils/metiers.ts'


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
    <p className="carte__texte chiffres ligne-icone">
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
    setPhase({ type: 'questions', questions: tirerExamenBlanc(Math.random, metierDe(profil)) })
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
            <ul className="liste-resultats chiffres liste-resultats--sur-vert">
              {bilan.parTheme.map((t) => (
                <li key={t.theme}>
                  <span>
                    {t.theme}. {THEMES_AMF[t.theme]}
                  </span>
                  <strong>
                    {t.justes} / {t.total}
                  </strong>
                </li>
              ))}
            </ul>
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
  const total = QUESTIONS_EXAMEN_BLANC
  const couverture = couvertureProgramme(metierDe(profil))
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
            L’examen AMF est un QCM de {EXAMEN_OFFICIEL.total} questions en 2 heures au plus, sur 12 thèmes. Il faut 80 % de
            bonnes réponses aux {EXAMEN_OFFICIEL.categorieA} questions de connaissances indispensables (déontologie, client,
            blanchiment, abus de marché…) et 80 % aux {EXAMEN_OFFICIEL.total - EXAMEN_OFFICIEL.categorieA} questions de culture
            financière.
          </p>
          <ul className="liste-conditions">
            <li>
              <Icone nom="coche" taille={16} />
              {total} questions tirées de tes cours : {REPARTITION_EXAMEN_BLANC.A} de connaissances indispensables,{' '}
              {REPARTITION_EXAMEN_BLANC.C} de culture financière, au prorata du programme officiel
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
            <a href={SOURCE_PROGRAMME_AMF.url} target="_blank" rel="noreferrer">
              {SOURCE_PROGRAMME_AMF.libelle}
            </a>
            . Les questions de l’examen officiel ne sont pas publiques : celles-ci viennent des cours de MoneyTree, rattachées
            par l’appli aux paragraphes du programme.
          </p>
          {conseille ? null : (
            <p className="carte__texte">
              Conseillé après un premier palier Professionnel : une partie des questions porte sur ce niveau.
            </p>
          )}
        </section>
        <section className="carte" aria-labelledby="blanc-couverture">
          <h2 id="blanc-couverture" className="carte__surtitre">
            Ce que tes cours couvrent du programme
          </h2>
          <p className="carte__texte chiffres">
            {couverture.paragraphesCouverts} paragraphes sur {PARAGRAPHES_AMF.length}, soit{' '}
            {couverture.questionsOfficiellesCouvertes} des {EXAMEN_OFFICIEL.total} questions de l’examen officiel.
          </p>
          {couverture.themesNonCouverts.length > 0 ? (
            <p className="texte-secondaire">
              Thèmes pas encore couverts :{' '}
              {couverture.themesNonCouverts.map((t) => `${String(t)}. ${THEMES_AMF[t] ?? ''}`).join(' ; ')}.
            </p>
          ) : null}
          {couverture.paragraphesNonCouverts.length > 0 ? (
            <p className="texte-secondaire">
              Aussi absents des cours :{' '}
              {couverture.paragraphesNonCouverts
                .filter((x) => !couverture.themesNonCouverts.includes(x.theme))
                .map((x) => x.intitule)
                .join(' · ')}
              .
            </p>
          ) : (
            <p className="texte-secondaire">
              Chaque paragraphe du programme a au moins une question dans tes cours, sur les {Object.keys(THEMES_AMF).length}{' '}
              thèmes.
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
