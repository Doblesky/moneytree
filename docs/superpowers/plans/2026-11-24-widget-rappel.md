# Widget de rappel des cours : plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objectif :** un widget Android qui affiche, sur l'écran d'accueil, une carte des paliers
maîtrisés du profil actif, changée toutes les 10 minutes par défaut, et que la PWA met à jour
sans bouton dédié.

**Architecture :** la PWA construit un « paquet » de cartes en texte brut et l'envoie à un
petit compagnon Android par un lien `intent:` accroché à un appui existant. Le compagnon
(Java, sans Gradle) valide et enregistre le paquet, choisit la carte selon l'heure et
replanifie une alarme inexacte. L'APK est publié avec la PWA sur GitHub Pages.

**Technologies :** React 19, TypeScript strict, Dexie, Vitest, `CompressionStream` ; Java 11,
SDK Android (build-tools 36.0.0, plateforme 37), `RemoteViews`, `AlarmManager`.

**Conception :** `docs/superpowers/specs/2026-11-24-widget-rappel-design.md` (à lire avant
toute tâche).

## Contraintes globales

- Interface et textes en français, typographie de l'appli (apostrophe ’, espaces insécables).
- Aucun taux ni plafond en dur : les valeurs des cartes viennent de `analyserTexte` et des
  paramètres de l'année (règle n° 1 de CLAUDE.md).
- Le paquet ne contient aucune donnée personnelle (ni salaire, ni ville, ni score).
- Envoi seulement sur Android, seulement dans un appui de l'utilisateur, jamais deux envois à
  moins de 10 000 ms, rattrapage au retour dans l'appli après 6 h.
- Durées proposées : 10, 15, 30, 60 et 180 minutes ; 10 par défaut.
- Paquet Android `io.github.doblesky.moneytree.widget`, schéma `moneytree-widget`, hôte `sync`,
  nom affiché « MoneyTree Widget », aucune permission réseau, `minSdk` 31, `targetSdk` 36.
