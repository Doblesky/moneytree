/**
 * Lecture des textes de cours : remplace les valeurs officielles ({p:…}) et les chiffres
 * historiques ({h:…}), puis découpe en paragraphes, puces, gras et liens de glossaire.
 * Module pur, sans React : l'affichage est dans src/ui/TexteRiche.tsx.
 */
import type { Parametres2026 } from '../data/params/schema.ts'
import { libelleMois, type FaitsHistoriques } from '../engine/marches.ts'
import { formatMontant, formatNombre, formatPourcentage } from '../lib/format.ts'

/** `{p:clé}`, `{p:clé*1000}` (valeur × 1 000, en euros) ou `{h:clé}`. */
const MOTIF_VALEUR = /\{([ph]):([A-Za-z0-9.]+(?:\*\d+)?)\}/g

function estCleParametre(cle: string, p: Parametres2026): cle is keyof Parametres2026 {
  return Object.hasOwn(p, cle)
}

/**
 * Valeur d'un paramètre, formatée selon son unité. Avec un multiplicateur (« livretA.taux*1000 »),
 * le produit est affiché en euros : « 17 € », calculé à partir du paramètre officiel.
 */
export function valeurParametre(cleComplete: string, p: Parametres2026): string {
  const [cle = '', multiplicateur] = cleComplete.split('*')
  if (!estCleParametre(cle, p)) throw new Error(`Paramètre inconnu dans un texte : ${cle}`)
  if (multiplicateur !== undefined) {
    const valeur: unknown = p[cle].valeur
    if (typeof valeur !== 'number') throw new Error(`Paramètre non multipliable : ${cle}`)
    const produit = valeur * Number(multiplicateur)
    return formatMontant(produit, { decimales: Number.isInteger(Math.round(produit * 100) / 100) ? 0 : 2 })
  }
  const parametre = p[cle]
  const valeur: unknown = parametre.valeur
  const unite = parametre.unite ?? ''
  if (cle === 'ir.bareme' && Array.isArray(valeur)) {
    const tranches = p['ir.bareme'].valeur
    return tranches
      .map((t, i) => {
        const taux = formatPourcentage(t.taux)
        if (t.jusqua === null) {
          const precedente = tranches[i - 1]?.jusqua ?? 0
          return `${taux} au-delà de ${formatMontant(precedente)}`
        }
        return `${taux} jusqu’à ${formatMontant(t.jusqua)}`
      })
      .join(' ; ')
  }
  if (typeof valeur !== 'number') throw new Error(`Paramètre non affichable dans un texte : ${cle}`)
  if (unite.includes('taux')) return formatPourcentage(valeur)
  // Un montant officiel avec des centimes (3 844,80 €) les garde : l'arrondir le fausserait.
  if (unite.startsWith('€')) return formatMontant(valeur, { decimales: Number.isInteger(valeur) ? 0 : 2 })
  if (unite === 'ans' || unite === 'jours') return `${valeur} ${unite}`
  // Un nombre décimal (150,2 points) s'écrit avec la virgule française.
  if (!Number.isInteger(valeur)) return formatNombre(valeur, { decimales: Math.round(valeur * 10) === valeur * 10 ? 1 : 2 })
  return String(valeur)
}

/** Valeur d'un chiffre historique, formatée. */
export function valeurFait(cle: string, f: FaitsHistoriques): string {
  const pourcent = (x: number) => formatPourcentage(x, { decimales: 1 })
  switch (cle) {
    case 'periode':
      return `${libelleMois(f.premierMois)} à ${libelleMois(f.dernierMois)}`
    case 'inflationAnnuelle':
      return pourcent(f.inflationAnnuelle)
    case 'inflation2022':
      return pourcent(f.inflation2022)
    case 'livretANominal':
      return pourcent(f.livretANominal)
    case 'livretAReel':
      return pourcent(f.livretAReel)
    case 'actionsNominal':
      return pourcent(f.actionsNominal)
    case 'actionsReel':
      return pourcent(f.actionsReel)
    case 'pireBaisse':
      return pourcent(f.pireBaisse)
    case 'pireBaisseDebut':
      return libelleMois(f.pireBaisseDebut)
    case 'pireBaisseFin':
      return libelleMois(f.pireBaisseFin)
    case 'pireAnnee':
      return `${pourcent(f.pireAnnee.rendement)} en ${f.pireAnnee.annee}`
    case 'dixAnsReelMin':
      return pourcent(f.dixAnsReelMin)
    case 'dixAnsReelMax':
      return pourcent(f.dixAnsReelMax)
    case 'dixAnsPartNegatives':
      return formatPourcentage(f.dixAnsPartNegatives, { decimales: 0 })
    case 'volatiliteActions':
      return pourcent(f.volatiliteActions)
    case 'anneesNegatives':
      return `${f.anneesNegatives} sur ${f.anneesCompletes}`
    case 'krach2008Sommet':
      return libelleMois(f.krach2008.sommet)
    case 'krach2008Creux':
      return libelleMois(f.krach2008.creux)
    // Les deux baisses suivantes s'écrivent après « a perdu » : on affiche leur valeur absolue.
    case 'krach2008Baisse':
      return pourcent(Math.abs(f.krach2008.baisse))
    case 'krach2008Retour':
      return libelleMois(f.krach2008.retour)
    case 'covidBaisse':
      return pourcent(Math.abs(f.covid.baisse))
    case 'covidRetour':
      return libelleMois(f.covid.retour)
    case 'cas2007EnUneFois':
      return formatMontant(f.cas2007.enUneFois)
    case 'cas2007En24Mois':
      return formatMontant(f.cas2007.en24Mois)
    case 'tenir':
      return formatMontant(f.tenirOuVendre.tenir)
    case 'vendreAuCreux':
      return formatMontant(f.tenirOuVendre.vendreAuCreux)
    default:
      throw new Error(`Chiffre historique inconnu dans un texte : ${cle}`)
  }
}

