"""Génère le rapport Power BI « Analyse du Joueur » au format PBIR (un dossier par page et par visuel).

Usage : python generer_rapport.py <id du modèle sémantique Analyse_Joueur>
Puis  : .\\le-systeme\\fab.ps1 import "Le Système.Workspace/Analyse du Joueur.Report" -i le-systeme\\analyse\\Analyse_Joueur.Report -f
"""

import json
import shutil
import sys
from pathlib import Path

ICI = Path(__file__).parent
DOSSIER = ICI / "Analyse_Joueur.Report"
SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition"


def ecrire(chemin, contenu):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(contenu, ensure_ascii=False, indent=2), encoding="utf-8")


def mesure(table, nom):
    return {"Measure": {"Expression": {"SourceRef": {"Entity": table}}, "Property": nom}}, f"{table}.{nom}", nom


def colonne(table, nom):
    return {"Column": {"Expression": {"SourceRef": {"Entity": table}}, "Property": nom}}, f"{table}.{nom}", nom


class Page:
    def __init__(self, nom, titre):
        self.nom, self.titre, self.visuels = nom, titre, []

    def visuel(self, type_visuel, x, y, l, h, roles, titre=None):
        etat = {}
        for role, champs in roles.items():
            etat[role] = {
                "projections": [
                    {"field": f, "queryRef": ref, "nativeQueryRef": natif, **({"active": True} if role == "Category" else {})}
                    for f, ref, natif in champs
                ]
            }
        visuel = {"visualType": type_visuel, "query": {"queryState": etat}, "drillFilterOtherVisuals": True}
        if titre:
            visuel["visualContainerObjects"] = {
                "title": [
                    {
                        "properties": {
                            "show": {"expr": {"Literal": {"Value": "true"}}},
                            "text": {"expr": {"Literal": {"Value": f"'{titre}'"}}},
                        }
                    }
                ]
            }
        nom = f"{self.nom}_{len(self.visuels):02d}"
        self.visuels.append(
            {
                "$schema": f"{SCHEMA}/visualContainer/1.5.0/schema.json",
                "name": nom,
                "position": {"x": x, "y": y, "z": len(self.visuels), "width": l, "height": h, "tabOrder": len(self.visuels)},
                "visual": visuel,
            }
        )

    def cartes(self, y, champs):
        largeur = (1240 - 10 * (len(champs) - 1)) // len(champs)
        for i, c in enumerate(champs):
            self.visuel("card", 20 + i * (largeur + 10), y, largeur, 110, {"Values": [c]})

    def enregistrer(self, racine):
        ecrire(
            racine / self.nom / "page.json",
            {
                "$schema": f"{SCHEMA}/page/1.3.0/schema.json",
                "name": self.nom,
                "displayName": self.titre,
                "displayOption": "FitToPage",
                "height": 720,
                "width": 1280,
            },
        )
        for v in self.visuels:
            ecrire(racine / self.nom / "visuals" / v["name"] / "visual.json", v)


