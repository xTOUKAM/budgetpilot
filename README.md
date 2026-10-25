# Warble — application Windows

Application locale de finances personnelles avec Electron, React, TypeScript et SQLite.

## Prérequis
- Windows 10/11 64 bits
- Node.js LTS installé
- npm fourni avec Node.js

## Installation et lancement
Dans PowerShell, depuis le dossier du projet :

```powershell
npm install
npm run dev
```

## Générer l'installateur Windows
```powershell
npm run dist:win
```
Le fichier d'installation est créé dans `release/`. Pour un exécutable portable :
```powershell
npm run dist:portable
```

Par défaut, `npm run dist:win` génère un installateur de développement sans
signature. Le paramètre `signAndEditExecutable: false` évite de télécharger
`winCodeSign`, qui nécessite la création de liens symboliques sur Windows.
L'installateur peut ensuite être bloqué par SmartScreen, car il n'est pas signé
par un éditeur vérifié.

Pour produire un installateur destiné à être distribué, utilisez un certificat
de signature de code Windows (`.p12` ou `.pfx`) émis par une autorité reconnue.
Un certificat auto-signé ne supprimera pas l'avertissement SmartScreen pour les
autres utilisateurs.

La commande signée nécessite également l'autorisation Windows de créer des
liens symboliques. Activez le **Mode développeur** dans les paramètres Windows
ou lancez le terminal avec les droits administrateur avant le packaging signé.

Dans PowerShell, configurez le certificat sans l'écrire dans le dépôt :

```powershell
$env:CSC_LINK = "C:\chemin\vers\budgetpilot.p12"
$env:CSC_KEY_PASSWORD = "mot-de-passe-du-certificat"
npm run dist:win:signed
```

`CSC_LINK` peut également contenir une URL ou une valeur encodée en base64,
selon le fournisseur du certificat. La commande signée échoue volontairement
si aucun certificat n'est disponible, afin de ne pas publier par erreur un
installateur non signé.

La génération utilise l'icône Windows dédiée `build/icon.ico` pour l'exécutable,
la fenêtre, les raccourcis et l'installateur. L'installateur NSIS affiche un
assistant d'installation complet, permet de choisir le dossier de destination,
crée les raccourcis Bureau et Menu Démarrer, puis propose de lancer Warble.
Les données utilisateur sont conservées lors de la désinstallation. La
signature est appliquée par `electron-builder` à l'installateur et aux
exécutables Windows lorsqu'un certificat est configuré.

## Stockage des données
La base SQLite est créée automatiquement dans le dossier de données utilisateur d'Electron, sous `data/budgetpilot.sqlite`. Lors de la mise à jour vers Warble, l'application recherche automatiquement l'ancien dossier utilisateur `BudgetPilot` ou `budgetpilot` et recopie la base ainsi que ses fichiers SQLite associés avant de l'ouvrir. Les données existantes sont donc conservées et l'ancien dossier n'est pas supprimé. Fermez l'application avant de copier la base pour une sauvegarde manuelle.

Depuis la version 0.1.1, la page **Paramètres** permet de créer une sauvegarde
Warble chiffrée (`.wbackup`). Le mot de passe n'est jamais enregistré par
l'application : choisissez un mot de passe d'au moins 8 caractères et
conservez-le séparément, car une sauvegarde ne peut pas être déchiffrée sans
celui-ci. La restauration vérifie l'intégrité de la base avant de remplacer les
données et crée une copie de sécurité de la base actuelle.

Les objectifs d'épargne acceptent désormais une date cible, un effort mensuel
et un compte associé. Pour les objectifs avec date cible sans effort mensuel,
Warble calcule automatiquement le montant mensuel recommandé.

L'import CSV est disponible dans **Paramètres et données**. Le fichier doit
contenir au minimum les colonnes suivantes, dans cet ordre :
`date;montant;catégorie;note`. Le montant est signé : une valeur positive est
un revenu et une valeur négative une dépense. Les dates `AAAA-MM-JJ`,
`JJ/MM/AAAA` et `JJ-MM-AAAA` sont reconnues, ainsi que les montants français
comme `1 234,56`. Un aperçu est affiché avant confirmation et les lignes déjà
importées sont ignorées grâce à leur empreinte unique.

La page Paramètres permet également de configurer un PIN local de 4 à 6
chiffres. Lorsqu'il est activé, l'application se verrouille après 5 minutes
d'inactivité. Le PIN est chiffré par le stockage sécurisé de Windows et n'est
jamais écrit en clair. Une sauvegarde automatique chiffrée peut aussi être
activée depuis cette page ; elle est conservée dans le dossier utilisateur
local de Warble et sa clé est protégée par le stockage sécurisé de Windows. Le
thème sombre ou clair peut être choisi au même endroit. La page **À propos**
rappelle la version et le fonctionnement local de Warble.

Les raccourcis `Ctrl+N` (nouvelle opération), `Ctrl+T` (nouveau transfert) et
`Échap` (fermer la fenêtre active) facilitent les actions rapides. Ils restent
désactivés pendant la saisie dans un champ.

Après cinq PIN incorrects, le déverrouillage est temporairement bloqué pendant
30 secondes.

## Fonctionnalités incluses dans ce starter
- Comptes multiples et soldes initiaux
- Ajout de revenus et dépenses
- Sous-catégories pour détailler les dépenses (essence, contrôle technique, garage, etc.)
- Tableau de bord mensuel
- Répartition des dépenses par catégorie
- Budgets mensuels par catégorie
- Objectifs d'épargne
- Export CSV des transactions

## À compléter avant un usage financier avancé
- Édition/suppression et annulation sécurisée des transactions (avec recalcul des soldes)
- Gestion complète des opérations récurrentes et génération automatique sans doublons
- Dates de fin optionnelles pour limiter une série de récurrences
- Refus des dépenses récurrentes qui dépasseraient le solde disponible, avec journalisation de l'échéance ignorée
- Prévision de fin de mois
- Statistiques détaillées par mois, catégorie, sous-catégorie et compte
- Transferts entre comptes, sans les compter comme revenus/dépenses
- Sauvegarde/restauration intégrée, sauvegarde automatique chiffrée et tests automatisés
- Tests de bout en bout sur Windows et signature de l'application si elle est distribuée

## Sécurité
Le renderer n'a pas accès directement à Node.js ou SQLite : seules des fonctions explicitement exposées via `preload` sont accessibles. Le projet active `contextIsolation`, désactive `nodeIntegration` et utilise le sandbox Electron.
