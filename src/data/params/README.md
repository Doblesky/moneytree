# Paramètres annuels

Un fichier par année (`2026.json`), validé au démarrage par `schema.ts` et par
`params.test.ts`. Règle n° 1 de CLAUDE.md : aucune valeur sans source primaire ou officielle.

## Format d'un paramètre

| Champ | Obligatoire | Contenu |
|---|---|---|
| `libelle` | oui | Ce que mesure le paramètre, en français |
| `valeur` | oui | Nombre (taux en décimal : 0,017 pour 1,7 %), ou barème `[{ "jusqua": 11600, "taux": 0 }, …, { "jusqua": null, "taux": 0.45 }]` |
| `unite` | non | « taux », « € », « ans »… |
| `source` | oui | URL https de la source primaire ou officielle consultée |
| `sources_complementaires` | non | Autres URL officielles consultées |
| `verifie_le` | oui | Date de la vérification (AAAA-MM-JJ) |
| `verifie` | oui | `false` si la valeur n'a pas pu être confirmée ; `note` devient alors obligatoire |
| `note` | non | Contexte, période de validité, écart avec le cahier des charges |

## Conventions

- **Impôt sur le revenu : année des revenus.** `2026.json` contient le barème de la loi de
  finances pour 2026, appliqué aux revenus 2025 (paramètre `ir.anneeRevenus`).
- Ajouter ou retirer une clé impose de mettre à jour `schema.ts`.

## Calendrier de vérification

- Chaque mois : taux moyen du crédit (Banque de France), taux d'usure (trimestriel), inflation, taux directeurs de la BCE (`bce.*`, après chaque réunion de politique monétaire).
- Février et août : Livret A, LDDS, LEP (révision au 1er février et au 1er août).
- Janvier-février : barème de l'IR, PFU, prélèvements sociaux, plafonds.
