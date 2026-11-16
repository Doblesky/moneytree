# src/data

Données embarquées en JSON, sans aucune API externe à l'exécution.

- `params/<année>.json` : taux, barèmes et plafonds. Chaque paramètre porte sa source
  officielle, sa date de vérification et un champ `verifie` (voir CLAUDE.md).
- `historique/*.json` (phase 2) : séries de marché et d'inflation.
