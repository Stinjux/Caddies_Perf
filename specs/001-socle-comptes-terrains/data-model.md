# Phase 1 — Modèle de données de référence

**Feature**: Socle — données, comptes et terrains | **Date**: 2026-09-18

Ce document traduit la section « Key Entities » de [spec.md](./spec.md) en schéma concret. **Il fait autorité pour l'ensemble du produit.** Les spécifications 2 à 5 s'y réfèrent et n'y ajoutent rien sans passer par la spécification 1.

## Conventions transversales

- **Identifiants** : chaque table porte un `id` de type UUID v7, généré par l'application. Ordonnable dans le temps, non devinable, et sans révéler de volume — contrairement à une séquence entière.
- **Cloisonnement** : toute table opérationnelle porte `golf_course_id NOT NULL`. Les clés étrangères entre tables opérationnelles sont **composites** `(golf_course_id, id)`, rendant structurellement impossible qu'une ligne référence une ligne d'un autre terrain.
- **Horodatage** : `created_at` et `updated_at` en `timestamptz`, toujours en UTC. La date locale du terrain est dérivée à la lecture, jamais stockée.
- **Concurrence** : colonne `version INTEGER NOT NULL DEFAULT 1` sur les tables modifiables, incrémentée à chaque écriture (FR-045).
- **Cycle de vie** : aucune suppression physique. Les entités portent un statut permettant l'archivage ou la désactivation, conformément aux exigences FR-006, FR-014 et FR-042.

---

## Tables

### `golf_course` — Terrain

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `id` | uuid | PK | FR-002 |
| `name` | text | NOT NULL | FR-004 |
| `address` | text | | FR-003 |
| `timezone` | text | NOT NULL, IANA valide | FR-004, FR-005 |
| `logo_path` | text | | FR-003 |
| `brand_color_primary` | text | format hexadécimal | FR-003 |
| `brand_color_secondary` | text | format hexadécimal | FR-003 |
| `google_review_url` | text | | FR-007 |
| `settings` | jsonb | NOT NULL DEFAULT `{}` | FR-003 |
| `status` | enum | `active` \| `archived` | FR-006 |
| `created_at`, `updated_at`, `version` | | | FR-045 |

**Règles** : `name` et `timezone` obligatoires à la création. Un terrain portant des données historiques passe à `archived`, jamais supprimé. Contrainte d'unicité sur `(id)` seule ; le nom peut être dupliqué entre terrains sans conséquence.

*Exemple fictif* : `Golf des Cèdres` · `Africa/Casablanca` · `#1B4D3E` / `#D4AF37`

---

### `account` — Compte utilisateur

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `id` | uuid | PK | |
| `email` | citext | **UNIQUE** globalement | FR-011 |
| `first_name`, `last_name` | text | NOT NULL | |
| `password_hash` | text | NOT NULL, scrypt | FR-017 |
| `status` | enum | `active` \| `disabled` | FR-014 |
| `created_at`, `updated_at`, `version` | | | |

**Règles** : `password_hash` n'est jamais renvoyé par aucune requête de lecture — exclu au niveau de la couche d'accès, pas seulement à l'affichage. Un compte `disabled` conserve toutes ses entrées de journal (FR-014).

**Pas de colonne `role`** : le rôle appartient au rattachement, non au compte — voir ci-dessous.

---

### `account_golf_course` — Rattachement compte ↔ terrain

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `account_id` | uuid | FK → `account` | FR-010 |
| `golf_course_id` | uuid | FK → `golf_course` | FR-010 |
| `role` | enum | `admin` \| `starter` | FR-008 |
| `created_at` | | | |

**Clé primaire** : `(account_id, golf_course_id)`.

**Décision de conception** : le rôle est porté par le rattachement et non par le compte, afin qu'une même personne puisse être administrateur sur un terrain et Starter sur un autre. Cela coûte zéro complexité supplémentaire aujourd'hui et évite une migration douloureuse le jour où le cas se présentera.

