# MoneyTree

PWA personnelle pour apprendre à gérer et investir son salaire en France, avec deux profils :
futur·e ingénieur·e et futur·e prof du second degré (choisi au premier lancement, modifiable
dans les réglages).
Éducative : elle ne donne aucun conseil en investissement. Règles du projet : [CLAUDE.md](CLAUDE.md).

## Commandes

Node.js ≥ 22 (version utilisée : `.nvmrc`).

| Commande | Rôle |
|---|---|
| `npm install` | Installe les dépendances |
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérifie les types puis construit l'appli dans `dist/` |
| `npm run preview` | Sert `dist/` en local (service worker actif : test hors ligne) |
| `npm test` | Tests Vitest |
| `npm run lint` | ESLint |
| `npm run icones` | Régénère les icônes PNG depuis `public/monogramme.svg` |

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` publie l'appli à chaque push sur `main`, après le
lint et les tests. Une seule fois, dans le dépôt GitHub : **Settings › Pages › Source :
GitHub Actions**. L'appli est alors servie en HTTPS à `https://<compte>.github.io/<dépôt>/`.

## Installer l'appli sur un téléphone Android

1. Ouvrir l'URL de l'appli dans Chrome.
2. Menu ⋮ › **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
3. L'appli s'ouvre ensuite depuis son icône, en plein écran, et fonctionne hors ligne.

Les données restent sur le téléphone. Réglages › Tes données : export et import JSON.

## Installer le widget de rappel (Android)

Un widget d'écran d'accueil montre une carte des paliers maîtrisés, qui change toutes les
10 minutes par défaut. Il vient d'un petit compagnon Android, car une PWA ne peut pas
déclarer de widget sur Android (conception : `docs/superpowers/specs/2026-11-24-widget-rappel-design.md`).

1. Dans l'appli installée : Réglages › Widget › **Télécharger le compagnon Android**.
2. Ouvrir le fichier téléchargé et autoriser l'installation depuis Chrome.
3. Sur un Xiaomi (HyperOS ou MIUI) : autoriser le **démarrage automatique** de MoneyTree Widget
   et retirer ses **restrictions de batterie**, sinon la carte risque de ne plus tourner.
4. Appui long sur l'écran d'accueil › Widgets › MoneyTree, puis placer le widget (4×3 par
   défaut, redimensionnable de 2×2 à 4×4).
5. Revenir dans Réglages › Widget et activer **Widget installé sur ce téléphone**.

Ensuite, l'appli envoie les cartes au compagnon toute seule, à la fin d'un palier réussi et
au premier appui après un retour dans l'appli. Construire le compagnon : `bash android/construire.sh`
(SDK Android et Android Studio requis), tests : `bash android/tester.sh`.
