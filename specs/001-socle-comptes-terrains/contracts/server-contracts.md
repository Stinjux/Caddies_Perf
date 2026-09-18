# Phase 1 — Contrats d'interface serveur

**Feature**: Socle — données, comptes et terrains | **Date**: 2026-09-18

Ce document décrit les **frontières** du socle : ce que le serveur expose, ce qu'il exige en entrée, et ce qu'il refuse. Il ne contient pas de code d'implémentation.

---

## 1. Contrat de portée — la barrière de cloisonnement

**C'est le contrat le plus important du produit.** Toute lecture et toute écriture y passe.

### Objet de portée

Un objet de portée est produit **uniquement** par la vérification de session côté serveur. Il ne peut jamais être fabriqué à partir d'une donnée venue du navigateur.

Il porte : l'identifiant du compte, l'identifiant du terrain actif, et le rôle du compte **sur ce terrain**.

### Règle d'application

Toute fonction d'accès aux données prend un objet de portée en premier paramètre. Le système de types refuse la compilation d'un appel qui l'omet : ce n'est pas une convention à respecter, c'est une impossibilité.

### Invariants garantis

| # | Garantie | Exigence |
|---|---|---|
| P-1 | Le terrain actif appartient toujours aux rattachements du compte | FR-012 |
| P-2 | Un identifiant de terrain venu du navigateur n'est jamais utilisé pour décider d'un droit | FR-024 |
| P-3 | Toute requête filtre sur le terrain de la portée | FR-023 |
| P-4 | Une portée dont le compte est passé à `disabled` est invalide dès la requête suivante | FR-016 |
| P-5 | Une ressource d'un autre terrain est traitée comme inexistante, jamais comme interdite | FR-025 |

### Comportements d'erreur

| Situation | Réponse | Ce qui n'est jamais révélé |
|---|---|---|
| Aucune session | Redirection vers la connexion | — |
| Session expirée ou compte désactivé | Session détruite, redirection | La raison précise |
| Terrain actif non rattaché | Session invalidée | Que le terrain existe |
| Ressource d'un autre terrain | Traitée comme introuvable | Son existence (FR-025) |
| Rôle insuffisant | Refus | Le contenu ou l'existence de la ressource (FR-022) |

---

## 2. Contrat d'accès aux renseignements personnels

**Un seul point d'entrée dans tout le code.** Aucune autre fonction ne lit `caddie_personal_data`.

### Opérations exposées

| Opération | Rôle requis | Effet secondaire obligatoire |
|---|---|---|
| Lire l'année de naissance d'**un** caddie | `admin` | Écrit `pii.read` dans le journal |
| Écrire ou corriger l'année de naissance | `admin` | Écrit `pii.write` dans le journal |
| Effacer les renseignements personnels | `admin` | Écrit `pii.erase` dans le journal |

### Interdictions structurelles

- **Aucune lecture en lot.** L'interface n'expose pas d'opération renvoyant les années de naissance de plusieurs caddies. Un export massif est donc impossible, pas seulement découragé.
- **Aucune jointure.** Les requêtes de liste de caddies ne touchent jamais cette table.
- **Journalisation non contournable.** L'écriture du journal fait partie de la même transaction que la lecture : elles réussissent ou échouent ensemble.
- **Refus opaque pour un Starter.** Un compte `starter` reçoit la même réponse que si le caddie n'existait pas (FR-020, FR-030).

---

## 3. Contrat des terrains

| Opération | Rôle | Règles de validation |
|---|---|---|
| Lister les terrains rattachés | tous | Limitée aux rattachements du compte |
| Consulter un terrain | tous | Terrain actif de la portée uniquement |
| Créer un terrain | `admin` | `name` et `timezone` obligatoires ; `timezone` doit être un identifiant IANA valide (FR-004) |
| Modifier un terrain | `admin` | Verrouillage optimiste par `version` ; journalisé |
| Archiver un terrain | `admin` | Refusé si c'est le dernier terrain actif du compte ; jamais de suppression physique (FR-006) |
| Téléverser un logo | `admin` | Formats et taille limités ; refus explicite sinon |

