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
