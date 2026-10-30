# Fabric notebook source

# METADATA ********************

# META {
# META   "kernel_info": {
# META     "name": "synapse_pyspark"
# META   },
# META   "dependencies": {
# META     "lakehouse": {
# META       "default_lakehouse": "033ba413-16aa-499e-b892-d81913398efc",
# META       "default_lakehouse_name": "Systeme_Analyse",
# META       "default_lakehouse_workspace_id": "728cf097-5712-42ad-9ce4-f8dfc2953fd8"
# META     }
# META   }
# META }

# MARKDOWN ********************

# # Le Système · chaîne médaillon
#
# - **Bronze** : la base SQL de la Fabric App, copiée automatiquement dans OneLake (aucune copie ici, on la lit sur place).
# - **Silver** : les mêmes données nettoyées : dates à l'heure suisse, colonnes renommées, sans identifiant de compte.
# - **Gold** : un modèle en étoile pour Power BI : une dimension date, une dimension catégorie, les faits d'activité et la progression jour par jour.

# CELL ********************

from datetime import date, timedelta

import pandas as pd
from pyspark.sql import functions as F

ESPACE = "728cf097-5712-42ad-9ce4-f8dfc2953fd8"
BASE_APP = "c193062b-8d23-4945-a21a-e94aaea91648"  # base SQL de la Fabric App « Le Système »
BRONZE = f"abfss://{ESPACE}@onelake.dfs.fabric.microsoft.com/{BASE_APP}/Tables/dbo"
FUSEAU = "Europe/Zurich"

spark.sql("CREATE SCHEMA IF NOT EXISTS silver")
spark.sql("CREATE SCHEMA IF NOT EXISTS gold")


def lire_bronze(table):
    return spark.read.format("delta").load(f"{BRONZE}/{table}")


def ecrire(df, nom):
    df.write.mode("overwrite").option("overwriteSchema", "true").format("delta").saveAsTable(nom)
    print(f"{nom} : {spark.table(nom).count()} lignes")


def date_locale(colonne):
    return F.to_date(F.from_utc_timestamp(colonne, FUSEAU))

# METADATA ********************

# META {
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }

# MARKDOWN ********************

# ## Silver : données nettoyées

# CELL ********************

activite = (
    lire_bronze("Activites")
    .dropDuplicates(["id"])
    .withColumn("faite_le", F.from_utc_timestamp("faiteLe", FUSEAU))
    .withColumn("date", F.to_date("faite_le"))
    .select("id", "date", "faite_le", "categorie", "unite", "quantite", "xp", "libelle", "appareil")
)
oeuvre = (
    lire_bronze("Oeuvres")
    .dropDuplicates(["id"])
    .withColumn("cree_le", date_locale("creeLe"))
    .withColumn("terminee_le", date_locale("termineeLe"))
    .select("id", "titre", "type", "format", "unite", "progression", "total", "terminee", "cree_le", "terminee_le")
)
certification = (
    lire_bronze("Certifications")
    .dropDuplicates(["id"])
    .withColumn("obtenue_le", date_locale("obtenueLe"))
    .select("id", F.upper("code").alias("code"), "intitule", "obtenue_le")
)

ecrire(activite, "silver.activite")
ecrire(oeuvre, "silver.oeuvre")
ecrire(certification, "silver.certification")

# METADATA ********************

# META {
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }

# MARKDOWN ********************

# ## Gold : dimensions

# CELL ********************

MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
JOURS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]

# Le calendrier couvre toutes les dates du joueur : actions, œuvres et certifications.
dates_connues = [
    activite.agg(F.min("date")).first()[0],
    oeuvre.agg(F.min("cree_le")).first()[0],
    certification.agg(F.min("obtenue_le")).first()[0],
]
debut = min([d for d in dates_connues if d] + [date.today()]).replace(month=1, day=1)
fin = date.today() + timedelta(days=31)

jours = pd.DataFrame({"date": pd.date_range(debut, fin, freq="D").date})
iso = [d.isocalendar() for d in jours["date"]]
jours["annee"] = [d.year for d in jours["date"]]
jours["mois_num"] = [d.month for d in jours["date"]]
jours["mois"] = [f"{MOIS[d.month - 1]} {d.year}" for d in jours["date"]]
jours["mois_tri"] = [d.year * 100 + d.month for d in jours["date"]]
jours["semaine"] = [f"{i[0]}-S{i[1]:02d}" for i in iso]
jours["semaine_tri"] = [i[0] * 100 + i[1] for i in iso]
jours["jour_semaine"] = [JOURS[d.weekday()] for d in jours["date"]]
jours["jour_semaine_num"] = [d.weekday() + 1 for d in jours["date"]]
jours["date_texte"] = [d.strftime("%d.%m.%Y") for d in jours["date"]]
jours["est_weekend"] = [d.weekday() >= 5 for d in jours["date"]]
ecrire(spark.createDataFrame(jours), "gold.dim_date")

