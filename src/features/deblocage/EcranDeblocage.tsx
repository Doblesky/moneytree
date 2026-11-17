/**
 * Annonce de déblocage (maquette 8) : ce que le module terminé ajoute au simulateur, et ce
 * que tu peux essayer maintenant. Chaque déblocage est annoncé.
 */
import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useEtatProgression } from '../../app/donnees.ts'
import { CAS_ECOLE } from '../../content/cas.ts'
import { LEVIERS, MODULES } from '../../content/catalogue.ts'
import { carriereOuverte, casOuvert, progressionDe } from '../../progression/regles.ts'
import { Icone } from '../../ui/Icone.tsx'
import { Medaillon } from '../../ui/Medaillon.tsx'
import { Rosace } from '../../ui/Rosace.tsx'

const ESSAIS: Record<number, string> = {
  0: 'Ouvre le simulateur : règle ton épargne de précaution sur le Livret A, puis avance d’un an pour voir les intérêts arriver le 31 décembre.',
  1: 'Dans le simulateur, ouvre le détail de l’impôt et avance jusqu’en septembre de ta deuxième année : regarde la régularisation et ton nouveau taux de prélèvement.',
  2: 'Remplis ton Livret A jusqu’au plafond dans le simulateur, puis ajoute un LDDS : compare avec l’argent placé sur l’ETF monde.',
}

export function EcranDeblocage() {
  const params = useParams()
  const moduleId = Number(params.module)
  const module = MODULES.find((m) => m.id === moduleId)
  const etat = useEtatProgression()

  useEffect(() => {
    document.title = 'Nouveau déblocage · MoneyTree'
  }, [])

  if (!module) return <Navigate to="/parcours" replace />
  if (!etat) return null
  const progression = progressionDe(etat, moduleId)
  const suivant = MODULES.find((m) => m.id === moduleId + 1)
  const carriere = carriereOuverte(etat)
  // Cas d'école que ce module vient d'ouvrir (tous leurs modules sont désormais terminés).
  const casDebloques = CAS_ECOLE.filter(
    (c) => c.disponible && c.modules.includes(moduleId) && casOuvert(etat, c.modules),
  )

  return (
    <div className="ecran-plein deblocage sur-vert">
      <Rosace taille={360} className="deblocage__rosace" opacite={0.1} />
      <header className="deblocage__entete">
        <Link to="/parcours" className="bouton-icone" aria-label="Fermer">
          <Icone nom="fermer" />
        </Link>
      </header>
      <main className="deblocage__contenu">
        <span className="surtitre surtitre--or">Module {moduleId} terminé</span>
        <div className="tampon">
          <Medaillon numero={moduleId} maitrises={progression.paliersMaitrises} taille={150} libelle={`Module ${moduleId}`} />
        </div>
        <h1 className="deblocage__titre">{module.titre}</h1>
        <p className="texte-secondaire">Palier Découverte maîtrisé : la suite du parcours s’ouvre.</p>

        <section className="carte deblocage__carte" aria-labelledby="deblocage-ajouts">
          <h2 id="deblocage-ajouts" className="surtitre">
            Ce que ça ajoute
          </h2>
          {module.leviers.map((levier) => (
            <div key={levier} className="ajout">
              <span className="ajout__icone">
                <Icone nom="cadenasOuvert" taille={20} />
              </span>
              <div>
                <p className="ajout__titre">
                  {LEVIERS[levier].nom}{' '}
                  <span className="etiquette etiquette--nouveau">
                    {LEVIERS[levier].disponible ? 'Nouveau levier' : 'Phase suivante'}
                  </span>
                </p>
                <p className="texte-secondaire">{LEVIERS[levier].description}</p>
              </div>
            </div>
          ))}
          {suivant ? (
            <div className="ajout">
              <span className="ajout__icone">
                <Icone nom="parcours" taille={20} />
              </span>
              <div>
                <p className="ajout__titre">
                  Module {suivant.id} · {suivant.titre} <span className="etiquette etiquette--nouveau">Ouvert</span>
                </p>
                <p className="texte-secondaire">{suivant.accroche}</p>
              </div>
            </div>
          ) : null}
          {carriere && moduleId === 2 ? (
            <div className="ajout">
              <span className="ajout__icone">
                <Icone nom="carriere" taille={20} />
              </span>
              <div>
                <p className="ajout__titre">
                  Mode carrière <span className="etiquette etiquette--nouveau">Ouvert</span>
                </p>
                <p className="texte-secondaire">
                  Les modules 0 à 2 sont terminés : vingt ans de carrière, un événement à choix chaque année.
                </p>
              </div>
            </div>
          ) : null}
          {casDebloques.map((cas) => (
            <Link key={cas.id} to={`/cas/${cas.id}`} className="ajout ajout--lien">
              <span className="ajout__icone">
                <Icone nom="livre" taille={20} />
              </span>
              <div>
                <p className="ajout__titre">
                  Cas d’école · {cas.titre} <span className="etiquette etiquette--nouveau">Ouvert</span>
                </p>
                <p className="texte-secondaire">{cas.question}</p>
              </div>
            </Link>
          ))}
          {ESSAIS[moduleId] ? (
            <div className="essai">
              <Icone nom="pousse" taille={20} />
              <div>
                <p className="ajout__titre">Essaie maintenant</p>
                <p className="texte-secondaire">{ESSAIS[moduleId]}</p>
              </div>
            </div>
          ) : null}
        </section>
      </main>
      <footer className="resultat__pied">
        <Link to="/simulateur" className="bouton bouton--sur-vert">
          Essayer dans le simulateur
          <Icone nom="suivant" taille={20} epaisseur={2} />
        </Link>
        <Link to="/parcours" className="lien-tertiaire lien-tertiaire--sur-vert">
          Plus tard
        </Link>
      </footer>
    </div>
  )
}
