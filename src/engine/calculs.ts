/**
 * Calculs ponctuels utilisés par les calculateurs des cours et les cas de test : économie
 * d'impôt d'un versement sur un PER, imposition d'un même gain selon l'enveloppe, effet des
 * frais. Fonctions pures, à partir des paramètres officiels.
 */
import type { Parametres2026 } from '../data/params/schema.ts'
import { calculerIR, parametresIR, type Foyer } from './impots.ts'

/**
 * Plafond de déduction des versements sur un PER : 10 % des revenus d'activité nets de frais
 * professionnels de l'année précédente, entre un minimum et un maximum indexés
 * (service-public F34982).
 * Sans revenus l'année précédente (premier emploi), c'est le minimum. Simplification : pas de
 * report des plafonds non utilisés des années précédentes.
 */
export function plafondPer(revenusActiviteAnneePrecedente: number, indexation: number, p: Parametres2026): number {
  const min = p['per.plafondDeductionMin'].valeur * indexation
  const max = p['per.plafondDeductionMax'].valeur * indexation
  return Math.min(max, Math.max(min, revenusActiviteAnneePrecedente * p['per.tauxPlafondDeduction'].valeur))
}

export interface EconomiePer {
  plafond: number
  /** Part du versement déduite du revenu imposable. */
  deduit: number
  impotSans: number
  impotAvec: number
  economie: number
  tauxMarginal: number
}

/**
 * Économie d'impôt d'un versement sur un PER, en supposant les mêmes salaires l'année
 * précédente (base du plafond). L'impôt est recalculé avec et sans la déduction : si le
 * versement fait changer de tranche, l'économie le reflète.
 */
export function economiePer(
  donnees: { foyer: Foyer; salaires: readonly number[]; versement: number },
  p: Parametres2026,
): EconomiePer {
  const pIR = parametresIR(p)
  const sans = calculerIR({ foyer: donnees.foyer, salaires: donnees.salaires }, pIR)
  const plafond = plafondPer(sans.revenuNetImposable, 1, p)
  const deduit = Math.max(0, Math.min(donnees.versement, plafond))
  const avec = calculerIR({ foyer: donnees.foyer, salaires: donnees.salaires, chargesDeductibles: deduit }, pIR)
  return {
    plafond,
    deduit,
    impotSans: sans.impotNet,
    impotAvec: avec.impotNet,
    economie: sans.impotNet - avec.impotNet,
    tauxMarginal: sans.tauxMarginal,
  }
}

export interface ImpositionGain {
  impotRevenu: number
  prelevementsSociaux: number
  total: number
}

export interface ImpositionParEnveloppe {
  /** Compte-titres, au prélèvement forfaitaire unique. */
  cto: ImpositionGain
  /** PEA de plus de 5 ans : prélèvements sociaux seuls. */
  pea: ImpositionGain
  /** Assurance-vie de plus de 8 ans, primes sous le plafond du taux réduit. */
  assuranceVie: ImpositionGain
}

function imposition(impotRevenu: number, prelevementsSociaux: number): ImpositionGain {
  return { impotRevenu, prelevementsSociaux, total: impotRevenu + prelevementsSociaux }
}

/**
 * Imposition d'un même gain sorti en une fois de chaque enveloppe, sans autre rachat sur
 * l'assurance-vie dans l'année (abattement entier) et avec des primes sous le plafond de
 * 150 000 € qui ouvre le taux réduit.
 */
export function impositionGainParEnveloppe(
  gain: number,
  p: Parametres2026,
  options: { couple?: boolean } = {},
): ImpositionParEnveloppe {
  const g = Math.max(0, gain)
  const abattement = options.couple
    ? p['assuranceVie.abattementApres8Ans.couple'].valeur
    : p['assuranceVie.abattementApres8Ans.personneSeule'].valeur
  return {
    cto: imposition(g * p['pfu.tauxImpotRevenu'].valeur, g * p['prelevementsSociaux.tauxGeneral'].valeur),
    pea: imposition(0, g * p['pea.tauxApres5Ans'].valeur),
    assuranceVie: imposition(
      Math.max(0, g - abattement) * p['assuranceVie.tauxImpotApres8Ans'].valeur,
      g * p['prelevementsSociaux.tauxAssuranceVie'].valeur,
    ),
  }
}

export interface DonneesFrais {
  montant: number
  /** Rendement brut annuel, avant frais (0,05 pour 5 %). */
  rendement: number
  /** Frais d'entrée, en part du montant investi. */
  fraisEntree: number
  /** Frais annuels proportionnels (gestion, droits de garde…), en part du montant détenu. */
  fraisAnnuels: number
  /** Frais fixes annuels en euros (tenue de compte). */
  fraisFixes: number
  annees: number
}

export interface ResultatFrais {
  sansFrais: number
  avecFrais: number
  /** Rendement annuel net moyen. */
  rendementNet: number
  fraisPayes: number
}

/**
 * Valeur d'un placement unique après frais. Chaque année : le placement progresse du
 * rendement brut, puis les frais proportionnels et fixes sont prélevés. Avec les hypothèses
 * de l'exemple de l'AMF, on retrouve environ 1 090 € au lieu de 1 276 €.
 */
export function valeurApresFrais(d: DonneesFrais): ResultatFrais {
  const sansFrais = d.montant * (1 + d.rendement) ** d.annees
  let valeur = d.montant * (1 - d.fraisEntree)
  for (let a = 0; a < d.annees; a++) {
    valeur *= 1 + d.rendement
    valeur -= valeur * d.fraisAnnuels + d.fraisFixes
    valeur = Math.max(0, valeur)
  }
  const rendementNet = d.montant > 0 && d.annees > 0 ? (valeur / d.montant) ** (1 / d.annees) - 1 : 0
  return { sansFrais, avecFrais: valeur, rendementNet, fraisPayes: sansFrais - valeur }
}
