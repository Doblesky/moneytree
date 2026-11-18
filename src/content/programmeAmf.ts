/**
 * Programme officiel de l'examen AMF : annexe 1 de l'instruction AMF DOC-2010-09, version
 * modifiée le 14 septembre 2026 et applicable au 1er janvier 2027 (PDF téléchargé et lu le
 * 18/11/2026). 12 thèmes, 120 questions ; chaque paragraphe a un nombre de questions et une
 * catégorie : A (connaissances indispensables) ou C (culture financière), 80 % requis dans
 * chacune, sans compensation.
 *
 * La mise en page du PDF rend quelques frontières entre paragraphes ambiguës ; les nombres de
 * questions, eux, totalisent bien 120 (dont 33 en catégorie A), ce que vérifient les tests.
 *
 * Plus bas, la correspondance entre les questions des cours et ces paragraphes : c'est un
 * choix de MoneyTree. Les questions hors programme (crédit immobilier, chômage, budget…)
 * n'entrent pas dans l'examen blanc.
 */
export const SOURCE_PROGRAMME_AMF = {
  libelle: 'AMF : instruction DOC-2010-09, annexe 1 (applicable au 1er janvier 2027)',
  url: "https://www.amf-france.org/sites/institutionnel/files/private/2026-09/DOC%202010-09%20-%20CONDITIONS%20DE%20CERTIFICATION%20PAR%20L'AMF%20D%E2%80%99UN%20ORGANISME%20EXAMEN%20AMF.pdf",
  verifieLe: '2026-11-18',
} as const

export type CategorieAmf = 'A' | 'C'

export const THEMES_AMF: Readonly<Record<number, string>> = {
  1: 'Cadre institutionnel et réglementaire',
  2: 'Déontologie et conformité',
  3: 'Sécurité financière : blanchiment, terrorisme, corruption',
  4: 'Abus de marché',
  5: 'Commercialisation et conseil',
  6: 'Relations avec les clients',
  7: 'Instruments financiers et leurs risques',
  8: 'Gestion collective et finance durable',
  9: 'Fonctionnement des marchés',
  10: 'Post-marché',
  11: 'Émissions et opérations sur titres',
  12: 'Bases comptables, financières et fiscales',
}

export interface ParagrapheAmf {
  id: string
  theme: number
  /** Nombre de questions à l'examen officiel. */
  nb: number
  categorie: CategorieAmf
  intitule: string
}

const p = (id: string, theme: number, nb: number, categorie: CategorieAmf, intitule: string): ParagrapheAmf => ({
  id,
  theme,
  nb,
  categorie,
  intitule,
})

