/**
 * Mini-calculatrice des questions chiffrées : un pavé tactile (pas de clavier du
 * téléphone qui masque l'écran), le résultat en direct, et un bouton pour le reporter
 * dans le champ de réponse.
 */
import { useId, useState } from 'react'
import { evaluerExpression, resultatEnTexte } from '../../lib/calculatrice.ts'
import { formatNombre } from '../../lib/format.ts'
import { Icone } from '../../ui/Icone.tsx'

const TOUCHES = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', ',', '%', '⌫'] as const
type Touche = (typeof TOUCHES)[number]

const OPERATEURS = new Set<Touche>(['÷', '×', '−', '+', '%', '(', ')'])

export function MiniCalculatrice({ onReporter }: { onReporter: (texte: string) => void }) {
  const [ouverte, setOuverte] = useState(false)
  const [expression, setExpression] = useState('')
  const idAffichage = useId()
  const resultat = evaluerExpression(expression)

  function appuyer(touche: Touche) {
    if (touche === 'C') setExpression('')
    else if (touche === '⌫') setExpression((e) => e.trimEnd().slice(0, -1).trimEnd())
    else if (OPERATEURS.has(touche) && touche !== '(' && touche !== ')' && touche !== '%') {
      setExpression((e) => `${e.trimEnd()} ${touche} `)
    } else setExpression((e) => e + touche)
  }

  if (!ouverte) {
    return (
      <button
        type="button"
        className="lien-tertiaire calculatrice__ouvrir"
        aria-expanded={false}
        onClick={() => {
          setOuverte(true)
        }}
      >
        <Icone nom="calculatrice" taille={18} />
        Calculatrice
      </button>
    )
  }

  return (
    <div className="calculatrice" role="group" aria-label="Calculatrice">
      <div className="calculatrice__ecran">
        <label htmlFor={idAffichage} className="visuellement-cache">
          Calcul
        </label>
        <input
          id={idAffichage}
          className="calculatrice__expression chiffres"
          inputMode="none"
          autoComplete="off"
          value={expression}
          placeholder="Ex. : 3000 × 30 %"
          onChange={(e) => {
            setExpression(e.target.value)
          }}
        />
        <output htmlFor={idAffichage} className="calculatrice__resultat chiffres" aria-live="polite">
          {resultat === null ? (expression.trim() ? '…' : '') : `= ${formatNombre(resultat, { decimales: Number.isInteger(resultat) ? 0 : 2 })}`}
        </output>
      </div>
      <div className="calculatrice__touches">
        {TOUCHES.map((t) => (
          <button
            key={t}
            type="button"
            className={`calculatrice__touche ${OPERATEURS.has(t) ? 'calculatrice__touche--operateur' : ''} ${t === 'C' || t === '⌫' ? 'calculatrice__touche--effacer' : ''}`}
            aria-label={t === '⌫' ? 'Effacer le dernier caractère' : t === 'C' ? 'Tout effacer' : undefined}
            onClick={() => {
              appuyer(t)
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="calculatrice__actions">
        <button
          type="button"
          className="bouton bouton--contour"
          disabled={resultat === null}
          onClick={() => {
            if (resultat !== null) onReporter(resultatEnTexte(resultat))
          }}
        >
          Reporter dans ma réponse
        </button>
        <button
          type="button"
          className="lien-tertiaire"
          onClick={() => {
            setOuverte(false)
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}
