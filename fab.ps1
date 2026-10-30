# Lance la CLI Fabric sur le tenant perso, avec le profil Azure isolé du projet
# (la connexion Azure par défaut de la machine n'est jamais utilisée).
# Exemple : .\le-systeme\fab.ps1 ls "Le Système.Workspace"
$env:AZURE_CONFIG_DIR = Join-Path $PSScriptRoot '.az-perso'
& (Join-Path $PSScriptRoot '.venv-fabric\Scripts\fab.exe') @args
