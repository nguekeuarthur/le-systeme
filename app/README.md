# Le Système

Une Fabric App qui transforme le quotidien en jeu de rôle : sport, lecture, anime, manga et certifications
font monter le niveau, les caractéristiques et le rang de chasseur. Chaque œuvre terminée rejoint
l'armée des ombres. Le rang S reste verrouillé tant que la DP-600 n'est pas obtenue.

Projet pour le #FabricAppsChallenge, construit avec Rayfin (Fabric Apps, préversion).

## Lancer l'application

```bash
# Sans backend : données gardées dans le navigateur (mode « hors ligne »)
npm run dev:frontend

# Avec la Fabric App : backend dans Fabric, interface en local
npx rayfin login
npm run dev

# Déployer dans Fabric (application + schéma de la base)
npx rayfin up --workspace "Le Système"
npx rayfin up status
```

Ajouter `#direct` à l'adresse saute l'intro. La touche `D` masque la barre de démo pour filmer.

## Données

La base SQL de la Fabric App contient cinq tables, filtrées par joueur côté serveur
(`claims.sub = user_id`) :

| Table | Rôle |
|---|---|
| `Joueur` | Nom du joueur |
| `Quete` | Objectifs de la quête quotidienne |
| `Oeuvre` | Anime, manga et livres suivis |
| `Certification` | Certifications obtenues |
| `Activite` | Journal de toutes les actions, jamais modifié |

Niveau, expérience, caractéristiques, rang et titre ne sont pas stockés : ils sont recalculés à partir
du journal (`src/systeme/regles.ts`). Un autre appareil (le téléphone) écrit dans le même journal,
et l'écran rejoue ses actions en quelques secondes.

## Organisation

```text
rayfin/data/            Entités Rayfin (tables de la base SQL)
src/systeme/regles.ts   Barèmes et calculs : XP, niveaux, rangs, événements
src/systeme/actions.ts  Actions du joueur (écrivent dans le journal)
src/systeme/depot*.ts   Accès aux données : Fabric (Rayfin) ou navigateur
src/systeme/scene.ts    Scène 3D (Three.js) : portail, armée des ombres, effets
src/systeme/narrateur.ts, sons.ts   Notifications, cinématiques, sons
src/pages/SystemePage.tsx           Interface
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev:frontend` | Interface seule, en mode hors ligne |
| `npm run dev` | Interface en local, backend dans Fabric |
| `npm run test` | Tests unitaires (Vitest) |
| `npm run lint` | ESLint |
| `npm run build:fabric` | Construction pour le déploiement Fabric |
