/**
 * Progression dans les cours et les quiz : paliers maîtrisés, reprise, répétition espacée,
 * XP, série de jours, badges et déblocages. Chaque opération est une transaction : l'état
 * reste cohérent même si l'appli est fermée au milieu d'un enregistrement.
 */
import { LEVIERS, moduleSuivant, origine, palier as palierDuModule, type Levier } from '../content/catalogue.ts'
import { METIERS, metierDe } from '../profils/metiers.ts'
import { bilanExamenBlanc, type BilanExamenBlanc } from '../progression/examenBlanc.ts'
import { bonnesReponsesRequises, examenReussi } from '../progression/examens.ts'
import { BADGES, SEUIL_MAITRISE, serieDeJours, XP, type Badge } from '../progression/gamification.ts'
import { apresReponse, jourLocal } from '../progression/leitner.ts'
import {
  avancementGlobal,
  carriereOuverte,
  moduleTermine,
  paliersValides,
  type EtatProgression,
} from '../progression/regles.ts'
import { db, type BaseMoneyTree, type Profil, type ProgressionModule } from './db.ts'
import { lireProfil, profilParDefaut } from './profil.ts'

export async function lireEtatProgression(base: BaseMoneyTree = db): Promise<EtatProgression> {
  const [profil, modules] = await Promise.all([lireProfil(base), base.progression.toArray()])
  return {
    metier: metierDe(profil),
    modeExpert: profil.modeExpert,
    modules,
    leviersForces: profil.leviersForces ?? [],
  }
}

async function lireProgression(base: BaseMoneyTree, moduleId: number): Promise<ProgressionModule> {
  return (
    (await base.progression.get(moduleId)) ?? {
      moduleId,
      paliersMaitrises: 0,
      majLe: new Date().toISOString(),
    }
  )
}

async function ecrireProfil(base: BaseMoneyTree, modif: (p: Profil) => Profil): Promise<Profil> {
  const actuel = (await base.profil.get('moi')) ?? profilParDefaut()
  const nouveau = { ...modif(actuel), majLe: new Date().toISOString() }
  await base.profil.put(nouveau)
  return nouveau
}

/** Ajoute de l'activité à la journée (XP, questions, paliers) : elle compte pour la série. */
async function noterJournee(
  base: BaseMoneyTree,
  ajout: { xp?: number; questions?: number; paliers?: number },
  maintenant: Date,
): Promise<void> {
  const date = jourLocal(maintenant)
  const actuelle = (await base.journees.get(date)) ?? { date, xp: 0, questions: 0, paliers: 0 }
  await base.journees.put({
    date,
    xp: actuelle.xp + (ajout.xp ?? 0),
    questions: actuelle.questions + (ajout.questions ?? 0),
    paliers: actuelle.paliers + (ajout.paliers ?? 0),
  })
}

async function attribuerBadges(base: BaseMoneyTree, candidats: Badge[]): Promise<Badge[]> {
  const profil = await lireProfil(base)
  const deja = new Set(profil.badges ?? [])
  const nouveaux = candidats.filter((b) => !deja.has(b) && b in BADGES)
  if (nouveaux.length > 0) {
    await ecrireProfil(base, (p) => ({ ...p, badges: [...(p.badges ?? []), ...nouveaux] }))
  }
  return nouveaux
}

/** Mémorise la carte affichée, pour reprendre plus tard au même endroit. */
export async function noterCarte(
  moduleId: number,
  palier: number,
  carte: number,
  base: BaseMoneyTree = db,
): Promise<void> {
  await base.transaction('rw', base.progression, async () => {
    const actuelle = await lireProgression(base, moduleId)
    await base.progression.put({ ...actuelle, enCours: { palier, carte }, majLe: new Date().toISOString() })
  })
}

export interface ReponseQuiz {
  questionId: string
  juste: boolean
  type: 'qcm' | 'calcul'
  /** Question d'un quiz précédent glissée en révision : elle ne compte pas pour la maîtrise. */
  revision?: boolean
}