categories = [
    ("sport", "Sport", "FORCE", "minutes", 1),
    ("lecture", "Lecture", "SAVOIR", "pages", 2),
    ("anime", "Anime", "IMAGINATION", "épisodes", 3),
    ("manga", "Manga", "IMAGINATION", "chapitres", 4),
    ("oeuvre", "Œuvre terminée", "ARMÉE DES OMBRES", "œuvres", 5),
    ("certification", "Certification", "MAÎTRISE", "certifications", 6),
    ("quete", "Quête quotidienne", "CONSTANCE", "quêtes", 7),
]
ecrire(
    spark.createDataFrame(categories, "categorie string, libelle string, caracteristique string, unite string, ordre int"),
    "gold.dim_categorie",
)

CLASSES = {"anime": "Chevalier", "manga": "Assassin", "livre": "Mage"}
classe_ombre = F.create_map(*[F.lit(x) for paire in CLASSES.items() for x in paire])
dim_oeuvre = oeuvre.select(
    "titre",
    F.initcap("type").alias("type"),
    F.when(F.col("format") == "en_ligne", "En ligne").otherwise("Papier").alias("format"),
    "unite",
    "progression",
    "total",
    F.round(F.col("progression") / F.col("total"), 4).alias("avancement"),
    F.when(F.col("terminee"), "Terminée").otherwise("En cours").alias("statut"),
    classe_ombre[F.col("type")].alias("classe_ombre"),
    "cree_le",
    F.col("terminee_le").alias("date_terminee"),
    F.datediff("terminee_le", "cree_le").alias("jours_pour_finir"),
)
ecrire(dim_oeuvre, "gold.dim_oeuvre")

# METADATA ********************

# META {
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }

# MARKDOWN ********************

# ## Gold : faits

# CELL ********************

fait_activite = activite.select(
    "date",
    "categorie",
    "xp",
    "quantite",
    F.when(F.col("unite") == "minute", F.col("quantite")).otherwise(0).alias("minutes"),
    F.when(F.col("unite") == "page", F.col("quantite")).otherwise(0).alias("pages"),
    F.when(F.col("unite") == "episode", F.col("quantite")).otherwise(0).alias("episodes"),
    # Même règle que l'app : un tome compte pour 8 chapitres.
    F.when(F.col("unite") == "chapitre", F.col("quantite"))
    .when(F.col("unite") == "tome", F.col("quantite") * 8)
    .otherwise(0)
    .alias("chapitres"),
    "libelle",
)
ecrire(fait_activite, "gold.fait_activite")

ecrire(
    certification.select("code", "intitule", F.col("obtenue_le").alias("date")),
    "gold.fait_certification",
)


def niveau_depuis_xp(total):
    """Même barème que l'app : passer du niveau n au suivant coûte 400 + 10 × n XP."""
    niveau, reste = 1, total
    while reste >= 400 + 10 * niveau:
        reste -= 400 + 10 * niveau
        niveau += 1
    return niveau


par_jour = (
    activite.groupBy("date")
    .agg(
        F.sum("xp").alias("xp_jour"),
        F.count("*").alias("actions"),
        F.max(F.when(F.col("categorie") == "quete", 1).otherwise(0)).alias("quete_accomplie"),
    )
    .toPandas()
)
# La progression commence au premier jour de jeu (sinon le taux de quête serait dilué).
premier_jour = par_jour["date"].min() if len(par_jour) else date.today()
periode = (jours["date"] >= premier_jour) & (jours["date"] <= date.today())
jour = jours.loc[periode, ["date"]].merge(par_jour, on="date", how="left")
jour = jour.fillna({"xp_jour": 0, "actions": 0, "quete_accomplie": 0}).sort_values("date").reset_index(drop=True)
jour["xp_cumule"] = jour["xp_jour"].cumsum()
jour["niveau"] = jour["xp_cumule"].apply(niveau_depuis_xp)
serie, en_cours = [], 0
for accomplie in jour["quete_accomplie"]:
    en_cours = en_cours + 1 if accomplie else 0
    serie.append(en_cours)
jour["serie"] = serie
jour["actif"] = (jour["actions"] > 0).astype(int)
for c in ["xp_jour", "actions", "quete_accomplie", "xp_cumule", "niveau", "serie", "actif"]:
    jour[c] = jour[c].astype("int64")
ecrire(spark.createDataFrame(jour), "gold.fait_jour")

# METADATA ********************

# META {
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }
