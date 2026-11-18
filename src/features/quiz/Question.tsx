/**
 * Une question de quiz : QCM ou réponse chiffrée, puis l'explication, juste ou non
 * (maquettes 6a et 6b). Une seule action par écran : valider, puis continuer.
 */
import { useId, useState } from 'react'
import { remplacerValeurs } from '../../content/texte.ts'
import type { Question as TypeQuestion } from '../../content/schema.ts'
import { parametres2026 } from '../../data/params/index.ts'
import { faitsHistoriques } from '../../engine/marches.ts'
import { formatNombre } from '../../lib/format.ts'
import { XP } from '../../progression/gamification.ts'
import { Icone } from '../../ui/Icone.tsx'
import { JetonXP } from '../../ui/JetonXP.tsx'
import { TexteEnLigne, TexteRiche } from '../../ui/TexteRiche.tsx'
import { MiniCalculatrice } from './MiniCalculatrice.tsx'
import { estJuste, lireNombre } from './reponses.ts'

const LETTRES = ['A', 'B', 'C', 'D'] as const

interface Props {
  question: TypeQuestion
  rang: number
  total: number
  /** Appelé une fois la réponse validée, avec la réponse donnée (texte du choix ou saisie). */
  onRepondu: (juste: boolean, donnee: string) => void
  /** Appelé pour passer à la question suivante. */
  onSuivante: () => void
  dernier: boolean
  onRevoirCarte?: ((carteId: string) => void) | undefined
  /** Étiquette d'une question de révision (« Révision · module 3 »). */
  etiquette?: string | undefined
  /** Mode examen : pas de correction après la réponse, on passe directement à la suite. */
  sansCorrection?: boolean
}

export function Question({
  question,
  rang,
  total,
  onRepondu,
  onSuivante,
  dernier,
  onRevoirCarte,
  etiquette,
  sansCorrection = false,
}: Props) {
  const [choix, setChoix] = useState<number | null>(null)
  const [saisie, setSaisie] = useState('')
  const [valide, setValide] = useState(false)
  const idSaisie = useId()
  const p = parametres2026()
  const f = faitsHistoriques()

  const reponse = question.type === 'qcm' ? choix : saisie
  const juste = valide && reponse !== null && estJuste(question, reponse)
  const peutValider = question.type === 'qcm' ? choix !== null : lireNombre(saisie) !== null

  function valider() {
    if (!peutValider || valide || reponse === null) return
    const donnee = question.type === 'qcm' ? remplacerValeurs(question.choix[choix ?? 0] ?? '', p, f) : saisie
    onRepondu(estJuste(question, reponse), donnee)
    if (sansCorrection) {
      onSuivante()
      return
    }
    setValide(true)
  }

  const xp = question.type === 'calcul' ? XP.bonneReponseCalcul : XP.bonneReponseQcm

  return (
    <div className="question">
      <div className="question__corps">
        <div className="question__entete">
          <span className="surtitre">
            Question {rang} sur {total} · {question.type === 'qcm' ? 'QCM' : 'Calcul'}
          </span>
          {etiquette ? <span className="etiquette etiquette--nouveau">{etiquette}</span> : null}
          {question.exempleFictif ? <span className="etiquette etiquette--fictif">Exemple fictif</span> : null}
        </div>
        <h2 className="question__enonce">
          <TexteEnLigne texte={question.enonce} />
        </h2>

        {question.type === 'qcm' ? (
          <div className="reponses" role="radiogroup" aria-label="Réponses">
            {question.choix.map((texte, i) => {
              const etat = !valide
                ? choix === i
                  ? 'choisie'
                  : ''
                : i === question.bonne
                  ? 'bonne'
                  : choix === i
                    ? 'fausse'
                    : 'neutre'
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={choix === i}
                  disabled={valide}
                  className={`reponse reponse--${etat || 'repos'}`}
                  onClick={() => {
                    setChoix(i)
                  }}
                >
                  <span className="reponse__lettre">{LETTRES[i]}</span>
                  <span className="reponse__texte">{remplacerValeurs(texte, p, f)}</span>
                  {etat === 'bonne' ? (
                    <span className="reponse__statut">
                      <Icone nom="coche" taille={16} epaisseur={2.6} />
                      Bonne réponse
                    </span>
                  ) : etat === 'fausse' ? (
                    <span className="reponse__statut">
                      <Icone nom="croix" taille={16} epaisseur={2.6} />
                      Ta réponse
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="champ">
            <label htmlFor={idSaisie} className="champ__libelle">
              Ta réponse{question.unite === '€' ? ', arrondie à l’euro' : ''}
            </label>
            <div className={`champ__boite champ__boite--grand ${valide ? (juste ? 'champ__boite--juste' : 'champ__boite--faux') : ''}`}>
              <input
                id={idSaisie}
                className="champ__saisie chiffres"
                inputMode="decimal"
                autoComplete="off"
                value={saisie}
                disabled={valide}
                onChange={(e) => {
                  setSaisie(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') valider()
                }}
              />
              <span className="champ__unite">{question.unite}</span>
              {valide ? <Icone nom={juste ? 'coche' : 'croix'} taille={20} epaisseur={2.4} /> : null}
            </div>
            {valide && !juste ? (
              <p className="texte-secondaire">
                Réponse attendue : <strong className="chiffres">{formatNombre(question.reponse, { decimales: Number.isInteger(question.reponse) ? 0 : 2 })} {question.unite}</strong>
              </p>
            ) : null}
            {valide ? null : <MiniCalculatrice onReporter={setSaisie} />}
          </div>
        )}
      </div>

      {valide ? (
        <section
          className={`retour ${juste ? 'retour--juste' : 'retour--faux'} apparition`}
          aria-live="polite"
          aria-labelledby="retour-titre"
        >
          <div className="retour__titre-ligne">
            <span className="retour__pastille" aria-hidden="true">
              <Icone nom={juste ? 'coche' : 'croix'} taille={16} epaisseur={3} />
            </span>
            <h3 id="retour-titre" className="retour__titre">
              {juste ? 'Juste !' : 'Pas tout à fait'}
            </h3>
          </div>
          <TexteRiche texte={question.explication} />
          {juste ? <JetonXP xp={xp} /> : null}
          {!juste && question.carte && onRevoirCarte ? (
            <button
              type="button"
              className="lien-tertiaire"
              onClick={() => {
                if (question.carte) onRevoirCarte(question.carte)
              }}
            >
              <Icone nom="livre" taille={18} />
              Revoir la carte
            </button>
          ) : null}
          {question.sources.length > 0 ? (
            <p className="note-source">
              Source :{' '}
              {question.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 ? ' · ' : ''}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.libelle}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
          <button type="button" className="bouton bouton--plein" onClick={onSuivante}>
            {dernier ? 'Voir le résultat' : 'Question suivante'}
            <Icone nom="suivant" taille={20} epaisseur={2} />
          </button>
        </section>
      ) : (
        <div className="question__pied">
          <button type="button" className="bouton bouton--plein" disabled={!peutValider} onClick={valider}>
            {sansCorrection ? (dernier ? 'Valider et voir le résultat' : 'Valider et continuer') : 'Valider'}
          </button>
        </div>
      )}
    </div>
  )
}