export interface ResultatQuiz {
  justes: number
  total: number
  score: number
  /** Questions de révision tirées des quiz précédents. */
  revisions: { justes: number; total: number }
  maitrise: boolean
  /** Le palier vient d'être maîtrisé pour la première fois. */
  nouveauPalier: boolean
  xpGagne: number
  nouveauxBadges: Badge[]
  /** Module terminé à l'instant (palier Découverte) : il débloque la suite. */
  moduleTermine: number | null
  leviersDebloques: Levier[]
  moduleOuvert: number | null
  carriereOuverte: boolean
}

function xpReponses(reponses: readonly ReponseQuiz[]): number {
  return reponses.reduce(
    (somme, r) => somme + (r.juste ? (r.type === 'calcul' ? XP.bonneReponseCalcul : XP.bonneReponseQcm) : 0),
    0,
  )
}

async function enregistrerReponses(
  base: BaseMoneyTree,
  reponses: readonly ReponseQuiz[],
  maintenant: Date,
): Promise<void> {
  for (const r of reponses) {
    const entree = await base.reponses.get(r.questionId)
    await base.reponses.put(apresReponse(entree, r.questionId, r.juste, maintenant))
  }
}

/** Fin du quiz d'un palier : répétition espacée, XP, palier maîtrisé, déblocages, badges. */
export async function terminerQuizPalier(
  moduleId: number,
  numeroPalier: number,
  reponses: readonly ReponseQuiz[],
  base: BaseMoneyTree = db,
  maintenant: Date = new Date(),
): Promise<ResultatQuiz> {
  return base.transaction('rw', [base.profil, base.progression, base.reponses, base.journees], async () => {
    const etatAvant = await lireEtatProgression(base)
    // La maîtrise ne porte que sur les questions du palier ; les révisions alimentent la
    // répétition espacée et l'XP.
    const duPalier = reponses.filter((r) => !r.revision)
    const revisions = reponses.filter((r) => r.revision)
    const justes = duPalier.filter((r) => r.juste).length
    const total = duPalier.length
    const score = total > 0 ? justes / total : 0
    const maitrise = score >= SEUIL_MAITRISE

    await enregistrerReponses(base, reponses, maintenant)

    const progression = await lireProgression(base, moduleId)
    const nouveauPalier = maitrise && progression.paliersMaitrises === numeroPalier - 1
    const cleScore = String(numeroPalier)
    await base.progression.put({
      ...progression,
      paliersMaitrises: nouveauPalier ? numeroPalier : progression.paliersMaitrises,
      enCours: maitrise ? undefined : progression.enCours,
      meilleursScores: {
        ...progression.meilleursScores,
        [cleScore]: Math.max(progression.meilleursScores?.[cleScore] ?? 0, score),
      },
      maitrisesLe: nouveauPalier
        ? { ...progression.maitrisesLe, [cleScore]: jourLocal(maintenant) }
        : progression.maitrisesLe,
      majLe: maintenant.toISOString(),
    })

    const termineMaintenant = nouveauPalier && numeroPalier === 1
    let xpGagne = xpReponses(reponses)
    if (nouveauPalier) xpGagne += XP.palierMaitrise
    if (termineMaintenant) xpGagne += XP.moduleTermine
    await ecrireProfil(base, (p) => ({ ...p, xp: (p.xp ?? 0) + xpGagne }))
    await noterJournee(base, { xp: xpGagne, questions: reponses.length, paliers: nouveauPalier ? 1 : 0 }, maintenant)

    const etatApres = await lireEtatProgression(base)
    const candidats: Badge[] = []
    if (nouveauPalier) candidats.push('premier-palier')
    if (moduleTermine(etatApres, 0)) candidats.push('bases')
    if (score === 1 && total > 0) candidats.push('sans-faute')
    if (METIERS[etatApres.metier].modulesCarriere.every((id) => moduleTermine(etatApres, id))) candidats.push('trois-modules')
    const jours = (await base.journees.toArray()).map((j) => j.date)
    if (serieDeJours(jours, jourLocal(maintenant)) >= 7) candidats.push('serie-7')
    const nouveauxBadges = await attribuerBadges(base, candidats)

    const leviersDebloques = nouveauPalier
      ? (Object.keys(LEVIERS) as Levier[]).filter(
          (l) =>
            LEVIERS[l].module === moduleId &&
            (LEVIERS[l].palier ?? 1) === numeroPalier &&
            !METIERS[etatApres.metier].leviersAbsents.includes(l),
        )
      : []
    const suivant = moduleSuivant(moduleId, etatApres.metier)
    return {
      justes,
      total,
      score,
      revisions: { justes: revisions.filter((r) => r.juste).length, total: revisions.length },
      maitrise,
      nouveauPalier,
      xpGagne,
      nouveauxBadges,
      moduleTermine: termineMaintenant ? moduleId : null,
      leviersDebloques,
      moduleOuvert: termineMaintenant && suivant ? suivant.id : null,
      carriereOuverte: carriereOuverte(etatApres) && !carriereOuverte(etatAvant),
    }
  })
}

