# Tasks: Socle — données, comptes et terrains

**Input**: Documents de conception de `/specs/001-socle-comptes-terrains/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: **OBLIGATOIRES.** Le principe VI de la constitution exige des tests exécutés avant la clôture de toute phase, et `quickstart.md` définit 12 scénarios de validation. Les tâches de test ne sont donc pas optionnelles ici.

**Organization**: Tâches groupées par parcours utilisateur, pour que chacun soit implémentable et testable indépendamment.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable — fichiers distincts, aucune dépendance en attente
- **[Story]** : parcours concerné (US1 à US6)

## Path Conventions

Projet unique, conformément à `plan.md` : `src/` et `tests/` à la racine du dépôt.

---

## ✅ Blocages levés le 2026-09-18

| Tâches | Point | Statut |
|---|---|---|
| T006, T007 | Vitest et Playwright | **Approuvés** |
| T031 | Authentification maison, sans bibliothèque | **Approuvée** |
| T021, T022 | Version de PostgreSQL | **Contournée** — développement sur PostgreSQL 14, migrations compatibles 14 et au-delà (research.md §10) |

**Contrainte permanente** : aucune migration ne doit employer une fonctionnalité postérieure à PostgreSQL 14 tant que la version du serveur de production reste inconnue.

Aucune tâche n'est bloquée. Seul le déploiement (phase 24) reste suspendu au choix d'hébergement.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose** : initialisation du projet et de sa structure.

- [x] T001 Initialiser le projet Next.js 16 avec TypeScript à la racine du dépôt (`package.json`, `tsconfig.json`, `next.config.ts`)
- [x] T002 [P] Configurer Tailwind CSS 4 dans `postcss.config.mjs` et `src/app/globals.css`
- [x] T003 [P] Configurer ESLint et Prettier dans `eslint.config.mjs`
- [x] T004 [P] Créer `.env.example` documentant les variables attendues, **sans aucune valeur réelle** (FR-046)
- [x] T005 Créer l'arborescence décrite dans plan.md : `src/app/`, `src/db/`, `src/server/{auth,scope,repositories,pii,audit}/`, `src/components/`, `src/lib/`, `tests/{unit,integration,e2e}/`, `fixtures/`
- [x] T006 Installer et configurer Vitest dans `vitest.config.ts` avec un environnement Node et une base de test dédiée
- [x] T007 [P] Installer et configurer Playwright dans `playwright.config.ts`, projets desktop et mobile
- [x] T008 Créer les bases `caddieperf_dev` et `caddieperf_test`, et documenter la procédure dans `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose** : socle technique indispensable à tous les parcours. Il porte les deux garanties critiques de la constitution.

**⚠️ CRITIQUE** : aucun parcours utilisateur ne démarre avant la fin de cette phase.

### Schéma de données

- [x] T009 Installer Drizzle ORM et drizzle-kit, et créer la connexion dans `src/db/index.ts`
- [x] T010 Définir tous les types énumérés dans `src/db/schema/enums.ts` d'après data-model.md
- [x] T011 [P] Définir la table `golf_course` dans `src/db/schema/golf-course.ts`
- [x] T012 [P] Définir les tables `account` et `account_golf_course` dans `src/db/schema/account.ts`
- [x] T013 [P] Définir la table `session` dans `src/db/schema/session.ts`
- [x] T014 [P] Définir la table `caddie` dans `src/db/schema/caddie.ts` — **aucune colonne pour la taille d'habits, l'adresse, l'âge ou la force** (FR-028, FR-028b)
- [x] T015 Définir la table `caddie_personal_data` dans `src/db/schema/caddie-personal-data.ts`, fichier **séparé** de `caddie.ts` pour rendre la frontière visible en revue (FR-029)
- [x] T016 [P] Définir la table `cart` dans `src/db/schema/cart.ts` avec `qr_token` unique
- [x] T017 [P] Définir la table `booking` dans `src/db/schema/booking.ts`
- [x] T018 Définir la table `assignment` dans `src/db/schema/assignment.ts` avec les **clés étrangères composites** `(golf_course_id, id)` vers booking, cart et caddie (FR-026)
- [x] T019 [P] Définir `evaluation`, `evaluation_criterion_answer` et `google_review_click` dans `src/db/schema/evaluation.ts`
- [x] T020 Définir la table `audit_log` dans `src/db/schema/audit-log.ts` avec ses trois index de filtrage (FR-039)
- [x] T021 Générer la migration initiale dans `src/db/migrations/`, en n'employant que des fonctionnalités disponibles depuis PostgreSQL 14
- [x] T022 Écrire la migration qui retire `UPDATE` et `DELETE` sur `audit_log` à l'utilisateur applicatif (FR-038)

