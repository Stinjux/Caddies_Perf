# CaddiePerf

Plateforme de gestion et d'évaluation des caddies pour terrains de golf.

Un client scanne le QR code permanent d'une voiturette au 18e trou et évalue son caddie
en moins de 30 secondes, sans compte et sans application à télécharger.

> **Aucune donnée réelle ne doit entrer dans ce dépôt.** Les jeux de test sont
> entièrement fictifs. Voir [la constitution du projet](.specify/memory/constitution.md).

## État

Spécification n°1 — socle : données, comptes et terrains.
**Phases 1 à 9 terminées.** Les spécifications 2 à 5 restent à écrire.

| Couvert                                    | Reste à faire                          |
| ------------------------------------------ | -------------------------------------- |
| Modèle de données de référence (13 tables) | Caddies et import CSV (spéc. 2)        |
| Terrains, comptes, authentification        | Voiturettes et QR codes (spéc. 2)      |
| Cloisonnement par terrain                  | Réservations et affectations (spéc. 3) |
| Permissions et non-exposition au Starter   | Questionnaire client (spéc. 4)         |
| Journal, correction, effacement, purge     | Scores et rapports (spéc. 5)           |

## Prérequis

- Node.js 22 LTS ou plus récent
- PostgreSQL 14 ou plus récent — **les migrations n'emploient aucune fonctionnalité
  postérieure à la version 14**, tant que la version du serveur de production reste
  inconnue

## Installation

```bash
npm install
```

Copier `.env.example` vers `.env`, renseigner les valeurs locales, puis créer les bases :

```bash
createdb caddieperf_dev && createdb caddieperf_test
```

Appliquer les migrations sur chaque base :

```bash
for f in src/db/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d caddieperf_dev -f "$f"; done
```

Amorcer des données **fictives** :

```bash
npm run seed
```

Les comptes créés et leurs mots de passe sont listés dans
[fixtures/seed-data.ts](fixtures/seed-data.ts). Ils sont fictifs et sans valeur.

## Développement

```bash
npm run dev
```

```bash
npm test
```

`npm run typecheck`, `npm run lint` et `npm run test:e2e` complètent la vérification.
Les tests de bout en bout exigent un serveur de développement en cours d'exécution.

## Architecture

```text
src/
├── app/            écrans : (admin), (starter), (auth)
├── db/schema/      13 tables — modèle de référence du produit
├── server/
│   ├── scope/      LA BARRIÈRE DE CLOISONNEMENT
│   ├── pii/        POINT D'ENTRÉE UNIQUE des renseignements personnels
│   ├── audit/      journal en écriture seule
│   ├── auth/       sessions, hachage scrypt, gardes de rôle
│   ├── repositories/ accès aux données — portée obligatoire
│   └── services/   règles métier
└── lib/            UUID v7, fuseaux horaires
```

## Les garanties, et comment elles tiennent

Ces propriétés ne reposent pas sur la discipline du développeur. Elles sont
structurelles, et des tests permanents échouent si quelqu'un les casse.

**Aucune donnée personnelle superflue** — le schéma est incapable de recevoir une
taille d'habits, une adresse de domicile ou un âge. L'année de naissance vit seule
dans `caddie_personal_data`, hors de tout chemin de jointure ordinaire, atteignable
par un unique module qui journalise chaque accès. Aucune lecture en lot n'est exposée :
un export massif est impossible, pas seulement découragé.

**Cloisonnement par terrain** — les clés étrangères composites `(golf_course_id, id)`
font refuser par PostgreSQL toute affectation reliant deux terrains. Des tests écrivent
en SQL brut pour le prouver, en contournant tout le code applicatif.

**Le Starter ne voit rien de personnel** — un test Playwright capture _tout_ le trafic
réseau d'une journée de travail et échoue si une valeur interdite y apparaît, même
jamais affichée. Sa capacité à échouer a été vérifiée par contrôle négatif.

**Journal inaltérable** — les droits de modification et de suppression sont retirés au
rôle applicatif au niveau de PostgreSQL. L'exigence reste vraie même si le code
applicatif est compromis.

## Documentation

| Document                                                        | Contenu                                 |
| --------------------------------------------------------------- | --------------------------------------- |
| [constitution.md](.specify/memory/constitution.md)              | Les 6 principes, dont 3 non négociables |
| [spec.md](specs/001-socle-comptes-terrains/spec.md)             | 50 exigences, 11 critères de succès     |
| [data-model.md](specs/001-socle-comptes-terrains/data-model.md) | Modèle de référence du produit          |
| [contracts/](specs/001-socle-comptes-terrains/contracts/)       | Frontières du serveur                   |
| [quickstart.md](specs/001-socle-comptes-terrains/quickstart.md) | 12 scénarios de validation              |
| [tasks.md](specs/001-socle-comptes-terrains/tasks.md)           | Les 85 tâches et leur état              |
