/**
 * Règles des enveloppes simulées en phase 1 : livrets réglementés (Livret A, LDDS, LEP),
 * compte-titres ordinaire (CTO) et plan d'épargne en actions (PEA). Fonctions pures : elles
 * renvoient de nouveaux objets sans modifier ceux qu'on leur passe.
 *
 * Simplifications assumées (documentées dans src/engine/README.md) :
 * - livrets : les intérêts sont comptés par quinzaine comme dans la réalité, en supposant
 *   que les versements arrivent en début de mois (valeur le 16) ;
 * - titres : un seul ETF monde, achats fractionnés, sans frais de courtage.
 */

// ---------------------------------------------------------------------------- Livrets

export interface Livret {
  solde: number
  /** Intérêts acquis depuis le 1er janvier, crédités le 31 décembre. */
  interetsCourus: number
}

export const LIVRET_VIDE: Livret = { solde: 0, interetsCourus: 0 }

/**
 * Versement du mois sur un livret, dans la limite du plafond (les intérêts capitalisés
 * peuvent dépasser le plafond, pas les versements) et de l'argent disponible.
 * Intérêts du mois : solde entier sur le mois, versement à partir du 16 (une quinzaine).
 */
export function moisLivret(
  livret: Livret,
  versementSouhaite: number,
  disponible: number,
  plafond: number,
  tauxAnnuel: number,
): { livret: Livret; verse: number } {
  const place = Math.max(0, plafond - livret.solde)
  const verse = Math.max(0, Math.min(versementSouhaite, place, disponible))
  const interets = livret.solde * (tauxAnnuel / 12) + verse * (tauxAnnuel / 24)
  return {
    livret: { solde: livret.solde + verse, interetsCourus: livret.interetsCourus + interets },
    verse,
  }
}

/** Au 31 décembre, les intérêts de l'année s'ajoutent au capital. */
export function crediterInterets(livret: Livret): { livret: Livret; credites: number } {
  return {
    livret: { solde: livret.solde + livret.interetsCourus, interetsCourus: 0 },
    credites: livret.interetsCourus,
  }
}

/**
 * Retrait : valeur au dernier jour de la quinzaine précédente, la somme retirée ne rapporte
 * donc rien pendant le mois en cours (approximation : on retire les intérêts du mois).
 */
export function retirerLivret(
  livret: Livret,
  montant: number,
  tauxAnnuel: number,
): { livret: Livret; retire: number } {
  const retire = Math.max(0, Math.min(montant, livret.solde))
  return {
    livret: {
      solde: livret.solde - retire,
      interetsCourus: Math.max(0, livret.interetsCourus - retire * (tauxAnnuel / 24)),
    },
    retire,
  }
}

// ---------------------------------------------------------------------------- Titres

export interface Titres {
  /** Nombre de parts d'ETF détenues (fractionnables). */
  parts: number
  /** Prix de revient total des parts détenues. */
  prixDeRevient: number
}

export const TITRES_VIDES: Titres = { parts: 0, prixDeRevient: 0 }

export function valeurTitres(titres: Titres, prixPart: number): number {
  return titres.parts * prixPart
}

export function acheter(titres: Titres, montant: number, prixPart: number): Titres {
  if (montant <= 0) return titres
  return { parts: titres.parts + montant / prixPart, prixDeRevient: titres.prixDeRevient + montant }
}

/** Vente d'un montant : la plus-value est calculée au prorata du prix de revient. */
export function vendre(
  titres: Titres,
  montant: number,
  prixPart: number,
): { titres: Titres; vendu: number; plusValue: number } {
  const valeur = valeurTitres(titres, prixPart)
  const vendu = Math.max(0, Math.min(montant, valeur))
  if (vendu === 0 || valeur === 0) return { titres, vendu: 0, plusValue: 0 }
  const fraction = vendu / valeur
  const revientVendu = titres.prixDeRevient * fraction
  return {
    titres: {
      parts: titres.parts * (1 - fraction),
      prixDeRevient: titres.prixDeRevient - revientVendu,
    },
    vendu,
    plusValue: vendu - revientVendu,
  }
}

// ---------------------------------------------------------------------------- PEA

export interface Pea {
  /** Mois de la partie où le plan a été ouvert (null : pas encore ouvert). */
  ouvertAuMois: number | null
  /** Le plan a été clôturé (retrait avant 5 ans ou retrait total). */
  cloture: boolean
  /** Total des versements encore investis (sert au plafond et au calcul du gain). */
  versements: number
  titres: Titres
}

export const PEA_FERME: Pea = { ouvertAuMois: null, cloture: false, versements: 0, titres: TITRES_VIDES }

export function ageDuPeaEnMois(pea: Pea, moisCourant: number): number {
  return pea.ouvertAuMois === null ? 0 : moisCourant - pea.ouvertAuMois
}

export interface RetraitPea {
  pea: Pea
  /** Somme versée sur le compte courant, impôts déduits. */
  net: number
  gain: number
  impotRevenu: number
  prelevementsSociaux: number
  cloture: boolean
}