export interface ResultatExamen {
  justes: number
  total: number
  requis: number
  score: number
  reussi: boolean
  /** Le palier vient d'être validé pour la première fois. */
  nouvelleValidation: boolean
  xpGagne: number
  nouveauxBadges: Badge[]
}

/**
 * Fin d'un examen de validation : répétition espacée, XP, palier validé à la première
 * réussite. Les tentatives ratées restent comptées, sans pénalité.
 */
export async function terminerExamen(
  moduleId: number,
  numeroPalier: number,
  reponses: readonly ReponseQuiz[],
  base: BaseMoneyTree = db,
  maintenant: Date = new Date(),
): Promise<ResultatExamen> {
  return base.transaction('rw', [base.profil, base.progression, base.reponses, base.journees], async () => {
    const justes = reponses.filter((r) => r.juste).length
    const total = reponses.length
    const score = total > 0 ? justes / total : 0
    const reussi = examenReussi(justes, total)
    await enregistrerReponses(base, reponses, maintenant)

    const progression = await lireProgression(base, moduleId)
    const cle = String(numeroPalier)
    const avant = progression.examens?.[cle]
    const nouvelleValidation = reussi && avant?.valideLe === undefined
    await base.progression.put({
      ...progression,
      examens: {
        ...progression.examens,
        [cle]: {
          tentatives: (avant?.tentatives ?? 0) + 1,
          meilleurScore: Math.max(avant?.meilleurScore ?? 0, score),
          ...(avant?.valideLe !== undefined
            ? { valideLe: avant.valideLe }
            : reussi
              ? { valideLe: jourLocal(maintenant) }
              : {}),
        },
      },
      majLe: maintenant.toISOString(),
    })

    const xpGagne = xpReponses(reponses) + (nouvelleValidation ? XP.examenValide : 0)
    await ecrireProfil(base, (p) => ({ ...p, xp: (p.xp ?? 0) + xpGagne }))
    await noterJournee(base, { xp: xpGagne, questions: reponses.length }, maintenant)

    const etatApres = await lireEtatProgression(base)
    const candidats: Badge[] = []
    if (nouvelleValidation) candidats.push('premier-examen')
    if (paliersValides(etatApres, moduleId) === 5) candidats.push('module-valide')
    if (avancementGlobal(etatApres) >= 1) candidats.push('cent-pour-cent')
    const nouveauxBadges = await attribuerBadges(base, candidats)
    return { justes, total, requis: bonnesReponsesRequises(total), score, reussi, nouvelleValidation, xpGagne, nouveauxBadges }
  })
}

/** Nombre d'examens blancs gardés dans l'historique. */
const HISTORIQUE_EXAMENS_BLANCS = 20

/**
 * Fin d'un examen blanc : répétition espacée, XP, historique et badge. Les questions sans
 * réponse (temps écoulé) comptent comme fausses.
 */
export async function terminerExamenBlanc(
  reponses: readonly ReponseQuiz[],
  base: BaseMoneyTree = db,
  maintenant: Date = new Date(),
): Promise<{ bilan: BilanExamenBlanc; xpGagne: number; nouveauxBadges: Badge[] }> {
  return base.transaction('rw', [base.profil, base.reponses, base.journees], async () => {
    await enregistrerReponses(base, reponses, maintenant)
    const bilan = bilanExamenBlanc(reponses)
    const xpGagne = xpReponses(reponses) + (bilan.reussi ? XP.examenValide : 0)
    await ecrireProfil(base, (p) => ({
      ...p,
      xp: (p.xp ?? 0) + xpGagne,
      examensBlancs: [
        ...(p.examensBlancs ?? []),
        {
          le: maintenant.toISOString(),
          A: { justes: bilan.A.justes, total: bilan.A.total },
          C: { justes: bilan.C.justes, total: bilan.C.total },
          reussi: bilan.reussi,
        },
      ].slice(-HISTORIQUE_EXAMENS_BLANCS),
    }))
    await noterJournee(base, { xp: xpGagne, questions: reponses.length }, maintenant)
    const nouveauxBadges = await attribuerBadges(base, bilan.reussi ? ['examen-blanc'] : [])
    return { bilan, xpGagne, nouveauxBadges }
  })
}

