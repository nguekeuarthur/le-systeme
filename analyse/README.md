# Analyse du Joueur : de l'app à Power BI

```text
Fabric App (base SQL)  ──copie automatique──▶  OneLake  = BRONZE
        │
        ▼  notebook Pipeline_Medaillon (PySpark)
Lakehouse Systeme_Analyse
   silver.activite / oeuvre / certification       données nettoyées, heure suisse, sans identifiant de compte
   gold.dim_date / dim_categorie / dim_oeuvre     dimensions
   gold.fait_activite / fait_jour / fait_certification   faits (modèle en étoile)
        │
        ▼  Direct Lake (pas d'import, pas de copie)
Modèle sémantique Analyse_Joueur  ──▶  Rapport « Analyse du Joueur »
```

## Commandes

La CLI Fabric passe par `le-systeme/fab.ps1`, qui utilise le profil Azure isolé du projet (tenant perso).
Si la connexion a expiré :

```powershell
$env:AZURE_CONFIG_DIR = "le-systeme\.az-perso"
az login --tenant f580b74a-b61c-4efd-9c8d-8ae7e04fab79 --use-device-code --allow-no-subscriptions
```

Mettre à jour la couche gold (à lancer avant de filmer, après avoir joué) :

```powershell
.\le-systeme\fab.ps1 job run "Le Système.Workspace/Pipeline_Medaillon.Notebook"
```

Redéployer le notebook, le modèle ou le rapport après une modification :

```powershell
.\le-systeme\fab.ps1 import "Le Système.Workspace/Pipeline_Medaillon.Notebook" -i le-systeme\analyse\Pipeline_Medaillon.Notebook --format .py -f
.\le-systeme\fab.ps1 import "Le Système.Workspace/Analyse_Joueur.SemanticModel" -i le-systeme\analyse\Analyse_Joueur.SemanticModel -f
python le-systeme\analyse\generer_rapport.py dda64813-0f07-4964-b00b-9326eea17596
.\le-systeme\fab.ps1 import "Le Système.Workspace/Analyse du Joueur.Report" -i le-systeme\analyse\Analyse_Joueur.Report -f
```

## Mesures principales

Niveau actuel, Rang, XP total, XP cumulé, XP 7 derniers jours, Série actuelle, Meilleure série,
Jours actifs, Taux de quête, Heures de sport, Pages lues, Épisodes vus, Chapitres lus,
Œuvres terminées, Certifications.
