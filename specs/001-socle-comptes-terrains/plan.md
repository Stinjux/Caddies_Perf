# Implementation Plan: Socle — données, comptes et terrains

**Branch**: `001-socle-comptes-terrains` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-socle-comptes-terrains/spec.md`

## Summary

Poser le socle de CaddiePerf : le schéma de base de données de référence pour tout le produit, la gestion des terrains de golf, les comptes Administrateur et Starter, l'authentification, les permissions, le cloisonnement étanche par terrain et la journalisation des actions sensibles.

**Approche technique retenue** : une application Next.js unique servant à la fois le back-office et, plus tard, la page client du QR code, adossée à PostgreSQL. Le cloisonnement par terrain et la protection des renseignements personnels ne reposent pas sur la discipline du développeur mais sur **deux barrières superposées** : une couche d'accès aux données qui refuse par construction toute requête sans portée de terrain, et des contraintes au niveau de la base elle-même. Les renseignements personnels vivent dans une table séparée, atteignable par un seul chemin, lequel journalise chaque consultation.

## Technical Context

**Language/Version**: TypeScript 5.x sur Node.js 22 LTS *(la machine de développement porte Node 25 ; la production sera figée sur une version LTS)*

**Primary Dependencies**: Next.js 16 (App Router), React 19, Tailwind CSS 4, Drizzle ORM. Authentification et hachage de mot de passe : voir `research.md`, décision en attente d'approbation.

**Storage**: PostgreSQL 16 *(la machine de développement porte PostgreSQL 14 ; voir research.md)*

**Testing**: Vitest pour les tests unitaires et d'intégration, Playwright pour les parcours de bout en bout. **Dépendances non installées, en attente d'approbation.**

**Target Platform**: Serveur Linux hébergé au Maroc. Navigateurs : mobile d'abord pour le parcours client, tablette et ordinateur pour l'administration.

**Project Type**: Application Web unique (back-office + parcours client public dans le même projet)

**Performance Goals**: Écrans d'exploitation affichés en moins de 2 secondes (SC-008), sur 5 terrains, 100 caddies et 300 départs par jour

**Constraints**: Hébergement au Maroc sans exception. Aucun service tiers recevant des données personnelles. Aucune donnée personnelle dans les URL, les QR codes ou les journaux.

**Scale/Scope**: 5 terrains, ~100 caddies, ~300 départs/jour, ~110 000 départs/an. Volume modeste : une seule base PostgreSQL et un seul serveur applicatif suffisent durablement.

## Constitution Check

*GATE : doit passer avant la phase 0. Re-vérifié après la phase 1.*

| Principe | Exigence | Évaluation avant conception | Évaluation après conception |
|---|---|---|---|
| **I. Minimisation des données personnelles** | Taille d'habits et adresse jamais stockées ; année de naissance isolée et réservée aux administrateurs | ✅ Aucune colonne ne leur est prévue. Le schéma ne peut pas les recevoir. | ✅ Table `caddie_personal_data` séparée, une seule colonne `birth_year`, accès par un chemin unique journalisé |
| **II. Aucune donnée réelle** | Dépôt et tests exclusivement fictifs | ✅ `.gitignore` en place et testé | ✅ Fixtures fictives sous `fixtures/`, test automatisé de détection |
| **III. Souveraineté au Maroc** | Hébergement et sauvegardes au Maroc, aucun tiers recevant des données | ✅ Aucune dépendance d'exécution appelant un service externe | ✅ Hachage de mot de passe par la bibliothèque standard de Node, aucun service d'authentification tiers |
| **IV. Cloisonnement par terrain** | Filtrage serveur, vérifié par tests | ✅ Contrainte structurante de la conception | ✅ Couche d'accès à portée obligatoire + clés composites en base + suite de tests dédiée |
| **V. Approbation explicite par phase** | Aucun code avant approbation | ✅ Ce plan ne produit que des documents | ✅ Aucun fichier de code créé |
| **VI. Tests avant clôture** | Tests exécutés et résultats présentés | ✅ Stratégie de test définie ci-dessous | ✅ `quickstart.md` décrit les scénarios de validation |

**Verdict** : aucune violation. Aucune entrée n'est requise dans le tableau de suivi de complexité.

**Points restant à approuver avant écriture de code** (principe V) : le choix du mécanisme d'authentification, celui des outils de test, et les caractéristiques de l'hébergeur. Ils sont détaillés dans `research.md`.

## Project Structure

### Documentation (this feature)

```text
specs/001-socle-comptes-terrains/
├── plan.md              # Ce fichier
├── research.md          # Décisions techniques et inconnues
├── data-model.md        # Schéma de référence du produit
├── quickstart.md        # Scénarios de validation exécutables
├── contracts/           # Contrats d'interface serveur
└── checklists/
    └── requirements.md  # Validation qualité de la spec — 16/16
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/              # Espace administrateur
│   │   ├── terrains/
│   │   ├── comptes/
│   │   └── journal/
│   ├── (starter)/            # Espace Starter — aucune donnée personnelle
│   ├── (auth)/               # Connexion, choix du terrain actif
│   └── api/
├── db/
│   ├── schema/               # Définition des tables (Drizzle)
│   ├── migrations/
│   └── index.ts
├── server/
│   ├── auth/                 # Sessions, hachage, garde d'accès
│   ├── scope/                # Portée de terrain — barrière de cloisonnement
│   ├── repositories/         # Accès aux données, portée obligatoire
│   ├── pii/                  # Chemin unique vers les renseignements personnels
│   └── audit/                # Écriture du journal
├── components/
└── lib/

tests/
├── unit/
├── integration/
│   ├── isolation/            # Cloisonnement par terrain
│   ├── permissions/          # Matrice des droits
│   └── pii/                  # Non-exposition des données personnelles
└── e2e/

fixtures/                     # Jeux de données fictifs, versionnés
```

**Structure Decision** : projet unique plutôt que séparation front/back. L'application sert un back-office et une page client publique depuis le même socle, avec un seul déploiement à administrer sur un serveur unique — ce qui correspond au volume réel et réduit la charge d'exploitation. Le répertoire `src/server/` isole ce qui ne doit jamais atteindre le navigateur ; `src/server/scope/` et `src/server/pii/` matérialisent dans l'arborescence les deux garanties les plus critiques de la constitution, afin qu'une revue de code puisse les vérifier d'un coup d'œil.

## Complexity Tracking

Aucune violation de la constitution à justifier.
