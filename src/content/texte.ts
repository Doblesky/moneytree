/**
 * Lecture des textes de cours : remplace les valeurs officielles ({p:…}) et les chiffres
 * historiques ({h:…}), puis découpe en paragraphes, puces, gras et liens de glossaire.
 * Module pur, sans React : l'affichage est dans src/ui/TexteRiche.tsx.
 */
import type { Parametres2026 } from '../data/params/schema.ts'
import { libelleMois, type FaitsHistoriques } from '../engine/marches.ts'
import { formatMontant, formatPourcentage } from '../lib/format.ts'

const MOTIF_VALEUR = /\{([ph]):([A-Za-z0-9.]+)\}/g

function estCleParametre(cle: string, p: Parametres2026): cle is keyof Parametres2026 {
  return Object.hasOwn(p, cle)
}

/** Valeur d'un paramètre, formatée selon son unité. */
export function valeurParametre(cle: string, p: Parametres2026): string {
  if (!estCleParametre(cle, p)) throw new Error(`Paramètre inconnu dans un texte : ${cle}`)
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
  if (unite.startsWith('€')) return formatMontant(valeur)
  if (unite === 'ans') return `${valeur} ans`
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
    default:
      throw new Error(`Chiffre historique inconnu dans un texte : ${cle}`)
  }
}

export function remplacerValeurs(texte: string, p: Parametres2026, f: FaitsHistoriques): string {
  return texte.replace(MOTIF_VALEUR, (_tout, type: string, cle: string) =>
    type === 'p' ? valeurParametre(cle, p) : valeurFait(cle, f),
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

export type Segment =
  | { type: 'texte'; texte: string }
  | { type: 'gras'; texte: string }
  | { type: 'glossaire'; texte: string; cle: string }

export type Bloc = { type: 'paragraphe'; segments: Segment[] } | { type: 'liste'; elements: Segment[][] }

const MOTIF_ENRICHI = /\[\[([^\]|]+)\|([a-z0-9-]+)\]\]|\*\*([^*]+)\*\*/g

export function decouperSegments(ligne: string): Segment[] {
  const segments: Segment[] = []
  let position = 0
  for (const correspondance of ligne.matchAll(MOTIF_ENRICHI)) {
    const debut = correspondance.index
    if (debut > position) segments.push({ type: 'texte', texte: ligne.slice(position, debut) })
    const [tout, texteLien, cle, gras] = correspondance
    if (texteLien && cle) segments.push({ type: 'glossaire', texte: texteLien, cle })
    else if (gras) segments.push({ type: 'gras', texte: gras })
    position = debut + tout.length
  }
  if (position < ligne.length) segments.push({ type: 'texte', texte: ligne.slice(position) })
  return segments
}

/** Clés de glossaire citées dans un texte. */
export function clesGlossaire(texte: string): string[] {
  return [...texte.matchAll(MOTIF_ENRICHI)].flatMap(([, , cle]) => (cle ? [cle] : []))
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
