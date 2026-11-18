/**
 * Schéma des fichiers de paramètres annuels (src/data/params/<année>.json).
 *
 * Chaque paramètre porte sa valeur, sa source officielle, sa date de vérification et un
 * champ `verifie` (règle n° 1 de CLAUDE.md). Le schéma liste explicitement chaque clé :
 * le code obtient ainsi un accès typé (`params['livretA.taux'].valeur` est un nombre), et
 * une clé manquante, en trop ou mal typée fait échouer le chargement.
 */
import { z } from 'zod'

const tauxDecimal = z.number().min(0).max(1)
const montantEuros = z.number().nonnegative()

/** Tranche d'un barème progressif : taux marginal appliqué jusqu'à `jusqua` (null = au-delà). */
const trancheBareme = z.strictObject({
  jusqua: z.number().positive().nullable(),
  taux: tauxDecimal,
})

const baremeProgressif = z
  .array(trancheBareme)
  .min(2)
  .superRefine((tranches, contexte) => {
    tranches.forEach((tranche, i) => {
      const derniere = i === tranches.length - 1
      if (derniere !== (tranche.jusqua === null)) {
        contexte.addIssue({
          code: 'custom',
          message: 'Seule la dernière tranche est ouverte (jusqua: null).',
          path: [i, 'jusqua'],
        })
      }
      const precedente = tranches[i - 1]
      if (precedente) {
        if (
          tranche.jusqua !== null &&
          precedente.jusqua !== null &&
          tranche.jusqua <= precedente.jusqua
        ) {
          contexte.addIssue({
            code: 'custom',
            message: 'Les limites des tranches doivent être croissantes.',
            path: [i, 'jusqua'],
          })
        }
        if (tranche.taux < precedente.taux) {
          contexte.addIssue({
            code: 'custom',
            message: 'Les taux d’un barème progressif doivent être croissants.',
            path: [i, 'taux'],
          })
        }
      }
    })
  })

export type BaremeProgressif = z.infer<typeof baremeProgressif>

/** Barème par tranches à taux décroissants (émoluments du notaire). */
const baremeDegressif = z
  .array(trancheBareme)
  .min(2)
  .refine((tranches) => tranches.at(-1)?.jusqua === null, 'La dernière tranche doit être ouverte (jusqua: null).')

export type BaremeDegressif = z.infer<typeof baremeDegressif>

/** Points de calage brut → net, calculés avec le simulateur officiel de l'Urssaf. */
const pointsBrutNet = z
  .array(
    z.strictObject({
      brutAnnuel: montantEuros,
      netAvantImpotAnnuel: montantEuros,
      netImposableAnnuel: montantEuros,
    }),
  )
  .min(2)
  .refine(
    (points) => points.every((p, i) => i === 0 || p.brutAnnuel > (points[i - 1]?.brutAnnuel ?? 0)),
    'Les points doivent être triés par brut croissant.',
  )
  .refine(
    (points) => points.every((p) => p.netAvantImpotAnnuel < p.brutAnnuel),
    'Le net doit être inférieur au brut.',
  )

export type PointBrutNet = z.infer<typeof pointsBrutNet>[number]

/** Grille indiciaire d'un grade : échelons dans l'ordre, durée null pour le dernier. */
const grilleIndiciaire = z
  .array(
    z.strictObject({
      echelon: z.number().int().positive(),
      indiceBrut: z.number().int().positive(),
      indiceMajore: z.number().int().positive(),
      dureeMois: z.number().int().positive().nullable(),
    }),
  )
  .min(1)
  .refine((g) => g.every((e, i) => e.echelon === i + 1), 'Les échelons doivent être numérotés 1, 2, 3…')
  .refine((g) => g.every((e, i) => i === 0 || e.indiceMajore > (g[i - 1]?.indiceMajore ?? 0)), 'Indices croissants attendus.')

export type GrilleIndiciaire = z.infer<typeof grilleIndiciaire>
export type EchelonGrille = GrilleIndiciaire[number]

