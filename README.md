<div align="center">

# ◆ Le Système

**Une application de progression personnelle construite comme une Microsoft Fabric App,<br/>de la saisie opérationnelle jusqu'au rapport Power BI.**

![Microsoft Fabric](https://img.shields.io/badge/Microsoft%20Fabric-Fabric%20App-0F6CBD?style=flat-square)
![SQL Database](https://img.shields.io/badge/SQL%20Database-in%20Fabric-0F6CBD?style=flat-square)
![PySpark](https://img.shields.io/badge/PySpark-Delta%20Lake-E25A1C?style=flat-square&logo=apachespark&logoColor=white)
![Power BI](https://img.shields.io/badge/Power%20BI-Direct%20Lake-F2C811?style=flat-square&logo=powerbi&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-React%2019-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?style=flat-square&logo=threedotjs&logoColor=white)

[Démo vidéo](#démo) · [Architecture](#architecture) · [Modèle de données](#modèle-de-données) · [Démarrage](#démarrage)

</div>

---

## Présentation

**Le Système** transforme les activités du quotidien (sport, lecture, anime, manga, certifications) en une progression de type jeu de rôle :
niveau, expérience, caractéristiques et rang. L'interface reprend l'esthétique des « fenêtres de Système » des récits de chasseurs,
avec une scène 3D temps réel et des cinématiques.

Le projet sert surtout de démonstrateur de bout en bout sur **Microsoft Fabric**. Les mêmes données passent par trois usages :

1. **Opérationnel** : une Fabric App (Rayfin) écrit dans une base SQL Fabric, avec authentification Entra ID et sécurité au niveau des lignes.
2. **Ingénierie de données** : la base est copiée automatiquement dans OneLake, puis un notebook PySpark construit une architecture médaillon.
3. **Analytique** : un modèle sémantique **Direct Lake** et un rapport Power BI lisent la couche gold, sans import ni copie.

Projet réalisé dans le cadre du **#FabricAppsChallenge** (novembre 2026).

## Démo

> 🎬 *Vidéo de démonstration : lien à venir*

<!-- ![Démonstration](docs/demo.gif) -->

## Fonctionnalités

| Domaine | Description |
|---|---|
| **Quête quotidienne** | Objectifs du jour (sport, pages, épisodes, chapitres). Leur réalisation déclenche un bonus et alimente une série. |
| **Statut du joueur** | Niveau, expérience et cinq caractéristiques recalculés à partir du journal d'activités. |
| **Armée des ombres** | Chaque œuvre terminée génère une unité 3D dont la classe dépend du type d'œuvre (anime, manga, livre). |
| **Rangs** | De E à A selon le nombre de certifications, puis S (DP-600) et Monarque (AI-103). |
| **Terminal mobile** | Version téléphone ouverte par QR code. Les saisies sont rejouées en direct sur l'écran principal. |
| **Journal** | Correction ou suppression d'une saisie, avec recalcul complet des gains associés. |
| **Expérience** | Scène Three.js (bloom, particules, animations), sons synthétisés (Web Audio) et voix du Système (Web Speech). |
| **Analyse** | Rapport Power BI sur deux pages : progression et activités. |

## Architecture

```mermaid
flowchart LR
    subgraph OPS["Opérationnel · Fabric App"]
        direction TB
        UI["Interface React + Three.js<br/>écran principal et terminal mobile"]
        API["API GraphQL Rayfin<br/>Entra ID · sécurité par ligne"]
        DB[("SQL Database in Fabric")]
        UI --> API --> DB
    end

    subgraph DE["Ingénierie de données · OneLake"]
        direction TB
        BR[("Bronze<br/>copie automatique de la base")]
        NB["Notebook PySpark<br/>Pipeline_Medaillon"]
        SI[("Silver<br/>données nettoyées")]
        GO[("Gold<br/>modèle en étoile")]
        BR --> NB --> SI --> GO
    end

    subgraph BI["Analytique · Power BI"]
        direction TB
        SM["Modèle sémantique<br/>Direct Lake"]
        RP["Rapport<br/>Analyse du Joueur"]
        SM --> RP
    end

    DB -. "réplication OneLake" .-> BR
    GO -- "Direct Lake" --> SM
```

### Choix de conception

- **Le journal comme source de vérité.** Chaque action est un événement ajouté à un journal. Niveau, caractéristiques, rang et titre en sont dérivés, jamais stockés. La logique est unique et testée (`app/src/systeme/regles.ts`), et la couche gold applique les mêmes barèmes.
- **Une seule source pour l'opérationnel et l'analytique.** La base SQL Fabric est répliquée nativement dans OneLake. La chaîne analytique la lit sur place, sans pipeline de copie.
- **Sécurité par conception.** Chaque table porte une politique de ligne (`claims.sub = user_id`). La couche silver ne conserve aucun identifiant de compte.
- **Synchronisation multi-appareils.** Chaque saisie porte l'appareil qui l'a faite. L'écran principal rejoue les événements venus d'un autre appareil sous forme de notifications et de cinématiques.
- **Tout est versionné en texte.** Notebook (`.py`), modèle sémantique (TMDL) et rapport (PBIR) sont déployés par la CLI Fabric à partir de ce dépôt.

## Modèle de données

### Base opérationnelle (SQL Database in Fabric)

```mermaid
erDiagram
    JOUEUR ||--o{ ACTIVITE : "user_id"
    JOUEUR ||--o{ QUETE : "user_id"
    JOUEUR ||--o{ OEUVRE : "user_id"
    JOUEUR ||--o{ CERTIFICATION : "user_id"

    JOUEUR {
        uuid id
        string nom
        date creeLe
    }
    QUETE {
        uuid id
        string categorie
        int objectif
        int pas
    }
    OEUVRE {
        uuid id
        string type
        string titre
        int progression
        int total
        bool terminee
    }
    CERTIFICATION {
        uuid id
        string code
        date obtenueLe
    }
    ACTIVITE {
        uuid id
        string categorie
        string unite
        int quantite
        int xp
        date faiteLe
        string appareil
    }
```

### Couche gold (modèle en étoile, Direct Lake)

```mermaid
erDiagram
    DIM_DATE ||--o{ FAIT_ACTIVITE : date
    DIM_DATE ||--o{ FAIT_JOUR : date
    DIM_DATE ||--o{ FAIT_CERTIFICATION : date
    DIM_DATE ||--o{ DIM_OEUVRE : date_terminee
    DIM_CATEGORIE ||--o{ FAIT_ACTIVITE : categorie
```

| Table | Grain | Contenu |
|---|---|---|
| `dim_date` | jour | calendrier en français (mois, semaine ISO, jour de la semaine) |
| `dim_categorie` | catégorie | libellé, caractéristique associée, unité |
| `dim_oeuvre` | œuvre | type, format, avancement, statut, classe d'ombre |
| `fait_activite` | action | XP, minutes, pages, épisodes, chapitres |
| `fait_jour` | jour | XP du jour, XP cumulée, niveau, série de quêtes |
| `fait_certification` | certification | code, date d'obtention |

Mesures principales : *Niveau actuel, Rang, XP total, XP cumulé, XP 7 derniers jours, Série actuelle, Meilleure série, Jours actifs,
Taux de quête, Heures de sport, Pages lues, Épisodes vus, Chapitres lus, Œuvres terminées, Certifications.*

## Stack technique

| Couche | Technologies |
|---|---|
| Application | React 19, TypeScript, Vite, Three.js (post-traitement bloom), Web Audio, Web Speech |
| Backend | Microsoft Fabric Apps (Rayfin SDK), GraphQL, Microsoft Entra ID |
| Données | SQL Database in Fabric, OneLake, Delta Lake, Lakehouse avec schémas |
| Traitement | Notebook PySpark (Fabric Spark) |
| Restitution | Modèle sémantique Direct Lake (TMDL), rapport Power BI (PBIR) |
| Outillage | Rayfin CLI, Fabric CLI, Vitest, ESLint |

## Démarrage

### Prérequis

- Node.js 20 ou plus récent
- Pour le déploiement : une capacité Microsoft Fabric (F SKU ou essai), le paramètre de locataire « Fabric apps (preview) » activé, et un espace de travail avec les droits Contributeur
- Pour la chaîne analytique : Python 3.10 ou plus récent et la [CLI Fabric](https://aka.ms/fabric-cli)

### En local, sans Fabric

Les données sont conservées dans le navigateur.

```bash
cd app
npm install
npm run dev:horsligne
```

### Déploiement sur Microsoft Fabric

```bash
cd app
npx rayfin login
npx rayfin up --workspace "<espace de travail>"
npx rayfin up status
```

La commande crée la Fabric App, provisionne la base SQL, applique le schéma et publie l'interface.

### Chaîne analytique

Création du lakehouse, import du notebook, du modèle sémantique et du rapport : voir [`analyse/README.md`](analyse/README.md).

### Tests

```bash
cd app
npm test
```

Les tests couvrent les barèmes, les rangs, les quêtes et les bonus, les actions du joueur et la suppression avec recalcul.

## Structure du dépôt

```text
.
├── app/                              Fabric App
│   ├── rayfin/data/                  entités (tables SQL, permissions par ligne)
│   └── src/
│       ├── systeme/                  règles du jeu, accès aux données, scène 3D, audio
│       ├── components/systeme/       fenêtres, formulaires, terminal mobile, journal
│       └── pages/                    page principale
├── analyse/
│   ├── Pipeline_Medaillon.Notebook/  bronze → silver → gold
│   ├── Analyse_Joueur.SemanticModel/ modèle Direct Lake (TMDL)
│   ├── Analyse_Joueur.Report/        rapport Power BI (PBIR)
│   └── generer_rapport.py            génération du rapport
├── prototype/                        prototype visuel initial
└── fab.ps1                           exécution de la CLI Fabric sur le tenant du projet
```

## Auteur

**Arthur Nguekeu**, certifié Microsoft **DP-600** (Fabric Analytics Engineer) et **DP-700** (Fabric Data Engineer).

---

<sub>Projet personnel. L'esthétique s'inspire des récits de chasseurs à « Système ». Tous les visuels sont générés par le code, sans image ni marque d'une œuvre existante. Les identifiants d'espace de travail présents dans <code>analyse/</code> désignent un tenant de démonstration et sont à adapter.</sub>
