# Phase 1 — Guide de validation

**Feature**: Socle — données, comptes et terrains | **Date**: 2026-09-18

Ce document décrit **comment prouver** que le socle fonctionne. Il ne contient pas de code d'implémentation : les détails de mise en œuvre appartiennent à `tasks.md` et à la phase de développement.

Référence du schéma : [data-model.md](./data-model.md) · Référence des frontières : [contracts/server-contracts.md](./contracts/server-contracts.md)

---

## Prérequis

| Élément | Attendu | État actuel sur la machine |
|---|---|---|
| Node.js | 22 LTS | 25.6.1 — à aligner |
| PostgreSQL | Version alignée sur la production | 14.21, service démarré |
| Base de développement | `caddieperf_dev` | à créer |
| Base de test | `caddieperf_test`, réinitialisée entre les séries | à créer |
| Outils de test | Vitest, Playwright | **non installés — approbation requise** |

Aucune de ces installations ne doit avoir lieu avant l'approbation de la phase correspondante (principe V).

---

## Jeu de données fictif

Le jeu de départ est **entièrement inventé** et versionné sous `fixtures/`. Aucune donnée réelle n'y figure jamais (principe II).

Il comprend **deux terrains**, ce qui est le minimum indispensable : avec un seul, aucun test de cloisonnement ne prouve quoi que ce soit.

| Terrain | Fuseau | Comptes |
|---|---|---|
| Golf des Cèdres | `Africa/Casablanca` | 1 administrateur, 1 Starter |
| Royal Atlas | `Africa/Casablanca` | 1 administrateur |

Plus : 6 caddies fictifs répartis sur les deux terrains, dont un désactivé porteur d'un historique ; 4 voiturettes ; un compte rattaché **aux deux** terrains, pour éprouver le changement de terrain actif.

---

## Scénarios de validation

Chaque scénario renvoie aux exigences qu'il démontre. Un scénario en échec bloque la clôture de la phase (principe VI).

### V-1 — Création et configuration d'un terrain

Se connecter en administrateur, créer un terrain avec nom, adresse, fuseau et lien Google Reviews, puis le retrouver dans la liste avec ses valeurs exactes. Tenter ensuite une création sans nom.

**Attendu** : création réussie et identifiant permanent attribué ; création sans nom refusée avec indication du champ manquant.
**Couvre** : FR-001 à FR-007, SC-001.

### V-2 — Comptes et rattachements

Créer un compte Starter rattaché au seul terrain Golf des Cèdres. Se connecter avec ce compte.

**Attendu** : le terrain est sélectionné d'office, sans écran de choix. Avec le compte rattaché aux deux terrains, l'écran de choix apparaît et ne propose que ces deux terrains.
**Couvre** : FR-008 à FR-013, SC-002.

### V-3 — Cloisonnement infranchissable ⚠️ *critique*

Depuis le compte rattaché au seul Golf des Cèdres, tenter d'atteindre un caddie, une voiturette et un journal de Royal Atlas en manipulant directement les identifiants.

**Attendu** : les trois tentatives échouent, et la réponse est indiscernable de celle d'une ressource inexistante. Aucune liste ne laisse apparaître un élément de l'autre terrain. Une création rattachée de force à l'autre terrain est refusée.
**Couvre** : FR-023 à FR-027, SC-003.

### V-4 — Le Starter ne reçoit aucune donnée personnelle ⚠️ *critique*

Simuler une journée complète de travail d'un Starter en capturant **toutes** les réponses réseau, pas seulement l'affichage.

**Attendu** : aucune occurrence d'année de naissance, de note, de commentaire ni de jeton de QR code dans l'ensemble du trafic. Une tentative directe d'accès aux renseignements personnels est refusée comme si le caddie n'existait pas.
**Couvre** : FR-019, FR-020, FR-030, SC-004.

### V-5 — Le schéma refuse les données interdites ⚠️ *critique*

Inspecter le schéma de la base et tenter d'insérer une taille d'habits, une adresse de domicile et une valeur de force.

**Attendu** : aucune colonne ne les accepte ; les insertions échouent au niveau de la base, pas de l'application.
**Couvre** : FR-028, FR-028b, SC-005.

### V-6 — Journal complet et inaltérable

Créer un terrain, modifier un compte, consulter l'année de naissance d'un caddie, puis ouvrir le journal. Tenter ensuite de modifier et de supprimer une entrée directement en base avec l'utilisateur applicatif.

**Attendu** : les trois actions figurent au journal avec auteur et horodatage ; aucune entrée ne contient de donnée personnelle ; les tentatives de modification et de suppression sont refusées par PostgreSQL.
**Couvre** : FR-035 à FR-039, SC-006, SC-007.

### V-7 — Dernier administrateur

Tenter de désactiver puis de détacher le dernier administrateur actif de Royal Atlas.

**Attendu** : les deux opérations sont refusées avec un message explicite ; le terrain conserve son administrateur.
**Couvre** : FR-015, SC-010.

### V-8 — Effacement des renseignements personnels

Relever les moyennes d'un terrain, effacer les renseignements personnels d'un caddie porteur d'historique, puis recalculer.

**Attendu** : l'année de naissance a disparu ; les affectations et évaluations demeurent ; les moyennes sont strictement identiques.
**Couvre** : FR-033, FR-034b, FR-034c, SC-009.

### V-9 — Session et désactivation en cours d'usage

Ouvrir une session Starter, désactiver son compte depuis un autre navigateur, puis agir dans la session Starter.

**Attendu** : la session est interrompue dès l'action suivante, sans attendre l'expiration.
**Couvre** : FR-014, FR-016.

### V-10 — Modification concurrente

Ouvrir la même fiche de terrain dans deux sessions administrateur, enregistrer dans la première, puis dans la seconde.

**Attendu** : la seconde écriture est refusée avec une invitation à recharger ; aucune donnée n'est écrasée en silence.
**Couvre** : FR-045.

### V-11 — Fuseau horaire et jour travaillé

Créer des affectations terminées de part et d'autre de minuit heure locale, dont deux le même jour pour un même caddie.

**Attendu** : les dates affichées suivent le fuseau du terrain et non celui du navigateur ; le décompte des jours travaillés compte **une seule journée** malgré les deux réservations.
**Couvre** : FR-005, FR-044.

### V-12 — Aucune donnée réelle dans le dépôt

Analyse automatisée du dépôt, des fixtures et de la documentation.

**Attendu** : aucun fichier CSV hors `fixtures/`, aucun `.env` versionné, aucune donnée réelle détectée.
**Couvre** : FR-046, SC-011.

---

## Ordre d'exécution recommandé

1. **V-5** d'abord — vérifier le schéma avant de construire dessus. Une erreur ici invalide tout le reste.
2. **V-1**, **V-2** — les fonctions structurantes.
3. **V-3**, **V-4** — les deux garanties critiques. Elles doivent tourner à **chaque** phase ultérieure, pas une seule fois.
4. **V-6** à **V-11** — les règles métier.
5. **V-12** — à chaque validation de phase.

## Critère de clôture de la phase

La phase n'est close que lorsque les douze scénarios passent et que leurs résultats réels ont été présentés — y compris les échecs, avec leur sortie (principe VI).

Les scénarios **V-3**, **V-4**, **V-5** et **V-12** deviennent ensuite des tests permanents, rejoués à chaque phase du projet. Ils protègent les trois principes non négociables de la constitution.
