/**
 * Séries historiques mensuelles réelles (src/data/historique/marches-mensuels.json) :
 * MSCI World dividendes réinvestis en euros, inflation Insee, taux des livrets réglementés.
 * Le mode historique les rejoue telles quelles ; la projection les rééchantillonne par blocs.
 */
import fondsEurosAcpr from '../data/historique/fonds-euros-acpr.json'
import historique from '../data/historique/marches-mensuels.json'

export interface SeriesMarche {
  /** Mois au format AAAA-MM. */
  mois: readonly string[]
  /** Rendement mensuel des actions monde (dividendes réinvestis, en euros). */
  actionsMonde: readonly number[]
  /** Inflation mensuelle (variation de l'indice des prix). */
  inflation: readonly number[]
  /** Taux annuels des livrets en vigueur pendant le mois. */
  livretA: readonly number[]
  ldds: readonly number[]
  lep: readonly number[]
  /** Taux annuel moyen des fonds en euros servi au titre de l'année du mois (ACPR). */
  fondsEuros?: readonly number[]
  /** Le taux des fonds en euros de ce mois est estimé (aucune donnée ACPR pour l'année). */
  fondsEurosEstime?: readonly boolean[]
}

export const SOURCES_FONDS_EUROS = fondsEurosAcpr

/**
 * Taux des fonds en euros mois par mois, d'après la série annuelle de l'ACPR. L'ACPR ne
 * publie rien avant 2007, et le taux d'une année n'est connu que l'été suivant : pour ces
 * années-là, on reprend la valeur publiée la plus proche, signalée comme estimée.
 */
function fondsEurosMensuels(mois: readonly string[]): { taux: number[]; estime: boolean[] } {
  const parAnnee = new Map(fondsEurosAcpr.annees.map((a) => [a.annee, a.taux]))
  const annees = [...parAnnee.keys()]
  const premiere = Math.min(...annees)
  const derniere = Math.max(...annees)
  const taux: number[] = []
  const estime: boolean[] = []
  for (const m of mois) {
    const annee = Number(m.slice(0, 4))
    const connu = parAnnee.get(annee)
    if (connu !== undefined) {
      taux.push(connu)
      estime.push(false)
    } else {
      taux.push(parAnnee.get(annee < premiere ? premiere : derniere) ?? 0)
      estime.push(true)
    }
  }
  return { taux, estime }
}

const FONDS_EUROS = fondsEurosMensuels(historique.mois)

export const SERIES: SeriesMarche = {
  ...historique,
  fondsEuros: FONDS_EUROS.taux,
  fondsEurosEstime: FONDS_EUROS.estime,
}

export const SOURCES_HISTORIQUE = historique.sources

export function nombreDeMois(series: SeriesMarche = SERIES): number {
  return series.mois.length
}

/** Indices de départ qui laissent au moins `duree` mois de données. */
export function nombreDeDepartsPossibles(duree: number, series: SeriesMarche = SERIES): number {
  return Math.max(0, nombreDeMois(series) - duree + 1)
}