/** Montant annuel par échelon (prime d'attractivité). */
const montantParEchelon = z
  .array(z.strictObject({ echelon: z.number().int().positive(), montant: montantEuros }))
  .min(1)

/** Valeurs successives d'un paramètre, avec leur date d'effet (dates croissantes). */
const serieDatee = z
  .array(z.strictObject({ depuis: z.iso.date(), valeur: montantEuros }))
  .min(1)
  .refine((s) => s.every((x, i) => i === 0 || x.depuis > (s[i - 1]?.depuis ?? '')), 'Dates croissantes attendues.')

export type SerieDatee = z.infer<typeof serieDatee>

/** Enveloppe commune à tous les paramètres. */
function parametre<T extends z.ZodType>(valeur: T) {
  return z
    .strictObject({
      libelle: z.string().min(1),
      valeur,
      unite: z.string().min(1).optional(),
      source: z.url({ protocol: /^https$/ }),
      sources_complementaires: z.array(z.url({ protocol: /^https$/ })).optional(),
      verifie_le: z.iso.date(),
      verifie: z.boolean(),
      note: z.string().min(1).optional(),
    })
    .refine((p) => p.verifie || p.note !== undefined, {
      message: 'Un paramètre non vérifié doit expliquer pourquoi dans « note ».',
      path: ['note'],
    })
}