- Adresse de l'appli, constante du compagnon : `https://doblesky.github.io/moneytree/`.
- Paquet décodé refusé au-delà de 512 000 octets ; version de format `v` = 1.
- Couleurs du widget : fond #1E3A2B, texte #F4EEDF, accents #C69A3F.
- Avant chaque commit : `npm run lint`, `npm test`, `npm run build` verts. Chaque tâche se
  termine par un commit poussé sur `main` (préférence de l'utilisateur).
- L'émulateur se lance toujours avec `-read-only` (AVD `Medium_Phone_API_37.0`).

## Points de vigilance

1. **Compagnon désinstallé pendant un quiz :** le repli ne doit ni recharger la page, ni
   changer de route, ni ouvrir le Play Store. Test : tâche 9, étape 3.
2. **Paquet de taille maximale** (tous les paliers des deux profils maîtrisés) : il doit
   passer par le lien et être accepté. Tests : tâche 2 (taille) et tâche 6 (réception).
3. **Paquet hostile ou corrompu** envoyé par une autre page : le widget n'affiche que du
   texte, ne plante pas et garde le paquet précédent. Test : tâche 6, étape 5.
4. **Import du profil sur le PC :** aucun lien `intent:` ne doit partir hors d'Android, et
   l'import d'un export contenant `widget` doit réussir. Tests : tâches 3 et 4.
5. **Retour au premier plan pendant un quiz :** le rattrapage ne doit pas interrompre la
   saisie. Test : tâche 9, étape 4.

---

### Tâche 1 : le paquet de cartes

**Fichiers :**
- Créer : `src/widget/paquet.ts`
- Test : `src/widget/paquet.test.ts`

**Interfaces :**
- Utilise : `EtatProgression` (`src/progression/regles.ts`), `contenuModule`, `infoModule`,
  `NOMS_PALIERS` (`src/content/catalogue.ts`), `METIERS` (`src/profils/metiers.ts`),
  `analyserTexte` (`src/content/texte.ts`), `parametres2026()`, `faitsHistoriques()`.
- Produit :
  ```ts
  export const INTERVALLES_WIDGET = [10, 15, 30, 60, 180] as const
  export type IntervalleWidget = (typeof INTERVALLES_WIDGET)[number]
  export interface CarteWidget {
    id: string; module: number; palier: number; rang: number
    moduleTitre: string; palierNom: string; titre: string; texte: string; fictif: boolean
  }
  export interface PaquetWidget { v: 1; profil: IdMetier; intervalle: IntervalleWidget; cartes: CarteWidget[] }
  export function texteBrut(texte: string, p: Parametres2026, f: FaitsHistoriques): string
  export function cartesMaitrisees(etat: EtatProgression): CarteWidget[]
  export function construirePaquet(etat: EtatProgression, intervalle: IntervalleWidget): PaquetWidget
  export function signaturePaquet(paquet: PaquetWidget): string
  ```

- [ ] **Étape 1 : écrire les tests qui échouent**

Un état de test se construit avec `{ metier, modeExpert: false, leviersForces: [], modules: [...] }`.

- `aucune carte sans palier maîtrisé` : `modules: []` → `cartesMaitrisees` renvoie `[]`.
- `cartes des paliers maîtrisés, dans l'ordre` : ingénieur, module 0 avec `paliersMaitrises: 2`
  → les ids sont ceux de `contenuModule(0, 'ingenieur')` paliers 1 puis 2 ; chaque carte a
  `module: 0`, le bon `palier`, `rang` = sa position dans le palier (0, 1, 2…),
  `palierNom` = `NOMS_PALIERS[palier - 1]`, `moduleTitre: 'Bases'`.
- `les déblocages ne comptent pas` : module 1 avec `paliersMaitrises: 0`,
  `debloqueQuandMeme: true`, `palierDebloque: 3`, `enCours: { palier: 1, carte: 2 }`, et
  `modeExpert: true` → aucune carte du module 1.
- `variantes et modules du profil prof` : prof, modules 0 et 10 avec `paliersMaitrises: 1`
  → au moins une carte dont l'id finit par `-prof`, et des cartes du module 10 ; le même état
  en ingénieur ne contient aucune carte du module 10.
- `titre de module selon le profil` : prof, module 8 maîtrisé au palier 1 →
  `moduleTitre: 'Carrière et vie de prof'`.
- `aucune balise ne subsiste` : pour chaque profil, tous les modules du parcours à
  `paliersMaitrises: 5` → aucun `texte` ni `titre` ne contient `{p:`, `{h:`, `[[`, `]]`, `**`,
  ni une ligne commençant par `- ` ; les puces commencent par `• `.
- `fictif suit exempleFictif` : pour chaque carte, `fictif` vaut `exempleFictif === true` de
  la carte source.
- `texteBrut` : `'Le [[taux|livret-a]] est **net**.\n\n- un\n- deux'` →
  `'Le taux est net.\n\n• un\n• deux'` (avec les paramètres et faits réels).
- `signature stable` : deux appels identiques donnent la même signature ; changer
  `intervalle` ou retirer une carte la change ; la signature fait 8 caractères hexadécimaux.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Run: `npx vitest run src/widget/paquet.test.ts`
Expected: FAIL, module `./paquet.ts` introuvable.

- [ ] **Étape 3 : écrire `src/widget/paquet.ts`**

`texteBrut` aplatit les `Bloc` d'`analyserTexte` : paragraphes joints par `\n\n`, éléments de
liste préfixés de `• ` et joints par `\n`, segments `glossaire` et `gras` réduits à leur texte.
`cartesMaitrisees` parcourt `METIERS[etat.metier].modules` dans l'ordre, puis les paliers 1 à
`paliersMaitrises`. `signaturePaquet` : FNV-1a 32 bits sur `JSON.stringify(paquet)`, en
hexadécimal sur 8 caractères.

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Run: `npx vitest run src/widget/paquet.test.ts`
Expected: PASS.

- [ ] **Étape 5 : vérifier, committer et pousser**

Run: `npm run lint && npm test && npm run build`, puis
`git add src/widget && git commit -m "Widget : paquet des cartes maîtrisées" && git push`.

---

### Tâche 2 : encodage du paquet et lien vers le compagnon

**Fichiers :**
- Créer : `src/widget/lien.ts`
- Test : `src/widget/lien.test.ts`

**Interfaces :**
- Utilise : `PaquetWidget`, `construirePaquet` (tâche 1).
- Produit :
  ```ts
  export const PAQUET_ANDROID = 'io.github.doblesky.moneytree.widget'
  export const PARAM_ABSENT = 'widget-absent'
  export const TAILLE_MAX_DECODEE = 512_000
  export function encoderPaquet(paquet: PaquetWidget): Promise<string>   // base64url sans « = »
  export function lienIntent(donnees: string, repli: string): string
  export function urlRepli(href: string, maintenantMs: number): string
  export function retirerParamAbsent(hash: string): string | null        // null : paramètre absent
  export function estAndroid(userAgent: string): boolean
  ```

- [ ] **Étape 1 : écrire les tests qui échouent**

- `lienIntent` : `lienIntent('abc', 'https://x/#/a')` vaut exactement
  `'intent://sync?d=abc#Intent;scheme=moneytree-widget;package=io.github.doblesky.moneytree.widget;S.browser_fallback_url=https%3A%2F%2Fx%2F%23%2Fa;end'`.
- `urlRepli` : `('https://d.io/m/#/parcours/0/1', 42)` → `'https://d.io/m/#/parcours/0/1?widget-absent=42'` ;
  `('https://d.io/m/#/parcours/0/1?carte=2', 42)` → `'…?carte=2&widget-absent=42'` ;
  `('https://d.io/m/', 42)` → `'https://d.io/m/#/?widget-absent=42'`.
- `retirerParamAbsent` : `'#/parcours/0/1?widget-absent=42'` → `'#/parcours/0/1'` ;
  `'#/a?carte=2&widget-absent=42'` → `'#/a?carte=2'` ; `'#/a'` → `null`.
- `estAndroid` : vrai pour un agent contenant `Android 14; 23013RK75C`, faux pour Windows.
- `aller-retour` : `encoderPaquet` puis décodage (base64url → `DecompressionStream('deflate-raw')`
  → `JSON.parse`) redonne le paquet ; la chaîne ne contient que `[A-Za-z0-9_-]`.
- `taille maximale` : pour chaque profil, tous les paliers maîtrisés → JSON en UTF-8 sous
  `TAILLE_MAX_DECODEE` et chaîne encodée sous 150 000 caractères. Le test affiche les deux
  tailles (`console.info`) pour la tâche 6.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Run: `npx vitest run src/widget/lien.test.ts`
Expected: FAIL, module `./lien.ts` introuvable.

- [ ] **Étape 3 : écrire `src/widget/lien.ts`**

`encoderPaquet` : `TextEncoder` → `CompressionStream('deflate-raw')` → base64url. Le repli
ajoute `widget-absent` dans la partie « recherche » du fragment, jamais dans l'URL hors
fragment (le routeur est un `createHashRouter`).

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Run: `npx vitest run src/widget/lien.test.ts`
Expected: PASS, avec les tailles affichées.

- [ ] **Étape 5 : vérifier, committer et pousser**

Run: `npm run lint && npm test && npm run build`, puis commit « Widget : encodage et lien
intent » et `git push`.

---

### Tâche 3 : réglage du widget dans le profil

**Fichiers :**
- Modifier : `src/storage/db.ts` (interface `Profil`, commentaire d'en-tête)
- Modifier : `src/storage/exportImport.ts` (`schemaProfil`)
- Créer : `src/widget/reglage.ts`
- Test : `src/widget/reglage.test.ts`, et un cas dans `src/storage/stockage.test.ts`

**Interfaces :**
- Utilise : `IntervalleWidget`, `INTERVALLES_WIDGET` (tâche 1), `lireProfil`, `modifierProfil`.
- Produit :
  ```ts
  // db.ts
  export interface ReglageWidget {
    actif: boolean; intervalleMinutes: IntervalleWidget
    derniereSignature?: string; dernierEnvoiLe?: string; nbCartes?: number; introuvableLe?: string
  }
  // Profil : widget?: ReglageWidget
  // reglage.ts
  export function reglageWidget(profil: Profil): ReglageWidget          // défaut { actif: false, intervalleMinutes: 10 }
  export function modifierReglageWidget(modif: Partial<ReglageWidget>, base?: BaseMoneyTree): Promise<ReglageWidget>
  export function noterEnvoi(signature: string, nbCartes: number, maintenant: Date, base?: BaseMoneyTree): Promise<void>
  export function noterIntrouvable(maintenant: Date, base?: BaseMoneyTree): Promise<void>
  ```

- [ ] **Étape 1 : écrire les tests qui échouent**

- `réglage par défaut` : profil sans `widget` → `{ actif: false, intervalleMinutes: 10 }`.
- `activer efface « introuvable »` : après `noterIntrouvable`, `modifierReglageWidget({ actif: true })`
  → `introuvableLe` absent.
- `noterEnvoi` : enregistre `derniereSignature`, `nbCartes` et `dernierEnvoiLe` (ISO).
- `stockage.test.ts`, `l'export avec widget se réimporte` : profil avec `widget` complet →
  `exporterDonnees` puis `importerDonnees` réussit et redonne le même `widget` ; un
  `intervalleMinutes: 7` est refusé à l'analyse.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Run: `npx vitest run src/widget/reglage.test.ts src/storage/stockage.test.ts`
Expected: FAIL.

- [ ] **Étape 3 : ajouter le type, le schéma et `src/widget/reglage.ts`**

Pas de nouvelle version Dexie (champ non indexé). `schemaProfil` gagne
`widget: z.strictObject({ actif: z.boolean(), intervalleMinutes: z.union(INTERVALLES_WIDGET.map(z.literal)), … }).optional()`.

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Run: `npx vitest run src/widget src/storage`
Expected: PASS.

- [ ] **Étape 5 : vérifier, committer et pousser**

Run: `npm run lint && npm test && npm run build`, commit « Widget : réglage dans le profil »,
`git push`.

---

### Tâche 4 : décider et déclencher l'envoi

**Fichiers :**
- Créer : `src/widget/synchro.ts`
- Test : `src/widget/synchro.test.ts`

**Interfaces :**
- Utilise : tâches 1 à 3, `lireEtatProgression` (`src/storage/apprentissage.ts`).
- Produit :
  ```ts
  export type RaisonEnvoi = 'palier' | 'reglage' | 'retour'
  export const DELAI_MIN_ENVOI_MS = 10_000
  export const RATTRAPAGE_MS = 6 * 60 * 60 * 1000
  export function doitEnvoyer(c: {
    raison: RaisonEnvoi; reglage: ReglageWidget; signature: string
    maintenantMs: number; dernierEssaiMs: number | null; android: boolean
  }): boolean
  export function synchroniserWidget(raison: RaisonEnvoi): Promise<void>
  ```

- [ ] **Étape 1 : écrire les tests de `doitEnvoyer`, en table**

Base : `actif: true`, `android: true`, `dernierEssaiMs: null`, signature `'aaaaaaaa'`,
`derniereSignature: 'bbbbbbbb'`, `dernierEnvoiLe` il y a 1 h.

| Cas | Attendu |
|---|---|
| base, raison `palier` | `true` |
| `actif: false` | `false` |
| `android: false` | `false` |
| `introuvableLe` renseigné | `false` |
| `dernierEssaiMs` = maintenant − 9 999 | `false` |
| `palier`, signature = `derniereSignature` | `false` |
| `retour`, signature = `derniereSignature`, envoi il y a 1 h | `false` |
| `retour`, signature = `derniereSignature`, envoi il y a 6 h + 1 ms | `true` |
| `retour`, signatures différentes | `true` |
| `reglage`, signature = `derniereSignature` | `true` |

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Run: `npx vitest run src/widget/synchro.test.ts`
Expected: FAIL.

- [ ] **Étape 3 : écrire `src/widget/synchro.ts`**

`synchroniserWidget` lit l'état et le profil, construit le paquet, appelle `doitEnvoyer` (le
dernier essai est gardé en mémoire du module), encode, fixe `window.location.href` au lien
avec `urlRepli(location.href, Date.now())`, puis `noterEnvoi`. Il ne lève jamais d'erreur
vers l'appelant (journal `console.warn`).

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Run: `npx vitest run src/widget`
Expected: PASS.

- [ ] **Étape 5 : vérifier, committer et pousser**

Run: `npm run lint && npm test && npm run build`, commit « Widget : décision d'envoi »,
`git push`.

---

### Tâche 5 : branchements dans l'appli et réglages

**Fichiers :**
- Créer : `src/widget/useSynchroWidget.ts`, `src/features/reglages/SectionWidget.tsx`
- Créer : `src/widget/carteDemandee.ts`, test `src/widget/carteDemandee.test.ts`
- Modifier : `src/app/Coque.tsx` (`Racine`), `src/features/cours/EcranPalier.tsx`
  (`finirQuiz`, carte initiale), `src/features/reglages/EcranReglages.tsx` (section, changement
  de profil)

**Interfaces :**
- Utilise : `synchroniserWidget`, `retirerParamAbsent`, `PARAM_ABSENT`, `noterIntrouvable`,
  `reglageWidget`, `modifierReglageWidget`, `INTERVALLES_WIDGET`.
- Produit : `useSynchroWidget(): void` ; `carteDemandee(recherche: string, nbCartes: number): number | null` ;
  `<SectionWidget />`.

- [ ] **Étape 1 : tests de `carteDemandee`**

`('?carte=2', 5)` → 2 ; `('?carte=5', 5)` → `null` ; `('?carte=-1', 5)` → `null` ;
`('?carte=abc', 5)` → `null` ; `('', 5)` → `null`. Lancer, voir échouer, écrire, voir passer
(`npx vitest run src/widget/carteDemandee.test.ts`).

- [ ] **Étape 2 : brancher**

- `useSynchroWidget`, appelé dans `Racine` : arme un drapeau au montage et à chaque
  `visibilitychange` vers `visible` ; un écouteur `click` en phase de capture désarme et
  appelle `synchroniserWidget('retour')`. Au montage et sur `hashchange`, si
  `retirerParamAbsent(location.hash)` n'est pas `null` : `history.replaceState` avec le
  fragment nettoyé, puis `noterIntrouvable(new Date())`.
- `finirQuiz` : si `resultat.nouveauPalier`, `void synchroniserWidget('palier')` juste après
  `terminerQuizPalier`.
- `Palier` : la carte initiale est `carteDemandee(useSearchParams…, contenu.cartes.length)`
  si elle n'est pas `null`, sinon le comportement actuel.
- `EcranReglages` : `<SectionWidget />` entre la section « Parcours » et `<SectionNotes />` ;
  au changement de profil, `void synchroniserWidget('reglage')` après `modifierProfil`.
- `SectionWidget` (même structure que la section « Parcours ») :
  - titre « Widget » ; interrupteur « Widget installé sur ce téléphone », sous-titre
    « Affiche sur ton écran d’accueil une carte des paliers que tu maîtrises. » ;
  - choix « Changer de carte toutes les » : « 10 min », « 15 min », « 30 min », « 1 h », « 3 h » ;
  - lien « Télécharger le compagnon Android » vers
    `${import.meta.env.BASE_URL}compagnon/moneytree-widget.apk`, puis les étapes :
    « 1. Ouvre le fichier téléchargé et autorise l’installation. », « 2. Sur un Xiaomi,
    autorise le démarrage automatique de MoneyTree Widget et retire ses restrictions de
    batterie. », « 3. Ajoute le widget MoneyTree depuis l’écran d’accueil. », « 4. Active
    l’interrupteur ci-dessus. » ;
  - état : « Dernier envoi : {formatDateHeure} · {n} cartes », ou « Compagnon introuvable :
    installe-le puis réactive l’interrupteur. » si `introuvableLe`.
  - chaque changement appelle `modifierReglageWidget`, puis `synchroniserWidget('reglage')`
    si le widget est actif.

- [ ] **Étape 3 : vérifier dans le navigateur**

`preview_start` (configuration du serveur de dev), ouvrir `#/reglages` : la section s'affiche,
les choix s'enregistrent après rechargement, aucune erreur dans la console. Sur ordinateur,
aucun lien `intent:` ne part (`estAndroid` faux). Ouvrir `#/parcours/0/1?carte=2` sur un
palier ouvert : le cours s'ouvre sur la troisième carte.

- [ ] **Étape 4 : vérifier, committer et pousser**

Run: `npm run lint && npm test && npm run build`, commit « Widget : envoi depuis l’appli et
réglages », `git push`.

---

### Tâche 6 : compagnon Android, chaîne de construction et réception

**Fichiers :**
- Créer : `android/AndroidManifest.xml`, `android/construire.sh`, `android/tester.sh`
- Créer : `android/src/io/github/doblesky/moneytree/widget/SyncActivity.java`, `Paquet.java`,
  `Depot.java`, `WidgetCartes.java`
- Créer : `android/res/layout/widget_moyen.xml`, `android/res/xml/widget_info.xml`,
  `android/res/values/strings.xml`
- Créer : `android/outils/page-envoi.html` (page de test locale)
- Modifier : `.gitignore` (`android/out/`)

**Interfaces :**
- Produit (Java) :
  ```java
  final class Paquet { static Paquet lire(String base64url) throws PaquetInvalide;  // décode, inflate, parse, valide
                       int version; String profil; int intervalle; List<Carte> cartes; }
  final class Carte  { String id; int module, palier, rang; String moduleTitre, palierNom, titre, texte; boolean fictif; }
  final class Depot  { static void enregistrer(Context c, String json); static Paquet charger(Context c);  // null si absent
                       static long decalage(Context c); static void avancer(Context c); }
  final class WidgetCartes extends AppWidgetProvider { static void actualiserTout(Context c); }
  ```

- [ ] **Étape 1 : chaîne de construction**

`construire.sh` reprend la chaîne de la conception (aapt2, javac `--release 11`, d8,
`aapt add`, zipalign, apksigner) et produit `android/out/moneytree-widget.apk`. La clé vit
dans `$USERPROFILE/.moneytree/compagnon.jks`, son mot de passe dans
`$USERPROFILE/.moneytree/compagnon.mdp` ; le script crée les deux (mot de passe aléatoire)
s'ils manquent, et ne les écrit jamais dans le dépôt. `versionCode` vient d'une variable en
tête du script.

- [ ] **Étape 2 : réception et validation**

`SyncActivity` (thème `Theme.NoDisplay`, `BROWSABLE`, `noHistory`, `excludeFromRecents`,
`taskAffinity=""`) journalise `MTWidget RECU octets=<n>`, appelle `Paquet.lire`, puis
`Depot.enregistrer`, `WidgetCartes.actualiserTout`, et `finish()`. `Paquet.lire` refuse :
plus de 512 000 octets décodés, JSON invalide, `v` ≠ 1 (enregistre alors l'indicateur
« version inconnue »), plus de 2 000 cartes, `module` hors 0–99, `palier` hors 1–5, `rang`
hors 0–50, `titre` de plus de 300 caractères, `texte` de plus de 6 000. Un paquet refusé ne
remplace pas le précédent.

- [ ] **Étape 3 : widget minimal**

`WidgetCartes` affiche la première carte du paquet (module · palier, titre, premier
paragraphe) dans `widget_moyen.xml`, ou le message vide de la conception. L'appui ouvre
`https://doblesky.github.io/moneytree/#/parcours/<module>/<palier>?carte=<rang>`.

- [ ] **Étape 4 : construire et tester sur l'émulateur la taille maximale**

Run: `bash android/construire.sh`, puis émulateur `-read-only`, `adb install`, `adb reverse`
et `page-envoi.html` servie en local : elle envoie un `d` de 150 000 caractères aléatoires
`[A-Za-z0-9_-]`.
Expected: `adb logcat -s MTWidget` affiche `RECU octets=150000` puis un refus propre (paquet
invalide), sans plantage. Si l'envoi n'arrive pas, s'arrêter et le signaler : la conception
prévoit alors de n'envoyer que le premier paragraphe.

- [ ] **Étape 5 : paquets hostiles**

Depuis la même page : `d` vide, `d` non base64, JSON `{"v":2}`, une carte avec `palier: 9`,
un texte de 10 000 caractères. Expected : aucun plantage (`adb logcat` sans `FATAL`), le
widget garde l'affichage précédent ; avec `v: 2`, il affiche « Mets à jour le compagnon ».

- [ ] **Étape 6 : committer et pousser**

`git add android .gitignore`, commit « Compagnon Android : construction et réception »,
`git push`.

---

### Tâche 7 : rotation des cartes

**Fichiers :**
- Créer : `android/src/io/github/doblesky/moneytree/widget/Rotation.java`, `Alarme.java`,
  `Demarrage.java`
- Créer : `android/test/VerifRotation.java` (lancé par `android/tester.sh`)
- Modifier : `WidgetCartes.java`, `AndroidManifest.xml`

**Interfaces :**
- Produit :
  ```java
  final class Rotation { static int indexCarte(long minutesEpoch, int intervalle, int n, long decalage); // -1 si n == 0
                         static int[] melange(int n, long graine); }
  final class Alarme   { static void planifier(Context c, long maintenantMs, int intervalle); }
  ```

- [ ] **Étape 1 : tests JVM de `Rotation` (sans dépendance)**

`VerifRotation` (méthode `main`, sortie 1 au premier échec) vérifie : `indexCarte(_, _, 0, 0) == -1` ;
`n == 1` → toujours 0 ; pour `n = 7`, `intervalle = 10`, les 7 créneaux d'un même cycle
donnent les 7 index une fois chacun ; deux appels identiques donnent le même résultat ;
`indexCarte(m, i, n, 1) == indexCarte(m + i, i, n, 0)` ; minutes négatives sans exception.

- [ ] **Étape 2 : lancer et voir échouer**

Run: `bash android/tester.sh`
Expected: échec de compilation, `Rotation` introuvable.

- [ ] **Étape 3 : écrire `Rotation`, puis le reste**

```java
long creneau = Math.floorDiv(minutesEpoch, intervalle) + decalage;
int[] ordre = melange(n, Math.floorDiv(creneau, n));
return ordre[(int) Math.floorMod(creneau, n)];
```
`melange` : Fisher-Yates avec `new java.util.Random(graine)`.
`Alarme.planifier` : `setWindow(AlarmManager.RTC, début du créneau suivant, 600_000, …)` vers
un récepteur qui actualise les widgets puis replanifie. `Demarrage` reçoit
`BOOT_COMPLETED`, `TIME_SET` et `TIMEZONE_CHANGED` et replanifie (permission
`RECEIVE_BOOT_COMPLETED`). `WidgetCartes` affiche la carte `indexCarte(…, Depot.decalage)`
et planifie l'alarme à chaque actualisation ; le bouton « carte suivante » appelle
`Depot.avancer` puis actualise.

- [ ] **Étape 4 : lancer et voir passer**

Run: `bash android/tester.sh`
Expected: `Rotation : OK`.

- [ ] **Étape 5 : vérifier sur l'émulateur**

Avec un paquet de vraies cartes (PWA en dev sur l'émulateur, widget activé), `adb shell
dumpsys alarm | grep moneytree` montre une alarme ; avancer l'horloge de l'émulateur de
11 minutes (`adb shell cmd alarm set-time` ou les réglages) puis
`adb exec-out screencap` : la carte a changé. Le bouton « carte suivante » la change aussi.

- [ ] **Étape 6 : committer, pousser, et publier une première version**

Copier `android/out/moneytree-widget.apk` dans `public/compagnon/moneytree-widget.apk`,
commit « Compagnon : rotation des cartes », `git push`.

**Point d'arrêt utilisateur :** demander à l'utilisateur d'installer cette version sur son
Xiaomi et de vérifier la rotation pendant une heure, écran allumé puis éteint, avec et sans
le démarrage automatique autorisé. Si la carte ne tourne pas, évaluer le `ViewFlipper` de la
conception avant de continuer.

---

### Tâche 8 : les quatre tailles et l'apparence

**Fichiers :**
- Créer : `android/res/layout/widget_petit.xml`, `widget_bandeau.xml`, `widget_grand.xml`
- Modifier : `widget_moyen.xml`, `widget_info.xml`, `WidgetCartes.java`

**Interfaces :**
- Utilise : `Rotation`, `Depot`, `Carte`.

- [ ] **Étape 1 : mises en page**

`RemoteViews(Map<SizeF, RemoteViews>)` avec, en dp : `SizeF(110, 100)` → petit (module,
titre) ; `SizeF(250, 100)` → bandeau (module · palier, titre, texte sur 2 lignes) ;
`SizeF(250, 170)` → moyen (premier paragraphe) ; `SizeF(250, 240)` → grand (texte complet,
lignes limitées et points de suspension). Couleurs des contraintes globales, titres en
`serif`, étiquette « Exemple fictif » si `fictif`, bouton « carte suivante » en haut à droite.
`widget_info.xml` : `targetCellWidth` 4, `targetCellHeight` 3, redimensionnable dans les deux
sens, `previewLayout` = `widget_moyen`.

- [ ] **Étape 2 : vérifier sur l'émulateur**

Placer le widget, le redimensionner en 2×2, 4×2, 4×3 et 4×4 (appui long, poignées), une
capture par taille. Expected : chaque taille affiche le contenu prévu, sans texte coupé au
milieu d'une ligne ni débordement ; l'étiquette fictive apparaît sur une carte fictive.

- [ ] **Étape 3 : committer et pousser**

Reconstruire, recopier l'APK dans `public/compagnon/`, commit « Compagnon : quatre tailles »,
`git push`.

---

### Tâche 9 : vérification de bout en bout sur l'émulateur

**Fichiers :**
- Modifier : `README.md` (section « Installer le widget » : téléchargement depuis les
  réglages, autorisation d'installation, réglages Xiaomi, ajout du widget)

- [ ] **Étape 1 : palier réussi → widget à jour**

PWA en dev sur l'émulateur (Chrome, `adb reverse`), compagnon installé, widget actif.
Réussir le quiz d'un palier non maîtrisé. Expected : `RECU` dans `logcat` dans les 2 s
suivant le dernier appui, pas de changement d'écran visible (mesure de l'essai :
enregistrement brut et comparaison d'images, moins de 1 % de l'écran modifié), le nombre de
cartes du widget augmente.

- [ ] **Étape 2 : appui sur la carte**

Appuyer sur la carte du widget. Expected : l'appli s'ouvre sur ce palier, à cette carte.

- [ ] **Étape 3 : compagnon absent pendant un quiz**

Désinstaller le compagnon, ouvrir un quiz, répondre à deux questions, provoquer un envoi
(retour au premier plan après avoir avancé l'horloge de 7 h, puis appui). Expected : ni Play
Store, ni rechargement, le quiz reste à la même question avec ses réponses ; l'URL ne garde
pas `widget-absent` ; les réglages affichent « Compagnon introuvable ».

- [ ] **Étape 4 : retour au premier plan pendant un quiz, compagnon présent**

Réinstaller, réactiver, ouvrir un quiz, passer à l'écran d'accueil, revenir, appuyer sur une
réponse. Expected : la réponse est prise en compte normalement.

- [ ] **Étape 5 : README, committer et pousser**

Commit « Widget : vérification et documentation », `git push`.

**Point d'arrêt utilisateur :** liste de contrôle sur le Xiaomi, à faire par l'utilisateur :
installer l'APK depuis les réglages de l'appli installée ; terminer un palier et voir le widget
se mettre à jour sans flash ; essayer les quatre tailles sur le lanceur Xiaomi ; laisser
tourner une heure écran allumé puis une heure écran éteint.