### Briques transverses

- [x] T023 [P] Écrire le générateur d'UUID v7 dans `src/lib/uuid.ts`
- [x] T024 [P] Écrire l'assistant de verrouillage optimiste dans `src/server/repositories/optimistic-lock.ts` (FR-045)
- [x] T025 [P] Écrire les utilitaires de fuseau horaire dans `src/lib/timezone.ts`, dont la dérivation de la date locale d'un terrain (FR-005, FR-044)
- [x] T026 **Écrire la barrière de cloisonnement** dans `src/server/scope/index.ts` : type `Scope` et construction depuis la session vérifiée, jamais depuis une entrée du navigateur (FR-023, FR-024)
- [x] T027 Écrire la base des dépôts dans `src/server/repositories/base.ts`, dont la signature **impose** un `Scope` en premier paramètre — un appel sans portée doit être une erreur de compilation (FR-023)
- [x] T028 Écrire l'écriture du journal dans `src/server/audit/write.ts`, dans la **même transaction** que l'action journalisée (FR-035)
- [x] T029 **Écrire le point d'entrée unique des renseignements personnels** dans `src/server/pii/index.ts` : lecture unitaire seulement, aucune lecture en lot, journalisation systématique (FR-030, FR-036)
- [x] T030 [P] Écrire le hachage de mot de passe par `scrypt` dans `src/server/auth/password.ts`, sans dépendance externe (FR-017)
- [x] T031 Écrire la gestion de session dans `src/server/auth/session.ts` : création, vérification, destruction, et revérification du statut du compte à chaque requête (FR-016)
- [x] T032 [P] Écrire les classes d'erreur et leur traitement dans `src/server/errors.ts` : identifiant de corrélation, **aucune donnée personnelle** dans les traces (FR-031)

### Données de test

- [x] T033 Créer les jeux de données fictifs dans `fixtures/` : 2 terrains, 4 comptes dont un rattaché aux deux terrains, 6 caddies dont un désactivé, 4 voiturettes (principe II)
- [x] T034 [P] Écrire l'utilitaire de réinitialisation de la base de test dans `tests/helpers/reset-db.ts`

**Checkpoint** : socle prêt. Les parcours utilisateurs peuvent démarrer.

---

## Phase 3: User Story 1 — Créer et configurer un terrain (Priority: P1) 🎯 MVP

**Goal** : un administrateur enregistre et configure un terrain de golf, conteneur de tout le reste.

**Independent Test** : créer un terrain de test entièrement configuré et le retrouver dans la liste avec ses valeurs exactes — scénario V-1.

### Tests

> Écrire ces tests **d'abord** et vérifier qu'ils échouent avant l'implémentation.

- [x] T035 [P] [US1] Test d'intégration de création, lecture, modification et archivage d'un terrain dans `tests/integration/golf-course.test.ts`
- [x] T036 [P] [US1] Test de validation : nom manquant refusé, fuseau IANA invalide refusé dans `tests/integration/golf-course-validation.test.ts`
- [x] T037 [P] [US1] Test d'affichage des dates dans le fuseau du terrain et non celui du navigateur dans `tests/unit/timezone.test.ts`

### Implementation

- [x] T038 [US1] Écrire le dépôt des terrains dans `src/server/repositories/golf-course.ts`
- [x] T039 [US1] Écrire le service des terrains dans `src/server/services/golf-course.ts` : création, modification avec verrouillage optimiste, archivage, journalisation (FR-001 à FR-006)
- [x] T040 [P] [US1] Écrire la validation et le stockage du logo dans `src/server/services/logo-upload.ts` : formats et taille limités, refus explicite
- [x] T041 [US1] Écrire la liste des terrains dans `src/app/(admin)/terrains/page.tsx`
- [x] T042 [US1] Écrire le formulaire de création et de modification dans `src/app/(admin)/terrains/[id]/page.tsx`, dont le lien Google Reviews (FR-007)

