# Specification Quality Checklist: Scores, KPI et rapports

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-18
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain — **3 restants**, voir Q1 à Q3 ci-dessous
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

## Cohérence avec la spécification 001

- [x] Aucune entité, aucun champ, aucune règle de calcul du modèle de référence n'est redéfini
- [x] Les lacunes constatées sont remontées dans « Évolutions demandées à la spéc. 001 » plutôt que comblées localement
- [x] Les formules décrites correspondent au code déjà implémenté (`calculerScore`, `joursTravailles`)

## Conformité constitutionnelle

- [x] Principe I — aucune donnée personnelle dans les rapports ni les exports
- [x] Principe I — les évaluations restent anonymes, y compris sur une période courte à faible volume
- [x] Principe IV — toute agrégation est cloisonnée par terrain ; aucune moyenne ne mélange deux parcours
- [x] FR-020 — le Starter n'accède ni aux rapports, ni aux notes, ni aux commentaires

## Questions en attente d'arbitrage

| # | Question | Recommandation | Avantage |
|---|---|---|---|
| **Q1** | Dénominateur du taux de réponse : affectations terminées, ou voiturettes affectées ? | **Affectations terminées** | Une affectation terminée correspond à une partie réellement jouée, donc à une occasion réelle d'évaluer. Le nombre de voiturettes gonflerait le dénominateur sans rapport avec le service rendu. |
| **Q2** | Un classement des caddies entre eux doit-il être visible ? | **Non — seule la comparaison à la moyenne** | Un classement transforme une mesure en compétition, et un écart d'un centième sépare alors deux rangs. La comparaison à la moyenne dit la même chose sans créer de hiérarchie affichée. |
| **Q3** | Historique figé des scores, ou recalcul à la demande ? | **Recalcul à la demande** | Un score figé devient faux dès qu'un commentaire est purgé ou une évaluation corrigée. Le recalcul garantit qu'un rapport dit toujours ce que disent les données actuelles. Le volume — 110 000 départs par an — ne justifie aucune pré-agrégation. |

## Notes

- **Itération 1 (2026-09-18)** : 16 items sur 17 du bloc standard passent. L'unique échec porte sur les 3 marqueurs [NEEDS CLARIFICATION], présentés ci-dessus avec une recommandation chacun.
- La rédaction a été interrompue par une limite de quota avant l'écriture de cette liste ; la spécification elle-même était complète, et cette liste a été établie par relecture.
- **La spécification n'est pas prête pour `/speckit-plan`** tant que Q1 à Q3 ne sont pas tranchées, conformément au principe V de la constitution.
- Le seuil de pertinence statistique (5 évaluations) et le format d'export (CSV seul) sont des **décisions arrêtées**, non des questions ouvertes.
