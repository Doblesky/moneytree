/**
 * Paquet de cartes envoyé au compagnon Android du widget
 * (docs/superpowers/specs/2026-11-24-widget-rappel-design.md) : les cartes des paliers
 * maîtrisés du profil, en texte brut, valeurs officielles et historiques déjà résolues.
 * Il ne contient aucune donnée personnelle.
 */
import { contenuModule, infoModule, NOMS_PALIERS } from '../content/catalogue.ts'
import { analyserTexte, type Segment } from '../content/texte.ts'
import { parametres2026, type Parametres2026 } from '../data/params/index.ts'
import { faitsHistoriques, type FaitsHistoriques } from '../engine/marches.ts'
import { METIERS, type IdMetier } from '../profils/metiers.ts'
import type { EtatProgression } from '../progression/regles.ts'

/** Durées de rotation proposées, en minutes : pas moins de 10, la fenêtre minimale d'une alarme inexacte. */
export const INTERVALLES_WIDGET = [10, 15, 30, 60, 180] as const
export type IntervalleWidget = (typeof INTERVALLES_WIDGET)[number]

export interface CarteWidget {
  id: string
  module: number
  palier: number
  /** Position de la carte dans son palier (de 0), pour la rouvrir dans l'appli. */
  rang: number
  moduleTitre: string
  palierNom: string
  titre: string
  texte: string
  fictif: boolean
}

export interface PaquetWidget {
  /** Version du format, vérifiée par le compagnon. */
  v: 1
  profil: IdMetier
  intervalle: IntervalleWidget
  cartes: CarteWidget[]
}

const texteSegments = (segments: readonly Segment[]): string =>
  segments.map((s) => (s.type === 'gras' ? texteSegments(s.segments) : s.texte)).join('')

/** Texte d'une carte sans balises : paragraphes séparés par une ligne vide, puces « • ». */
export function texteBrut(texte: string, p: Parametres2026, f: FaitsHistoriques): string {
  return analyserTexte(texte, p, f)
    .map((bloc) =>
      bloc.type === 'paragraphe'
        ? texteSegments(bloc.segments)
        : bloc.elements.map((element) => `• ${texteSegments(element)}`).join('\n'),
    )
    .join('\n\n')
}

/** Cartes des paliers maîtrisés, dans l'ordre du parcours du profil. */
export function cartesMaitrisees(etat: EtatProgression): CarteWidget[] {
  const p = parametres2026()
  const f = faitsHistoriques()
  return METIERS[etat.metier].modules.flatMap((moduleId) => {
    const maitrises = etat.modules.find((m) => m.moduleId === moduleId)?.paliersMaitrises ?? 0
    const contenu = contenuModule(moduleId, etat.metier)
    const moduleTitre = infoModule(moduleId, etat.metier)?.titre ?? ''
    return (contenu?.paliers ?? [])
      .filter((palier) => palier.numero <= maitrises)
      .flatMap((palier) =>
        palier.cartes.map((carte, rang) => ({
          id: carte.id,
          module: moduleId,
          palier: palier.numero,
          rang,
          moduleTitre,
          palierNom: NOMS_PALIERS[palier.numero - 1] ?? '',
          titre: carte.titre,
          texte: texteBrut(carte.texte, p, f),
          fictif: carte.exempleFictif === true,
        })),
      )
  })
}

export function construirePaquet(etat: EtatProgression, intervalle: IntervalleWidget): PaquetWidget {
  return { v: 1, profil: etat.metier, intervalle, cartes: cartesMaitrisees(etat) }
}

/** Empreinte FNV-1a 32 bits du paquet, en hexadécimal sur 8 caractères. */
export function signaturePaquet(paquet: PaquetWidget): string {
  const json = JSON.stringify(paquet)
  let empreinte = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    empreinte ^= json.charCodeAt(i)
    empreinte = Math.imul(empreinte, 0x01000193) >>> 0
  }
  return empreinte.toString(16).padStart(8, '0')
}
