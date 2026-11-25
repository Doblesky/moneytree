# Widget de rappel des cours : conception

Date : 2026-11-24. Demande de l'utilisateur du 2026-11-23. Cette fonctionnalité n'est pas
dans le cahier des charges : elle s'ajoute aux phases 0 à 5 sans en modifier aucune.

## Intention

L'utilisateur n'ouvre pas MoneyTree tous les jours et ne travaille pas toujours les mêmes
thèmes. Il veut un widget sur l'écran d'accueil de son téléphone Android qui lui remette en
tête, sans effort, des cartes de cours qu'il a déjà vues. Le widget montre une carte tirée
des paliers maîtrisés du profil actif (ingénieur ou prof), et la carte change toutes les
10 minutes, une durée réglable dans l'appli. Le format principal fait 4 icônes de large sur
3 de haut, et d'autres tailles doivent marcher au cas où il réorganise son écran.

Le succès, pour lui : un coup d'œil sur le téléphone suffit à revoir une notion, sans jamais
avoir à penser au widget, à le synchroniser ou à appuyer sur un bouton.

## Objectifs

- Afficher sur l'écran d'accueil une carte de cours issue des paliers maîtrisés du profil actif.
- Faire tourner les cartes, toutes les 10 minutes par défaut, avec une durée réglable dans l'appli.
- Mettre le widget à jour tout seul quand la progression, le profil ou la durée changent,
  sans bouton dédié.
- S'adapter à plusieurs tailles : 2×2, 4×2, 4×3 (format principal) et 4×4.
- Ouvrir la carte dans l'appli quand on appuie dessus.

## Non-objectifs

- Pas d'iPhone, ni d'Android avant la version 12 : le téléphone visé est un Xiaomi sous
  Android 12 ou plus.
- Pas de questions de quiz dans le widget pour l'instant : seulement les cartes de cours.
- Pas de notifications, pas de synchronisation par Internet, pas de serveur.
- Pas de publication sur le Play Store : l'APK s'installe à la main.
- Pas de nouveau contenu de cours : le widget réutilise les cartes existantes, déjà sourcées.

## Anti-objectifs (échec même si « ça marche »)

- Couper ou recharger un quiz en cours, ou faire perdre une donnée de la PWA.
- Ouvrir le Play Store ou une fenêtre de confirmation sans que l'utilisateur l'ait demandé.
- Vider la batterie ou réveiller le téléphone pour changer de carte.
- Afficher un chiffre hors contexte : un exemple fictif doit rester marqué comme tel, et une
  valeur officielle doit venir des paramètres de l'appli (règle n° 1 de CLAUDE.md).
- Demander des permissions Android inquiétantes (accès réseau, contacts, alarmes exactes…).

## Contraintes établies

Documentation officielle lue le 2026-11-23 :

- Une PWA ne peut pas déclarer de widget sur Android. Le membre `widgets` du manifeste ne
  sert qu'au tableau des widgets de Windows 11
  (learn.microsoft.com/microsoft-edge/progressive-web-apps/how-to/widgets). Il faut donc une
  petite appli Android native.
- Android ne rafraîchit pas un widget plus d'une fois toutes les 30 minutes avec
  `updatePeriodMillis`, et WorkManager descend au mieux à 15 minutes
  (developer.android.com/develop/ui/views/appwidgets/advanced, …/androidx/work/PeriodicWorkRequest).
- Les alarmes inexactes ne demandent aucune permission spéciale. Avec `setWindow`, la fenêtre
  minimale est de 10 minutes pour une appli qui cible Android 12 ou plus, et les alarmes
  attendent la sortie du mode Doze (developer.android.com/develop/background-work/services/alarms).
- Chrome n'ouvre une appli Android depuis une page qu'à la suite d'un geste de l'utilisateur,
  et seulement vers une activité `BROWSABLE` (developer.chrome.com/docs/android/intents).
- `RemoteViews` accepte `AdapterViewFlipper` et `ViewFlipper`, et Android 12 permet de fournir
  une mise en page par taille de widget (developer.android.com/reference/android/widget/RemoteViews,
  …/appwidgets/layouts).

Téléphone de l'utilisateur (réponse du 2026-11-24) : un Xiaomi, Redmi ou Poco (HyperOS ou
MIUI), sous Android 12 ou plus. Ces surcouches sont connues pour bloquer les tâches de fond
des applis installées à la main tant que l'utilisateur ne les autorise pas. Ce point n'a pas
été vérifié sur une source officielle de Xiaomi : il se vérifie sur le téléphone.

