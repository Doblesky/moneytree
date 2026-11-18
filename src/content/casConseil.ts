/**
 * Cas de conseil client (palier Professionnel) : un client fictif, son dossier, et cinq
 * décisions à prendre comme le ferait un conseiller. Le débrief est corrigé comme un examen.
 *
 * Tous les faits viennent des sources officielles déjà citées dans les cours (vérifiées le
 * 18/11/2026) ; les clients, leurs chiffres et leurs demandes sont fictifs.
 */
import type { QuestionQcm, Source } from './schema.ts'

const S = (libelle: string, url: string): Source => ({ libelle, url })

const SRC = {
  cif: S('AMF : que savoir sur les conseillers en investissements financiers ?', 'https://www.amf-france.org/fr/espace-epargnants/savoir-bien-investir/choisir-un-professionnel/conseillers-en-investissements-financiers'),
  precaution: S('Banque de France, Mes questions d’argent : pourquoi épargner', 'https://www.mesquestionsdargent.fr/epargne-et-placements/pourquoi-epargner'),
  horizon: S('AMF : fixer son horizon de placement', 'https://www.amf-france.org/fr/espace-epargnants/savoir-bien-investir/cadrer-son-projet/fixer-son-horizon-de-placement'),
  psan: S('AMF : fin de la période transitoire des PSAN', 'https://www.amf-france.org/fr/actualites-publications/actualites/lamf-rappelle-que-la-periode-transitoire-pour-les-psan-pour-continuer-de-fournir-des-services-sur'),
  sinformer: S('AMF : bien s’informer sur les sociétés cotées', 'https://www.amf-france.org/fr/espace-epargnants/savoir-bien-investir/etre-un-actionnaire-individuel/bien-sinformer'),
  donation: S('Service-Public : droits à payer sur une donation', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F14203'),
  bareme669: S('BOFiP : barème de l’article 669 du CGI', 'https://bofip.impots.gouv.fr/bofip/2323-PGP.html/identifiant=BOI-ENR-DMTG-10-40-10-50-20131223'),
  notaires: S('Notaires de France : donation avec réserve d’usufruit', 'https://monnotaire-masuccession.notaires.fr/node/151'),
  avDeces: S('impots.gouv.fr : imposition des assurances-vie en cas de décès', 'https://www.impots.gouv.fr/international-particulier/questions/comment-sont-imposees-les-assurances-vie-en-cas-de-deces-du'),
  ifiCalcul: S('Service-Public : calcul de l’IFI', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F138'),
  ifiBiens: S('Service-Public : IFI, personnes et biens concernés', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F563'),
  fgdr: S('FGDR : la protection de votre argent', 'https://www.garantiedesdepots.fr/fr/plaquette-explicative-la-protection-de-votre-argent-en-cas-de-defaillance-de-votre-etablissement'),
  mereFille: S('BOFiP : régime des sociétés mères et filiales', 'https://bofip.impots.gouv.fr/bofip/1924-PGP.html/identifiant=BOI-IS-BASE-10-10-10-10-20200415'),
  cfd: S('AMF : CFD et options binaires, des restrictions pour protéger les épargnants', 'https://www.amf-france.org/fr/actualites-publications/communiques/communiques-de-lamf/cfd-et-options-binaires-lamf-rappelle-aux-epargnants-que-les-mesures-de-restriction-decidees-par'),
  forex: S('AMF : Forex, options binaires, un marché à fuir', 'https://www.amf-france.org/fr/espace-epargnants/proteger-son-epargne/forex-options-binaires-un-marche-fuir'),
  tracfin: S('Tracfin : les obligations déclaratives', 'https://www.economie.gouv.fr/tracfin/les-obligations-declaratives'),
}

export interface CasConseil {
  id: string
  /** Le dossier du client, paragraphe par paragraphe. */
  dossier: readonly string[]
  /** Ce que le client demande. */
  demande: string
  questions: readonly QuestionQcm[]
}

const q = (
  id: string,
  enonce: string,
  choix: string[],
  explication: string,
  sources: Source[],
): QuestionQcm => ({ id, type: 'qcm', enonce, choix, bonne: 0, explication, sources })

export const CAS_CONSEIL: readonly CasConseil[] = [
  {
    id: 'conseil-premier-client',
    dossier: [
      'Léa, 27 ans, ingénieure, célibataire. 2 900 € net par mois, 800 € de loyer, 1 300 € d’autres dépenses.',
      '2 000 € sur son compte courant, aucune autre épargne. Elle veut acheter sa résidence principale dans 5 ans et commencer à préparer sa retraite.',
    ],
    demande: '« J’ai vu sur TikTok qu’on pouvait doubler sa mise en cryptos. Je veux y mettre tout ce que j’économise. »',
    questions: [
      q('conseil-premier-client-q1', 'Avant de lui proposer quoi que ce soit, que dois-tu faire ?',
        ['Recueillir ses objectifs, sa situation, ses connaissances, sa tolérance au risque et sa capacité à subir des pertes', 'Lui présenter les cryptos les plus rentables', 'Lui faire signer un mandat de gestion', 'Lui demander son avis d’imposition seulement'],
        'Un conseiller doit d’abord connaître son client : objectifs, situation financière, connaissances et expérience, tolérance au risque et capacité à subir des pertes. Sans ces informations, il s’abstient de conseiller.', [SRC.cif]),
      q('conseil-premier-client-q2', 'Léa n’a aucune réserve. Quelle est la première étape ?',
        ['Constituer une épargne de précaution disponible', 'Investir en cryptos tout de suite', 'Ouvrir un PER pour la retraite', 'Emprunter pour acheter plus tôt'],
        'L’épargne de précaution sert à faire face aux imprévus (panne, période sans emploi). Elle passe avant tout placement risqué.', [SRC.precaution]),
      q('conseil-premier-client-q3', 'Pour l’apport de son achat dans 5 ans, quel type de placement ?',
        ['Un placement peu risqué, adapté à un horizon court', 'Des actions à 100 %', 'Des cryptos', 'Un placement bloqué jusqu’à la retraite'],
        'L’horizon guide le choix des supports : un projet à 5 ans supporte mal une forte baisse au mauvais moment.', [SRC.horizon]),
      q('conseil-premier-client-q4', 'Elle tient à une petite part de cryptos. Quel réflexe lui donner ?',
        ['Passer par un prestataire autorisé selon MiCA, et n’y mettre que ce qu’elle peut perdre', 'Suivre les conseils de l’influenceur', 'Utiliser une plateforme non autorisée, moins chère', 'Emprunter pour en acheter plus'],
        'Depuis le 1er juillet 2026, seuls les prestataires autorisés selon MiCA peuvent proposer leurs services en France. Et une information vue sur un réseau social appelle la méfiance.', [SRC.psan, SRC.sinformer]),
      q('conseil-premier-client-q5', 'Léa décide de ne pas suivre ton conseil. Que lui remets-tu ?',
        ['La déclaration d’adéquation, qu’elle suive ou non le conseil', 'Rien, puisqu’elle refuse', 'Une facture de pénalité', 'Un contrat de crypto-actifs'],
        'La déclaration d’adéquation est remise une fois le conseil délivré, que le client décide ou non de le suivre.', [SRC.cif]),
    ],
  },
  {
    id: 'conseil-transmission',
    dossier: [
      'Michel, 64 ans, et Anne, 62 ans, mariés, deux enfants majeurs. Résidence principale 450 000 €, appartement loué 300 000 € au nom de Michel, livrets 80 000 €.',
      'Une assurance-vie de 200 000 €, alimentée avant les 70 ans de Michel, au profit de leurs deux enfants à parts égales.',
    ],
    demande: '« Nous voulons aider nos enfants maintenant, sans nous démunir, et payer le moins de droits possible. »',
    questions: [
      q('conseil-transmission-q1', 'Hors don d’argent, combien les parents peuvent-ils donner à leurs deux enfants sans droits de donation ?',
        ['400 000 €', '100 000 €', '200 000 €', '800 000 €'],
        'Chaque enfant bénéficie d’un abattement de 100 000 € par parent, renouvelable tous les 15 ans : 2 parents × 2 enfants × 100 000 €.', [SRC.donation]),
      q('conseil-transmission-q2', 'Michel donne aux deux enfants la nue-propriété de l’appartement loué et garde l’usufruit. Sur quelle valeur portent les droits ?',
        ['180 000 €', '300 000 €', '120 000 €', '0 €'],
        'De 61 à 70 ans, l’usufruit vaut 40 % et la nue-propriété 60 % : 300 000 × 60 % = 180 000 €, soit 90 000 € par enfant, sous l’abattement de 100 000 €.', [SRC.bareme669]),
      q('conseil-transmission-q3', 'Que garde Michel avec l’usufruit ?',
        ['Les loyers de l’appartement', 'Le droit de le vendre seul', 'Rien du tout', 'La moitié du prix de vente'],
        'L’usufruitier garde le droit d’utiliser le bien et d’en percevoir les revenus : Michel continue de toucher les loyers.', [SRC.notaires]),
      q('conseil-transmission-q4', 'Au décès de Michel, que se passe-t-il pour l’appartement ?',
        ['Les enfants deviennent pleins propriétaires sans droits de mutation supplémentaires', 'Ils paient des droits sur 300 000 €', 'L’appartement revient à Anne', 'Il doit être vendu'],
        'L’usufruit s’éteint au décès et les donataires deviennent pleins propriétaires, sans droits de mutation en complément.', [SRC.notaires]),
      q('conseil-transmission-q5', 'Au décès de Michel, combien de prélèvement sur l’assurance-vie de 200 000 € ?',
        ['Aucun', '9 500 €', '40 000 €', '20 000 €'],
        'Pour des primes versées avant 70 ans, chaque bénéficiaire a un abattement de 152 500 € : 100 000 € chacun, aucun prélèvement.', [SRC.avDeces]),
    ],
  },
  {
    id: 'conseil-ifi',
    dossier: [
      'Claire, 58 ans, dirigeante. Résidence principale estimée 1 000 000 €, un studio loué 400 000 €, sans dette.',
      '250 000 € répartis sur un compte courant et un compte à terme dans une seule banque. Elle détient, via une holding, des actions de sa société.',
    ],
    demande: '« Je veux acheter un deuxième appartement à 300 000 € comptant. Quelles conséquences ? »',
    questions: [
      q('conseil-ifi-q1', 'Aujourd’hui, Claire est-elle soumise à l’IFI ?',
        ['Non, son patrimoine taxable reste sous le seuil', 'Oui, sur 1 400 000 €', 'Oui, sur 1 000 000 €', 'Non, car sa résidence principale est exonérée en totalité'],
        'La résidence principale bénéficie d’un abattement de 30 % : 1 000 000 € comptent pour 700 000 €. Avec le studio, 1 100 000 € : sous le seuil de 1 300 000 €.', [SRC.ifiBiens, SRC.ifiCalcul]),
      q('conseil-ifi-q2', 'Après l’achat, son patrimoine taxable atteint 1 400 000 €. Quel IFI ?',
        ['3 200 €', '0 €', '9 800 €', '1 400 €'],
        'Barème dès 800 000 € : 500 000 × 0,5 % = 2 500 € et 100 000 × 0,7 % = 700 €. La décote vaut 17 500 − 1,25 % × 1 400 000 = 0 €.', [SRC.ifiCalcul]),
      q('conseil-ifi-q3', 'Ses 250 000 € de dépôts dans une seule banque sont-ils protégés si la banque fait défaut ?',
        ['Jusqu’à 100 000 €', 'En totalité', 'Jusqu’à 70 000 €', 'Jusqu’à 250 000 €, avec deux comptes'],
        'La garantie des dépôts couvre 100 000 € par client et par établissement, tous comptes additionnés (hors livrets réglementés, couverts à part).', [SRC.fgdr]),
      q('conseil-ifi-q4', 'Sa holding reçoit 100 000 € de dividendes de sa société, sous le régime mère-fille. Quelle part reste imposable à l’impôt sur les sociétés ?',
        ['5 000 €', '100 000 €', '25 000 €', '0 €'],
        'Sous le régime mère-fille, les dividendes sont retirés du résultat, sauf une quote-part de frais et charges égale à 5 %.', [SRC.mereFille]),
      q('conseil-ifi-q5', 'Les actions de sa société, détenues par la holding, entrent-elles dans l’IFI ?',
        ['Non, tant que ce ne sont pas des biens immobiliers', 'Oui, en totalité', 'Oui, pour 30 %', 'Seulement si elles versent des dividendes'],
        'L’IFI ne porte que sur l’immobilier détenu directement ou indirectement : une société opérationnelle non immobilière n’en fait pas partie.', [SRC.ifiBiens]),
    ],
  },
  {
    id: 'conseil-levier',
    dossier: [
      'Hugo, 31 ans, a perdu 8 000 € en un an sur des CFD. Une plateforme lui propose de le classer « client professionnel » pour avoir plus de levier.',
      'Un « cabinet d’avocats » l’a contacté pour récupérer ses pertes, contre 1 500 € de frais. Il veut aussi placer 50 000 € en espèces, dont il reste vague sur l’origine.',
    ],
    demande: '« Je veux me refaire vite. Tu peux gérer mon compte à ma place ? »',
    questions: [
      q('conseil-levier-q1', 'Que lui dis-tu du reclassement en « client professionnel » ?',
        ['Il perdrait des protections réservées aux particuliers', 'C’est une bonne idée pour se refaire', 'Cela lui donne une garantie de l’AMF', 'Cela ne change rien pour lui'],
        'Un client professionnel peut perdre plus que le solde de son compte et n’a pas de plafond de levier ; le reclassement exige plusieurs critères et affaiblit sa position en cas de litige.', [SRC.cfd]),
      q('conseil-levier-q2', 'Quel chiffre lui rappeler sur les CFD ?',
        ['74 % à 89 % de comptes perdants', '10 % à 20 % de comptes perdants', 'Environ la moitié de comptes perdants', 'Moins de 5 % de comptes perdants'],
        'Selon les chiffres cités par l’ESMA, 74 % à 89 % des comptes investis en CFD avaient un solde négatif selon les pays.', [SRC.cfd]),
      q('conseil-levier-q3', 'Que penser du « cabinet » qui propose de récupérer ses pertes ?',
        ['C’est une arnaque classique : ne rien payer', 'Il faut payer vite', 'C’est l’AMF qui l’a mandaté', 'C’est un service normal'],
        'De soi-disant avocats ou personnes mandatées par l’AMF proposent de récupérer l’argent perdu sur le Forex : l’AMF prévient qu’il s’agit d’une arnaque.', [SRC.forex]),
      q('conseil-levier-q4', 'En tant que conseiller en investissements financiers, peux-tu gérer son portefeuille à sa place ?',
        ['Non', 'Oui, avec son accord oral', 'Oui, au-delà de 50 000 €', 'Oui, si tu es inscrit à l’ORIAS'],
        'Le CIF peut conseiller, pas gérer un portefeuille pour le compte d’un client : ce service est réservé aux prestataires de services d’investissement agréés.', [SRC.cif]),
      q('conseil-levier-q5', 'Ses 50 000 € en espèces d’origine floue te font soupçonner du blanchiment. Que dois-tu faire ?',
        ['Déclarer ton soupçon à Tracfin avant toute opération, et t’abstenir de l’exécuter', 'Placer l’argent, puis voir', 'Lui conseiller de fractionner les dépôts', 'Ignorer la question'],
        'La déclaration de soupçon se fait avant l’exécution, pour permettre à Tracfin de s’y opposer ; le professionnel s’abstient de l’opération suspecte.', [SRC.tracfin]),
    ],
  },
]

export function casConseilParId(id: string): CasConseil | undefined {
  return CAS_CONSEIL.find((c) => c.id === id)
}