**Checkpoint** : V-1 passe. Un terrain peut être créé et configuré.

---

## Phase 4: User Story 2 — Comptes et rattachements (Priority: P1)

**Goal** : créer des comptes Administrateur et Starter, les rattacher à des terrains, et garantir qu'aucun terrain ne perd son dernier administrateur.

**Independent Test** : créer un compte Starter rattaché à un seul terrain, s'y connecter, constater que ce terrain est sélectionné d'office — scénario V-2.

### Tests

- [x] T043 [P] [US2] Test de création de compte et de refus d'une adresse déjà utilisée dans `tests/integration/account.test.ts`
- [x] T044 [P] [US2] **Test de l'invariant du dernier administrateur** : désactivation et détachement refusés, dans `tests/integration/last-admin.test.ts` (FR-015)
- [x] T045 [P] [US2] Test de sélection du terrain : automatique avec un seul rattachement, écran de choix avec plusieurs, dans `tests/integration/course-selection.test.ts`
- [x] T046 [P] [US2] Test d'interruption de session dès la désactivation du compte dans `tests/integration/session-revocation.test.ts` (FR-016)

### Implementation

- [x] T047 [US2] Écrire le dépôt des comptes dans `src/server/repositories/account.ts`, excluant **toujours** `password_hash` des lectures
- [x] T048 [US2] Écrire le service des comptes dans `src/server/services/account.ts`, avec la vérification transactionnelle du dernier administrateur (FR-015)
- [x] T049 [US2] Écrire la gestion des rattachements dans `src/server/services/account-course.ts`, détachement refusé s'il laisse un terrain orphelin
- [x] T050 [US2] Écrire l'écran de connexion dans `src/app/(auth)/connexion/page.tsx`, avec un message d'échec **identique** que l'adresse soit inconnue ou le mot de passe faux
- [x] T051 [US2] Écrire le sélecteur de terrain actif dans `src/components/course-switcher.tsx`, terrain actif visible en permanence (FR-013)
- [x] T052 [US2] Écrire la gestion des comptes dans `src/app/(admin)/comptes/page.tsx`

**Checkpoint** : V-2, V-7 et V-9 passent.

---

## Phase 5: User Story 3 — Cloisonnement infranchissable (Priority: P1) ⚠️ *critique*

**Goal** : rendre impossible l'accès aux données d'un terrain non rattaché, quel que soit le chemin emprunté.

**Independent Test** : depuis un compte rattaché au seul terrain A, tenter d'atteindre une donnée du terrain B par manipulation directe d'identifiant — scénario V-3.

### Tests

- [x] T053 [P] [US3] Test de lecture inter-terrains refusée, sur caddie, voiturette et journal, dans `tests/integration/isolation/cross-course-read.test.ts`
- [x] T054 [P] [US3] Test d'écriture inter-terrains refusée dans `tests/integration/isolation/cross-course-write.test.ts`
- [x] T055 [P] [US3] Test vérifiant qu'aucune liste ne laisse apparaître un élément d'un autre terrain dans `tests/integration/isolation/list-leakage.test.ts`
- [x] T056 [P] [US3] **Test au niveau de la base** : une clé étrangère composite refuse une affectation reliant deux terrains, dans `tests/integration/isolation/composite-fk.test.ts`
- [x] T057 [P] [US3] Test vérifiant que la réponse pour une ressource d'un autre terrain est **indiscernable** d'une ressource inexistante, dans `tests/integration/isolation/not-found-parity.test.ts` (FR-025)

### Implementation

