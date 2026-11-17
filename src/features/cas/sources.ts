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
} satisfies Record<string, Source>
