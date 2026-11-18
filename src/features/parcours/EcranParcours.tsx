/**
 * Carte de progression (maquettes 4a et 4b) : les dix modules comme une carte à explorer.
 * Les modules verrouillés restent visibles, grisés, avec leur titre et leur accroche ;
 * « Débloquer quand même » est toujours là.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { useEtatProgression, useProfil } from '../../app/donnees.ts'
import { MODULES, NOMS_PALIERS, NOMBRE_PALIERS, palier as lirePalier, paliersDisponibles, type InfoModule } from '../../content/catalogue.ts'
import { jourLocal } from '../../progression/leitner.ts'
import {
  etatExamen,
  etatPalier,
  moduleOuvert,
  ordreSelonObjectif,
  paliersValides,
  progressionDe,
  prochaineEtape,
  type EtatProgression,
} from '../../progression/regles.ts'
import { debloquerModule, debloquerPalier } from '../../storage/apprentissage.ts'
import { EnTete } from '../../ui/EnTete.tsx'
import { Icone } from '../../ui/Icone.tsx'
import { Medaillon, SecteurPalier } from '../../ui/Medaillon.tsx'

export function EcranParcours() {
  const etat = useEtatProgression()
  const profil = useProfil()
  const [ouvert, setOuvert] = useState<number | null>(null)

  const etape = etat ? prochaineEtape(etat, { questionsARevoir: 0, ordreModules: ordreSelonObjectif(profil?.objectif) }) : null
  const moduleCourant = etape?.type === 'palier' ? etape.moduleId : 0

  const deplie = ouvert ?? moduleCourant

  return (
    <>
      <EnTete
        titre="Ton parcours"
        sousTitre="10 modules, 5 paliers chacun."
        actions={
          <Link to="/reglages" className="pastille-sur-vert">
            {etat?.modeExpert ? 'Mode expert activé' : 'Mode expert'}
          </Link>
        }
      />
      <main className="ecran apparition parcours">
        {etat
          ? MODULES.map((module, i) => (
              <NoeudModule
                key={module.id}
                module={module}
                etat={etat}
                cote={i % 2 === 0 ? 'gauche' : 'droite'}
                deplie={deplie === module.id}
                onBasculer={() => {
                  setOuvert(deplie === module.id ? -1 : module.id)
                }}
              />
            ))
          : null}
        <p className="texte-secondaire parcours__regle">
          Le palier Découverte d’un module ouvre le module suivant et ses leviers dans le simulateur. Les paliers
          suivants approfondissent. Chaque palier réussi se valide ensuite par un examen : des questions tirées au
          hasard, 90 % de bonnes réponses. Ce sont les examens qui mènent aux 100 %.
        </p>
      </main>
    </>
  )
}

function NoeudModule({
  module,
  etat,
  cote,
  deplie,
  onBasculer,
}: {
  module: InfoModule
  etat: EtatProgression
  cote: 'gauche' | 'droite'
  deplie: boolean
  onBasculer: () => void
}) {
  const ouvert = moduleOuvert(etat, module.id)
  const progression = progressionDe(etat, module.id)
  const disponibles = paliersDisponibles(module.id)

  if (!ouvert) {
    return (
      <section className={`noeud noeud--${cote} noeud--verrouille`} aria-labelledby={`module-${module.id}`}>
        <Medaillon numero={module.id} maitrises={0} verrouille taille={56} />
        <div className="noeud__corps">
          <span className="surtitre">
            <Icone nom="cadenas" taille={14} /> Module {module.id} · verrouillé
          </span>
          <h2 id={`module-${module.id}`} className="noeud__titre">
            {module.titre}
          </h2>
          <p className="texte-secondaire">{module.accroche}</p>
          <button
            type="button"
            className="lien-debloquer"
            onClick={() => {
              void debloquerModule(module.id)
            }}
          >
            Débloquer quand même
          </button>
        </div>
      </section>
    )
  }

  const enCours = progression.enCours?.palier
  return (
    <section className={`noeud noeud--${cote} noeud--ouvert ${deplie ? 'noeud--deplie' : ''}`} aria-labelledby={`module-${module.id}`}>
      <button type="button" className="noeud__tete" aria-expanded={deplie} onClick={onBasculer}>
        <Medaillon
          numero={module.id}
          maitrises={progression.paliersMaitrises}
          enCours={enCours ?? progression.paliersMaitrises + 1}
          taille={deplie ? 96 : 64}
          libelle={`Module ${module.id}, ${progression.paliersMaitrises} paliers sur 5 maîtrisés`}
        />
        <span className="noeud__corps">
          <span className="surtitre surtitre--or">
            Module {module.id} · {progression.paliersMaitrises >= 1 ? 'terminé' : 'ouvert'}
          </span>
          <span id={`module-${module.id}`} className="noeud__titre">
            {module.titre}
          </span>
          <span className="texte-secondaire">{module.accroche}</span>
        </span>
      </button>
      {deplie ? (
        <div className="paliers">
          <div className="paliers__entete">
            <span className="surtitre">Paliers</span>
            <span className="texte-secondaire chiffres">
              {progression.paliersMaitrises} sur {NOMBRE_PALIERS} maîtrisé{progression.paliersMaitrises > 1 ? 's' : ''} ·{' '}
              {paliersValides(etat, module.id)} validé{paliersValides(etat, module.id) > 1 ? 's' : ''}
            </span>
          </div>
          {disponibles === 0 ? (
            <p className="texte-secondaire paliers__a-venir">
              Les cours de ce module arrivent avec la phase {module.phase}. Au programme : {module.contenuCle}
            </p>
          ) : null}
          {Array.from({ length: NOMBRE_PALIERS }, (_, i) => i + 1).map((numero) => (
            <LignePalier key={numero} module={module} numero={numero} etat={etat} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function LignePalier({ module, numero, etat }: { module: InfoModule; numero: number; etat: EtatProgression }) {
  const statut = etatPalier(etat, module.id, numero)
  const contenu = lirePalier(module.id, numero)
  const progression = progressionDe(etat, module.id)
  const nom = `${numero}. ${NOMS_PALIERS[numero - 1] ?? ''}`
  const lien = `/parcours/${module.id}/${numero}`

  const examen = etatExamen(etat, module.id, numero, jourLocal())
  let detail: string
  if (statut === 'maitrise' && examen === 'valide') detail = contenu?.objectif ?? 'Validé'
  else if (statut === 'maitrise' && examen === 'demain') detail = 'Maîtrisé · examen de validation conseillé demain'
  else if (statut === 'maitrise') detail = 'Maîtrisé · examen de validation à passer'
  else if (statut === 'en-cours') detail = `Carte ${(progression.enCours?.carte ?? 0) + 1} sur ${contenu?.cartes.length ?? 0}`
  else if (statut === 'ouvert') detail = `${contenu?.cartes.length ?? 0} cartes · environ ${contenu?.minutes ?? 8} minutes`
  else if (statut === 'verrouille') detail = 'Après le palier précédent'
  else detail = numero >= 4 ? 'Arrive avec la phase 5' : `Arrive avec la phase ${module.phase}`

  return (
    <div className={`palier palier--${statut}`}>
      <SecteurPalier numero={numero} etat={statut} />
      <div className="palier__texte">
        <span className="palier__nom">{nom}</span>
        <span className="texte-secondaire">{detail}</span>
      </div>
      {statut === 'maitrise' && examen === 'valide' ? (
        <span className="palier__actions">
          <Link to={lien} className="palier__statut palier__statut--or" aria-label={`Revoir ${nom}`}>
            <Icone nom="medaille" taille={16} />
            Validé
          </Link>
          <Link to={`${lien}/examen`} className="palier__examen">
            Repasser
          </Link>
        </span>
      ) : statut === 'maitrise' ? (
        <span className="palier__actions">
          <Link to={`${lien}/examen`} className="bouton-pastille">
            Examen
          </Link>
          <Link to={lien} className="palier__examen" aria-label={`Revoir ${nom}`}>
            Revoir
          </Link>
        </span>
      ) : statut === 'en-cours' || statut === 'ouvert' ? (
        <Link to={lien} className="bouton-pastille">
          {statut === 'en-cours' ? 'Reprendre' : 'Commencer'}
        </Link>
      ) : statut === 'verrouille' ? (
        <button
          type="button"
          className="lien-debloquer"
          onClick={() => {
            void debloquerPalier(module.id, numero)
          }}
        >
          Débloquer
        </button>
      ) : (
        <Icone nom="cadenas" taille={18} />
      )}
    </div>
  )
}