export const PARAGRAPHES_AMF: readonly ParagrapheAmf[] = [
  p('1.1', 1, 2, 'C', 'Cadre de tutelle français : AMF, ACPR, associations professionnelles'),
  p('1.2.1', 1, 2, 'C', 'Processus législatif et régulation européenne : EBA, ESMA, EIOPA'),
  p('1.2.2', 1, 1, 'C', 'Cadre de tutelle international'),
  p('1.3', 1, 3, 'C', 'Acteurs de l’intermédiation et de la distribution, statuts ORIAS, CIF'),
  p('1.5.1', 1, 2, 'C', 'Indicateurs économiques, politique monétaire, rôle de la BCE'),
  p('1.5.2', 1, 2, 'C', 'Marchés internationaux de capitaux et leurs risques'),
  p('1.8', 1, 2, 'C', 'Cadre juridique des instruments financiers et des services d’investissement'),
  p('2.1', 2, 2, 'A', 'Fondements de la déontologie, fonction de conformité'),
  p('2.2', 2, 2, 'A', 'Conflits d’intérêts, transactions personnelles, lanceurs d’alerte'),
  p('2.3', 2, 2, 'A', 'Réclamations et médiation'),
  p('3', 3, 3, 'A', 'Lutte contre le blanchiment, le terrorisme et la corruption'),
  p('4', 4, 2, 'A', 'Abus de marché : initiés, manipulation, fausse information'),
  p('5.1', 5, 4, 'A', 'Gouvernance des produits, démarchage, vente à distance, publicité'),
  p('5.2', 5, 2, 'C', 'Prospectus et documents d’informations clés, frais'),
  p('6.1.1', 6, 5, 'A', 'Connaissance, évaluation et catégorisation du client'),
  p('6.1.2', 6, 2, 'C', 'Confidentialité et protection des données'),
  p('6.2', 6, 5, 'A', 'Information sur la nature du conseil, les produits et les coûts'),
  p('6.3', 6, 3, 'A', 'Agir au mieux des intérêts du client, adéquation, rémunérations'),
  p('6.4', 6, 3, 'A', 'Meilleure exécution des ordres'),
  p('6.5', 6, 2, 'C', 'Charges et commissions'),
  p('6.6', 6, 1, 'C', 'Contrat, capacité, comptes joints, démembrement'),
  p('6.7', 6, 1, 'C', 'Insolvabilité du client'),
  p('6.8', 6, 2, 'C', 'Protection des clients et indemnisation des investisseurs'),
  p('6.9', 6, 1, 'C', 'Protection renforcée sur les produits spéculatifs (CFD, options binaires)'),
  p('7.1', 7, 3, 'C', 'Instruments financiers, couple risque/rendement, risques'),
  p('7.2', 7, 3, 'C', 'Actions : types, valorisation, PER, volatilité'),
  p('7.3', 7, 3, 'C', 'Obligations : types, valorisation, taux, sensibilité'),
  p('7.4', 7, 2, 'C', 'Titres de créances négociables, marché monétaire, indices de référence'),
  p('7.5', 7, 2, 'C', 'Produits structurés'),
  p('7.6', 7, 2, 'C', 'Autres instruments : assurance-vie, comptes à terme, produits de bilan'),
  p('7.7', 7, 1, 'C', 'Produits dérivés : options, futures, swaps, CFD'),
  p('7.8', 7, 2, 'C', 'OPC : valorisation, souscription, rachat'),
  p('7.9', 7, 1, 'C', 'Biens divers'),
  p('7.10', 7, 2, 'C', 'Crypto-actifs, MiCA et prestataires autorisés'),
  p('8.1', 8, 1, 'C', 'Acteurs de la gestion d’actifs'),
  p('8.2.1', 8, 1, 'C', 'Fondamentaux de la gestion d’actifs'),
  p('8.2.2', 8, 2, 'C', 'Mandat, OPCVM, FIA, mesures de performance'),
  p('8.4', 8, 2, 'C', 'Cadre réglementaire de la gestion sous mandat et des fonds'),
  p('8.5', 8, 3, 'C', 'Typologie des OPC : OPCVM, FIA, SCPI, ETF…'),
  p('8.6', 8, 1, 'C', 'Types de gestion : active, passive, thématique'),
  p('8.7', 8, 15, 'C', 'Finance durable : ISR, ESG, taxonomie, SFDR'),
  p('9.1', 9, 2, 'C', 'Lieux et modes d’exécution des ordres'),
  p('9.2', 9, 2, 'A', 'Typologie des ordres et séance de bourse'),
  p('9.3', 9, 1, 'C', 'Transparence pré et post-négociation'),
  p('9.4', 9, 1, 'C', 'Participants et trading algorithmique'),
  p('9.5', 9, 1, 'C', 'Sources de données de marché, agences de notation'),
  p('10.1', 10, 2, 'C', 'Acteurs du post-marché'),
  p('10.2', 10, 1, 'C', 'Organisation du post-marché, règlement-livraison, compensation'),
  p('11.1', 11, 1, 'C', 'Marchés primaires, émetteurs, prospectus, financement participatif'),
  p('11.2', 11, 1, 'C', 'Introductions en bourse, offres publiques, dividendes'),
  p('12.1', 12, 2, 'C', 'Bilan, compte de résultat, ratios'),
  p('12.2', 12, 1, 'C', 'Information financière des sociétés cotées'),
  p('12.3', 12, 2, 'C', 'Fiscalité des particuliers : IR, IFI, prélèvements sociaux'),
  p('12.4', 12, 1, 'C', 'Fiscalité des sociétés'),
]

