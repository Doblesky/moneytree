/**
 * Formatage des nombres et des montants selon la typographie française de la planche
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
