/**
 * Les trois modes de marché du cahier des charges, choisis en créant une partie :
 * - historique : une vraie période rejouée telle quelle, révélée à la fin ;
 * - Monte Carlo : une trajectoire obtenue par bootstrap par blocs des mois historiques. On
 *   tire des lignes entières (actions, inflation, taux des livrets, fonds en euros) pour
 *   conserver les krachs et les corrélations ;
 * - scénario : des chocs imposés pour tester la robustesse d'une stratégie. Les chocs
 *   sont des hypothèses fictives, signalées comme telles, sauf la « décennie perdue » qui
 *   rejoue la vraie décennie 2001-2010.
 */
import type { Aleatoire } from './aleatoire.ts'
import type { SeriesMarche } from './marches.ts'

export type ModeMarche = 'historique' | 'monte-carlo' | 'scenario'
export type Scenario = 'krach' | 'decennie-perdue' | 'inflation'

export interface InfoScenario {
  nom: string
  description: string
  /** Le scénario rejoue des données réelles (sinon : chocs fictifs). */
  reel: boolean
}

export const SCENARIOS: Record<Scenario, InfoScenario> = {
  krach: {
    nom: 'Krach la première année',
    description:
      'Les actions perdent 40 % pendant ta première année (choc fictif), puis les mois suivants sont tirés dans l’historique.',
    reel: false,
  },
  'decennie-perdue': {
    nom: 'Décennie perdue',
    description:
      'Les dix premières années rejouent la vraie décennie 2001-2010 du MSCI World en euros, terminée en perte réelle.',
    reel: true,
  },
  inflation: {
    nom: 'Inflation façon années 1970',
    description:
      'Pendant dix ans, 10 % d’inflation par an, des livrets à 6 % et des actions qui perdent 4 points par an face à l’inflation (chocs fictifs).',
    reel: false,
  },
}

/** Durée des trajectoires Monte Carlo et des scénarios : trente ans. */
export const DUREE_TRAJECTOIRE_MOIS = 360
const LONGUEUR_BLOC = 12

/** Indices de mois historiques recollés par blocs de 12 mois (bootstrap circulaire). */
export function indicesBootstrap(alea: Aleatoire, nombreMoisHistoriques: number, duree: number): number[] {
  const indices: number[] = []
  while (indices.length < duree) {
    const debut = alea.entier(nombreMoisHistoriques)
    for (let k = 0; k < LONGUEUR_BLOC && indices.length < duree; k++) {
      indices.push((debut + k) % nombreMoisHistoriques)
    }
  }
  return indices
}

export interface MarcheDeLaPartie {
  mode: ModeMarche
  /** Monte Carlo et scénario : indice historique de chaque mois de la partie. */
  indices?: number[]
  scenario?: Scenario
}

export interface LigneMarche {
  actions: number
  inflation: number
  livretA: number
  ldds: number
  lep: number
  fondsEuros: number
  fondsEurosEstime: boolean
}

function ligneHistorique(series: SeriesMarche, i: number): LigneMarche {
  return {
    actions: series.actionsMonde[i] ?? 0,
    inflation: series.inflation[i] ?? 0,
    livretA: series.livretA[i] ?? 0,
    ldds: series.ldds[i] ?? 0,
    lep: series.lep[i] ?? 0,
    fondsEuros: series.fondsEuros?.[i] ?? 0,
    fondsEurosEstime: series.fondsEurosEstime?.[i] ?? false,
  }
}

/** Indices des scénarios : la décennie perdue rejoue 2001-2010, puis le bootstrap prend le relais. */
export function indicesScenario(
  scenario: Scenario,
  alea: Aleatoire,
  series: SeriesMarche,
  duree = DUREE_TRAJECTOIRE_MOIS,
): number[] {
  const indices = indicesBootstrap(alea, series.mois.length, duree)
  if (scenario === 'decennie-perdue') {
    const debut = series.mois.indexOf('2001-01')
    for (let m = 0; m < 120 && debut >= 0; m++) indices[m] = debut + m
  }
  return indices
}

/** Les conditions de marché du mois `mois` de la partie. */
export function ligneDuMois(
  marche: MarcheDeLaPartie,
  debutHistorique: number,
  mois: number,
  series: SeriesMarche,
): LigneMarche {
  if (marche.mode === 'historique' || !marche.indices) {
    return ligneHistorique(series, debutHistorique + mois)
  }
  const base = ligneHistorique(series, marche.indices[mois] ?? 0)
  if (marche.mode !== 'scenario') return base

  if (marche.scenario === 'krach' && mois < 12) {
    // −40 % répartis sur douze mois.
    return { ...base, actions: 0.6 ** (1 / 12) - 1 }
  }
  if (marche.scenario === 'inflation' && mois < 120) {
    const inflation = 1.1 ** (1 / 12) - 1
    const reelBase = (1 + base.actions) / (1 + base.inflation) - 1
    return {
      ...base,
      inflation,
      actions: (1 + reelBase) * (1 + inflation) * (1 - 0.04 / 12) - 1,
      livretA: 0.06,
      ldds: 0.06,
      lep: 0.08,
      fondsEuros: 0.06,
      fondsEurosEstime: true,
    }
  }
  return base
}