export function paragrapheParId(id: string): ParagrapheAmf | undefined {
  return PARAGRAPHES_AMF.find((x) => x.id === id)
}

/** Paragraphe par défaut des questions d'un palier (« m3-p4 ») ; absent = hors programme. */
const PAR_PALIER: Readonly<Record<string, string>> = {
  'm0-p2': '1.5.1',
  'm0-p3': '1.5.1',
  'm0-p4': '7.3',
  'm0-p5': '6.3',
  'm1-p1': '12.3',
  'm1-p2': '12.3',
  'm1-p3': '12.3',
  'm1-p4': '12.3',
  'm1-p5': '12.3',
  'm2-p1': '7.6',
  'm2-p2': '7.6',
  'm2-p3': '7.6',
  'm2-p4': '1.5.1',
  'm2-p5': '6.8',
  'm3-p1': '7.1',
  'm3-p2': '7.1',
  'm3-p3': '7.3',
  'm3-p4': '12.1',
  'm3-p5': '10.2',
  'm4-p1': '12.3',
  'm4-p2': '12.3',
  'm4-p3': '12.3',
  'm4-p4': '6.5',
  'm4-p5': '12.3',
  'm5-p1': '8.2.2',
  'm5-p2': '8.2.2',
  'm5-p3': '8.2.2',
  'm5-p4': '8.2.1',
  'm5-p5': '8.2.2',
  'm6-p3': '12.3',
  'm6-p4': '12.3',
  'm6-p5': '6.6',
  'm7-p1': '7.9',
  'm7-p2': '7.10',
  'm7-p3': '11.1',
  'm7-p4': '7.3',
  'm7-p5': '7.7',
  'm8-p5': '12.3',
  'm9-p1': '6.8',
  'm9-p2': '7.5',
  'm9-p3': '6.2',
  'm9-p4': '12.2',
  'm9-p5': '1.3',
}

/** Exceptions question par question ; null = hors programme. */
const PAR_QUESTION: Readonly<Record<string, string | null>> = {
  'm0-p4-q6': null, // TAEG d'un crédit immobilier
  'm0-p4-q7': '1.5.1',
  'm0-p5-q1': '6.1.1',
  'm0-p5-q2': '6.1.1',
  'm2-p4-q5': '7.4', // €STR, indice de référence
  'm2-p5-q5': '1.1',
  'm3-p1-q1': '7.2',
  'm3-p1-q2': '7.3',
  'm3-p1-q3': '7.2',
  'm3-p3-q3': '5.2', // échelle de risque du document d'informations clés
  'm3-p3-q4': '7.1',
  'm3-p3-q5': '7.1',
  'm3-p4-q7': '7.2',
  'm3-p5-q2': '9.2',
  'm3-p5-q3': '9.2',
  'm3-p5-q4': '11.1',
  'm6-p3-q5': '8.5', // SCPI
  'm7-p3-q1': '7.3',
  'm7-p3-q5': '8.5', // capital-investissement
  'm7-p4-q6': '9.5', // agences de notation
  'm7-p5-q3': '6.9',
  'm7-p5-q4': '6.9',
  'm7-p5-q5': '6.1.1', // catégorisation du client
  'm9-p1-q3': '1.3',
  'm9-p2-q1': '6.5',
  'm9-p2-q2': '5.2',
  'm9-p2-q5': '6.8',
  'm9-p3-q3': '1.3',
  'm9-p3-q4': '6.8',
  'm9-p3-q5': null, // biais comportementaux, hors programme
  'm9-p4-q2': '11.1',
  'm9-p4-q4': '6.8',
  'm9-p4-q5': '6.9',
  'm9-p4-q6': '6.8',
  'm9-p5-q1': '6.2',
  'm9-p5-q2': '1.8',
  'm9-p5-q3': '3',
}

/** Paragraphe du programme AMF auquel se rattache une question des cours (null : hors programme). */
export function paragrapheDeQuestion(questionId: string): ParagrapheAmf | null {
  const exception = PAR_QUESTION[questionId]
  if (exception === null) return null
  const id = exception ?? PAR_PALIER[questionId.slice(0, 5)]
  return id === undefined ? null : (paragrapheParId(id) ?? null)
}