- [x] T058 [US3] Écrire l'intercepteur de portée dans `src/middleware.ts` et `src/server/scope/guard.ts`, appliqué à **toutes** les routes serveur
- [x] T059 [US3] Écrire la normalisation des réponses « introuvable » dans `src/server/errors.ts`, pour ne jamais révéler l'existence d'une ressource (FR-022, FR-025)
- [x] T060 [US3] Écrire le test de conformité de la couche d'accès dans `tests/integration/isolation/scope-coverage.test.ts` : **échoue si une seule fonction de dépôt est appelable sans portée**
- [x] T061 [US3] Écrire la réinitialisation de l'état à l'écran lors du changement de terrain actif dans `src/components/course-switcher.tsx` (FR-027)

**Checkpoint** : V-3 passe. Ce test devient permanent.

---

## Phase 6: User Story 4 — Le Starter ne voit aucune donnée personnelle (Priority: P1) ⚠️ *critique*

**Goal** : garantir qu'un compte Starter ne reçoit jamais de donnée personnelle, ni à l'écran ni dans les échanges réseau.

**Independent Test** : capturer **toutes** les réponses réseau d'une journée de travail simulée d'un Starter — scénario V-4.

### Tests

- [x] T062 [P] [US4] **Test Playwright de capture réseau intégrale** sur une journée de Starter dans `tests/e2e/starter-no-pii.spec.ts` : échoue si une année de naissance, une note, un commentaire ou un jeton de QR code apparaît, **même non affiché** (SC-004)
- [x] T063 [P] [US4] Test d'accès direct aux renseignements personnels par un Starter, refusé comme si le caddie n'existait pas, dans `tests/integration/pii/starter-denied.test.ts`
- [x] T064 [P] [US4] Test de la matrice complète des permissions dans `tests/integration/permissions/matrix.test.ts` (FR-018, FR-019, FR-020)
- [x] T065 [P] [US4] Test vérifiant l'absence de colonne interdite dans le schéma, et l'échec d'insertion d'une taille d'habits, d'une adresse ou d'une force, dans `tests/integration/pii/schema-forbids.test.ts` (V-5)

### Implementation

- [x] T066 [US4] Écrire les projections destinées au Starter dans `src/server/serializers/starter.ts` : liste blanche de champs, jamais liste noire
- [x] T067 [US4] Écrire le garde de rôle dans `src/server/auth/require-role.ts` (FR-021)
- [x] T068 [US4] Écrire la mise en page et les routes du Starter dans `src/app/(starter)/`

**Checkpoint** : V-4 et V-5 passent. Ces tests deviennent permanents.

---

## Phase 7: User Story 5 — Journal des actions et consultations (Priority: P2)

**Goal** : tracer chaque action administrative et chaque consultation sensible, sans jamais journaliser de donnée personnelle.

**Independent Test** : modifier un terrain, consulter une année de naissance, retrouver les deux au journal — scénario V-6.

### Tests

- [x] T069 [P] [US5] Test vérifiant que chaque mutation administrative produit une entrée de journal dans `tests/integration/audit/coverage.test.ts`
- [x] T070 [P] [US5] Test vérifiant qu'**aucune** entrée de journal ne contient de donnée personnelle dans `tests/integration/audit/no-pii.test.ts` (FR-037)
- [x] T071 [P] [US5] Test vérifiant que PostgreSQL refuse la modification et la suppression d'une entrée dans `tests/integration/audit/immutable.test.ts` (FR-038)

### Implementation

- [x] T072 [US5] Brancher l'écriture du journal sur toutes les mutations de `src/server/services/golf-course.ts`, `src/server/services/account.ts` et `src/server/services/account-course.ts`
- [x] T073 [US5] Écrire la consultation du journal dans `src/app/(admin)/journal/page.tsx`, avec filtres par auteur, nature d'action et période (FR-039)

**Checkpoint** : V-6 passe.

---

## Phase 8: User Story 6 — Corriger ou effacer les renseignements personnels (Priority: P3)

**Goal** : permettre la correction et l'effacement des renseignements personnels sans détruire l'historique ni fausser les statistiques.

**Independent Test** : effacer les renseignements d'un caddie porteur d'historique, puis vérifier que les moyennes du terrain sont inchangées — scénario V-8.

### Tests