**Invariant critique (FR-015)** : chaque `golf_course` en statut `active` compte au moins un rattachement `admin` dont le compte est `active`. Vérifié par une transaction avant toute désactivation ou détachement ; **aucune** opération ne peut laisser un terrain orphelin.

---

### `session` — Session authentifiée

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `id` | uuid | PK | |
| `token_hash` | text | UNIQUE, NOT NULL | |
| `account_id` | uuid | FK → `account` | |
| `active_golf_course_id` | uuid | FK → `golf_course`, NULL tant qu'aucun terrain n'est choisi | FR-012 |
| `expires_at` | timestamptz | NOT NULL | |
| `created_at`, `last_seen_at` | | | FR-016 |

**Règles** : seul le **haché** du jeton est stocké ; le jeton en clair ne vit que dans le cookie. À chaque requête, le statut du compte est revérifié : une session dont le compte est passé à `disabled` est détruite immédiatement (FR-016). `active_golf_course_id` doit correspondre à un rattachement existant, sans quoi la session est invalide.

---

### `caddie` — Identité professionnelle

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `id` | uuid | PK | |
| `golf_course_id` | uuid | NOT NULL, FK | FR-040 |
| `internal_ref` | text | NOT NULL, UNIQUE sur `(golf_course_id, internal_ref)` | FR-041 |
| `first_name`, `last_name` | text | NOT NULL | |
| `seniority_years` | integer | ≥ 0 | FR-041b |
| `seniority_recorded_on` | date | NOT NULL si `seniority_years` renseigné | FR-041b |
| `status` | enum | `active` \| `disabled` | FR-042 |
| `created_at`, `updated_at`, `version` | | | |

**Aucune colonne pour la taille d'habits, l'adresse du domicile, l'âge ou la force.** Le schéma est structurellement incapable de les recevoir (FR-028, FR-028b).

**Règles** : `internal_ref` n'est jamais réattribué, même après désactivation (FR-041). Un caddie `disabled` conserve l'intégralité de ses affectations et évaluations (FR-042). L'ancienneté ne se recalcule pas d'elle-même : elle porte la date de sa saisie pour rester interprétable (FR-041b).

**Clé unique composite** `(golf_course_id, id)` : cible des clés étrangères composites venant de `assignment`.

---

### `caddie_personal_data` — Renseignements personnels *(accès restreint)*

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `caddie_id` | uuid | **PK**, FK → `caddie` | FR-029 |
| `birth_year` | integer | entre 1940 et l'année courante moins 15 | FR-029 |
| `updated_at` | timestamptz | | |

**Une seule colonne de donnée.** Ni taille d'habits, ni adresse, ni date de naissance complète.

**Règles d'accès (FR-030)** :
- Un unique module du code peut lire cette table. Aucune jointure générale, aucune requête de liste ne la traverse.
- Chaque lecture et chaque écriture produit une entrée `audit_log` (FR-036).
- Seul un compte `admin` y accède ; un compte `starter` reçoit un refus sans indication d'existence.
- N'apparaît dans aucun rapport ni export.
- Supprimable indépendamment du caddie, sans toucher à son historique (FR-033).
- Effacement automatique 2 ans après le passage du caddie à `disabled` (FR-034).

---

### `cart` — Voiturette *(mise en œuvre : spéc. 2)*

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `id` | uuid | PK | |
| `golf_course_id` | uuid | NOT NULL, FK | FR-040 |
| `visible_number` | text | NOT NULL, UNIQUE sur `(golf_course_id, visible_number)` | |
| `qr_token` | text | **UNIQUE globalement**, 32 octets aléatoires en base64url | FR-031 |
| `status` | enum | `available` \| `assigned` \| `maintenance` \| `inactive` | |
| `created_at`, `updated_at`, `version` | | | |

**Règles** : `qr_token` est permanent — il survit aux changements de statut et d'affectation. Il ne contient aucune donnée : c'est une valeur aléatoire opaque servant uniquement de clé de recherche côté serveur (FR-031).

---