/**
 * Typographie française des textes rédigés à la main : espace fine insécable entre les
 * groupes de milliers (« 1 000 »), espace insécable avant €, % et les signes doubles, pour
 * qu'un nombre ne soit jamais coupé de son unité en fin de ligne.
 */
export function typographie(texte: string): string {
  return texte
    .replace(/(\d) (?=\d{3}(?!\d))/g, '$1 ')
    .replace(/(\d) (?=[€%])/g, '$1 ')
    .replace(/ (?=[:;?!»])/g, ' ')
    .replace(/« /g, '« ')
}

export function remplacerValeurs(texte: string, p: Parametres2026, f: FaitsHistoriques): string {
  return typographie(
    texte.replace(MOTIF_VALEUR, (_tout, type: string, cle: string) =>
      type === 'p' ? valeurParametre(cle, p) : valeurFait(cle, f),
    ),
  )
}

/** Clés {p:…} et {h:…} citées dans un texte. */
export function clesCitees(texte: string): { parametres: string[]; faits: string[] } {
  const parametres: string[] = []
  const faits: string[] = []
  for (const [, type, cle] of texte.matchAll(MOTIF_VALEUR)) {
    if (cle) (type === 'p' ? parametres : faits).push(cle)
  }
  return { parametres, faits }
}

/** Segment sans mise en forme imbriquée : texte simple ou lien de glossaire. */
export type SegmentSimple = { type: 'texte'; texte: string } | { type: 'glossaire'; texte: string; cle: string }

/** Le gras peut contenir un lien de glossaire (« **onze [[échelons|echelon]]** »). */
export type Segment = SegmentSimple | { type: 'gras'; segments: SegmentSimple[] }

export type Bloc = { type: 'paragraphe'; segments: Segment[] } | { type: 'liste'; elements: Segment[][] }

const MOTIF_GLOSSAIRE = /\[\[([^\]|]+)\|([a-z0-9-]+)\]\]/g
const MOTIF_GRAS = /\*\*([^*]+)\*\*/g

function decouperLiens(ligne: string): SegmentSimple[] {
  const segments: SegmentSimple[] = []
  let position = 0
  for (const correspondance of ligne.matchAll(MOTIF_GLOSSAIRE)) {
    const debut = correspondance.index
    if (debut > position) segments.push({ type: 'texte', texte: ligne.slice(position, debut) })
    const [tout, texteLien = '', cle = ''] = correspondance
    segments.push({ type: 'glossaire', texte: texteLien, cle })
    position = debut + tout.length
  }
  if (position < ligne.length) segments.push({ type: 'texte', texte: ligne.slice(position) })
  return segments
}

/** Le gras d'abord, puis les liens de glossaire, dedans comme dehors. */
export function decouperSegments(ligne: string): Segment[] {
  const segments: Segment[] = []
  let position = 0
  for (const correspondance of ligne.matchAll(MOTIF_GRAS)) {
    const debut = correspondance.index
    if (debut > position) segments.push(...decouperLiens(ligne.slice(position, debut)))
    const [tout, gras = ''] = correspondance
    segments.push({ type: 'gras', segments: decouperLiens(gras) })
    position = debut + tout.length
  }
  if (position < ligne.length) segments.push(...decouperLiens(ligne.slice(position)))
  return segments
}

/** Clés de glossaire citées dans un texte, gras compris. */
export function clesGlossaire(texte: string): string[] {
  return [...texte.matchAll(MOTIF_GLOSSAIRE)].map(([, , cle = '']) => cle)
}

export function analyserTexte(texte: string, p: Parametres2026, f: FaitsHistoriques): Bloc[] {
  const blocs: Bloc[] = []
  for (const paragraphe of remplacerValeurs(texte, p, f).split(/\n\s*\n/)) {
    const lignes = paragraphe.split('\n').filter((l) => l.trim() !== '')
    if (lignes.length === 0) continue
    if (lignes.every((l) => l.trimStart().startsWith('- '))) {
      blocs.push({
        type: 'liste',
        elements: lignes.map((l) => decouperSegments(l.trimStart().slice(2))),
      })
    } else {
      blocs.push({ type: 'paragraphe', segments: decouperSegments(lignes.join(' ')) })
    }
  }
  return blocs
}
