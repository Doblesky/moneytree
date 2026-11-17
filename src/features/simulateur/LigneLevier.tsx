import { useState, type CSSProperties, type ReactNode } from 'react'
import { formatMontant } from '../../lib/format.ts'
import { Icone, type NomIcone } from '../../ui/Icone.tsx'

/** Une ligne de levier : icône, titre, détail et curseur, validé au relâchement. */
export function LigneLevier({
  icone,
  titre,
  sousTitre,
  valeur,
  max,
  pas,
  onChange,
  desactive,
  libelle,
}: {
  icone: NomIcone
  titre: ReactNode
  sousTitre: string
  valeur: number
  max: number
  pas: number
  onChange: (v: number) => void
  desactive?: boolean
  /** Nom lu par les lecteurs d'écran, quand le titre n'est pas du texte simple. */
  libelle?: string
}) {
  // Valeur en cours de glissement ; null quand on affiche la valeur enregistrée.
  const [glisse, setGlisse] = useState<number | null>(null)
  const brouillon = glisse ?? valeur
  const valider = () => {
    if (glisse !== null && glisse !== valeur) onChange(glisse)
    setGlisse(null)
  }
  return (
    <div className="levier">
      <span className="levier__icone">
        <Icone nom={icone} taille={20} />
      </span>
      <div className="levier__texte">
        <span className="levier__titre">{titre}</span>
        <span className="texte-secondaire chiffres">{sousTitre}</span>
      </div>
      <input
        type="range"
        className="levier__curseur"
        aria-label={libelle ?? (typeof titre === 'string' ? titre : sousTitre)}
        min={0}
        max={max}
        step={pas}
        value={brouillon}
        disabled={desactive}
        style={{ '--remplissage': `${(brouillon / max) * 100}%` } as CSSProperties}
        onChange={(e) => {
          setGlisse(Number(e.target.value))
        }}
        onPointerUp={valider}
        onKeyUp={valider}
        onBlur={valider}
      />
    </div>
  )
}

/** Variation mise en avant : flèche, signe et libellé, jamais la couleur seule. */
export function Variation({ valeur, suffixe }: { valeur: number; suffixe: string }) {
  if (Math.abs(valeur) < 0.5) return <span className="texte-secondaire chiffres">Stable {suffixe}</span>
  const gain = valeur > 0
  return (
    <span className={`variation chiffres ${gain ? 'variation--gain' : 'variation--perte'}`}>
      {gain ? '▲' : '▼'} {formatMontant(valeur, { signe: true })} {suffixe}
    </span>
  )
}
