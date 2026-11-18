/**
 * Examen de validation d'un palier : 10 questions tirées au hasard (le palier et les
 * précédents du module), choix mélangés, pas de correction avant la fin, 90 % requis.
 * C'est lui, et non la lecture des cours, qui compte pour les 100 % de progression.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useEtatProgression } from '../../app/donnees.ts'
import { infoModule, NOMS_PALIERS, palier as lirePalier } from '../../content/catalogue.ts'
import type { Question } from '../../content/schema.ts'
import { formatPourcentage } from '../../lib/format.ts'
import { bonnesReponsesRequises, SEUIL_EXAMEN, tirerExamen } from '../../progression/examens.ts'
import { BADGES } from '../../progression/gamification.ts'
import { jourLocal } from '../../progression/leitner.ts'
import { etatExamen, progressionDe } from '../../progression/regles.ts'
import { terminerExamen, type ResultatExamen } from '../../storage/apprentissage.ts'
import { Icone } from '../../ui/Icone.tsx'
import { JetonXP } from '../../ui/JetonXP.tsx'
import { EnTeteCours } from '../cours/EcranPalier.tsx'
import { Correction, Deroulement, type ReponseExamen } from './Deroulement.tsx'

type Phase =
  | { type: 'accueil' }
  | { type: 'questions'; questions: Question[] }
  | { type: 'resultat'; resultat: ResultatExamen; reponses: ReponseExamen[] }

export function EcranExamen() {
  const params = useParams()
  return <Examen key={`${params.module ?? ''}-${params.palier ?? ''}`} />
}

function formatJour(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number)
  return new Date(a ?? 2000, (m ?? 1) - 1, j ?? 1).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function Examen() {
  const params = useParams()
  const moduleId = Number(params.module)
  const numero = Number(params.palier)
  const etat = useEtatProgression()
  const metier = etat?.metier
  const module = metier ? infoModule(moduleId, metier) : undefined
  const contenu = metier ? lirePalier(moduleId, numero, metier) : undefined
  const naviguer = useNavigate()
  const [phase, setPhase] = useState<Phase>({ type: 'accueil' })

  useEffect(() => {
    if (module) document.title = `Examen · ${module.titre} · palier ${numero} · MoneyTree`
  }, [module, numero])

  if (!etat) return null
  if (!module || !contenu) return <Navigate to="/parcours" replace />

  const titre = `Examen · ${module.titre} · palier ${numero}`
  const fermer = () => void naviguer('/parcours')

  if (phase.type === 'questions') {
    return (
      <Deroulement
        titre={titre}
        questions={phase.questions}
        onQuitter={() => {
          setPhase({ type: 'accueil' })
        }}
        onFini={(reponses) => {
          void terminerExamen(
            moduleId,
            numero,
            reponses.map((r) => ({ questionId: r.question.id, juste: r.juste, type: r.question.type })),
          ).then((resultat) => {
            setPhase({ type: 'resultat', resultat, reponses })
          })
        }}
      />
    )
  }

  if (phase.type === 'resultat') {
    const { resultat, reponses } = phase
    return (
      <div className="ecran-plein">
        <EnTeteCours moduleId={moduleId} numero={numero} onFermer={fermer} />
        <main className="ecran apparition">
          <section className="carte carte--importante sur-vert carte-etape" aria-labelledby="examen-resultat">
            <span className="surtitre surtitre--or">Examen de validation</span>
            <h1 id="examen-resultat" className="carte__titre">
              {resultat.reussi ? (resultat.nouvelleValidation ? 'Palier validé' : 'Réussi, encore') : 'Pas encore'}
            </h1>
            <p className="resultat__score chiffres">
              {resultat.justes} / {resultat.total} bonnes réponses · {resultat.requis} exigées
            </p>
            <p className="carte__texte">
              {resultat.reussi
                ? resultat.nouvelleValidation
                  ? 'Ce palier compte désormais en entier dans ta progression.'
                  : 'Le palier était déjà validé : ces réponses entretiennent ta mémoire.'
                : 'Les questions ratées reviendront dans ton quiz du jour. Tu peux repasser l’examen quand tu veux : le tirage change à chaque fois.'}
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
          </section>
          <section className="section" aria-labelledby="examen-correction">
            <h2 id="examen-correction" className="section__titre">
              Correction
            </h2>
            <Correction reponses={reponses} />
          </section>
          <div className="pile-boutons">
            {resultat.reussi ? (
              <Link to="/parcours" className="bouton bouton--plein">
                Retour au parcours
                <Icone nom="suivant" taille={20} epaisseur={2} />
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className="bouton bouton--plein"
                  onClick={() => {
                    setPhase({ type: 'questions', questions: tirerExamen(moduleId, numero, Math.random, etat.metier) })
                  }}
                >
                  Repasser l’examen
                </button>
                <Link to={`/parcours/${String(moduleId)}/${String(numero)}`} className="lien-tertiaire">
                  Revoir les cartes du palier
                </Link>
              </>
            )}
          </div>
        </main>
      </div>
    )
  }

  const statut = etatExamen(etat, moduleId, numero, jourLocal())
  const stocke = progressionDe(etat, moduleId).examens?.[String(numero)]
  const nbQuestions = tirerExamen(moduleId, numero, () => 0, etat.metier).length

  if (statut === 'verrouille') {
    return (
      <div className="ecran-plein">
        <EnTeteCours moduleId={moduleId} numero={numero} onFermer={fermer} />
        <main className="ecran">
          <section className="carte carte--verrouillee">
            <Icone nom="cadenas" />
            <div className="carte__corps">
              <h1 className="carte__titre">Examen pas encore ouvert</h1>
              <p className="carte__texte">Il s’ouvre une fois le quiz de ce palier réussi.</p>
              <Link to={`/parcours/${String(moduleId)}/${String(numero)}`} className="lien-debloquer">
                Aller au palier
              </Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="ecran-plein">
      <EnTeteCours moduleId={moduleId} numero={numero} onFermer={fermer} />
      <main className="ecran apparition">
        <section className="carte" aria-labelledby="examen-titre">
          <span className="surtitre surtitre--or">
            {NOMS_PALIERS[numero - 1]} · examen de validation
          </span>
          <h1 id="examen-titre" className="carte__titre">
            {contenu.objectif}
          </h1>
          <ul className="liste-conditions">
            <li>
              <Icone nom="coche" taille={16} />
              {nbQuestions} questions tirées au hasard
              {numero > 1 ? ', dans ce palier et les précédents' : ' dans ce palier'}
            </li>
            <li>
              <Icone nom="coche" taille={16} />
              Les choix sont mélangés, la correction vient à la fin
            </li>
            <li>
              <Icone nom="coche" taille={16} />
              {bonnesReponsesRequises(nbQuestions)} bonnes réponses sur {nbQuestions} pour valider (
              {formatPourcentage(SEUIL_EXAMEN, { decimales: 0 })})
            </li>
          </ul>
          {stocke ? (
            <p className="texte-secondaire chiffres">
              {stocke.tentatives} tentative{stocke.tentatives > 1 ? 's' : ''} · meilleur score{' '}
              {formatPourcentage(stocke.meilleurScore, { decimales: 0 })}
              {stocke.valideLe ? ` · validé le ${formatJour(stocke.valideLe)}` : ''}
            </p>
          ) : null}
          {statut === 'demain' ? (
            <p className="carte__texte">
              Tu viens de réussir le quiz : l’examen est fait pour vérifier ce qui reste après une nuit. Il est conseillé
              à partir de demain, mais tu peux le passer dès maintenant.
            </p>
          ) : null}
          {statut === 'valide' ? (
            <p className="carte__texte">Palier déjà validé : tu peux repasser l’examen pour t’entraîner.</p>
          ) : null}
        </section>
        <div className="pile-boutons">
          <button
            type="button"
            className="bouton bouton--plein"
            onClick={() => {
              setPhase({ type: 'questions', questions: tirerExamen(moduleId, numero, Math.random, etat.metier) })
            }}
          >
            {statut === 'demain' ? 'Le passer maintenant' : 'Commencer l’examen'}
            <Icone nom="suivant" taille={20} epaisseur={2} />
          </button>
          <p className="texte-secondaire">
            Environ {Math.ceil(nbQuestions * 0.75)} minutes.
          </p>
        </div>
      </main>
    </div>
  )
}
