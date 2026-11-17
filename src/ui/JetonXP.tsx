/**
 * Jeton d'XP de la planche : sceau doré dentelé et feuille gravée, sans aucun signe
 * monétaire (rien qui rappelle les euros du simulateur).
 */
import { formatNombre } from '../lib/format.ts'

const DENTS = 20

function sceau(r1: number, r2: number): string {
  const points: string[] = []
  for (let i = 0; i < DENTS * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2
    const angle = (i * Math.PI) / DENTS
    points.push(`${(20 + r * Math.cos(angle)).toFixed(2)},${(20 + r * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

export function SceauXP({ taille = 28 }: { taille?: number }) {
  return (
    <svg aria-hidden="true" width={taille} height={taille} viewBox="0 0 40 40" style={{ flex: 'none' }}>
      <polygon points={sceau(19, 16.5)} fill="var(--or)" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="var(--or-sombre)" strokeWidth="0.8" opacity="0.6" />
      <path
        d="M20 27c-4-3-5.5-7-3-11.5 1 3 3 4.5 3 4.5s2-1.5 3-4.5c2.5 4.5 1 8.5-3 11.5z"
        fill="var(--or-sombre)"
        opacity="0.85"
      />
      <path d="M20 27v3" stroke="var(--or-sombre)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

/** Pastille « +20 XP ». */
export function JetonXP({ xp }: { xp: number }) {
  return (
    <span className="jeton-xp chiffres">
      <SceauXP taille={26} />+{formatNombre(xp)} XP
    </span>
  )
}
