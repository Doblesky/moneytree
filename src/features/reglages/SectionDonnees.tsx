import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { telechargerTexte } from '../../lib/fichier.ts'
import {
  analyserFichierExport,
  exporterDonnees,
  importerDonnees,
  nomFichierExport,
  serialiserExport,
  type ExportMoneyTree,
  type ResumeExport,
} from '../../storage/exportImport.ts'
import { lireEtatPersistance, type EtatPersistance } from '../../storage/persistance.ts'
import { Icone } from '../../ui/Icone.tsx'

const TEXTE_PERSISTANCE: Record<EtatPersistance, string> = {
  accorde: 'Accordé : le navigateur ne videra pas tes données, même s’il manque de place.',
  refuse:
    'Non accordé : le navigateur peut vider tes données s’il manque de place. Exporte-les de temps en temps.',
  indisponible:
    'Indisponible sur ce navigateur. Exporte tes données de temps en temps pour ne rien perdre.',
}

type Message = { type: 'succes' | 'erreur'; texte: string } | null

function decrireResume(resume: ResumeExport): string {
  const date = new Date(resume.exporteLe).toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
  const contenu = [
    resume.profil ? 'ton profil' : 'aucun profil',
    pluriel(resume.modules, 'module'),
    pluriel(resume.sauvegardes, 'sauvegarde'),
    pluriel(resume.reponses, 'réponse'),
    pluriel(resume.notes, 'remarque'),
  ].join(', ')
  return `Fichier exporté le ${date} : ${contenu}.`
}

/** Section « Tes données » des Réglages : stockage persistant, export, import. */
export function SectionDonnees() {
  const [persistance, setPersistance] = useState<EtatPersistance | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [enAttente, setEnAttente] = useState<{
    donnees: ExportMoneyTree
    resume: ResumeExport
  } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const champFichier = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void lireEtatPersistance().then(setPersistance)
  }, [])

  async function exporter() {
    setMessage(null)
    setOccupe(true)
    try {
      const donnees = await exporterDonnees()
      telechargerTexte(nomFichierExport(), serialiserExport(donnees))
      setMessage({ type: 'succes', texte: `Export prêt : ${nomFichierExport()}.` })
    } catch {
      setMessage({ type: 'erreur', texte: 'L’export a échoué. Réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  async function lireFichier(evenement: ChangeEvent<HTMLInputElement>) {
    setMessage(null)
    setEnAttente(null)
    const fichier = evenement.target.files?.[0]
    evenement.target.value = '' // Permet de rechoisir le même fichier.
    if (!fichier) return
    const analyse = analyserFichierExport(await fichier.text())
    if (analyse.ok) {
      setEnAttente({ donnees: analyse.donnees, resume: analyse.resume })
    } else {
      setMessage({ type: 'erreur', texte: analyse.erreur })
    }
  }

  async function confirmerImport() {
    if (!enAttente) return
    setOccupe(true)
    try {
      await importerDonnees(enAttente.donnees)
      setEnAttente(null)
      setMessage({ type: 'succes', texte: 'Données importées : l’appli a repris l’état du fichier.' })
    } catch {
      setMessage({ type: 'erreur', texte: 'L’import a échoué : tes données n’ont pas été modifiées.' })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <section className="section" aria-labelledby="reglages-donnees">
      <h2 id="reglages-donnees" className="section__titre">
        Tes données
      </h2>
      <div className="carte">
        <div className="ligne__libelle">
          <span className="ligne__titre">Stockage persistant</span>
          <span className="texte-secondaire" aria-live="polite">
            {persistance ? TEXTE_PERSISTANCE[persistance] : 'Vérification…'}
          </span>
        </div>
        <hr className="separateur" />
        <p className="texte-secondaire">
          Tout reste sur ce téléphone, sauf ce que tu choisis d’envoyer. L’export crée un fichier JSON avec ton profil, ta
          progression, tes parties et tes remarques ; l’import le recharge.
        </p>
        <button
          type="button"
          className="bouton bouton--contour"
          disabled={occupe}
          onClick={() => {
            void exporter()
          }}
        >
          <Icone nom="telecharger" taille={20} />
          Exporter mes données
        </button>
        <button
          type="button"
          className="bouton bouton--contour"
          disabled={occupe}
          onClick={() => champFichier.current?.click()}
        >
          <Icone nom="importer" taille={20} />
          Importer un fichier
        </button>
        <input
          ref={champFichier}
          type="file"
          accept="application/json,.json"
          className="visuellement-masque"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(evenement) => {
            void lireFichier(evenement)
          }}
        />

        {enAttente ? (
          <div className="message" role="alertdialog" aria-labelledby="import-confirmation">
            <p id="import-confirmation">
              {decrireResume(enAttente.resume)} L’import remplacera toutes tes données
              actuelles.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
              <button
                type="button"
                className="bouton bouton--plein"
                disabled={occupe}
                onClick={() => {
                  void confirmerImport()
                }}
              >
                Remplacer mes données
              </button>
              <button
                type="button"
                className="lien-tertiaire"
                style={{ alignSelf: 'center' }}
                onClick={() => {
                  setEnAttente(null)
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p
            className={`message message--${message.type}`}
            role={message.type === 'erreur' ? 'alert' : 'status'}
          >
            {message.texte}
          </p>
        ) : null}
      </div>
    </section>
  )
}