const NOMS_MOIS = [
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

/** « 2007-01 » → « 2006-12 ». */
export function moisPrecedent(aaaamm: string): string {
  const [annee, mois] = aaaamm.split('-').map(Number)
  if (!annee || !mois) return aaaamm
  return mois === 1 ? `${annee - 1}-12` : `${annee}-${String(mois - 1).padStart(2, '0')}`
}

/** « 2007-03 » → « mars 2007 ». */
export function libelleMois(aaaamm: string): string {
  const [annee, mois] = aaaamm.split('-')
  return `${NOMS_MOIS[Number(mois) - 1] ?? ''} ${annee ?? ''}`
}

/** Rendements mensuels réels (corrigés de l'inflation) des actions monde. */
export function rendementsReels(series: SeriesMarche = SERIES): number[] {
  return series.actionsMonde.map((r, i) => (1 + r) / (1 + (series.inflation[i] ?? 0)) - 1)
}

/** Rendement annualisé d'une suite de rendements mensuels. */
export function rendementAnnualise(rendements: readonly number[]): number {
  if (rendements.length === 0) return 0
  const produit = rendements.reduce((acc, r) => acc * (1 + r), 1)
  return produit ** (12 / rendements.length) - 1
}

/**
 * Chiffres tirés des séries embarquées, cités dans les cours : ils se recalculent quand
 * les données sont mises à jour, au lieu d'être recopiés à la main.
 */
export interface FaitsHistoriques {
  premierMois: string
  dernierMois: string
  inflationAnnuelle: number
  /** Inflation de décembre 2021 à décembre 2022. */
  inflation2022: number
  livretANominal: number
  livretAReel: number
  actionsNominal: number
  actionsReel: number
  /** Pire baisse depuis un sommet (nombre négatif). */
  pireBaisse: number
  pireBaisseDebut: string
  pireBaisseFin: string
  pireAnnee: { annee: string; rendement: number }
  /** Rendements réels annualisés sur toutes les périodes de dix ans. */
  dixAnsReelMin: number
  dixAnsReelMax: number
  dixAnsPartNegatives: number
  /** Volatilité annualisée des rendements mensuels des actions monde. */
  volatiliteActions: number
  anneesNegatives: number
  anneesCompletes: number
  /** Krach de 2008 : sommet de 2007, creux, baisse, mois où le sommet est retrouvé. */
  krach2008: { sommet: string; creux: string; baisse: number; retour: string }
  /** Mars 2020 : baisse du mois et mois où le niveau de janvier 2020 est retrouvé. */
  covid: { baisse: number; retour: string }
  /** 20 000 € investis début 2007, en une fois ou en 24 mois, valeur fin 2016. */
  cas2007: { enUneFois: number; en24Mois: number }
  /** 10 000 € investis début 2008 : gardés jusqu'à fin 2012, ou vendus au creux du krach (fin de mois). */
  tenirOuVendre: { tenir: number; vendreAuCreux: number }
}

let faitsEnCache: FaitsHistoriques | undefined

export function faitsHistoriques(series: SeriesMarche = SERIES): FaitsHistoriques {
  if (series === SERIES && faitsEnCache) return faitsEnCache
  const n = series.mois.length
  const reels = rendementsReels(series)
  const livretMensuel = series.livretA.map((t) => t / 12)
  const indice = (mois: string) => series.mois.indexOf(mois)
  const debut2022 = indice('2022-01')
  const fin2022 = indice('2022-12')
  const inflation2022 =
    debut2022 >= 0 && fin2022 >= 0
      ? series.inflation.slice(debut2022, fin2022 + 1).reduce((acc, r) => acc * (1 + r), 1) - 1
      : Number.NaN

  let niveau = 1
  let sommet = 1
  // Le premier rendement part du niveau de fin du mois précédent la série.
  let moisSommet = moisPrecedent(series.mois[0] ?? '')
  let pireBaisse = 0
  let pireBaisseDebut = moisSommet
  let pireBaisseFin = moisSommet
  const parAnnee = new Map<string, number>()
  series.actionsMonde.forEach((r, i) => {
    niveau *= 1 + r
    const mois = series.mois[i] ?? ''
    if (niveau > sommet) {
      sommet = niveau
      moisSommet = mois
    }
    if (niveau / sommet - 1 < pireBaisse) {
      pireBaisse = niveau / sommet - 1
      pireBaisseDebut = moisSommet
      pireBaisseFin = mois
    }
    const annee = mois.slice(0, 4)
    parAnnee.set(annee, (parAnnee.get(annee) ?? 1) * (1 + r))
  })
  const pire = [...parAnnee.entries()].reduce((a, b) => (b[1] < a[1] ? b : a))

  const dixAns: number[] = []
  for (let s = 0; s + 120 <= n; s++) dixAns.push(rendementAnnualise(reels.slice(s, s + 120)))

  const r = series.actionsMonde
  const moyenne = r.reduce((a, b) => a + b, 0) / n
  const volatiliteActions = Math.sqrt(r.reduce((a, b) => a + (b - moyenne) ** 2, 0) / (n - 1)) * Math.sqrt(12)
  const anneeEnCours = series.mois.at(-1)?.slice(0, 4) ?? ''
  const completes = [...parAnnee.entries()].filter(([annee]) => annee < anneeEnCours)

  // Niveau de l'indice à la fin de chaque mois (1 à la fin du mois précédant la série).
  const niveaux: number[] = []
  r.reduce((acc, x) => {
    const suivant = acc * (1 + x)
    niveaux.push(suivant)
    return suivant
  }, 1)
  const niveauFin = (mois: string) => niveaux[indice(mois)] ?? Number.NaN
  const premierMoisAuDessus = (depuis: string, seuil: number) => {
    for (let k = Math.max(0, indice(depuis)); k < n; k++) {
      if ((niveaux[k] ?? 0) >= seuil) return series.mois[k] ?? ''
    }
    return ''
  }
  const extremum = (de: string, a: string, sens: 1 | -1) => {
    let meilleur = de
    for (let k = indice(de); k >= 0 && k <= indice(a); k++) {
      if (sens * ((niveaux[k] ?? 0) - niveauFin(meilleur)) > 0) meilleur = series.mois[k] ?? meilleur
    }
    return meilleur
  }
  const sommet2007 = extremum('2006-01', '2008-12', 1)
  const creux2009 = extremum(sommet2007, '2010-12', -1)
  const croissance = (de: string, a: string) =>
    r.slice(indice(de), indice(a) + 1).reduce((acc, x) => acc * (1 + x), 1)
  let en24Mois = 0
  for (let k = indice('2007-01'); k >= 0 && k <= indice('2016-12'); k++) {
    if (k < indice('2007-01') + 24) en24Mois += 20000 / 24
    en24Mois *= 1 + (r[k] ?? 0)
  }

  const faits: FaitsHistoriques = {
    premierMois: series.mois[0] ?? '',
    dernierMois: series.mois.at(-1) ?? '',
    inflationAnnuelle: rendementAnnualise(series.inflation),
    inflation2022,
    livretANominal: rendementAnnualise(livretMensuel),
    livretAReel: rendementAnnualise(livretMensuel.map((r, i) => (1 + r) / (1 + (series.inflation[i] ?? 0)) - 1)),
    actionsNominal: rendementAnnualise(series.actionsMonde),
    actionsReel: rendementAnnualise(reels),
    pireBaisse,
    pireBaisseDebut,
    pireBaisseFin,
    pireAnnee: { annee: pire[0], rendement: pire[1] - 1 },
    dixAnsReelMin: Math.min(...dixAns),
    dixAnsReelMax: Math.max(...dixAns),
    dixAnsPartNegatives: dixAns.filter((x) => x < 0).length / dixAns.length,
    volatiliteActions,
    anneesNegatives: completes.filter(([, v]) => v < 1).length,
    anneesCompletes: completes.length,
    krach2008: {
      sommet: sommet2007,
      creux: creux2009,
      baisse: niveauFin(creux2009) / niveauFin(sommet2007) - 1,
      retour: premierMoisAuDessus(creux2009, niveauFin(sommet2007)),
    },
    covid: {
      baisse: r[indice('2020-03')] ?? Number.NaN,
      retour: premierMoisAuDessus('2020-03', niveauFin('2020-01')),
    },
    cas2007: { enUneFois: 20000 * croissance('2007-01', '2016-12'), en24Mois },
    tenirOuVendre: {
      tenir: 10000 * croissance('2008-01', '2012-12'),
      vendreAuCreux: 10000 * croissance('2008-01', creux2009),
    },
  }
  if (series === SERIES) faitsEnCache = faits
  return faits
}
