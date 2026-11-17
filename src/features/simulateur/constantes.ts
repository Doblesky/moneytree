export const MOIS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const

export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const

/** Graduations de l'axe du temps : des années entières. */
export const ANNEES_ENTIERES = [12, 24, 36, 60, 120]

/** Lit un montant saisi en français (« 1 000,50 »). */
export function lireMontant(texte: string): number {
  const n = Number(texte.replace(/[\s\u202F\u00A0]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : Number.NaN
}