def pages():
    progression = Page("progression", "Progression du Joueur")
    progression.cartes(
        20,
        [
            mesure("fait_jour", "Niveau actuel"),
            mesure("fait_certification", "Rang"),
            mesure("fait_activite", "XP total"),
            mesure("fait_jour", "Série actuelle"),
            mesure("dim_oeuvre", "Œuvres terminées"),
            mesure("fait_certification", "Certifications"),
        ],
    )
    progression.visuel(
        "lineChart", 20, 145, 800, 280,
        {"Category": [colonne("dim_date", "date")], "Y": [mesure("fait_jour", "XP cumulé")]},
        "Expérience cumulée",
    )
    progression.visuel(
        "clusteredBarChart", 840, 145, 420, 280,
        {"Category": [colonne("dim_categorie", "libelle")], "Y": [mesure("fait_activite", "XP total")]},
        "D'où vient l'expérience",
    )
    progression.visuel(
        "columnChart", 20, 440, 800, 260,
        {
            "Category": [colonne("dim_date", "semaine")],
            "Series": [colonne("dim_categorie", "libelle")],
            "Y": [mesure("fait_activite", "XP total")],
        },
        "Expérience par semaine",
    )
    progression.visuel(
        "tableEx", 840, 440, 420, 260,
        {
            "Values": [
                colonne("dim_oeuvre", "titre"),
                colonne("dim_oeuvre", "classe_ombre"),
                colonne("dim_oeuvre", "statut"),
                colonne("dim_oeuvre", "avancement"),
            ]
        },
        "Armée des ombres",
    )

    activites = Page("activites", "Activités")
    activites.cartes(
        20,
        [
            mesure("fait_activite", "Heures de sport"),
            mesure("fait_activite", "Pages lues"),
            mesure("fait_activite", "Épisodes vus"),
            mesure("fait_activite", "Chapitres lus"),
            mesure("fait_jour", "Jours actifs"),
            mesure("fait_jour", "Taux de quête"),
        ],
    )
    activites.visuel(
        "pivotTable", 20, 145, 1240, 280,
        {
            "Rows": [colonne("dim_date", "jour_semaine")],
            "Columns": [colonne("dim_date", "semaine")],
            "Values": [mesure("fait_activite", "XP total")],
        },
        "Expérience par jour de la semaine",
    )
    activites.visuel(
        "clusteredColumnChart", 20, 440, 1240, 260,
        {
            "Category": [colonne("dim_date", "mois")],
            "Y": [
                mesure("fait_activite", "Minutes de sport"),
                mesure("fait_activite", "Pages lues"),
                mesure("fait_activite", "Chapitres lus"),
            ],
        },
        "Volume par mois",
    )
    return [progression, activites]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    id_modele = sys.argv[1]
    if DOSSIER.exists():
        shutil.rmtree(DOSSIER)
    definition = DOSSIER / "definition"

    ecrire(
        DOSSIER / ".platform",
        {
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
            "metadata": {"type": "Report", "displayName": "Analyse du Joueur"},
            "config": {"version": "2.0", "logicalId": "00000000-0000-0000-0000-000000000000"},
        },
    )
    ecrire(
        DOSSIER / "definition.pbir",
        {
            "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
            "version": "4.0",
            "datasetReference": {
                "byConnection": {
                    "connectionString": "Data Source=\"powerbi://api.powerbi.com/v1.0/myorg/Le Système\";"
                    f"initial catalog=Analyse_Joueur;integrated security=ClaimsToken;semanticmodelid={id_modele}"
                }
            },
        },
    )
    ecrire(definition / "version.json", {"$schema": f"{SCHEMA}/versionMetadata/1.0.0/schema.json", "version": "2.0.0"})
    ecrire(
        definition / "report.json",
        {
            "$schema": f"{SCHEMA}/report/1.2.0/schema.json",
            "themeCollection": {"baseTheme": {"name": "CY24SU10", "reportVersionAtImport": "5.61", "type": "SharedResources"}},
            "layoutOptimization": "None",
            "resourcePackages": [
                {
                    "name": "SharedResources",
                    "type": "SharedResources",
                    "items": [{"name": "CY24SU10", "path": "BaseThemes/CY24SU10.json", "type": "BaseTheme"}],
                }
            ],
            "settings": {
                "useStylableVisualContainerHeader": True,
                "defaultDrillFilterOtherVisuals": True,
                "allowChangeFilterTypes": True,
                "useEnhancedTooltips": True,
                "useDefaultAggregateDisplayName": True,
            },
        },
    )
    theme = DOSSIER / "StaticResources" / "SharedResources" / "BaseThemes" / "CY24SU10.json"
    theme.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(ICI / "theme" / "CY24SU10.json", theme)

    liste = pages()
    ecrire(
        definition / "pages" / "pages.json",
        {
            "$schema": f"{SCHEMA}/pagesMetadata/1.0.0/schema.json",
            "pageOrder": [p.nom for p in liste],
            "activePageName": liste[0].nom,
        },
    )
    for p in liste:
        p.enregistrer(definition / "pages")
    print(f"Rapport généré : {sum(len(p.visuels) for p in liste)} visuels sur {len(liste)} pages")


if __name__ == "__main__":
    main()