Côté projet :

- La PWA utilise un `createHashRouter` (`src/app/routeur.tsx`) : toutes les routes vivent
  dans le fragment, par exemple `https://doblesky.github.io/moneytree/#/parcours/0/1`.
- Les textes des cartes contiennent des balises (`{p:…}`, `{h:…}`, `[[…|…]]`, `**…**`, puces)
  que `analyserTexte` de `src/content/texte.ts` sait déjà résoudre.
- La base Dexie est versionnée : un champ facultatif du profil, non indexé, ne demande pas
  de nouvelle version (`src/storage/db.ts`).
- L'appli n'a pas de thème sombre. Ses couleurs sont dans `src/styles/tokens.css`.

## Ce que l'essai a montré (2026-11-23)

Un essai jetable a tourné sur l'émulateur Android 17 du PC (Chrome 156), avec un mini
compagnon et une page de test :

- 18 envois sur 19 sont arrivés au compagnon, depuis un onglet Chrome comme depuis l'appli
  installée, sans aucune fenêtre de confirmation.
- Aucun flash visible : au plus 0,2 % de l'écran a changé pendant l'envoi, compagnon froid
  ou déjà lancé. L'utilisateur reste sur sa page, dont l'état est conservé.
- L'envoi part aussi après une écriture IndexedDB, et même 12 secondes après l'appui. Il ne
  faut pas compter sur cette tolérance : la règle documentée exige un geste.
- Le seul envoi perdu est un second appui fait pendant le tout premier démarrage du compagnon.
- Compagnon absent : sans repli, Chrome ouvre le Play Store. Avec un repli vers la même URL,
  la page se recharge. Avec un repli vers la même URL suivie d'un fragment unique, la page
  reste en place (3 fois sur 3).
- Le widget 4×3 s'affiche et se met à jour dès réception.

