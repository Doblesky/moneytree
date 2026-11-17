/**
 * Médaillons de progression de la planche : cinq secteurs, un par palier (Découverte,
 * Investisseur autonome, Investisseur averti, Expert, Professionnel). Un secteur se dore
 * quand son palier est maîtrisé ; le palier en cours est tracé en vert de marque.
 */
const SECTEURS = 5
const ECART_DEGRES = 7

function arc(cx: number, cy: number, r: number, debut: number, fin: number): string {
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(rad(debut))
  const y1 = cy + r * Math.sin(rad(debut))
  const x2 = cx + r * Math.cos(rad(fin))
  const y2 = cy + r * Math.sin(rad(fin))
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

function bornesSecteur(i: number): [number, number] {
  const largeur = 360 / SECTEURS
  return [i * largeur + ECART_DEGRES / 2, (i + 1) * largeur - ECART_DEGRES / 2]
}

interface Props {
  numero: number
  /** Paliers maîtrisés (0 à 5). */
  maitrises: number
  /** Palier en cours (1 à 5), tracé en vert. */
  enCours?: number | undefined
  verrouille?: boolean
  taille?: number
  /** Texte lu par les lecteurs d'écran. */
  libelle?: string
}

export function Medaillon({ numero, maitrises, enCours, verrouille = false, taille = 64, libelle }: Props) {
  const accessibilite = libelle ? { role: 'img', 'aria-label': libelle } : { 'aria-hidden': true as const }
  const rosace = Array.from({ length: 16 }, (_, i) => i * 11.25)
  return (
    <svg width={taille} height={taille} viewBox="0 0 100 100" className="medaillon" {...accessibilite}>
      {Array.from({ length: SECTEURS }, (_, i) => {
        const [debut, fin] = bornesSecteur(i)
        const maitrise = i < maitrises
        const actif = enCours === i + 1 && !maitrise
        return (
          <path
            key={i}
            d={arc(50, 50, 44, debut, fin)}
            fill="none"
            stroke={maitrise ? 'var(--or)' : actif ? 'var(--vert-marque)' : 'var(--filet-secteur)'}
            strokeWidth={maitrise || actif ? 6 : 4.5}
            strokeLinecap="butt"
          />
        )
      })}
      <circle cx="50" cy="50" r="37" fill={verrouille ? 'var(--creme-verrouille)' : 'var(--vert-marque)'} />
      {verrouille ? (
        <circle cx="50" cy="50" r="37" fill="none" stroke="var(--filet-verrouille)" strokeDasharray="3 3" />
      ) : (
        <g transform="translate(50 50)" fill="none" stroke="var(--sur-vert)" strokeWidth="0.4" opacity="0.22">
          {rosace.map((angle) => (
            <ellipse key={angle} rx="33" ry="11.9" transform={`rotate(${angle})`} />
          ))}
          <circle r="33.7" />
          <circle r="7.9" />
        </g>
      )}
      <text
        x="50"
        y="61"
        textAnchor="middle"
        fontFamily="Cormorant Garamond, Georgia, serif"
        fontWeight="700"
        fontSize="32"
        style={{ fontVariantNumeric: 'lining-nums' }}
        fill={verrouille ? 'var(--encre-secondaire)' : 'var(--sur-vert)'}
      >
        {numero}
      </text>
    </svg>
  )
}

/** Petit pictogramme d'un palier : son secteur est mis en avant dans l'anneau. */
export function SecteurPalier({
  numero,
  etat,
}: {
  numero: number
  etat: 'maitrise' | 'en-cours' | 'ouvert' | 'verrouille' | 'a-venir'
}) {
  return (
    <svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34" style={{ flex: 'none' }}>
      {Array.from({ length: SECTEURS }, (_, i) => {
        const [debut, fin] = bornesSecteur(i)
        const lui = i === numero - 1
        const couleur =
          lui && etat === 'maitrise'
            ? 'var(--or)'
            : lui && (etat === 'en-cours' || etat === 'ouvert')
              ? 'var(--vert-marque)'
              : 'var(--filet-secteur-clair)'
        return (
          <path key={i} d={arc(17, 17, 13, debut, fin)} fill="none" stroke={couleur} strokeWidth={lui ? 5 : 3.5} />
        )
      })}
      <circle
        cx="17"
        cy="17"
        r="3"
        fill={etat === 'verrouille' || etat === 'a-venir' ? 'var(--filet-verrouille)' : 'var(--vert-marque)'}
      />
    </svg>
  )
}