### `booking` — Réservation *(mise en œuvre : spéc. 3)*

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | uuid | PK |
| `golf_course_id` | uuid | NOT NULL, FK |
| `external_ref` | text | NOT NULL, UNIQUE sur `(golf_course_id, external_ref)` |
| `tee_time` | timestamptz | NOT NULL |
| `status` | enum | `scheduled` \| `cancelled` \| `completed` |
| `source` | enum | `csv_import` \| `manual` |
| `created_at`, `updated_at`, `version` | | |

**Règles** : `external_ref` est le numéro de réservation du système existant du terrain. Un même caddie peut être rattaché à **plusieurs réservations le même jour** — cas confirmé par le propriétaire du produit.

---

### `assignment` — Affectation *(mise en œuvre : spéc. 3)*

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `id` | uuid | PK | |
| `golf_course_id` | uuid | NOT NULL, FK | FR-040 |
| `booking_id` | uuid | FK composite `(golf_course_id, booking_id)` | FR-026 |
| `cart_id` | uuid | FK composite `(golf_course_id, cart_id)` | FR-026 |
| `caddie_id` | uuid | FK composite `(golf_course_id, caddie_id)` | FR-026 |
| `local_date` | date | NOT NULL, dérivée du fuseau du terrain | FR-044 |
| `started_at` | timestamptz | NOT NULL | |
| `ended_at` | timestamptz | NULL tant que l'affectation est en cours | |
| `status` | enum | `active` \| `completed` \| `cancelled` | FR-044 |
| `created_by_account_id` | uuid | FK → `account` | |
| `created_at`, `updated_at`, `version` | | | FR-045 |

**Pivot du produit.** Les clés étrangères composites garantissent qu'une affectation ne peut jamais relier une réservation du terrain A à un caddie du terrain B — la base refuserait l'écriture.

**`local_date`** est calculée à la création à partir de `started_at` et du fuseau du terrain, puis figée. C'est la clé du décompte des jours travaillés.

**Jour travaillé (FR-044)** : notion **dérivée, jamais stockée**. Elle se calcule comme le nombre de `local_date` distinctes où le caddie possède au moins une affectation en statut `completed`. Plusieurs affectations le même jour ne comptent qu'une fois.

---

### `evaluation` — Évaluation anonyme *(mise en œuvre : spéc. 4)*

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `id` | uuid | PK | |
| `golf_course_id` | uuid | NOT NULL, FK | |
| `assignment_id` | uuid | FK composite | |
| `language` | enum | `fr` \| `en` \| `ar` \| `de` \| `es` | |
| `comment` | text | NULL, facultatif | |
| `course_rating` | smallint | 1 à 5, NULL possible | FR-043 |
| `value_for_money` | smallint | 1 à 5, NULL possible | FR-043 |
| `price_perception` | enum | `beaucoup_trop_bas` … `beaucoup_trop_eleve` | FR-043 |
| `submitted_at` | timestamptz | NOT NULL | |
| `comment_purge_at` | timestamptz | `submitted_at` + 2 ans | FR-034 |

**Aucune colonne identifiant le joueur** : ni nom, ni adresse électronique, ni adresse IP, ni empreinte de navigateur (FR-032).

**Séparation des mesures (FR-043)** : `course_rating` appartient au terrain, `value_for_money` et `price_perception` à la perception du prix. Aucune des trois n'entre dans le score du caddie, qui se calcule exclusivement à partir de `evaluation_criterion_answer`.

**Conservation (FR-034, FR-034c)** : à l'échéance de `comment_purge_at`, seul le champ `comment` est vidé. La ligne et les notes chiffrées subsistent sans limite de durée — sans quoi les statistiques historiques s'effaceraient d'elles-mêmes.

---

### `evaluation_criterion_answer` — Réponse par critère *(mise en œuvre : spéc. 4)*

| Colonne | Type | Contraintes |
|---|---|---|
| `evaluation_id` | uuid | FK → `evaluation` |
| `criterion` | enum | `accueil` \| `regles_etiquette` \| `connaissance_parcours` \| `lecture_verts` \| `communication` \| `experience_generale` |
| `rating` | smallint | 1 à 5, **NULL signifie « non applicable »** |

