/**
 * Rosace « spirographe » de la planche : ellipses tournées et couronne de cercles.
 * Décor discret réservé aux en-têtes, aux cartes importantes et aux écrans de réussite.
 * Proportions relevées sur la rosace d'en-tête de l'écran Accueil (220 px de côté).
 */
const ROTATIONS_ELLIPSES = Array.from({ length: 24 }, (_, i) => i * 7.5)
const ANGLES_CERCLES = Array.from({ length: 36 }, (_, i) => (i * 10 * Math.PI) / 180)

interface Props {
  taille: number
  opacite?: number
  className?: string
}

export function Rosace({ taille, opacite = 0.16, className }: Props) {
  const r = taille / 2
  const rayonCouronne = 0.305 * taille
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={taille}
      height={taille}
      viewBox={`0 0 ${taille} ${taille}`}
    >
      <g
        transform={`translate(${r} ${r})`}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity={opacite}
      >
        {ROTATIONS_ELLIPSES.map((angle) => (
          <ellipse
            key={`e${angle}`}
            rx={0.491 * taille}
            ry={0.177 * taille}
            transform={`rotate(${angle})`}
          />
        ))}
        {ANGLES_CERCLES.map((angle) => (
          <circle
            key={`c${angle}`}
            cx={(rayonCouronne * Math.cos(angle)).toFixed(1)}
            cy={(rayonCouronne * Math.sin(angle)).toFixed(1)}
            r={0.186 * taille}
          />
        ))}
        <circle r={0.5 * taille} />
        <circle r={0.118 * taille} />
      </g>
    </svg>
  )
}