/**
 * Retrait sur un PEA. Avant 5 ans, tout retrait clôture le plan et le gain supporte
 * l'impôt (12,8 %) et les prélèvements sociaux ; après 5 ans, un retrait partiel garde le
 * plan ouvert et le gain ne supporte que les prélèvements sociaux (service-public F2385,
 * impots.gouv « L'assurance-vie et le PEA »). Simplification : impôts retenus au retrait.
 */
export function retirerPea(
  pea: Pea,
  montant: number,
  prixPart: number,
  moisCourant: number,
  regles: { dureeExonerationMois: number; tauxImpot: number; tauxPrelevementsSociaux: number },
): RetraitPea {
  const valeur = valeurTitres(pea.titres, prixPart)
  const avantExoneration = ageDuPeaEnMois(pea, moisCourant) < regles.dureeExonerationMois
  const brut = avantExoneration ? valeur : Math.max(0, Math.min(montant, valeur))
  if (brut === 0) {
    return { pea, net: 0, gain: 0, impotRevenu: 0, prelevementsSociaux: 0, cloture: false }
  }
  const fraction = brut / valeur
  const versementsRetires = pea.versements * fraction
  const gain = Math.max(0, brut - versementsRetires)
  const impotRevenu = avantExoneration ? gain * regles.tauxImpot : 0
  const prelevementsSociaux = gain * regles.tauxPrelevementsSociaux
  const cloture = avantExoneration || fraction >= 0.999999
  return {
    pea: cloture
      ? { ouvertAuMois: pea.ouvertAuMois, cloture: true, versements: 0, titres: TITRES_VIDES }
      : {
          ...pea,
          versements: pea.versements - versementsRetires,
          titres: {
            parts: pea.titres.parts * (1 - fraction),
            prixDeRevient: pea.titres.prixDeRevient * (1 - fraction),
          },
        },
    net: brut - impotRevenu - prelevementsSociaux,
    gain,
    impotRevenu,
    prelevementsSociaux,
    cloture,
  }
}

// ---------------------------------------------------------------- Assurance-vie

/**
 * Un contrat d'assurance-vie : un fonds en euros (capital garanti, intérêts crédités
 * chaque 31 décembre, prélèvements sociaux prélevés au passage) et des unités de compte
 * (ici l'ETF monde, capital non garanti).
 */
export interface AssuranceVie {
  ouvertAuMois: number | null
  fondsEuros: Livret
  uc: Titres
  /** Primes versées encore investies (base du calcul des gains et du seuil de 150 000 €). */
  primes: number
}

export const ASSURANCE_VIE_FERMEE: AssuranceVie = {
  ouvertAuMois: null,
  fondsEuros: LIVRET_VIDE,
  uc: TITRES_VIDES,
  primes: 0,
}

export function valeurAssuranceVie(av: AssuranceVie, prixPart: number): number {
  return av.fondsEuros.solde + valeurTitres(av.uc, prixPart)
}

export interface ReglesAssuranceVie {
  dureeFiscaleMois: number
  /** Impôt sur les gains avant 8 ans (PFU, part impôt sur le revenu). */
  tauxImpotAvant: number
  tauxImpotApres: number
  plafondPrimesTauxReduit: number
  /** Abattement annuel restant cette année (4 600 € pour une personne seule). */
  abattementRestant: number
  tauxPrelevementsSociaux: number
}

export interface RachatAssuranceVie {
  av: AssuranceVie
  net: number
  gain: number
  impotRevenu: number
  prelevementsSociaux: number
  abattementUtilise: number
}

/**
 * Rachat partiel ou total, prélevé au prorata sur le fonds en euros et les unités de compte.
 * Gain imposable = rachat − primes × (rachat ÷ valeur du contrat) (BOFiP,
 * BOI-RPPM-RCM-20-10-20-50). Les prélèvements sociaux ne portent ici que sur la part de gain
 * des unités de compte : ceux du fonds en euros ont déjà été prélevés chaque année.
 * Simplification : l'impôt est réglé au rachat, sans régularisation l'année suivante.
 */
