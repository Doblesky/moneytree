#!/usr/bin/env node
/**
 * Construit src/data/historique/marches-mensuels.json à partir des fichiers bruts téléchargés
 * une fois sur les sites officiels (voir src/data/README.md) :
 *
 *   node scripts/historique.mjs <msci.json> <ipc.xml> <livretA.csv> <ldds.csv> <lep.csv>
 *
 * - msci.json : MSCI World dividendes nets réinvestis (NETR) en euros, fin de mois, code 990100,
 *   API https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph
 *   (currency_symbol=EUR, index_variant=NETR, data_frequency=END_OF_MONTH).
 * - ipc.xml : Insee, série 011814630 (IPC base 2025, ensemble des ménages, France), SDMX
 *   https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/011814630
 * - livretA.csv, ldds.csv, lep.csv : Banque de France, Webstat, séries MIR1 (taux en %).
 *   https://webstat.banque-france.fr/export/csv/fr/catalog/MIR1/<clé de série>
 *
 * Le script n'appelle aucun réseau : il convertit des fichiers déjà téléchargés.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [cheminMsci, cheminIpc, cheminLivretA, cheminLdds, cheminLep] = process.argv.slice(2)
if (!cheminLep) {
  console.error('Usage : node scripts/historique.mjs <msci.json> <ipc.xml> <livretA.csv> <ldds.csv> <lep.csv>')
  process.exit(1)
}

/** « 20001229 » → « 2000-12 ». */
const moisDepuisDate = (n) => `${String(n).slice(0, 4)}-${String(n).slice(4, 6)}`

const msci = JSON.parse(readFileSync(cheminMsci, 'utf8'))
const niveaux = new Map(
  msci.indexes.INDEX_LEVELS.map((p) => [moisDepuisDate(p.calc_date), p.level_eod]),
)

const ipc = new Map()
for (const [, periode, valeur] of readFileSync(cheminIpc, 'utf8').matchAll(
  /<Obs TIME_PERIOD="(\d{4}-\d{2})" OBS_VALUE="([\d.]+)"/g,
)) {
  ipc.set(periode, Number(valeur))
}

function lireTauxBdf(chemin) {
  const lignes = readFileSync(chemin, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)
  const entetes = lignes[0].split(';')
  const iPeriode = entetes.indexOf('time_period')
  const iValeur = entetes.indexOf('obs_value')
  const taux = new Map()
  for (const ligne of lignes.slice(1)) {
    const champs = ligne.split(';')
    const valeur = champs[iValeur]
    if (valeur) taux.set(champs[iPeriode], Number(valeur.replace(',', '.')) / 100)
  }
  return taux
}
const livretA = lireTauxBdf(cheminLivretA)
const ldds = lireTauxBdf(cheminLdds)
const lep = lireTauxBdf(cheminLep)

/** Mois suivant au format AAAA-MM. */
function suivant(mois) {
  const [a, m] = mois.split('-').map(Number)
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
}

// Période commune : un rendement mensuel exige le niveau du mois précédent.
const tousLesMois = [...niveaux.keys()].sort()
const mois = []
for (let m = suivant(tousLesMois[0]); niveaux.has(m); m = suivant(m)) {
  const precedent = tousLesMois[tousLesMois.indexOf(m) - 1]
  if (!ipc.has(m) || !ipc.has(precedent) || !livretA.has(m) || !ldds.has(m) || !lep.has(m)) break
  mois.push(m)
}

const arrondi = (x, n) => Number(x.toFixed(n))
const donnees = {
  description:
    'Séries mensuelles réelles embarquées dans l’appli (aucune API à l’exécution). Rendement du mois m = niveau fin m / niveau fin m-1 - 1 ; inflation du mois m = IPC m / IPC m-1 - 1 ; taux des livrets = taux annuel en vigueur pendant le mois.',
  telecharge_le: '2026-11-17',
  sources: {
    actionsMonde: {
      libelle: 'MSCI World, dividendes nets réinvestis (Net Return), en euros, fin de mois (code 990100)',
      source: 'https://www.msci.com/indexes/index/990100',
      acces: 'https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph?currency_symbol=EUR&index_variant=NETR&data_frequency=END_OF_MONTH&index_codes=990100',
      note: 'L’API ne fournit la série en euros qu’à partir de fin décembre 2000.',
    },
    inflation: {
      libelle: 'Indice des prix à la consommation, base 2025, ensemble des ménages, France (Insee, série 011814630)',
      source: 'https://www.insee.fr/fr/statistiques/serie/011814630',
      acces: 'https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/011814630',
    },
    livretA: {
      libelle: 'Taux du Livret A (Banque de France, MIR1.M.FR.B.L23FRLA.D.R.A.2230U6.EUR.O)',
      source: 'https://webstat.banque-france.fr/fr/catalogue/mir1/MIR1.M.FR.B.L23FRLA.D.R.A.2230U6.EUR.O',
    },
    ldds: {
      libelle: 'Taux du LDDS (Banque de France, MIR1.M.FR.B.L23FRLD.D.R.A.2254U6.EUR.O)',
      source: 'https://webstat.banque-france.fr/fr/catalogue/mir1/MIR1.M.FR.B.L23FRLD.D.R.A.2254U6.EUR.O',
    },
    lep: {
      libelle: 'Taux du LEP (Banque de France, MIR1.M.FR.B.L23FRLP.H.R.A.2250U6.EUR.O)',
      source: 'https://webstat.banque-france.fr/fr/catalogue/mir1/MIR1.M.FR.B.L23FRLP.H.R.A.2250U6.EUR.O',
    },
  },
  premierMois: mois[0],
  dernierMois: mois.at(-1),
  mois,
  actionsMonde: mois.map((m, i) => {
    const precedent = i === 0 ? tousLesMois[tousLesMois.indexOf(m) - 1] : mois[i - 1]
    return arrondi(niveaux.get(m) / niveaux.get(precedent) - 1, 6)
  }),
  inflation: mois.map((m, i) => {
    const precedent = i === 0 ? tousLesMois[tousLesMois.indexOf(m) - 1] : mois[i - 1]
    return arrondi(ipc.get(m) / ipc.get(precedent) - 1, 6)
  }),
  livretA: mois.map((m) => arrondi(livretA.get(m), 5)),
  ldds: mois.map((m) => arrondi(ldds.get(m), 5)),
  lep: mois.map((m) => arrondi(lep.get(m), 5)),
}

writeFileSync(
  new URL('../src/data/historique/marches-mensuels.json', import.meta.url),
  `${JSON.stringify(donnees, null, 1)}\n`,
)
console.log(`${mois.length} mois, de ${donnees.premierMois} à ${donnees.dernierMois}`)
