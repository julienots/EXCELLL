# SuperEssence Sheets 📱💪

**Le tableur des coachs sportifs** — une application Android (APK) réalisée par **SuperEssence Studio**.

Un vrai tableur (formules, mise en forme, plusieurs feuilles, graphiques, import/export Excel)
optimisé pour créer de beaux programmes sportifs, suivre ses athlètes et calculer charges et allures.

## Télécharger l'APK

Chaque push déclenche le workflow **Build APK Android** (`.github/workflows/android-apk.yml`) qui :

1. teste le moteur de formules,
2. compile l'application Android,
3. publie l'APK dans l'onglet **Releases** du dépôt (et en artefact du workflow).

Sur le téléphone : ouvrir la dernière release → télécharger `SuperEssence-Sheets-v1.0.X.apk` → installer
(autoriser l'installation depuis le navigateur si Android le demande). Les versions suivantes s'installent par-dessus
(même clé de signature).

## Fonctionnalités

### Tableur complet
- Grille canvas virtualisée (jusqu'à 50 000 lignes), lignes/colonnes figées, zoom (pincement), redimensionnement
- **~150 fonctions** compatibles Excel, en **français et en anglais** (`SOMME`/`SUM`, `SI`/`IF`, `RECHERCHEV`/`VLOOKUP`,
  `NB.SI.ENS`, `INDEX`/`EQUIV`, `RECHERCHEX`, dates, texte, stats…), séparateurs `;` ou `,`, virgule décimale
- Références relatives/absolues (`$A$1`, F4), plages, références inter-feuilles (`Profil!B14`), mode pointage
  (toucher une cellule pendant la saisie d'une formule insère sa référence), détection des références circulaires
- Gras, italique, souligné, barré, tailles, couleurs, fonds, alignements, retour à la ligne, retrait, bordures, fusion
- Formats : nombre, %, €, $, dates, heures, durées, **kg, reps, séries, km, km/h, bpm, kcal, RPE, cm**
- Mise en forme conditionnelle (seuils, texte, échelles de couleurs, barres de données)
- Listes déroulantes, cases à cocher, notes, liens, pinceau de mise en forme, styles de tableau
- Copier / couper / coller (avec ajustement des formules, valeurs seules, formats seuls), recopie incrémentée
  (« Semaine 1 → Semaine 2 », suites numériques, dates), tri, filtre, doublons, rechercher/remplacer
- Insertion/suppression de lignes et colonnes avec mise à jour des formules, annuler/rétablir (40 niveaux)
- Graphiques (courbe, barres, aire, secteurs) liés aux données, déplaçables et redimensionnables
- Import **.xlsx / .csv / .sess**, export **Excel .xlsx (avec mise en forme)**, **PDF**, **image PNG**, CSV, sauvegarde `.sess`
- Enregistrement automatique sur l'appareil, gestion de plusieurs classeurs

### Spécial sport
- **Générateur de programme** : objectif (force, hypertrophie, perte de poids, endurance, remise en forme), niveau,
  fréquence (2-6 séances), durée (4-12 semaines), décharges, 1RM → classeur complet *Profil / Programme / Journal /
  Tableau de bord* avec charges calculées automatiquement depuis les 1RM
- **16 modèles** : Force 3 jours, Hypertrophie PPL, Upper/Lower, Full body débutant, Perte de poids, Plan 10 km,
  Circuit HIIT, Semaine type, Suivi corporel, Calculateur 1RM, Fiche bilan client, Plan nutrition,
  Clients & facturation, Programme vierge, Budget (non sportif), Classeur vide
- **Fonctions sport** : `ONERM`, `CHARGE`, `RPEPCT`, `CHARGERPE`, `E1RM`, `RIR`, `VOLUME`, `TONNAGE`, `INOL`,
  `PROGRESSION`, `ALLURE`, `VITESSE`, `TEMPSCOURSE`, `ALLUREVMA`, `RIEGEL`, `SECONDES`, `MMSS`, `IMC`, `FCMAX`,
  `FCZONE`, `KCAL`, `MB`, `DET`, `MACROS`, `DOTS`, `MASSEMAIGRE`, `HYDRATATION`
- Bibliothèque de **130+ exercices** par groupe musculaire (+ vos exercices), bloc séance prêt à l'emploi
- **Chrono** : minuteur de repos, chronomètre avec tours, intervalles/Tabata/EMOM avec bips et vibrations
- Calculateurs 1RM (table des %) et allures (VMA, prédictions de course)

> Les fonctions sport sont propres à l'application : à l'export Excel, ces cellules sont écrites avec leur valeur
> calculée ; les formules standard restent des formules Excel.

## Développement

```bash
npm install
npm run serve        # http://localhost:8080 — l'application tourne aussi dans un navigateur
npm test             # tests du moteur de formules et des modèles
npm run icons        # régénère les icônes et écrans de démarrage
npm run apk          # nécessite le SDK Android (JDK 21) — sinon utiliser le workflow GitHub
```

Structure : `www/` (application web : `js/formula.js` moteur de calcul, `js/grid.js` grille canvas,
`js/sport.js` modèles & générateur, `js/actions.js` commandes et dialogues), `android/` (projet Capacitor).

### Signature de publication (optionnel)
Par défaut l'APK est signé avec la clé de développement versionnée `android/app/superessence-debug.keystore`.
Pour publier sur le Play Store, ajouter les secrets `SE_KEYSTORE_BASE64`, `SE_KEYSTORE_PASSWORD`, `SE_KEY_ALIAS`,
`SE_KEY_PASSWORD` dans les paramètres du dépôt : le workflow les utilisera automatiquement.

---
© SuperEssence Studio — composants : Capacitor (MIT), ExcelJS (MIT), jsPDF (MIT), icônes Lucide (ISC).
