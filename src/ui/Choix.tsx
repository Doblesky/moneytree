import { Icone } from './Icone.tsx'

/** Option d'un groupe de boutons radio (`role="radiogroup"` sur le parent). */
export function Choix({
  choisi,
  onChoisir,
  titre,
  detail,
  verrou,
}: {
  choisi: boolean
  onChoisir: () => void
  titre: string
  detail?: string
  verrou?: string | undefined
}) {
  return (
    <button type="button" role="radio" aria-checked={choisi} className="choix" disabled={Boolean(verrou)} onClick={onChoisir}>
      <span className="choix__texte">
        <span className="choix__titre">{titre}</span>
        {detail ? <span className="texte-secondaire">{detail}</span> : null}
        {verrou ? (
          <span className="texte-secondaire">
            <Icone nom="cadenas" taille={12} /> {verrou}
          </span>
        ) : null}
      </span>
      <span className="choix__coche" aria-hidden="true">
        {choisi ? <Icone nom="coche" taille={14} epaisseur={3} /> : null}
      </span>
    </button>
  )
}
