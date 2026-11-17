import type { Question } from '../../content/schema.ts'

/** Lit une saisie française : « 1 102,50 » → 1102.5 ; null si ce n'est pas un nombre. */
export function lireNombre(texte: string): number | null {
  const propre = texte.replace(/[\s\u202F\u00A0]/g, '').replace(',', '.').replace(/[€%]/g, '')
  if (propre === '' || propre === '-' || propre === '.' || !/^-?\d*\.?\d*$/.test(propre)) return null
  const n = Number(propre)
  return Number.isFinite(n) ? n : null
}

/** Une réponse est juste si c'est le bon choix, ou un nombre dans la tolérance. */
export function estJuste(question: Question, reponse: number | string): boolean {
  if (question.type === 'qcm') return reponse === question.bonne
  const n = typeof reponse === 'number' ? reponse : lireNombre(reponse)
  return n !== null && Math.abs(n - question.reponse) <= question.tolerance + 1e-9
}
