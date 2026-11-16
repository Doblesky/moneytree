# Appli d'apprentissage de l'investissement (PWA)

PWA personnelle pour apprendre à gérer et investir un salaire d'ingénieur en France :
cours en quiz par paliers, simulateur (historique / Monte Carlo / scénarios), mode carrière,
cas d'école. Usage personnel, éducatif : l'appli ne donne aucun conseil en investissement.

Cahier des charges : `Cahier des charges – Appli d'apprentissage de l'investissement (PWA).pdf`,
à la racine du dossier. C'est l'export du doc https://claude.ai/artifact/YUTkJc3MYiDdfHxK7NTsSK,
que Claude Code ne peut pas ouvrir : si ce doc change, il faut réexporter le PDF.
En cas de doute sur une fonctionnalité, le cahier des charges fait foi.

Maquettes : `01_Maquettes/`. La planche de direction artistique est
`Sources_Claude_Design/Main.dc.html` ; les écrans sont dans le même dossier, dans l'ordre de
`canvas.json`. Tous les chiffres des maquettes sont fictifs.

## Règle n°1 : sources vérifiées

Toute information financière, fiscale ou réglementaire (taux, barèmes, plafonds, règles des
enveloppes, données de marché) doit être vérifiée sur une source primaire ou officielle
au moment où elle est utilisée : Légifrance, BOFiP, impots.gouv.fr, service-public.fr, AMF,
Banque de France, Insee, URSSAF, fournisseurs d'indices (MSCI…).

- Ne jamais coder une valeur de mémoire. Si une source n'est pas vérifiable, le signaler
  explicitement à l'utilisateur et marquer la valeur `"verifie": false`.
- Les blogs et comparateurs servent seulement de piste vers la source officielle.
- Le même niveau d'exigence s'applique aux contenus des cours et aux explications des quiz.

## Paramètres

Tous les taux, barèmes et plafonds vivent dans `src/data/params/<année>.json`, jamais en dur
dans le code. Chaque paramètre porte sa source et sa date de vérification :

```json
{
  "livretA.taux": {
    "valeur": 0.017,
    "source": "https://www.service-public.gouv.fr/...",
    "verifie_le": "2026-11-16",
    "verifie": true
  }
}
```

Une tâche mensuelle vérifie ces paramètres : chaque mois les taux de crédit, l'inflation et
le taux d'usure ; en février et en août les livrets réglementés ; une fois par an
(janvier-février) le barème de l'IR, la flat tax, les prélèvements sociaux et les plafonds.

## Architecture

- Vite + React + TypeScript (strict), vite-plugin-pwa, IndexedDB via Dexie, Recharts ou uPlot.
- `src/engine/` : moteur de simulation en TypeScript pur, sans dépendance à l'interface.
  Il prend un état et des décisions, et renvoie l'état du mois suivant. Le Monte Carlo
  tourne dans un Web Worker.
- `src/data/` : paramètres annuels et séries historiques embarquées en JSON (aucune API
  externe à l'exécution).
- `src/content/` : modules de cours et questions de quiz en JSON.
- `src/features/` : cours, quiz, simulateur, carrière, cas d'école.

## Principes de conception

- Réalisme en deux couches : les règles connues sont calculées exactement, les marchés sont
  rejoués ou modélisés de façon probabiliste, jamais prédits.
- Les résultats s'affichent par défaut en euros constants.
- Divulgation progressive : à l'arrivée, l'utilisateur ne voit que l'essentiel. Chaque
  module est découpé en 5 paliers, et un levier du simulateur ne s'affiche qu'une fois que
  le module correspondant est maîtrisé. Les boutons « débloquer quand même » et mode expert
  restent toujours disponibles.
- Interface et contenus en français.

## Tests

- Vitest. Le moteur fiscal (IR, brut → net, fiscalité des enveloppes) est testé contre des cas
  calculés avec les simulateurs officiels (impots.gouv.fr, mon-entreprise.urssaf.fr) avant
  tout travail d'interface. Chaque cas de test cite le simulateur et la date.
- Une modification du moteur ne se livre pas sans tests qui passent.

## Développement

On avance phase par phase (phases 0 à 5 du cahier des charges). Chaque phase doit livrer une
appli utilisable, et on ne commence pas la suivante sans l'accord de l'utilisateur.
