# Specification Quality Checklist: Caddies, voiturettes et QR codes

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

## Cohérence avec la spécification 001

- [x] Aucune entité n'est redéfinie ; la section « Entités référencées » renvoie au modèle de la spéc. 001
- [x] Aucun champ nouveau n'est introduit localement
- [x] Aucune règle de calcul posée en spéc. 001 n'est réécrite
- [x] Les manques constatés sont consignés dans « Évolutions demandées à la spéc. 001 » (E-01, E-02, E-03) plutôt qu'inventés
- [x] La numérotation des exigences (FR-101 et suivantes) n'entre pas en collision avec les FR-001 à FR-046 de la spéc. 001
- [x] Les exigences de la spéc. 001 applicables ici sont rappelées comme toujours en vigueur

## Conformité à la constitution

- [x] Principe I — minimisation : les trois colonnes rejetées et l'année de naissance sont traitées explicitement (FR-130 à FR-136, US 2)
- [x] Principe II — aucune donnée réelle hors production : FR-171
- [x] Principe III — souveraineté : aucun service tiers introduit ; impression locale documentée en Assumptions
- [x] Principe IV — cloisonnement par terrain : FR-167, unicité par terrain de l'identifiant interne et du numéro visible
- [x] Principe V — approbation par phase : les points non tranchés sont posés en questions, jamais inventés
- [x] Principe VI — tests avant clôture : chaque exigence est formulée de façon vérifiable et les critères SC-101 à SC-112 sont mesurables
- [x] QR code permanent, opaque, sans donnée : FR-156 à FR-160, FR-163
- [x] Caddie désactivé conservant son historique : FR-141, FR-143

## État actuel

**15 items sur 16** passent sur le bloc standard. L'unique échec est volontaire et documenté : il reste **3 marqueurs [NEEDS CLARIFICATION]**, à la limite exacte autorisée.

| # | Exigence | Question posée |
|---|---|---|
| Q1 | FR-104 | Quels encodages accepter — UTF-8 seul, ou aussi ISO-8859-1 et Windows-1252 — et l'encodage doit-il être détecté automatiquement ou choisi par l'administrateur ? |
| Q2 | FR-115 | Quel traitement pour un doublon détecté — ignorer la ligne, remplacer le caddie existant, ou demander une décision ligne par ligne ? |
| Q3 | FR-161 | Quel format d'impression attendu — planche A4 à grille fixe, étiquettes autocollantes d'un gabarit précis — et quelle taille minimale pour un QR code scannable en plein soleil ? |

## Notes

- **Itération 1 (2026-09-18)** : première rédaction. 7 parcours priorisés (4 en P1, 3 en P2/P3), 18 cas limites, 71 exigences fonctionnelles FR-101 à FR-171, 12 critères de succès SC-101 à SC-112.
- Trois points relevant de la même famille de questions ont été traités par **valeur par défaut documentée** dans la section Assumptions plutôt que par marqueur, afin de respecter la limite de trois : la ligne d'en-tête, le séparateur de colonnes et l'origine de l'identifiant interne. Les deux premiers reçoivent une détection annoncée et corrigeable dans l'aperçu ; le troisième est également remonté en **E-03** car il a une conséquence directe sur la fiabilité de la détection de doublons.
- La question du rapport d'importation (**E-01**) n'est pas un marqueur mais une demande d'arbitrage adressée à la spéc. 001 : le modèle de référence ne comporte aucune entité de lot d'importation et `audit_log` est dépourvu de colonne de contenu. L'hypothèse retenue faute d'arbitrage — rapport éphémère — n'ajoute aucune surface de stockage et reste conforme au principe I.
- **E-02** (colonne `source` sur `caddie`, par symétrie avec `booking.source`) est signalé sans que cette spécification en dépende.
- Les exigences FR-130 à FR-136 (protection des renseignements personnels à l'import) et FR-156 à FR-166 (opacité et permanence des QR codes) doivent faire l'objet de **tests automatisés permanents**, rejoués à chaque phase, conformément au principe VI.
- FR-121 à FR-124 (atomicité, double confirmation, concurrence) traduisent l'exigence du propriétaire du produit d'**éviter toute importation partielle silencieuse**. Elles sont la porte de qualité principale de cette spécification.
- La spécification **n'est pas encore prête** pour `/speckit-plan` : les trois questions Q1 à Q3 doivent d'abord être tranchées par le propriétaire du produit, conformément au principe V.