/** Une réponse du quiz du jour (répétition espacée et XP, sans changer de palier). */
export async function terminerQuizDuJour(
  reponses: readonly ReponseQuiz[],
  base: BaseMoneyTree = db,
  maintenant: Date = new Date(),
): Promise<{ xpGagne: number; nouveauxBadges: Badge[] }> {
  return base.transaction('rw', [base.profil, base.reponses, base.journees], async () => {
    await enregistrerReponses(base, reponses, maintenant)
    const aujourdhui = jourLocal(maintenant)
    const profil = await lireProfil(base)
    const premierDuJour = profil.quizDuJourFaitLe !== aujourdhui
    const xpGagne = xpReponses(reponses) + (premierDuJour ? XP.quizDuJour : 0)
    await ecrireProfil(base, (p) => ({ ...p, xp: (p.xp ?? 0) + xpGagne, quizDuJourFaitLe: aujourdhui }))
    await noterJournee(base, { xp: xpGagne, questions: reponses.length }, maintenant)
    const jours = (await base.journees.toArray()).map((j) => j.date)
    const nouveauxBadges = await attribuerBadges(
      base,
      serieDeJours(jours, aujourdhui) >= 7 ? ['serie-7'] : [],
    )
    return { xpGagne, nouveauxBadges }
  })
}

export async function debloquerModule(moduleId: number, base: BaseMoneyTree = db): Promise<void> {
  await base.transaction('rw', base.progression, async () => {
    const actuelle = await lireProgression(base, moduleId)
    await base.progression.put({ ...actuelle, debloqueQuandMeme: true, majLe: new Date().toISOString() })
  })
}

export async function debloquerPalier(moduleId: number, numero: number, base: BaseMoneyTree = db): Promise<void> {
  await base.transaction('rw', base.progression, async () => {
    const actuelle = await lireProgression(base, moduleId)
    await base.progression.put({
      ...actuelle,
      debloqueQuandMeme: true,
      palierDebloque: Math.max(actuelle.palierDebloque ?? 0, numero),
      majLe: new Date().toISOString(),
    })
  })
}

export async function debloquerLevier(levier: Levier, base: BaseMoneyTree = db): Promise<void> {
  await base.transaction('rw', base.profil, async () => {
    await ecrireProfil(base, (p) => ({
      ...p,
      leviersForces: [...new Set([...(p.leviersForces ?? []), levier])],
    }))
  })
}

/** Badges liés au simulateur, attribués à l'enregistrement de la partie. */
export async function badgesDuSimulateur(moisEcoules: number, base: BaseMoneyTree = db): Promise<Badge[]> {
  const candidats: Badge[] = []
  if (moisEcoules >= 12) candidats.push('premiere-annee')
  if (moisEcoules >= 120) candidats.push('dix-ans')
  if (candidats.length === 0) return []
  return base.transaction('rw', base.profil, () => attribuerBadges(base, candidats))
}

/** Questions des paliers maîtrisés ou commencés, dans le parcours du profil : le vivier du quiz du jour. */
export function questionsDisponibles(etat: EtatProgression): string[] {
  const ids: string[] = []
  for (const m of etat.modules) {
    if (!METIERS[etat.metier].modules.includes(m.moduleId)) continue
    const jusqua = Math.max(m.paliersMaitrises, m.enCours?.palier ?? 0)
    for (let n = 1; n <= jusqua; n++) {
      ids.push(...(palierDuModule(m.moduleId, n, etat.metier)?.questions.map((q) => q.id) ?? []))
    }
  }
  return ids.filter((id) => origine(id).module >= 0)
}
