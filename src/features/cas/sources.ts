/** Sources officielles citées par les débriefs des cas d'école (vérifiées le 17/11/2026). */
import type { Source } from '../../content/schema.ts'

export const SOURCES = {
  precaution: {
    libelle: 'Banque de France, Mes questions d’argent : pourquoi épargner',
    url: 'https://www.mesquestionsdargent.fr/epargne-et-placements/pourquoi-epargner',
  },
  loyers: {
    libelle: 'Observatoires des loyers : agglomération de Toulouse',
    url: 'https://www.observatoires-des-loyers.org/connaitre-les-loyers/carte-des-niveaux-de-loyers/agglomeration-de-toulouse/toulouse-31555',
  },
  cge: {
    libelle: 'Conférence des grandes écoles : enquête insertion 2026',
    url: 'https://www.cge.asso.fr/wp-content/uploads/2026/06/CGE-Enquete-Insertion-2026-Rapport-VF.pdf',
  },
  per: { libelle: 'Service-Public : plan d’épargne retraite', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F34982' },
  pea: { libelle: 'Service-Public : PEA', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2385' },
  peaFiscalite: { libelle: 'impots.gouv : l’assurance-vie et le PEA', url: 'https://www.impots.gouv.fr/particulier/lassurance-vie-et-le-pea-0' },
  pee: { libelle: 'Service-Public : PEE', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2142' },
  msci: { libelle: 'MSCI : indice MSCI World', url: 'https://www.msci.com/indexes/index/990100' },
  frais: {
    libelle: 'AMF : comprendre les frais des placements financiers',
    url: 'https://www.amf-france.org/fr/espace-epargnants/les-frais-des-placements-financiers/comprendre-les-frais-des-placements-financiers',
  },
  conseils: {
    libelle: 'AMF : quelques conseils pour bien investir',
    url: 'https://www.amf-france.org/fr/espace-epargnants/savoir-bien-investir/conseils-pratiques/les-regles-dor-de-linvestisseur',
  },
  succession: {
    libelle: 'Service-Public : droits de succession',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F14198',
  },
  livretA: { libelle: 'Service-Public : Livret A', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2365' },
  loyersBordeaux: {
    libelle: 'Observatoires des loyers : agglomération de Bordeaux',
    url: 'https://www.observatoires-des-loyers.org/connaitre-les-loyers/carte-des-niveaux-de-loyers/agglomeration-de-bordeaux',
  },
  notaire: { libelle: 'Service-Public : frais de notaire', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F17701' },
  droitsMutation: { libelle: 'impots.gouv : achat dans l’ancien', url: 'https://www.impots.gouv.fr/particulier/achat-dans-lancien' },
  creditBdf: {
    libelle: 'Banque de France : crédits aux particuliers',
    url: 'https://www.banque-france.fr/fr/statistiques/credit/credits-aux-particuliers-2026-09',
  },
  hcsf: {
    libelle: 'HCSF : octroi de crédits immobiliers',
    url: 'https://www.economie.gouv.fr/hcsf/mesures/mesure-relative-loctroi-de-credits-immobiliers',
  },
  dvf: { libelle: 'data.gouv.fr : explorateur des valeurs foncières (DVF)', url: 'https://explore.data.gouv.fr/fr/immobilier' },
  // Profil prof (vérifiées le 18/11/2026).
  statutCertifies: {
    libelle: 'Légifrance : statut des professeurs certifiés (décret n° 72-581)',
    url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000306772',
  },
  remunerationFp: {
    libelle: 'Légifrance : rémunération des agents publics (décret n° 85-1148)',
    url: 'https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006064738/',
  },
  grillesEnseignants: {
    libelle: 'Légifrance : échelonnement indiciaire des enseignants (décret n° 2017-789)',
    url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000034601473',
  },
  cotisationsFp: {
    libelle: 'Service-Public : cotisations salariales du fonctionnaire',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F468',
  },
  lep: { libelle: 'Service-Public : LEP', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2367' },
  aip: {
    libelle: 'Portail de la fonction publique : aide à l’installation des personnels',
    url: 'https://www.fonction-publique.gouv.fr/etre-agent-public/mes-prestations-daction-sociale/laction-sociale-interministerielle/logement/vous-etes-affecte-pour-la-premiere-fois-dans-la-fonction-publique',
  },
  fraisReels: {
    libelle: 'Service-Public : frais professionnels, forfait ou frais réels',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1989',
  },
  mutations: {
    libelle: 'Ministère de l’Éducation nationale : mutation des personnels du second degré',
    url: 'https://www.education.gouv.fr/mutation-des-personnels-du-second-degre-siam-phase-interacademique-3218',
  },
  tempsPartielFp: {
    libelle: 'Service-Public : temps partiel d’un fonctionnaire',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F486',
  },
  retraiteFp: {
    libelle: 'Service-Public : montant de la retraite de l’agent public',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F21142',
  },
} satisfies Record<string, Source>