export function racheterAssuranceVie(
  av: AssuranceVie,
  montant: number,
  prixPart: number,
  moisCourant: number,
  regles: ReglesAssuranceVie,
): RachatAssuranceVie {
  const valeur = valeurAssuranceVie(av, prixPart)
  const brut = Math.max(0, Math.min(montant, valeur))
  if (brut === 0 || valeur === 0) {
    return { av, net: 0, gain: 0, impotRevenu: 0, prelevementsSociaux: 0, abattementUtilise: 0 }
  }
  const fraction = brut / valeur
  const gain = Math.max(0, brut - av.primes * fraction)

  const valeurUc = valeurTitres(av.uc, prixPart)
  const gainUc = Math.max(0, valeurUc * fraction - av.uc.prixDeRevient * fraction)
  const prelevementsSociaux = gainUc * regles.tauxPrelevementsSociaux

  const age = av.ouvertAuMois === null ? 0 : moisCourant - av.ouvertAuMois
  let impotRevenu: number
  let abattementUtilise = 0
  if (age < regles.dureeFiscaleMois) {
    impotRevenu = gain * regles.tauxImpotAvant
  } else {
    abattementUtilise = Math.min(gain, regles.abattementRestant)
    const imposable = gain - abattementUtilise
    const partReduite = av.primes > 0 ? Math.min(1, regles.plafondPrimesTauxReduit / av.primes) : 1
    impotRevenu =
      imposable * partReduite * regles.tauxImpotApres + imposable * (1 - partReduite) * regles.tauxImpotAvant
  }

  const reste = 1 - fraction
  return {
    av: {
      ouvertAuMois: av.ouvertAuMois,
      fondsEuros: {
        solde: av.fondsEuros.solde * reste,
        interetsCourus: av.fondsEuros.interetsCourus * reste,
      },
      uc: { parts: av.uc.parts * reste, prixDeRevient: av.uc.prixDeRevient * reste },
      primes: av.primes * reste,
    },
    net: brut - impotRevenu - prelevementsSociaux,
    gain,
    impotRevenu,
    prelevementsSociaux,
    abattementUtilise,
  }
}

// ---------------------------------------------------------------- PEE

/** Versement sur un PEE : bloqué 5 ans, sauf cas de déblocage anticipé (non simulés). */
export interface TranchePee {
  /** Mois de la partie à partir duquel la tranche est disponible. */
  disponibleAuMois: number
  parts: number
  prixDeRevient: number
}

export interface Pee {
  tranches: TranchePee[]
}

export const PEE_VIDE: Pee = { tranches: [] }

export function valeurPee(pee: Pee, prixPart: number): number {
  return pee.tranches.reduce((somme, t) => somme + t.parts * prixPart, 0)
}

export function revientPee(pee: Pee): number {
  return pee.tranches.reduce((somme, t) => somme + t.prixDeRevient, 0)
}

export function disponiblePee(pee: Pee, prixPart: number, moisCourant: number): number {
  return pee.tranches
    .filter((t) => t.disponibleAuMois <= moisCourant)
    .reduce((somme, t) => somme + t.parts * prixPart, 0)
}

export function verserPee(pee: Pee, montant: number, prixPart: number, disponibleAuMois: number): Pee {
  if (montant <= 0) return pee
  return {
    tranches: [...pee.tranches, { disponibleAuMois, parts: montant / prixPart, prixDeRevient: montant }],
  }
}

/**
 * Retrait des sommes débloquées : exonéré d'impôt sur le revenu, les gains supportent les
 * prélèvements sociaux (service-public F2142). Les tranches les plus anciennes partent d'abord.
 */
export function retirerPee(
  pee: Pee,
  montant: number,
  prixPart: number,
  moisCourant: number,
  tauxPrelevementsSociaux: number,
): { pee: Pee; net: number; gain: number; prelevementsSociaux: number } {
  let reste = Math.max(0, Math.min(montant, disponiblePee(pee, prixPart, moisCourant)))
  let gain = 0
  let retire = 0
  const tranches: TranchePee[] = []
  for (const t of pee.tranches) {
    const valeur = t.parts * prixPart
    if (reste <= 0 || t.disponibleAuMois > moisCourant || valeur <= 0) {
      tranches.push(t)
      continue
    }
    const pris = Math.min(reste, valeur)
    const fraction = pris / valeur
    gain += Math.max(0, pris - t.prixDeRevient * fraction)
    retire += pris
    reste -= pris
    if (fraction < 0.999999) {
      tranches.push({ ...t, parts: t.parts * (1 - fraction), prixDeRevient: t.prixDeRevient * (1 - fraction) })
    }
  }
  const prelevementsSociaux = gain * tauxPrelevementsSociaux
  return { pee: { tranches }, net: retire - prelevementsSociaux, gain, prelevementsSociaux }
}

// ---------------------------------------------------------------- PER individuel

/** PER individuel : bloqué jusqu'à la retraite (hors cas de déblocage anticipé, non simulés). */
export interface Per {
  /** Versements volontaires déduits du revenu imposable. */
  versementsDeduits: number
  /** Versements non déduits (au-delà du plafond). */
  versementsNonDeduits: number
  titres: Titres
}

export const PER_VIDE: Per = { versementsDeduits: 0, versementsNonDeduits: 0, titres: TITRES_VIDES }

/**
 * Impôt estimé d'une sortie en capital aujourd'hui : versements déduits au barème (estimé
 * à la tranche marginale actuelle), gains au PFU (service-public F34982).
 */
export function impotLatentPer(per: Per, prixPart: number, tauxMarginal: number, tauxPfu: number): number {
  const valeur = valeurTitres(per.titres, prixPart)
  const gain = Math.max(0, valeur - per.titres.prixDeRevient)
  return per.versementsDeduits * tauxMarginal + gain * tauxPfu
}
