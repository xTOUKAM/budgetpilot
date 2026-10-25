# BudgetPilot — starter Windows

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

La génération utilise l'icône Windows dédiée `build/icon.ico`. La signature est
appliquée par `electron-builder` à l'installateur et aux exécutables Windows.

## Stockage des données
La base SQLite est créée automatiquement dans le dossier de données utilisateur d'Electron, sous `data/budgetpilot.sqlite`. Ce chemin est propre à l'application et à l'utilisateur Windows. Fermez l'application avant de copier la base pour une sauvegarde manuelle.

## Fonctionnalités incluses dans ce starter
- Comptes multiples et soldes initiaux
- Ajout de revenus et dépenses
- Tableau de bord mensuel
- Répartition des dépenses par catégorie
- Budgets mensuels par catégorie
- Objectifs d'épargne
- Export CSV des transactions

## À compléter avant un usage financier avancé
- Édition/suppression et annulation sécurisée des transactions (avec recalcul des soldes)
- Gestion complète des opérations récurrentes et génération mensuelle sans doublons
- Prévision de fin de mois
- Transferts entre comptes, sans les compter comme revenus/dépenses
- Sauvegarde/restauration intégrée et tests automatisés
- Tests de bout en bout sur Windows et signature de l'application si elle est distribuée

## Sécurité
Le renderer n'a pas accès directement à Node.js ou SQLite : seules des fonctions explicitement exposées via `preload` sont accessibles. Le projet active `contextIsolation`, désactive `nodeIntegration` et utilise le sandbox Electron.
