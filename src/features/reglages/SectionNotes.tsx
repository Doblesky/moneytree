import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState, type SyntheticEvent } from 'react'
import { partagerFichierTexte, telechargerTexte } from '../../lib/fichier.ts'
import type { Note } from '../../storage/db.ts'
import {
  ajouterNote,
  listerNotes,
  LONGUEUR_MAX_NOTE,
  marquerNote,
  nomFichierNotes,
  supprimerNote,
  texteNotesPourClaude,
} from '../../storage/notes.ts'
import { Icone } from '../../ui/Icone.tsx'

type Message = { type: 'succes' | 'erreur'; texte: string } | null

const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

/** Section « Tes remarques » des Réglages : noter une idée, l'envoyer à Claude, la cocher. */
export function SectionNotes() {
  const idChamp = useId()
  const notes = useLiveQuery(() => listerNotes())
  const [brouillon, setBrouillon] = useState('')
  const [message, setMessage] = useState<Message>(null)
  // Si le presse-papiers est refusé, le texte s'affiche pour une copie à la main.
  const [copieManuelle, setCopieManuelle] = useState(false)

  const aTraiter = (notes ?? []).filter((n) => n.traiteeLe === undefined)
  const traitees = (notes ?? []).filter((n) => n.traiteeLe !== undefined)

  async function ajouter(evenement: SyntheticEvent) {
    evenement.preventDefault()
    setMessage(null)
    try {
      if ((await ajouterNote(brouillon)) !== null) setBrouillon('')
    } catch {
      setMessage({ type: 'erreur', texte: 'La remarque n’a pas pu être enregistrée. Réessaie.' })
    }
  }

  async function envoyer() {
    setMessage(null)
    const nom = nomFichierNotes()
    const contenu = texteNotesPourClaude(aTraiter)
    const resultat = await partagerFichierTexte(nom, contenu)
    if (resultat === 'partage') {
      setMessage({ type: 'succes', texte: 'Envoyé. Si tu as choisi Drive, demande à Claude de lire tes remarques.' })
    } else if (resultat === 'indisponible') {
      telechargerTexte(nom, contenu, 'text/plain')
      setMessage({ type: 'succes', texte: `Partage indisponible ici : ${nom} est téléchargé. Ajoute-le à ton Drive.` })
    }
  }

  async function copier() {
    setMessage(null)
    try {
      await navigator.clipboard.writeText(texteNotesPourClaude(aTraiter))
      setCopieManuelle(false)
      setMessage({ type: 'succes', texte: 'Copié. Colle ce texte dans ta conversation avec Claude.' })
    } catch {
      setCopieManuelle(true)
    }
  }

  return (
    <section className="section" aria-labelledby="reglages-notes">
      <h2 id="reglages-notes" className="section__titre">
        Tes remarques
      </h2>
      <p className="texte-secondaire">
        Un mot à ajouter au glossaire, un écran à revoir, une idée : note-le ici. Quand tu veux qu’on s’en occupe,
        envoie la liste et choisis Drive dans le menu de partage : Claude pourra la lire sur ton Google Drive.
      </p>
      <div className="carte">
        <form
          className="notes__formulaire"
          onSubmit={(e) => {
            void ajouter(e)
          }}
        >
          <label htmlFor={idChamp} className="visuellement-masque">
            Nouvelle remarque
          </label>
          <div className="champ__boite champ__boite--zone">
            <textarea
              id={idChamp}
              className="champ__zone"
              rows={3}
              maxLength={LONGUEUR_MAX_NOTE}
              placeholder="Ex. : je ne comprends pas tel mot du cours"
              value={brouillon}
              onChange={(e) => {
                setBrouillon(e.target.value)
              }}
            />
          </div>
          <button type="submit" className="bouton bouton--contour" disabled={brouillon.trim() === ''}>
            Ajouter la remarque
          </button>
        </form>

        {aTraiter.length > 0 ? (
          <>
            <hr className="separateur" />
            <h3 className="ligne__titre">À traiter ({aTraiter.length})</h3>
            <ul className="notes__liste">
              {aTraiter.map((note) => (
                <LigneNote key={note.id} note={note} />
              ))}
            </ul>
            <button
              type="button"
              className="bouton bouton--plein"
              onClick={() => {
                void envoyer()
              }}
            >
              <Icone nom="importer" taille={20} />
              Envoyer à Claude via Drive
            </button>
            <button
              type="button"
              className="bouton bouton--contour"
              onClick={() => {
                void copier()
              }}
            >
              Copier le texte
            </button>
          </>
        ) : null}

        {copieManuelle && aTraiter.length > 0 ? (
          <div className="champ">
            <label htmlFor={`${idChamp}-copie`} className="texte-secondaire">
              La copie automatique n’a pas marché. Sélectionne ce texte et copie-le :
            </label>
            <div className="champ__boite champ__boite--zone">
              <textarea
                id={`${idChamp}-copie`}
                className="champ__zone"
                rows={5}
                readOnly
                value={texteNotesPourClaude(aTraiter)}
                onFocus={(e) => {
                  e.target.select()
                }}
              />
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

        {traitees.length > 0 ? (
          <details className="notes__traitees">
            <summary className="ligne__titre">Traitées ({traitees.length})</summary>
            <ul className="notes__liste">
              {traitees.map((note) => (
                <LigneNote key={note.id} note={note} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  )
}

function LigneNote({ note }: { note: Note }) {
  const id = note.id
  if (id === undefined) return null
  const traitee = note.traiteeLe !== undefined
  return (
    <li className="note">
      <label className="note__case">
        <input
          type="checkbox"
          checked={traitee}
          aria-label={traitee ? 'Remettre à traiter' : 'Marquer comme traitée'}
          onChange={(e) => {
            void marquerNote(id, e.target.checked)
          }}
        />
        <span className="note__contenu">
          <span className={traitee ? 'note__texte note__texte--traitee' : 'note__texte'}>{note.texte}</span>
          <span className="note-source">{dateCourte(note.creeLe)}</span>
        </span>
      </label>
      {/* Suppression réservée aux remarques traitées : un geste de plus évite les pertes. */}
      {traitee ? (
        <button
          type="button"
          className="bouton-icone bouton-icone--clair"
          aria-label={`Supprimer la remarque : ${note.texte.slice(0, 40)}`}
          onClick={() => {
            void supprimerNote(id)
          }}
        >
          <Icone nom="croix" taille={18} />
        </button>
      ) : null}
    </li>
  )
}
