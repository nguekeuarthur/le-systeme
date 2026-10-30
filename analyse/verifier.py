"""Exécute une requête DAX sur le modèle Analyse_Joueur via la CLI Fabric.

Usage : python verifier.py "EVALUATE ROW(\"x\", [XP total])"
Le fichier envoyé est en ASCII pur (accents échappés), sinon la CLI les déforme.
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

MODELE = "groups/728cf097-5712-42ad-9ce4-f8dfc2953fd8/datasets/dda64813-0f07-4964-b00b-9326eea17596/executeQueries"
FAB = Path(__file__).parent.parent / "fab.ps1"

with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="ascii") as f:
    json.dump({"queries": [{"query": sys.argv[1]}]}, f, ensure_ascii=True)
sortie = subprocess.run(
    ["powershell", "-NoProfile", "-File", str(FAB), "api", "-A", "powerbi", MODELE, "-X", "post", "-i", f.name, "--output_format", "json"],
    capture_output=True,
    text=True,
    encoding="utf-8",
)
resultat = json.loads(sortie.stdout)["result"]["data"][0]
if resultat["status_code"] != 200:
    print(json.dumps(resultat["text"], ensure_ascii=False, indent=1))
    sys.exit(1)
for ligne in resultat["text"]["results"][0]["tables"][0]["rows"]:
    print(json.dumps(ligne, ensure_ascii=False))