- [x] T074 [P] [US6] Test de correction d'une année de naissance et de sa journalisation dans `tests/integration/pii/correction.test.ts`
- [x] T075 [P] [US6] **Test d'effacement** : les renseignements disparaissent, les affectations et évaluations demeurent, les moyennes sont strictement identiques, dans `tests/integration/pii/erasure.test.ts` (SC-009)
- [x] T076 [P] [US6] Test de la purge à échéance : le commentaire est vidé, l'évaluation chiffrée subsiste, dans `tests/integration/retention.test.ts` (FR-034, FR-034c)

### Implementation

- [x] T077 [US6] Écrire la correction et l'effacement dans `src/server/pii/mutate.ts`, journalisés
- [x] T078 [US6] Écrire l'écran de consultation et de correction dans `src/app/(admin)/caddies/[id]/donnees-personnelles/page.tsx`
- [x] T079 [US6] Écrire le traitement de purge à échéance dans `src/server/jobs/retention.ts` : année de naissance 2 ans après désactivation, commentaires 2 ans après dépôt (FR-034, FR-034b)

**Checkpoint** : V-8 passe.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T080 [P] Écrire l'analyse automatisée du dépôt dans `tests/integration/no-real-data.test.ts` : aucun CSV hors `fixtures/`, aucun `.env` versionné (V-12, FR-046)
- [ ] T081 [P] Écrire le script d'amorçage des données fictives dans `scripts/seed.ts`
- [ ] T082 Mesurer le critère de performance SC-008 dans `tests/e2e/performance.spec.ts` : écrans d'exploitation sous 2 secondes avec 5 terrains, 100 caddies et 300 départs
- [ ] T083 [P] Vérifier l'accessibilité et le rendu mobile dans `tests/e2e/accessibility.spec.ts` pour les écrans de `src/app/(admin)/` et `src/app/(starter)/`
- [ ] T084 [P] Rédiger `README.md` : installation, bases de données, exécution des tests, **sans aucune donnée réelle**
- [ ] T085 Exécuter les 12 scénarios de `quickstart.md` et présenter leurs résultats réels, échecs compris (principe VI)

---

## Dependencies

```text
Phase 1 (Setup)
   └─> Phase 2 (Foundational) ── BLOQUANTE
          ├─> Phase 3 (US1 · terrains)
          ├─> Phase 4 (US2 · comptes)       ── dépend de US1 pour un terrain d'essai
          ├─> Phase 5 (US3 · cloisonnement) ── dépend de US1 et US2
          ├─> Phase 6 (US4 · Starter)       ── dépend de US2 et US3
          ├─> Phase 7 (US5 · journal)       ── dépend de US1 et US2
          └─> Phase 8 (US6 · effacement)    ── dépend de US4
                 └─> Phase 9 (Polish)
```

**Note honnête sur l'indépendance** : les parcours US3 à US6 ne sont pas strictement indépendants, contrairement à l'idéal du gabarit. C'est inhérent au sujet — on ne teste pas un cloisonnement sans avoir au moins deux terrains et deux comptes. Prétendre le contraire produirait un découpage artificiel.

## Parallel Execution

| Phase | Tâches parallélisables |
|---|---|
| 1 | T002, T003, T004, T007 |
| 2 | T011 à T014, T016, T017, T019 (fichiers de schéma distincts) puis T023, T024, T025, T030, T032, T034 |
| 3 | T035, T036, T037 (tests) puis T040 |
| 4 | T043 à T046 (tests) |
| 5 | T053 à T057 (tests) |
| 6 | T062 à T065 (tests) |
| 7 | T069, T070, T071 (tests) |
| 8 | T074, T075, T076 (tests) |
| 9 | T080, T081, T083, T084 |

## Implementation Strategy

**MVP** : phases 1 à 3. Elles livrent un produit démontrable — un administrateur crée et configure un terrain — et prouvent que le socle tient.

**Incrément suivant** : phases 4 et 5. À leur terme, le produit est multi-terrains et cloisonné, ce qui est la promesse centrale.

**Puis** : phase 6, qui rend le Starter utilisable en sécurité, condition du pilote sur le terrain.

**Ordre imposé par la constitution** : les tests des phases 5, 6 et 9 (T053 à T057, T062 à T065, T080) deviennent **permanents** et sont rejoués à chaque phase ultérieure du projet. Ils protègent les trois principes non négociables.
