/**
 * Accueil (maquette 3) : une seule action, pas un tableau de bord. La carte « prochaine
 * étape » propose de reprendre un module, de faire le quiz du jour ou de continuer la
 * partie ; la carte de progression est en dessous.
 */
import { Link, Navigate } from 'react-router'
import { useEtatProgression, useJournees, usePartieEnregistree, useProfil, useReponses } from '../../app/donnees.ts'
import { MODULES, NOMS_PALIERS, palier as lirePalier } from '../../content/catalogue.ts'
import { formatNombre } from '../../lib/format.ts'
import { serieDeJours } from '../../progression/gamification.ts'
import { aRevoir, jourLocal } from '../../progression/leitner.ts'
import { moduleOuvert, ordreSelonObjectif, progressionDe, prochaineEtape } from '../../progression/regles.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { SceauXP } from '../../ui/JetonXP.tsx'
import { Medaillon } from '../../ui/Medaillon.tsx'

export function EcranAccueil() {
  const profil = useProfil()
  const etat = useEtatProgression()
  const reponses = useReponses()
  const journees = useJournees()
  const partie = usePartieEnregistree()

  if (profil && !profil.lancementTermine) return <Navigate to="/bienvenue" replace />

  const aujourdhui = jourLocal()
  const questionsARevoir = reponses ? aRevoir(reponses, aujourdhui).length : 0
  const quizFait = profil?.quizDuJourFaitLe === aujourdhui
  const etape = etat
    ? prochaineEtape(etat, {
        questionsARevoir: quizFait ? 0 : questionsARevoir,
        ordreModules: ordreSelonObjectif(profil?.objectif),
      })
    : null
  const serie = serieDeJours((journees ?? []).map((j) => j.date), aujourdhui)
  const xp = profil?.xp ?? 0
  const peutFaireQuiz = (reponses?.length ?? 0) > 0

  return (
    <>
      <EnTete
        titre="Salut !"
        sousTitre="Dix minutes aujourd’hui suffisent."
        actions={
          <>
            <Link to="/progres" className="pastille-sur-vert pastille-sur-vert--chiffres" aria-label={`${xp} XP, voir tes progrès`}>
              <SceauXP taille={20} />
              {formatNombre(xp)} XP
            </Link>
            <Link to="/progres" className="pastille-sur-vert" aria-label={`Série de ${serie} jours`}>
              <Icone nom="calendrier" taille={16} />
              {serie} j
            </Link>
            <Link to="/reglages" className="bouton-icone" aria-label="Réglages">
              <Icone nom="reglages" />
            </Link>
          </>
        }
      />
      <main className="ecran apparition">
        {etape && etat ? (
          <CarteProchaineEtape
            etape={etape}
            partieEnCours={Boolean(partie)}
            peutFaireQuiz={peutFaireQuiz && !quizFait}
            moduleMaitrises={(id) => progressionDe(etat, id).paliersMaitrises}
          />
        ) : null}

        <section className="section" aria-labelledby="accueil-parcours">
          <div className="section__entete">
            <h2 id="accueil-parcours" className="section__titre">
              Ton parcours
            </h2>
            <Link to="/parcours" className="lien-tertiaire">
              Tout voir
              <Icone nom="suivant" taille={16} epaisseur={2} />
            </Link>
          </div>
          {etat ? (
            <div className="mini-parcours">
              {MODULES.slice(0, 4).map((m, i) => {
                const ouvert = moduleOuvert(etat, m.id)
                const progression = progressionDe(etat, m.id)
                return (
                  <Link
                    key={m.id}
                    to="/parcours"
                    className={`mini-noeud mini-noeud--${i % 2 === 0 ? 'gauche' : 'droite'} ${ouvert ? '' : 'mini-noeud--verrouille'}`}
                  >
                    <Medaillon numero={m.id} maitrises={progression.paliersMaitrises} verrouille={!ouvert} taille={52} />
                    <span className="mini-noeud__texte">
                      {ouvert ? null : (
                        <span className="surtitre">
                          <Icone nom="cadenas" taille={12} /> Verrouillé
                        </span>
                      )}
                      <span className="mini-noeud__titre">{m.titre}</span>
                      <span className="texte-secondaire">
                        {ouvert ? `Palier ${Math.min(progression.paliersMaitrises + 1, 5)} sur 5` : m.accroche}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : null}
        </section>
        <p className="texte-secondaire mention-educative">
          MoneyTree est éducatif : il explique, rejoue et modélise, mais ne donne aucun conseil en investissement.
        </p>
      </main>
    </>
  )
}

function CarteProchaineEtape({
  etape,
  partieEnCours,
  peutFaireQuiz,
  moduleMaitrises,
}: {
  etape: ReturnType<typeof prochaineEtape>
  partieEnCours: boolean
  peutFaireQuiz: boolean
  moduleMaitrises: (id: number) => number
}) {
  const autres = (
    <p className="carte__autres">
      Ou :{' '}
      {peutFaireQuiz && etape.type !== 'quiz-du-jour' ? (
        <>
          <Link to="/quiz-du-jour">quiz du jour</Link>
          {' · '}
        </>
      ) : null}
      <Link to="/simulateur">{partieEnCours ? 'continuer ma partie' : 'lancer une partie'}</Link>
    </p>
  )

  if (etape.type === 'palier') {
    const module = MODULES.find((m) => m.id === etape.moduleId)
    const contenu = lirePalier(etape.moduleId, etape.palier)
    const carte = contenu?.cartes[etape.carte]
    const nbCartes = contenu?.cartes.length ?? 1
    const minutesRestantes = Math.max(2, Math.round(((contenu?.minutes ?? 8) * (nbCartes - etape.carte)) / nbCartes))
    return (
      <section className="carte carte--importante sur-vert carte-etape" aria-labelledby="prochaine-etape">
        <div className="carte-etape__haut">
          <Medaillon numero={etape.moduleId} maitrises={moduleMaitrises(etape.moduleId)} enCours={etape.palier} taille={44} />
          <div>
            <span className="surtitre surtitre--or">Prochaine étape</span>
            <p className="texte-secondaire">
              Module {etape.moduleId} · {module?.titre} · palier {etape.palier} sur 5
            </p>
          </div>
        </div>
        <h2 id="prochaine-etape" className="carte__titre">
          {etape.reprise ? `Reprendre : ${carte?.titre ?? NOMS_PALIERS[etape.palier - 1]}` : `${NOMS_PALIERS[etape.palier - 1]} : ${contenu?.objectif ?? ''}`}
        </h2>
        <div className="barre-avancement" aria-hidden="true">
          <span style={{ width: `${(etape.carte / nbCartes) * 100}%` }} />
        </div>
        <p className="texte-secondaire chiffres">
          Carte {etape.carte + 1} sur {nbCartes} · environ {minutesRestantes} minutes
        </p>
        <Link to={`/parcours/${etape.moduleId}/${etape.palier}`} className="bouton bouton--sur-vert">
          {etape.reprise ? 'Reprendre le module' : 'Commencer'}
          <Icone nom="suivant" taille={20} epaisseur={2} />
        </Link>
        {autres}
      </section>
    )
  }

  if (etape.type === 'quiz-du-jour') {
    return (
      <section className="carte carte--importante sur-vert carte-etape" aria-labelledby="prochaine-etape">
        <span className="surtitre surtitre--or">Prochaine étape</span>
        <h2 id="prochaine-etape" className="carte__titre">
          Le quiz du jour
        </h2>
        <p className="carte__texte">Trois questions, dont celles que tu dois revoir aujourd’hui.</p>
        <Link to="/quiz-du-jour" className="bouton bouton--sur-vert">
          Faire le quiz du jour
          <Icone nom="suivant" taille={20} epaisseur={2} />
        </Link>
        {autres}
      </section>
    )
  }

  return (
    <section className="carte carte--importante sur-vert carte-etape" aria-labelledby="prochaine-etape">
      <span className="surtitre surtitre--or">Prochaine étape</span>
      <h2 id="prochaine-etape" className="carte__titre">
        {partieEnCours ? 'Continuer ta partie' : 'Tes dix premières années'}
      </h2>
      <p className="carte__texte">
        Tous les cours disponibles sont maîtrisés. Mets-les en pratique sur une vraie période de marché.
      </p>
      <Link to="/simulateur" className="bouton bouton--sur-vert">
        {partieEnCours ? 'Continuer ma partie' : 'Lancer une partie'}
        <Icone nom="suivant" taille={20} epaisseur={2} />
      </Link>
    </section>
  )
}
