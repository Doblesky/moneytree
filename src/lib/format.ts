/**
 * Formatage des nombres, des montants et des dates selon la typographie française de la planche
 * de direction artistique :
 * - espace fine insécable (U+202F) entre les groupes de milliers : « 18 450 » ;
 * - espace insécable (U+00A0) avant le symbole € : « 18 450 € » ;
 * - signe moins typographique (U+2212) : « −7 200 € » ;
 * - virgule décimale : « 1 234,56 € ».
 *
 * Écrit à la main plutôt qu'avec Intl.NumberFormat, dont la sortie dépend de la version
 * d'ICU du navigateur (espaces et signe moins variables) : ici, le résultat est identique
 * partout et vérifiable par les tests.
 */

export const ESPACE_FINE_INSECABLE = ' '
export const ESPACE_INSECABLE = ' '
export const SIGNE_MOINS = '−'

export interface OptionsNombre {
  /** Nombre de décimales affichées (0 par défaut). */
  decimales?: number
  /** Affiche « + » devant une valeur strictement positive, pour une variation. */
  signe?: boolean
}

export interface OptionsMontant extends OptionsNombre {
  /** Ajoute « € » après le nombre (oui par défaut). */
  devise?: boolean
}

/** Arrondi au plus proche, demi vers l'infini (évite que 1,005 devienne 1,00). */
function arrondir(valeurAbsolue: number, decimales: number): number {
  const texte = String(valeurAbsolue)
  // Les très petits nombres s'écrivent en notation scientifique (« 1e-7 ») : le décalage
  // par l'exposant ne s'applique plus, on revient à une multiplication.
  if (texte.includes('e')) return Math.round(valeurAbsolue * 10 ** decimales) / 10 ** decimales
  return Number(`${Math.round(Number(`${texte}e${decimales}`))}e-${decimales}`)
}

/** Au-delà, toFixed passe en notation scientifique. */
const VALEUR_MAX = 1e21

function grouperMilliers(chiffres: string): string {
  let resultat = ''
  for (let i = 0; i < chiffres.length; i++) {
    const resteAPlacer = chiffres.length - i
    if (i > 0 && resteAPlacer % 3 === 0) resultat += ESPACE_FINE_INSECABLE
    resultat += chiffres.charAt(i)
  }
  return resultat
}

/** « 18450 » → « 18 450 » ; « -7200.5 » avec 1 décimale → « −7 200,5 ». */
export function formatNombre(valeur: number, options: OptionsNombre = {}): string {
  const { decimales = 0, signe = false } = options
  if (!Number.isFinite(valeur) || Math.abs(valeur) >= VALEUR_MAX) {
    throw new RangeError(`Impossible de formater cette valeur : ${String(valeur)}`)
  }
  if (!Number.isInteger(decimales) || decimales < 0 || decimales > 10) {
    throw new RangeError(`Nombre de décimales invalide : ${decimales}`)
  }

  const arrondi = arrondir(Math.abs(valeur), decimales)
  const [partieEntiere = '0', partieDecimale] = arrondi.toFixed(decimales).split('.')
  const corps =
    partieDecimale === undefined
      ? grouperMilliers(partieEntiere)
      : `${grouperMilliers(partieEntiere)},${partieDecimale}`

  // Une valeur qui s'arrondit à zéro s'affiche sans signe (pas de « −0 »).
  if (arrondi === 0) return corps
  if (valeur < 0) return `${SIGNE_MOINS}${corps}`
  return signe ? `+${corps}` : corps
}

/** « 18450 » → « 18 450 € » ; « -7200 » → « −7 200 € » ; signe : « +320 € ». */
export function formatMontant(valeur: number, options: OptionsMontant = {}): string {
  const { devise = true, ...optionsNombre } = options
  const nombre = formatNombre(valeur, optionsNombre)
  return devise ? `${nombre}${ESPACE_INSECABLE}€` : nombre
}

/**
 * Taux décimal → pourcentage français : 0,017 → « 1,7 % », 0,4525 → « 45,25 % ».
 * Par défaut, jusqu'à deux décimales, sans zéros inutiles.
 */
export function formatPourcentage(
  taux: number,
  options: { decimales?: number; decimalesMax?: number; signe?: boolean } = {},
): string {
  const valeur = taux * 100
  let texte: string
  if (options.decimales !== undefined) {
    texte = formatNombre(valeur, { decimales: options.decimales, signe: options.signe ?? false })
  } else {
    const max = options.decimalesMax ?? 2
    texte = formatNombre(valeur, { decimales: max, signe: options.signe ?? false })
    if (texte.includes(',')) texte = texte.replace(/0+$/, '').replace(/,$/, '')
  }
  return `${texte}${ESPACE_INSECABLE}%`
}

/** Montant court pour les axes des graphiques : « 15 k », « 1,2 M ». */
export function montantCourt(valeur: number): string {
  const abs = Math.abs(valeur)
  if (abs >= 1e6) return `${formatNombre(valeur / 1e6, { decimales: 1 })}${ESPACE_INSECABLE}M`
  if (abs >= 1e3) return `${formatNombre(valeur / 1e3)}${ESPACE_INSECABLE}k`
  return formatNombre(valeur)
}

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const

/**
 * Intl ne sert qu'au passage à l'heure de Paris (heure d'été comprise) : on ne lui demande
 * que des nombres, assemblés ensuite à la main pour la même raison que ci-dessus.
 */
const HEURE_DE_PARIS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

/** Date et heure de Paris : « 1er novembre 2026 à 9 h 05 », « 17 novembre 2026 à 14 h 32 ». */
export function formatDateHeure(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('Date invalide')
  const parties: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {}
  for (const { type, value } of HEURE_DE_PARIS.formatToParts(date)) {
    if (type !== 'literal') parties[type] = Number(value)
  }
  const { year: annee, month: mois, day: jour, hour: heure, minute } = parties
  if (annee === undefined || mois === undefined || jour === undefined) {
    throw new RangeError('Date illisible')
  }
  if (heure === undefined || minute === undefined) throw new RangeError('Heure illisible')
  const nomJour = jour === 1 ? '1er' : String(jour)
  const minutes = String(minute).padStart(2, '0')
  return `${nomJour} ${MOIS[mois - 1] ?? ''} ${annee} à ${heure}${ESPACE_INSECABLE}h${ESPACE_INSECABLE}${minutes}`
}
