# Specification Quality Checklist: Questionnaire client, multilingue et avis Google

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

- [x] Aucune entité n'est redéfinie ; la section « Entités référencées » renvoie au modèle de la spéc. 1
- [x] Aucun champ nouveau n'est inventé ; les manques sont signalés dans « Évolutions demandées à la spéc. 001 »
- [x] Aucune règle de calcul n'est redéfinie ; la séparation des trois mesures reprend FR-043 de la spéc. 1
- [x] Les valeurs d'énumération employées — six critères, cinq langues, cinq niveaux de perception du prix — sont celles du modèle de la spéc. 1
- [x] Les durées de conservation reprennent FR-034 et FR-034c de la spéc. 1 sans les modifier

## Conformité constitutionnelle

- [x] Principe I — minimisation : aucune donnée personnelle du joueur n'est recueillie (FR-353 à FR-355)
- [x] Principe I — anonymat des évaluations préservé, y compris pour la reconnaissance d'un appareil ayant déjà répondu (FR-343)
- [x] Principe III — souveraineté : aucun service tiers ne reçoit de données du client, hors renvoi explicite vers Google déclenché par le client (FR-357)
- [x] Principe IV — cloisonnement : la résolution du jeton est serveur seul et chaque évaluation appartient à un seul terrain (FR-303, FR-358)
- [x] Sécurité du parcours client : les cas de résolution exigés par la constitution sont tous couverts (FR-304)
- [x] Expérience client : moins de 30 secondes, cinq langues, arabe de droite à gauche, mobile d'abord, lisible en plein soleil (SC-301, FR-314 à FR-316, FR-359 à FR-363)
- [x] Approbation des traductions par le propriétaire du produit exigée explicitement avant intégration (FR-319)
- [x] Séparation des mesures : le score du caddie, la note du parcours et la valeur perçue restent distincts (FR-329, FR-332, FR-333, SC-307)
- [x] Réponses « Non applicable » exclues des moyennes et ne les abaissant jamais (FR-325, SC-308)

## Notes

- **Itération 1 (2026-09-18)** : 16 items sur 17 passent dans les trois sections du gabarit. Seul échec : la présence de **3 marqueurs [NEEDS CLARIFICATION]**, qui constituent les questions à poser au propriétaire du produit avant `/speckit-plan`.

- **Les 3 questions ouvertes** :
  - **Q1 — FR-307** : au bout de combien de temps après la fin d'une partie le QR code cesse-t-il d'accepter une évaluation ? *Recommandation : fin de la journée locale du terrain. Avantage : simple à expliquer au client, robuste aux parties qui s'éternisent, et sans risque d'accepter une évaluation le lendemain pour la voiturette réaffectée.*
  - **Q2 — FR-334** : le prix de 200 MAD est-il fixe pour tous les terrains, ou paramétrable par terrain ? *Recommandation : paramétrable par terrain dès le départ. Avantage : le produit est multi-terrains depuis le premier jour ; figer le montant obligerait à une migration dès le deuxième terrain.*
  - **Q3 — FR-342** : combien de réponses au maximum accepte-t-on pour une même affectation ? *Recommandation : un plafond de 4, correspondant à un flight complet. Avantage : couvre le cas légitime décrit par le propriétaire du produit tout en bornant les envois répétés.*

- **Quatrième point d'incertitude traité par valeur par défaut** : le retour en arrière dans le questionnaire a été tranché dans la section Assumptions — le client peut corriger ses réponses tant qu'il n'a pas envoyé — plutôt que par un quatrième marqueur, conformément à la limite de 3 marqueurs.

- **Trois évolutions sont demandées à la spécification 1** et doivent être tranchées par elle, non ici :
  1. Mémoriser le tarif présenté au client au moment de la réponse — bloquant pour l'interprétation durable de FR-330 et FR-331.
  2. Consigner un signalement d'affectation contestée — **FR-313 ne peut pas être satisfaite** tant qu'aucune entité n'accueille ce signal.
  3. Clarifier si un clic Google sans évaluation reste prévu.

- Les 66 exigences fonctionnelles (FR-301 à FR-366) sont numérotées à partir de 301 pour éviter toute collision avec les spécifications 1, 2 et 3, rédigées en parallèle.

- Les exigences FR-322 à FR-326 (notation et « Non applicable ») et FR-329 à FR-333 (séparation des trois mesures) doivent faire l'objet de tests automatisés permanents, rejoués à chaque phase, conformément au principe VI de la constitution.

- Les exigences FR-353 à FR-358 (anonymat et cloisonnement) relèvent des principes I et IV, non négociables, et sont soumises aux mêmes tests permanents.

- La section « Texte exact des écrans » fait foi **en français uniquement**. Aucune traduction n'est proposée dans cette spécification : les quatre autres langues sont produites et approuvées séparément (FR-319). Tant que cette approbation n'est pas obtenue, la spécification ne peut pas être considérée comme prête pour la mise en service, même si elle est prête pour `/speckit-plan`.

- **État global** : **16 / 17**. La spécification est complète et cohérente ; elle attend les réponses aux trois questions Q1 à Q3 avant de passer à la planification.