**Clé primaire** : `(evaluation_id, criterion)`.

**Règle centrale** : une valeur `NULL` est **exclue** du calcul des moyennes et ne les abaisse jamais. Les cinq premiers critères forment les compétences ; `experience_generale` est distinct et pondéré séparément (spéc. 5).

---

### `google_review_click` — Clic vers les avis *(mise en œuvre : spéc. 4)*

| Colonne | Type |
|---|---|
| `id` | uuid PK |
| `golf_course_id` | uuid NOT NULL FK |
| `evaluation_id` | uuid NULL |
| `clicked_at` | timestamptz |

**Règle** : mesure le clic, jamais la publication d'un avis. Aucune donnée identifiante.

---

### `audit_log` — Journal en écriture seule

| Colonne | Type | Contraintes | Exigence |
|---|---|---|---|
| `id` | uuid | PK | |
| `golf_course_id` | uuid | NULL pour les actions hors terrain | FR-039 |
| `actor_account_id` | uuid | FK → `account` | FR-035 |
| `action` | text | ex. `course.update`, `pii.read`, `account.disable` | FR-035 |
| `target_type` | text | ex. `caddie`, `golf_course` | FR-035 |
| `target_id` | uuid | identifiant interne uniquement | FR-037 |
| `occurred_at` | timestamptz | NOT NULL | FR-035 |

**Aucune colonne de contenu.** Ni valeur avant/après, ni nom, ni commentaire — uniquement des identifiants internes (FR-037).

**Écriture seule (FR-038)** : l'utilisateur applicatif de la base ne reçoit que `INSERT` et `SELECT` sur cette table. `UPDATE` et `DELETE` lui sont retirés au niveau de PostgreSQL, ce qui rend l'exigence vraie même si le code applicatif est compromis.

**Index** sur `(golf_course_id, occurred_at)`, `(actor_account_id, occurred_at)` et `(action, occurred_at)` pour servir les filtres de FR-039.

---

## Vue d'ensemble des relations

```text
golf_course ──┬── account_golf_course ── account ── session
              ├── caddie ── caddie_personal_data   (accès restreint et journalisé)
              ├── cart
              ├── booking
              ├── assignment ──┬── booking
              │                ├── cart
              │                └── caddie
              ├── evaluation ──┬── assignment
              │                ├── evaluation_criterion_answer
              │                └── google_review_click
              └── audit_log
```

## Transitions d'état

| Entité | États | Transitions permises |
|---|---|---|
| `golf_course` | `active` → `archived` | Archivage uniquement ; aucun retour, aucune suppression |
| `account` | `active` ↔ `disabled` | Réversible ; la désactivation détruit les sessions en cours |
| `caddie` | `active` ↔ `disabled` | Réversible ; l'historique est toujours conservé |
| `cart` | `available` ↔ `assigned` ↔ `maintenance` ↔ `inactive` | `assigned` uniquement via une affectation active |
| `booking` | `scheduled` → `completed` \| `cancelled` | Sans retour arrière |
| `assignment` | `active` → `completed` \| `cancelled` | Seul `completed` alimente le décompte des jours travaillés |

## Ce que le schéma rend impossible

Ces garanties sont structurelles, non conventionnelles. Aucune erreur de développement ne peut les contourner.

1. **Stocker une taille d'habits, une adresse de domicile ou une force** — aucune colonne ne les accueille.
2. **Relier deux terrains** — les clés étrangères composites font échouer l'écriture.
3. **Modifier ou effacer une entrée de journal depuis l'application** — le droit est retiré en base.
4. **Identifier le joueur d'une évaluation** — aucune colonne ne le permet.
5. **Charger une année de naissance par mégarde** — la table est hors de tout chemin de jointure ordinaire.
6. **Écraser silencieusement une modification concurrente** — la colonne `version` refuse l'écriture périmée.