Pas encore vérifié : le vrai téléphone et son lanceur, l'appli installée en vrai WebAPK
(l'essai, servi en local, a donné un raccourci Chrome), la rotation sur la durée, et les
envois de grande taille.

## Approches considérées

1. **Petit compagnon Android (choisi par l'utilisateur).** La PWA reste telle quelle, avec
   ses données dans Chrome et sa mise à jour automatique à chaque push. Une mini-appli native
   n'apporte que le widget. La PWA lui transmet les cartes à afficher par un lien `intent:`,
   déclenché par un appui que l'utilisateur fait déjà. Coût : deux installations, et un
   envoi qui dépend d'un geste.
2. **Appli Android complète (Capacitor).** Le widget se synchronise tout seul, mais il faut
   migrer les données une fois par export/import, et chaque mise à jour de l'appli demande un
   nouvel APK : charger le site en ligne dans Capacitor n'est « pas prévu pour la production »
   (capacitorjs.com/docs/config). Écartée, car elle casse la publication automatique.
3. **Trusted Web Activity avec `postMessage`.** Transmission silencieuse, mais il faut un
   fichier de vérification à la racine du domaine (`doblesky.github.io/.well-known/`), donc
   un second dépôt public, et la page doit être ouverte par le compagnon. Gardée en réserve si
   le lien `intent:` se comporte mal sur le vrai téléphone.

L'utilisateur a demandé qu'aucun bouton de synchronisation ne soit nécessaire : c'est pourquoi
l'envoi s'accroche aux appuis existants (voir « Quand envoyer »).

## Conception

### Vue d'ensemble

```
PWA (Chrome)                                   Compagnon Android
───────────                                    ─────────────────
progression + profil + réglage
        │ construit le paquet de cartes
        │ (texte brut, valeurs résolues)
        ▼
appui de l'utilisateur ── intent://sync?d=… ──► activité invisible : valide,
                                                enregistre, met à jour le widget,
                                                se ferme
                                                        │
                                                alarme inexacte ──► change de carte
                                                        │
widget ◄────────────────────────────────────────────────┘
appui sur la carte ── https://…/moneytree/#/parcours/m/p?carte=n ──► PWA
```

### Côté PWA

**Le paquet de cartes.** Un module pur, `src/widget/paquet.ts`, construit à partir de l'état
de progression, du profil et des paramètres de l'année :

```json
{
  "v": 1,
  "profil": "ingenieur",
  "intervalle": 10,
  "cartes": [
    {
      "id": "m0-p1-c2",
      "module": 0,
      "palier": 1,
      "rang": 1,
      "moduleTitre": "Bases",
      "palierNom": "Découverte",
      "titre": "…",
      "texte": "Premier paragraphe.\n\nDeuxième paragraphe.\n• puce\n• puce",
      "fictif": false
    }
  ]
}
```

- Cartes retenues : pour chaque module du parcours du profil (`METIERS[metier].modules`), les
  paliers 1 à `paliersMaitrises`, avec les variantes du profil (`contenuModule(id, metier)`).
  Un palier ouvert par « débloquer quand même » ou par le mode expert ne compte pas : seuls
  les paliers maîtrisés sont « déjà faits ».
- `rang` est la position de la carte dans son palier (de 0), pour rouvrir la bonne carte.
- Texte : `analyserTexte` résout les valeurs officielles et historiques, puis le paquet
  aplatit les blocs en texte brut. Les liens de glossaire gardent leur texte affiché, le gras
  perd ses astérisques, les puces deviennent « • », les paragraphes sont séparés par une
  ligne vide. Aucune balise ne doit subsister.
- `moduleTitre` vient d'`infoModule(id, metier)`, qui tient compte du profil.
- Le paquet ne contient aucune donnée personnelle : ni salaire, ni ville, ni score.
- Encodage : JSON, compressé en `deflate-raw` (`CompressionStream`), puis base64url, passé dans
  le paramètre `d`.

**Quand envoyer.** Tant que le widget est activé dans les réglages :

1. Juste après un palier maîtrisé : `finirQuiz` (`src/features/cours/EcranPalier.tsx`)
   déclenche l'envoi dès que `terminerQuizPalier` revient avec `nouveauPalier`, dans la foulée
   de l'appui sur la dernière question.
2. Au premier appui qui suit un lancement de l'appli ou un retour au premier plan
   (`visibilitychange`), un écouteur global sur `click` envoie le paquet si sa signature a
   changé ou si le dernier envoi date de plus de 6 heures. Cela rattrape un envoi perdu, une
   mise à jour des contenus ou des paramètres et un changement fait ailleurs (import de
   données), sans envoyer à chaque retour dans l'appli. Sur Android, la PWA reste souvent
   ouverte en arrière-plan pendant des jours : un simple lancement ne suffirait pas.
   *Choix de Claude.*
3. À l'appui qui change un réglage du widget ou le profil.
4. Garde-fous : jamais deux envois à moins de 10 secondes d'intervalle (l'envoi perdu de
   l'essai), et pas d'envoi si la signature du paquet (empreinte de son JSON) est celle du
   dernier envoi, sauf pour le rattrapage de plus de 6 heures du point 2.

L'envoi ne part jamais sans geste : pas d'envoi au chargement, ni depuis un minuteur. Il ne
part que sur Android (agent utilisateur) : après un import du profil sur le PC, Windows
afficherait sinon sa fenêtre « choisir une appli pour ce lien ».

**Comment envoyer.** Un module `src/widget/envoi.ts` :

```
intent://sync?d=<paquet>#Intent;scheme=moneytree-widget;package=<paquet Android>;
  S.browser_fallback_url=<repli>;end
```

- Le repli évite le Play Store si le compagnon est absent. Avec le routeur par fragment, il
  ne doit pas changer de route : c'est l'URL actuelle avec un paramètre unique dans le
  fragment, par exemple `#/parcours/0/1?widget-absent=<horodatage>`.
- Quand l'appli voit ce paramètre, elle le retire de l'URL (`replace`), note « compagnon
  introuvable » dans le profil et suspend les envois jusqu'à ce que l'utilisateur réactive le
  widget. Le réglage l'affiche.

**Réglages.** Une section « Widget » dans `EcranReglages`, entre « Parcours » et les notes :

- un interrupteur « Widget installé sur ce téléphone », éteint par défaut ;
- la durée de rotation : 10 min (par défaut), 15 min, 30 min, 1 h, 3 h. Pas moins de
  10 minutes, la fenêtre minimale d'une alarme inexacte ;
- un lien pour télécharger le compagnon, avec les étapes d'installation ;
- l'état : date du dernier envoi et nombre de cartes, ou « compagnon introuvable ».

Stockage : un champ facultatif `widget` dans le profil (`actif`, `intervalleMinutes`,
`derniereSignature`, `dernierEnvoiLe`, `introuvableLe`). Il ne demande pas de migration de la
base, mais `schemaProfil` (`src/storage/exportImport.ts`) est un `strictObject` : il faut y
ajouter ce champ, sinon l'import d'un export qui le contient échoue.

**Rouvrir une carte.** `EcranPalier` accepte `?carte=n` dans la route : le cours s'ouvre sur
cette carte au lieu de la carte mémorisée. Valeur invalide ou hors bornes : comportement
actuel.

### Côté compagnon Android

**Identité.** Paquet `io.github.doblesky.moneytree.widget`, nom affiché « MoneyTree Widget ».
Aucune permission réseau : le compagnon ne peut rien envoyer nulle part.

**Réception.** Une activité `SyncActivity` au thème `Theme.NoDisplay`, `BROWSABLE`, schéma
`moneytree-widget`, hôte `sync`, comme dans l'essai. Elle :

- refuse un paquet de plus de 512 Ko décodé, mal formé, ou d'une version `v` inconnue (le
  widget affiche alors « Mets à jour le compagnon ») ;
- valide chaque carte (types, longueurs, `module` et `palier` entiers bornés) ;
- enregistre le paquet dans un fichier privé, met à jour tous les widgets, replanifie
  l'alarme et se ferme.

N'importe quelle page peut ouvrir ce lien : le pire possible est d'afficher du texte sur le
widget. Le compagnon n'exécute rien, n'ouvre aucune URL venue du paquet et construit lui-même
le lien de retour.

**Rotation.** Le choix de la carte ne dépend que de l'heure :

- créneau = minutes depuis l'époque ÷ `intervalle`, arrondi par défaut ;
- avec `n` cartes, le cycle est `créneau ÷ n` et la position `créneau mod n` ; l'ordre du
  cycle est un mélange déterministe des cartes (graine = cycle), pour tout revoir avant de
  revoir une carte ;
- un décalage, enregistré, s'ajoute au créneau quand on appuie sur « carte suivante ».

Après chaque mise à jour, une alarme `RTC` inexacte (`setWindow`, sans réveil) est planifiée
au début du créneau suivant, avec une fenêtre de 10 minutes. Le téléphone endormi ne change
pas de carte. Au réveil, l'alarme en attente part et affiche la carte du créneau en cours.
L'alarme est replanifiée au démarrage du téléphone et après un changement d'heure.

Sur le Xiaomi, les instructions d'installation des réglages demandent d'autoriser le
démarrage automatique de « MoneyTree Widget » et de lever ses restrictions de batterie (les
libellés exacts se relèvent sur le téléphone). Si la carte ne change toujours pas écran
éteint puis rallumé, l'alternative à évaluer est un `ViewFlipper` dont le lanceur fait
lui-même défiler les cartes, sans réveiller le compagnon. Elle a une limite : le minuteur ne
tourne que pendant que le widget est à l'écran.

**Affichage.** Mises en page par taille (`RemoteViews` avec une table taille → mise en page,
Android 12 et plus) :

| Taille | Contenu |
|---|---|
| 2×2 | nom du module, titre de la carte |
| 4×2 | module et palier, titre, début du texte |
| 4×3 | module et palier, titre, premier paragraphe |
| 4×4 et plus | module et palier, titre, texte complet tronqué proprement |

- Couleurs de la direction artistique : fond `--vert-marque` (#1E3A2B), texte
  `--sur-vert` (#F4EEDF), filets et étiquettes en `--or` (#C69A3F).
- Titres en police serif du système, faute de pouvoir embarquer Cormorant Garamond au format
  `woff2`. Texte en police du système.
- L'étiquette « Exemple fictif » apparaît sur les cartes concernées, comme dans l'appli.
- Sans paquet ou sans carte : « Termine ton premier palier dans MoneyTree pour voir tes cartes
  ici », et l'appui ouvre l'appli.
- Un bouton discret « carte suivante » dans un coin.

**Appui sur la carte.** Ouvre `https://doblesky.github.io/moneytree/#/parcours/<module>/<palier>?carte=<rang>`.
L'adresse de base est une constante du compagnon, jamais une valeur du paquet.

### Construction et distribution

- Code dans `android/` : Java, sans AndroidX ni Gradle, construit par un script qui
  n'utilise que le SDK Android, comme dans l'essai : `aapt2 compile` puis `aapt2 link` contre
  `platforms/android-37.0/android.jar`, `javac --release 11`, `d8`, ajout de `classes.dex`
  par `aapt add`, `zipalign -p 4`, `apksigner`. Outils déjà sur le PC : build-tools 36.0.0,
  plateforme 37, JDK d'Android Studio (`jbr`), émulateur `Medium_Phone_API_37.0`.
- Le code de l'essai est resté dans le dossier temporaire de la session de Claude, qui peut
  être effacé : le plan reconstruit la chaîne dans le dépôt à partir de ce document, en
  reprenant l'essai s'il est encore là. L'émulateur se lance avec `-read-only` pour ne rien
  modifier durablement.
- Signature : une clé de publication créée une fois et gardée hors du dépôt, dans le dossier
  personnel de l'utilisateur. Si elle se perd, il suffit de désinstaller et réinstaller le
  compagnon : la PWA renverra les cartes.
- L'APK signé est commité dans `public/compagnon/` et publié par le déploiement GitHub Pages.
  Il pèse quelques dizaines de Ko et ne change que si le code Android change, puisque les
  contenus passent par la PWA. Le service worker ne le met pas en cache (motifs de
  `globPatterns`).
- `minSdk` 31 (Android 12), puisque le téléphone est sous Android 12 ou plus : pas de mise en
  page de secours pour les versions plus anciennes. `targetSdk` 36.

### Tests

- Vitest pour `src/widget/` : choix des paliers selon le profil et la progression, variantes
  prof, absence de toute balise dans les textes, valeurs officielles résolues, signature
  stable, construction du lien et du repli, taille du paquet quand tous les paliers des deux
  profils sont maîtrisés.
- Vitest pour la route `?carte=n` si la logique sort du composant.
- Sur l'émulateur, par script comme pour l'essai : paquet de taille maximale reçu ; compagnon
  absent pendant un quiz sans perte d'état ; rendu des quatre tailles ; changement de carte
  par l'alarme ; appui sur la carte qui ouvre la bonne carte.
- Sur le téléphone de l'utilisateur, une liste de contrôle : installation de l'APK, envoi sans
  flash depuis l'appli installée, les quatre tailles sur le lanceur Xiaomi, rotation pendant
  une heure écran allumé, puis après une heure écran éteint, avec et sans le démarrage
  automatique autorisé.
- Lint, tests et build verts avant chaque push, comme d'habitude.

## Choix faits par Claude, à relire

- Le rattrapage au retour dans l'appli, au plus toutes les 6 heures (« Quand envoyer »).
- Les durées proposées : 10 min, 15 min, 30 min, 1 h, 3 h.
- Les envois limités à Android.
- Le nom du paquet Android, `io.github.doblesky.moneytree.widget`.
- L'APK publié dans `public/compagnon/` et la clé de signature gardée sur le PC.
- Les polices du système dans le widget, faute de Cormorant Garamond.
- Le contenu de chaque taille de widget.

## Laissé au builder

- Le découpage exact des fichiers Java et des mises en page XML.
- Le nom et l'emplacement du script de construction, et la façon d'y fournir le mot de passe
  de la clé.
- L'aperçu du widget dans le sélecteur du lanceur.
- Le gras dans le widget (texte stylé dans `RemoteViews`) : facultatif.
- Le format de la signature du paquet.

## Risques à lever en premier

1. **Taille du paquet.** Les 302 cartes du tronc commun font environ 110 Ko de texte. Le plan
   doit commencer par vérifier sur l'émulateur qu'un lien de cette taille passe. Sinon, le
   paquet se limite au premier paragraphe des cartes, et le format 4×4 aussi.
   *Mesure du 2026-11-25 (émulateur, Chrome 156) :* le paramètre `d` passe à 65 400
   caractères et plus à 66 000. Le paquet complet du profil prof en fait 61 000. Le paquet est
   donc borné à 60 000 caractères : texte complet s'il tient, sinon premier paragraphe de
   chaque carte, et en dernier recours moins de cartes (`encoderPaquetBorne`).
2. **Repli avec le routeur par fragment.** À vérifier sur l'émulateur, au milieu d'un quiz.
3. **Vrai téléphone.** Envoi depuis la WebAPK, rendu sur le lanceur Xiaomi, comportement de
   l'alarme sous HyperOS ou MIUI : seule la liste de contrôle sur le téléphone peut le
   confirmer. Le plan prévoit une première version installable tôt pour la lancer.