export const schemaParametres2026 = z.strictObject({
  'ir.anneeRevenus': parametre(z.number().int().min(2000).max(2100)),
  'ir.bareme': parametre(baremeProgressif),
  'ir.abattementFraisPro.taux': parametre(tauxDecimal),
  'ir.abattementFraisPro.minimum': parametre(montantEuros),
  'ir.abattementFraisPro.maximum': parametre(montantEuros),
  'ir.decote.plafondPersonneSeule': parametre(montantEuros),
  'ir.decote.plafondCouple': parametre(montantEuros),
  'ir.decote.taux': parametre(tauxDecimal),
  'ir.plafonnementQuotientFamilial.parDemiPart': parametre(montantEuros),
  'ir.seuilRecouvrement': parametre(montantEuros),
  'pas.grilleParDefautMetropole': parametre(baremeProgressif),
  'pas.seuilPaiementFractionne': parametre(montantEuros),
  'cotisations.salarieCadre': parametre(pointsBrutNet),
  'pfu.tauxImpotRevenu': parametre(tauxDecimal),
  'pfu.tauxGlobal': parametre(tauxDecimal),
  'pfu.tauxGlobalAssuranceVie': parametre(tauxDecimal),
  'prelevementsSociaux.tauxGeneral': parametre(tauxDecimal),
  'prelevementsSociaux.tauxAssuranceVie': parametre(tauxDecimal),
  'prelevementsSociaux.csgDeductibleBareme': parametre(tauxDecimal),
  'pea.dureeExonerationImpotRevenu': parametre(z.number().int().positive()),
  'pea.tauxApres5Ans': parametre(tauxDecimal),
  'pea.plafondVersements': parametre(montantEuros),
  'assuranceVie.abattementApres8Ans.personneSeule': parametre(montantEuros),
  'assuranceVie.abattementApres8Ans.couple': parametre(montantEuros),
  'assuranceVie.dureeFiscaleAnnees': parametre(z.number().int().positive()),
  'assuranceVie.tauxImpotApres8Ans': parametre(tauxDecimal),
  'assuranceVie.plafondPrimesTauxReduit': parametre(montantEuros),
  'pass.mensuel': parametre(montantEuros),
  'epargneSalariale.abondementPeeMax': parametre(montantEuros),
  'epargneSalariale.abondementRatioMax': parametre(z.number().positive()),
  'epargneSalariale.versementsVolontairesTaux': parametre(tauxDecimal),
  'epargneSalariale.blocagePeeAnnees': parametre(z.number().int().positive()),
  'epargneSalariale.plafondExonerationInteressement': parametre(montantEuros),
  'csgCrds.revenusActivite': parametre(tauxDecimal),
  'livretA.taux': parametre(tauxDecimal),
  'livretA.plafond': parametre(montantEuros),
  'ldds.taux': parametre(tauxDecimal),
  'ldds.plafond': parametre(montantEuros),
  'lep.taux': parametre(tauxDecimal),
  'lep.plafond': parametre(montantEuros),
  'lep.plafondRevenuFiscalReference1Part': parametre(montantEuros),
  'lep.plafondRevenuFiscalReferenceDemiPart': parametre(montantEuros),
  'pel.taux2026': parametre(tauxDecimal),
  'pel.plafond': parametre(montantEuros),
  'pel.dureeMinimaleAnnees': parametre(z.number().int().positive()),
  'pel.versementAnnuelMinimum': parametre(montantEuros),
  'cel.taux': parametre(tauxDecimal),
  'cel.plafond': parametre(montantEuros),
  'credit.tauxMoyenNouveauxCreditsHabitat': parametre(tauxDecimal),
  'usure.pretsImmobiliersTauxFixe20AnsEtPlus': parametre(tauxDecimal),
  'hcsf.tauxEffortMax': parametre(tauxDecimal),
  'hcsf.dureeMaxAnnees': parametre(z.number().int().positive()),
  'hcsf.margeFlexibilite': parametre(tauxDecimal),
  'per.tauxPlafondDeduction': parametre(tauxDecimal),
  'per.plafondDeductionMax': parametre(montantEuros),
  'per.plafondDeductionMin': parametre(montantEuros),
  'insertion.ingenieurs.salaireBrutAnnuelMoyenHorsPrimes': parametre(montantEuros),
  'insertion.ingenieurs.salaireBrutAnnuelMedianHorsPrimes': parametre(montantEuros),
  'insertion.ingenieurs.tauxNetEmploi': parametre(tauxDecimal),
  'insertion.ensemble.tauxNetEmploi': parametre(tauxDecimal),
  'chomage.partieFixeJournaliere': parametre(montantEuros),
  'chomage.tauxPartieVariable': parametre(tauxDecimal),
  'chomage.plancherSjr': parametre(tauxDecimal),
  'chomage.plafondSjr': parametre(tauxDecimal),
  'chomage.minimumNetJournalier': parametre(montantEuros),
  'chomage.smicJournalier': parametre(montantEuros),
  'chomage.dureeMaxJours': parametre(z.number().int().positive()),
  'chomage.coefficientDuree': parametre(tauxDecimal),
  'chomage.affiliationMinMois': parametre(z.number().int().positive()),
  'chomage.affiliationMinMoisPrimoEntrant': parametre(z.number().int().positive()),
  'chomage.seuilDegressiviteSjr': parametre(montantEuros),
  'chomage.tauxDegressivite': parametre(tauxDecimal),
  'chomage.plancherDegressiviteJournalier': parametre(montantEuros),
  'chomage.retraiteComplementaireSjr': parametre(tauxDecimal),
  'chomage.tauxCsg': parametre(tauxDecimal),
  'chomage.tauxCrds': parametre(tauxDecimal),
  'chomage.abattementAssietteCsg': parametre(tauxDecimal),
  'chomage.delaiAttenteJours': parametre(z.number().int().nonnegative()),
  'loyers.toulouse': parametre(montantEuros),
  'loyers.bordeaux': parametre(montantEuros),
  'loyers.lyon': parametre(montantEuros),
  'loyers.paris': parametre(montantEuros),
  'succession.abattementEnfant': parametre(montantEuros),
  'periodeEssai.cadreMoisMax': parametre(z.number().int().positive()),
  'entretienParcours.periodiciteAns': parametre(z.number().int().positive()),
  'retraite.ageLegalNesApres1969': parametre(z.number().int().positive()),
  'retraite.trimestresNesApres1966': parametre(z.number().int().positive()),
  'retraite.revenuParTrimestre': parametre(montantEuros),
  'retraite.trimestresMaxParAn': parametre(z.number().int().positive()),
  'notaire.droitDepartementalPrimoAccedant': parametre(tauxDecimal),
  'notaire.droitDepartementalMax': parametre(tauxDecimal),
  'notaire.taxeCommunale': parametre(tauxDecimal),
  'notaire.fraisAssiette': parametre(tauxDecimal),
  'notaire.contributionSecuriteImmobiliere': parametre(tauxDecimal),
  'notaire.emolumentsVente': parametre(baremeDegressif),
  'notaire.tvaEmoluments': parametre(tauxDecimal),
  'revenusFonciers.plafondMicroFoncier': parametre(montantEuros),
  'revenusFonciers.abattementMicroFoncier': parametre(tauxDecimal),
  'prelevementsSociaux.tauxRevenusFonciers': parametre(tauxDecimal),
  'lmnp.abattementMicroBic': parametre(tauxDecimal),
  'lmnp.plafondMicroBic2025': parametre(montantEuros),
  'or.taxeForfaitaire': parametre(tauxDecimal),
  'or.crds': parametre(tauxDecimal),
  'cryptos.seuilExonerationCessions': parametre(montantEuros),
  'bce.objectifInflation': parametre(tauxDecimal),
  'bce.tauxDepot': parametre(tauxDecimal),
  'bce.tauxRefinancement': parametre(tauxDecimal),
  'bce.tauxPretMarginal': parametre(tauxDecimal),
  'pea.plafondCumulPeaPme': parametre(montantEuros),
  'pea.fraisTransactionEnLigneMax': parametre(tauxDecimal),
  'pea.droitsDeGardeMax': parametre(tauxDecimal),
  'dividendes.abattementBareme': parametre(tauxDecimal),
  'pfnl.seuilDispensePersonneSeule': parametre(montantEuros),
  'pfnl.seuilDispenseCouple': parametre(montantEuros),
  'moinsValues.dureeReportAnnees': parametre(z.number().int().positive()),
  'assuranceVie.participationMinimaleSoldeFinancier': parametre(tauxDecimal),
  'revenusFonciers.plafondDeficitRevenuGlobal': parametre(montantEuros),
  'plusValueImmobiliere.tauxImpot': parametre(tauxDecimal),
  'retraite.tauxPlein': parametre(tauxDecimal),
  'retraite.decoteParTrimestre': parametre(tauxDecimal),
  'retraite.decoteMaxTrimestres': parametre(z.number().int().positive()),
  'retraite.pensionBaseMaxMensuelle': parametre(montantEuros),
  'agircArrco.valeurServicePoint': parametre(montantEuros),
  'agircArrco.valeurAchatPoint': parametre(montantEuros),
  'agircArrco.tauxCalculTranche1': parametre(tauxDecimal),
  'agircArrco.tauxCalculTranche2': parametre(tauxDecimal),
  'ifi.seuil': parametre(montantEuros),
  'ifi.abattementResidencePrincipale': parametre(tauxDecimal),
  'fgdr.plafondDepots': parametre(montantEuros),
  'fgdr.plafondTitres': parametre(montantEuros),
  'assuranceVie.abattementDecesParBeneficiaire': parametre(montantEuros),
  'assuranceVie.abattementPrimesApres70Ans': parametre(montantEuros),
  'donation.abattementEnfant': parametre(montantEuros),
  'donation.donFamilialArgent': parametre(montantEuros),
  'is.tauxNormal': parametre(tauxDecimal),
  'is.tauxReduit': parametre(tauxDecimal),
  'is.plafondTauxReduit': parametre(montantEuros),
  'demarchage.delaiRetractationJours': parametre(z.number().int().positive()),
  'offrePublique.seuilObligatoire': parametre(tauxDecimal),
  'offrePublique.seuilRetraitObligatoire': parametre(tauxDecimal),
  // Fonction publique et enseignants (profil « futur·e prof »).
  'fp.valeurPointAnnuelle': parametre(montantEuros),
  'fp.historiquePoint': parametre(serieDatee),
  'fp.indiceMinimum': parametre(z.number().int().positive()),
  'fp.retenuePensionCivile': parametre(tauxDecimal),
  'fp.rafp.taux': parametre(tauxDecimal),
  'fp.rafp.plafondPartTraitement': parametre(tauxDecimal),
  'fp.csgCrds.assiette': parametre(tauxDecimal),
  'fp.csg.taux': parametre(tauxDecimal),
  'fp.csg.partNonDeductible': parametre(tauxDecimal),
  'fp.crds.taux': parametre(tauxDecimal),
  'fp.transfertPrimesPoints.categorieA': parametre(montantEuros),
  'fp.indemniteResidence.zone1': parametre(tauxDecimal),
  'fp.indemniteResidence.zone2': parametre(tauxDecimal),
  'fp.indemniteResidence.zone3': parametre(tauxDecimal),
  'certifies.grilleClasseNormale': parametre(grilleIndiciaire),
  'certifies.grilleHorsClasse': parametre(grilleIndiciaire),
  'certifies.grilleClasseExceptionnelle': parametre(grilleIndiciaire),
  'certifies.bonificationRdvCarriere.mois': parametre(z.number().int().positive()),
  'certifies.bonificationRdvCarriere.part': parametre(tauxDecimal),
  'certifies.horsClasse.ancienneteMinMois': parametre(z.number().int().positive()),
  'certifies.classeExceptionnelle.echelonHorsClasseMin': parametre(z.number().int().positive()),
  'enseignants.primeAttractivite': parametre(montantParEchelon),
  'enseignants.isoe.partFixe': parametre(montantEuros),
  'enseignants.isoe.partModulableCollege': parametre(montantEuros),
  'm2e.engagementServirAnnees': parametre(z.number().int().positive()),
  'm2e.stagesM1Semaines': parametre(z.number().int().positive()),
  'm2e.serviceStagiaireHeuresMin': parametre(z.number().int().positive()),
  'm2e.serviceStagiaireHeuresMax': parametre(z.number().int().positive()),
  'm2e.stagiaireEchelon': parametre(z.number().int().positive()),
  'fp.tempsPartiel.remuneration80': parametre(tauxDecimal),
  'fp.surcotisation80.taux': parametre(tauxDecimal),
  'fp.surcotisation80.dureeMaxAnnees': parametre(z.number().int().positive()),
  'fp.cmo.taux3PremiersMois': parametre(tauxDecimal),
  'fp.cmo.taux9MoisSuivants': parametre(tauxDecimal),
  'fp.retraite.tauxMax': parametre(tauxDecimal),
  'fp.retraite.trimestresRequisNesApres1969': parametre(z.number().int().positive()),
  'fp.retraite.decoteParTrimestre': parametre(tauxDecimal),
  'fp.retraite.decoteMaxTrimestres': parametre(z.number().int().positive()),
  'fp.retraite.ageTauxPleinSedentaire': parametre(z.number().int().positive()),
  'aip.montantZoneAlur': parametre(montantEuros),
  'aip.montantAutres': parametre(montantEuros),
  'aip.plafondRfr1Part': parametre(montantEuros),
  'aip.plafondRfr2Parts': parametre(montantEuros),
  'psc.participationEmployeurSante': parametre(tauxDecimal),
  'psc.participationPrevoyanceMensuelle': parametre(montantEuros),
  'mutation.voeuxMax': parametre(z.number().int().positive()),
  'mutation.rapprochementConjoints': parametre(z.number().positive()),
  'mutation.parEnfant': parametre(z.number().positive()),
  'mutation.separationPremiereAnnee': parametre(z.number().positive()),
  'mutation.voeuPreferentielParAn': parametre(z.number().positive()),
  'mutation.voeuPreferentielMax': parametre(z.number().positive()),
})

export type Parametres2026 = z.infer<typeof schemaParametres2026>
export type CleParametre = keyof Parametres2026