**Erreurs** : champ obligatoire manquant, fuseau horaire invalide, version périmée (invitation à recharger, FR-045), format de logo refusé.

---

## 4. Contrat des comptes

| Opération | Rôle | Règles de validation |
|---|---|---|
| Lister les comptes du terrain | `admin` | Sans jamais renvoyer le haché de mot de passe |
| Créer un compte | `admin` | Adresse électronique unique globalement (FR-011) ; au moins un rattachement obligatoire (FR-010) |
| Modifier un compte | `admin` | Verrouillage optimiste ; journalisé |
| Désactiver un compte | `admin` | **Refusé** s'il s'agit du dernier administrateur actif du terrain (FR-015) ; détruit ses sessions |
| Réactiver un compte | `admin` | Journalisé |
| Rattacher ou détacher un terrain | `admin` | Détachement **refusé** s'il laisse le terrain sans administrateur actif |
| Réinitialiser un mot de passe | `admin` | Journalisé ; aucune valeur de mot de passe dans le journal |

**Invariant à vérifier en transaction** : avant toute désactivation ou détachement, le système compte les administrateurs actifs restants du terrain. Si le compte tombe à zéro, la transaction est annulée.

---

## 5. Contrat d'authentification

| Opération | Entrée | Sortie |
|---|---|---|
| Connexion | Adresse électronique, mot de passe | Cookie de session `HttpOnly`, `Secure`, `SameSite=Lax` |
| Choix du terrain actif | Identifiant de terrain | Portée mise à jour, après vérification du rattachement |
| Déconnexion | — | Session détruite |

**Règles** :

- Un échec de connexion produit **le même message** que l'adresse soit inconnue ou le mot de passe faux, pour ne pas révéler quels comptes existent.
- Le mot de passe n'apparaît jamais dans un journal, une trace d'erreur ou une réponse.
- Le jeton en clair ne vit que dans le cookie ; la base ne stocke que son haché.
- Un compte rattaché à un seul terrain le reçoit d'office, sans écran de choix (FR-012).

---

## 6. Contrat du journal

| Opération | Rôle | Règles |
|---|---|---|
| Écrire une entrée | interne | Dans la même transaction que l'action journalisée |
| Consulter le journal | `admin` | Limité au terrain actif ; filtres par auteur, nature, période (FR-039) |

**Interdictions** : aucune opération de modification ni de suppression n'est exposée, et le droit correspondant est retiré à l'utilisateur de base (FR-038). Aucune valeur métier n'entre dans une entrée : uniquement des identifiants internes (FR-037).

---

## 7. Contrat de non-exposition pour le Starter

Ce contrat définit **exactement** ce qu'un compte Starter peut recevoir. Il est vérifié par des tests de bout en bout inspectant les échanges réseau réels, pas seulement l'écran.

### Champs autorisés

| Depuis | Champs |
|---|---|
| Caddie | identifiant interne, prénom, nom, disponibilité |
| Voiturette | numéro visible, statut |
| Réservation | numéro de réservation, heure de départ |
| Affectation | caddie, voiturette, réservation, heure de début, statut |

### Champs interdits, en toutes circonstances

Année de naissance · taille d'habits · adresse du domicile · notes et scores · commentaires clients · rapports de performance · jeton de QR code · données d'un autre terrain.

**Méthode de vérification** : un parcours Playwright simule une journée de travail complète d'un Starter et capture **toutes** les réponses réseau. Le test échoue si une seule des valeurs interdites y apparaît, même sans être affichée à l'écran. C'est ce qui distingue une interdiction réelle d'un simple masquage visuel.

---

## 8. Comportements d'erreur communs

| Classe | Réponse utilisateur | Journalisation |
|---|---|---|
| Validation | Message nommant le champ fautif | Non |
| Permission refusée | Message neutre, sans révéler l'existence | Oui |
| Ressource d'un autre terrain | Traitée comme introuvable | Oui |
| Conflit de version | « Cette fiche a été modifiée, rechargez » | Non |
| Invariant violé (dernier administrateur) | Message expliquant la raison du refus | Oui |
| Erreur technique | Message générique, identifiant de corrélation | Oui, **sans donnée personnelle** (FR-031) |
