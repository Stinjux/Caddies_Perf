# Specification Quality Checklist: Réservations et affectations — l'écran du Starter

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-18
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Cohérence avec la spécification 1

- [x] Aucune entité de la spéc. 1 n'est redéfinie — `booking`, `assignment`, `cart` et `caddie` sont uniquement référencées
- [x] Aucun champ nouveau n'est introduit localement
- [x] Aucune règle de calcul de la spéc. 1 n'est réécrite — le jour travaillé reste défini par FR-044
- [x] Les lacunes constatées du modèle sont consignées dans « Évolutions demandées à la spécification 1 » au lieu d'être comblées ici
- [x] La numérotation des exigences commence à FR-201 et des critères à SC-201, sans collision avec la spéc. 1

## Conformité constitutionnelle

- [x] Principe I — minimisation des données personnelles : FR-218, FR-220, FR-249, FR-257 et SC-210 bornent strictement ce que reçoit le Starter
- [x] Principe II — aucune donnée réelle hors production : les volumes et exemples cités sont fictifs, aucun nom ni numéro réel n'apparaît
- [x] Principe IV — cloisonnement par terrain : FR-208, FR-225, FR-258, FR-260 et SC-205
- [x] Contrat de non-exposition pour le Starter appliqué sans assouplissement, et vérifié par FR-261

## Couverture des cas exigés par le propriétaire du produit

- [x] Aucune affectation active — Edge case 1, FR-253, parcours 6
- [x] Plusieurs affectations trouvées — Edge case 2, FR-254, parcours 6
- [x] Mauvais caddie affiché — Edge case 3, FR-234, parcours 3
- [x] Changement de caddie en cours de partie — Edge case 4, FR-234, FR-237, parcours 3
- [x] Changement de voiturette — Edge case 5, FR-235, FR-236, parcours 3
- [x] Réservation annulée — Edge case 6, FR-213, FR-214, FR-256
- [x] Voiturette indisponible — Edge case 7, FR-246, FR-248, FR-256
- [x] Partie terminée depuis trop longtemps — Edge case 8, FR-255 *(délai encore inconnu, marqueur en place)*

## Notes

- **Itération 1 (2026-09-18)** : 16 items de qualité sur 17 passent. Seul échec : les 3 marqueurs [NEEDS CLARIFICATION] subsistants, soumis au propriétaire du produit sous forme de questions Q1 à Q3.

  - **Q1 (FR-203)** — Quelles colonnes l'export CSV du système de réservation contient-il exactement, dans quel ordre, et lesquelles sont obligatoires ? Un exemple de fichier réel anonymisé suffirait à trancher.
  - **Q2 (FR-233)** — Un même départ peut-il comporter plusieurs caddies et plusieurs voiturettes, par exemple une partie à quatre joueurs ? Si oui, combien d'affectations distinctes cela produit-il pour une même réservation ?
  - **Q3 (FR-255)** — Au bout de combien de temps après l'heure de fin une partie est-elle considérée « terminée depuis trop longtemps » pour qu'un client puisse encore répondre au questionnaire ?

- **Deux points ouverts ont été traités par hypothèse documentée** plutôt que par marqueur, afin de respecter la limite de trois : la **fréquence de l'import** (manuel, au moins une fois le matin, rejouable sans risque car idempotent) et le **traitement d'une réservation réimportée portant déjà une affectation** (l'affectation active prime, la divergence est signalée en conflit — FR-211). Les deux figurent dans la section Assumptions et restent modifiables avant le début du développement.

- **61 exigences fonctionnelles** (FR-201 à FR-261), **12 critères de succès** (SC-201 à SC-212), **7 parcours utilisateurs** priorisés et **16 cas limites**.

- **Cinq évolutions sont demandées à la spécification 1** et ne doivent pas être introduites localement : disponibilité opérationnelle d'un caddie distincte de son cycle de vie, traçabilité d'un remplacement de caddie ou de voiturette, traçabilité d'un lot d'import, relation réservation ↔ affectations multiples si Q2 est positive, et emplacement du délai de clôture d'une partie dans les paramètres du terrain. Tant qu'elles ne sont pas arbitrées, FR-237, FR-245 et FR-247 ne sont pas implémentables en l'état.

- **Le parcours 1 est le cœur du produit.** SC-201 (20 secondes pour créer une affectation sur le départ) est le critère le plus discriminant de cette spécification : il doit être mesuré sur un appareil réel, debout, en extérieur, et non sur un poste de bureau.

- **Prochaine étape** : `/speckit-clarify` pour lever Q1 à Q3, puis nouvelle passe de cette liste de contrôle avant `/speckit-plan`. La spécification n'est pas encore prête pour la planification.
