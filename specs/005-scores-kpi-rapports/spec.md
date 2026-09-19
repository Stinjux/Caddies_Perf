# Feature Specification: Scores, KPI et rapports administratifs

**Feature Branch**: `005-scores-kpi-rapports`

**Created**: 2026-09-18

**Status**: Draft

**Input**: Spécification n°5 de CaddiePerf. Elle couvre le calcul du score des caddies, le tableau de bord et les indicateurs consultés par l'administrateur, les comparaisons à la moyenne du terrain, les rapports et les exports. Phases 15, 16 et 17 du projet.

## Rôle de cette spécification

Cette spécification décrit une **lecture** du produit : comment les données déjà produites par les spécifications 2, 3 et 4 sont agrégées, présentées, comparées et exportées.

- La **spécification n°1 détient le modèle de données** de référence. Ce document s'y réfère et ne redéfinit jamais une entité, un champ, une valeur d'énumération ni une règle de calcul déjà posés dans [`specs/001-socle-comptes-terrains/spec.md`](../001-socle-comptes-terrains/spec.md) et [`specs/001-socle-comptes-terrains/data-model.md`](../001-socle-comptes-terrains/data-model.md).
- Les entités manipulées ici — `evaluation`, `evaluation_criterion_answer`, `assignment`, `booking`, `caddie`, `golf_course`, `google_review_click`, `audit_log` — sont **définies ailleurs**. Voir la section « Entités référencées ».
- Les règles de calcul reprises ici — pondération 70 / 30, exclusion des réponses « non applicable », définition du jour travaillé, séparation des trois mesures — sont **déjà arrêtées** par la spécification 1 et par la constitution. Ce document les **décrit** et les **rend vérifiables** ; il ne les réinvente pas.
- Lorsque ce document estime qu'un champ ou une précision manque au modèle, il le **signale** dans la section « Évolutions demandées à la spéc. 001 » et ne l'invente pas.

**Couvert ici** : calcul du score de compétences et du score final d'un caddie, agrégation sur un périmètre, décompte des jours travaillés, indicateurs du tableau de bord, filtres, comparaison d'un caddie à la moyenne du parcours et seuil de pertinence statistique, évolution hebdomadaire et mensuelle, distribution des notes, lecture des commentaires, résultats sur la valeur perçue du prix, comptage des clics vers les avis Google, rapports administratifs et export CSV.

**Hors de ce document** : recueil des évaluations et écrans clients (spéc. 4), création et clôture des affectations (spéc. 3), import et cycle de vie des caddies et des voiturettes (spéc. 2), comptes, permissions, cloisonnement et journalisation (spéc. 1).

**Statut de conformité constitutionnelle** : cette spécification est soumise au principe I (minimisation des données personnelles, et anonymat des évaluations), au principe IV (cloisonnement strict par terrain) et à la section « Séparation des mesures » des contraintes techniques. Ce sont les trois contraintes structurantes d'un rapport : un rapport est précisément l'endroit où une donnée cloisonnée peut fuir, où un agrégat trop fin peut désanonymiser, et où trois mesures distinctes peuvent se mélanger sans que personne ne s'en aperçoive.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - L'administrateur consulte le score d'un caddie et comprend comment il est obtenu (Priority: P1)

Un administrateur ouvre la fiche de performance d'un caddie. Il y voit la moyenne de chacun des six critères, la moyenne des cinq compétences, la note d'expérience générale, et le score final. Chaque valeur est accompagnée du nombre de réponses sur lequel elle repose. En lisant l'écran, l'administrateur peut refaire le calcul de tête : rien n'est produit par une boîte noire.

**Why this priority** : c'est la promesse centrale du produit. Sans score lisible et explicable, les évaluations recueillies par la spéc. 4 ne servent à rien, et l'administrateur n'a aucune raison de faire confiance au chiffre qu'on lui montre.

**Independent Test** : on charge un jeu d'évaluations fictives de valeurs connues sur un caddie de test, on ouvre sa fiche, et l'on vérifie que chaque moyenne, chaque effectif et le score final correspondent exactement au calcul fait à la main. Cette seule fiche délivre déjà de la valeur : le terrain sait enfin ce que vaut chacun de ses caddies.

**Acceptance Scenarios** :

1. **Given** un caddie ayant reçu des évaluations comportant des notes chiffrées sur les six critères, **When** l'administrateur ouvre sa fiche de performance, **Then** la moyenne de chaque critère, la moyenne des cinq compétences, la note d'expérience générale et le score final s'affichent, chacun accompagné du nombre de réponses utilisées.
2. **Given** une évaluation dont un critère de compétence porte « non applicable », **When** le score est calculé, **Then** ce critère est exclu du dénominateur et le score n'est pas abaissé, ce qui se vérifie en comparant avec le même jeu de notes sans la réponse « non applicable ».
3. **Given** un caddie dont les cinq compétences sont toutes « non applicable » et dont l'expérience générale est notée, **When** le score est calculé, **Then** le score vaut l'expérience générale seule.
4. **Given** un caddie dont au moins une compétence est notée et dont l'expérience générale est absente ou « non applicable », **When** le score est calculé, **Then** le score vaut la moyenne des compétences seule.
5. **Given** un caddie dont aucune réponse chiffrée n'existe sur les six critères, **When** sa fiche est ouverte, **Then** l'écran indique qu'il n'y a pas de score, et n'affiche jamais la valeur zéro.
6. **Given** des évaluations portant une note du parcours très basse et des réponses très négatives sur le prix, **When** le score du caddie est calculé, **Then** ce score est strictement identique à celui obtenu sans ces réponses.

---

### User Story 2 - L'administrateur lit le tableau de bord de son terrain sur une période choisie (Priority: P1)

Un administrateur ouvre le tableau de bord de son terrain. Il choisit une période, éventuellement un caddie, un nombre minimal d'évaluations et un statut de caddie. Le tableau lui donne, pour ce périmètre : les jours travaillés, les réservations, les évaluations, le taux de réponse, les moyennes par critère, le score final, la moyenne d'appréciation du parcours, les résultats sur la valeur perçue et les clics vers les avis Google.

**Why this priority** : c'est l'écran quotidien du propriétaire du produit. C'est aussi lui qui rend le produit vendable : un terrain achète la capacité de piloter, pas la capacité de stocker.

**Independent Test** : on alimente un terrain de test avec des affectations et des évaluations réparties sur deux mois, on applique chaque filtre l'un après l'autre, et l'on vérifie que chaque indicateur correspond au décompte manuel du périmètre filtré.

**Acceptance Scenarios** :

1. **Given** un terrain actif et une période choisie, **When** l'administrateur ouvre le tableau de bord, **Then** tous les indicateurs de FR-421 sont présentés pour ce périmètre, chacun avec son effectif.
2. **Given** un caddie ayant travaillé deux jours avec trois affectations terminées, dont deux le même jour, **When** ses jours travaillés sont comptés, **Then** le résultat est **2**.
3. **Given** un caddie dont une affectation est encore en cours et une autre annulée, **When** ses jours travaillés sont comptés, **Then** ni l'une ni l'autre n'est comptée.
4. **Given** une période sans aucune activité, **When** le tableau de bord s'affiche, **Then** chaque indicateur indique l'absence de donnée et aucun n'affiche zéro comme s'il s'agissait d'une mesure.
5. **Given** un filtre « nombre minimal d'évaluations » réglé sur 10, **When** la liste des caddies s'affiche, **Then** seuls les caddies atteignant ce nombre sur le périmètre y figurent, et l'écran indique combien de caddies ont été écartés par ce filtre.
6. **Given** un administrateur rattaché à deux terrains ayant sélectionné le terrain A, **When** il consulte n'importe quel indicateur, **Then** aucune donnée du terrain B n'y contribue.

---

### User Story 3 - L'administrateur compare un caddie à la moyenne de son parcours (Priority: P1)

Un administrateur veut savoir si un caddie est au-dessus ou en dessous de ses collègues. L'écran lui montre la note du caddie, la moyenne du parcours sur exactement le même périmètre, l'écart signé, et le nombre d'évaluations utilisées. Quand ce nombre est trop faible, la comparaison reste affichée mais porte une mention explicite : elle n'est pas statistiquement significative.

**Why this priority** : une moyenne sans point de repère ne se décide pas. Mais une comparaison fondée sur deux évaluations est pire qu'aucune comparaison — elle donne l'assurance sans la matière. Les deux moitiés de ce parcours sont indissociables.

**Independent Test** : on constitue un terrain de test avec quatre caddies aux notes connues, on compare l'un d'eux à la moyenne, on vérifie l'écart au centième, puis on réduit son nombre d'évaluations sous le seuil et l'on vérifie que la comparaison reste visible et devient explicitement marquée comme non significative.

**Acceptance Scenarios** :

1. **Given** un caddie et une période, **When** la comparaison s'affiche, **Then** l'écran présente quatre éléments : la note du caddie, la moyenne du parcours, l'écart positif ou négatif, et le nombre d'évaluations utilisées.
2. **Given** une comparaison affichée, **When** on examine la moyenne de référence, **Then** elle est calculée sur le **même terrain**, la **même période** et les **mêmes critères** que la note du caddie, et sur les seules évaluations valides.
3. **Given** un caddie comptant **4 évaluations valides** sur la période, **When** la comparaison s'affiche, **Then** elle est présentée **et** porte la mention explicite qu'elle n'est pas statistiquement significative.
4. **Given** un caddie comptant **5 évaluations valides** ou plus, **When** la comparaison s'affiche, **Then** aucune mention de non-significativité n'est portée.
5. **Given** un caddie dont un critère n'a reçu aucune réponse chiffrée sur la période, **When** la comparaison s'affiche, **Then** ce critère est retiré des deux côtés de la comparaison, et l'écran indique quels critères ont été retenus.
6. **Given** deux terrains, **When** un caddie du terrain A est comparé à une moyenne, **Then** aucune évaluation du terrain B n'entre dans cette moyenne.

---

### User Story 4 - L'administrateur suit l'évolution dans le temps et la distribution des notes (Priority: P2)

Un administrateur veut savoir si un caddie progresse. Il consulte l'évolution hebdomadaire et mensuelle de son score, et la répartition de ses notes de 1 à 5 étoiles. Chaque point de l'évolution porte le nombre d'évaluations qui le composent, de sorte qu'un pic dû à une seule réponse ne se confonde pas avec une tendance.

**Why this priority** : c'est ce qui transforme une mesure en outil de pilotage. Non bloquant pour la première démonstration, qui peut se contenter d'un score et d'une comparaison, d'où le P2.

**Independent Test** : on répartit des évaluations fictives sur huit semaines avec des valeurs connues, puis on vérifie que chaque point hebdomadaire, son effectif, et la distribution des notes correspondent au décompte manuel.

**Acceptance Scenarios** :

1. **Given** des évaluations réparties sur plusieurs semaines, **When** l'évolution hebdomadaire s'affiche, **Then** chaque point porte sa valeur et le nombre d'évaluations dont il est issu.
2. **Given** une semaine sans aucune évaluation, **When** l'évolution s'affiche, **Then** cette semaine apparaît comme une absence de mesure et non comme un score de zéro.
3. **Given** un jeu d'évaluations comportant des notes de 1 à 5 et des réponses « non applicable », **When** la distribution s'affiche, **Then** les cinq niveaux sont dénombrés séparément et les réponses « non applicable » sont comptées à part, jamais assimilées à la note 1 ni à zéro.
4. **Given** un terrain dont le fuseau horaire est celui du Maroc, **When** une semaine ou un mois est délimité, **Then** les bornes sont exprimées dans les dates locales du terrain.

---

### User Story 5 - L'administrateur lit les commentaires sans jamais pouvoir remonter à un joueur (Priority: P2)

Un administrateur consulte les commentaires laissés par les clients et les résultats sur la valeur perçue du prix. Les commentaires sont présentés sans aucun élément qui permettrait d'identifier la partie, la réservation ou l'heure de départ. Quand le périmètre filtré est si étroit qu'un commentaire désigne de fait une seule partie, l'écran le dit.

**Why this priority** : l'anonymat des évaluations est une exigence non négociable de la constitution. Un rapport bien filtré est le moyen le plus simple de la contourner sans le vouloir. Cette vigilance est indispensable, mais elle ne conditionne pas la première démonstration du score, d'où le P2.

**Independent Test** : on crée un caddie n'ayant reçu qu'une seule évaluation commentée sur une journée, on ouvre le rapport, et l'on vérifie qu'aucun élément affiché ne permet de désigner la partie concernée et qu'un avertissement de périmètre étroit est présenté.

**Acceptance Scenarios** :

1. **Given** des évaluations comportant des commentaires, **When** l'administrateur les consulte, **Then** il voit le texte, la langue et la date, et aucun numéro de réservation, aucune heure de départ, aucune référence d'affectation, aucun numéro de voiturette.
2. **Given** un périmètre filtré ne contenant qu'un seul commentaire, **When** ce commentaire s'affiche, **Then** un avertissement indique que le périmètre est trop étroit pour préserver la dilution de l'anonymat.
3. **Given** une évaluation dont le commentaire a été effacé à son échéance de conservation, **When** les rapports sont consultés, **Then** le commentaire a disparu tandis que les notes chiffrées de cette évaluation continuent d'alimenter toutes les moyennes.
4. **Given** des réponses sur la valeur perçue du prix, **When** elles sont présentées, **Then** elles le sont séparément du score du caddie, et le tarif mémorisé au moment de chaque réponse est celui qui sert à les interpréter.
5. **Given** une période pendant laquelle le tarif affiché au client a changé, **When** les résultats sur le prix sont présentés, **Then** ils sont ventilés par tarif et l'agrégat global porte la mention qu'il couvre plusieurs tarifs.

---

### User Story 6 - L'administrateur exporte un rapport pour le partager (Priority: P2)

Un administrateur applique ses filtres, obtient le tableau qu'il veut, et l'exporte au format CSV pour le joindre à une réunion ou à un dossier. Le fichier contient exactement ce que l'écran montrait, effectifs et mentions de non-significativité compris, et aucune donnée personnelle.

**Why this priority** : c'est ce qui fait sortir la mesure de l'outil et entrer dans la décision. Mais un export est inutile tant que les chiffres qu'il contient ne sont pas fiables, d'où sa place après les trois parcours P1.

**Independent Test** : on exporte un rapport de test, on ouvre le fichier obtenu dans un tableur, et l'on vérifie ligne à ligne qu'il reproduit l'écran, qu'il ne contient ni année de naissance, ni adresse, ni taille d'habits, ni commentaire en texte libre, et que l'export a produit une entrée de journal.

**Acceptance Scenarios** :

1. **Given** un rapport affiché avec ses filtres, **When** l'administrateur l'exporte, **Then** un fichier CSV est produit reprenant le même périmètre, les mêmes valeurs et les mêmes effectifs.
2. **Given** un export produit, **When** on inspecte son contenu, **Then** on n'y trouve ni année de naissance, ni adresse de domicile, ni taille d'habits, ni aucune autre donnée personnelle.
3. **Given** un export produit, **When** on inspecte son contenu, **Then** on n'y trouve aucun commentaire en texte libre.
4. **Given** un export produit, **When** on consulte le journal, **Then** l'export y figure avec son auteur, son terrain et son horodatage.
5. **Given** un administrateur rattaché à deux terrains, **When** il exporte depuis le terrain A, **Then** le fichier ne contient aucune ligne du terrain B.
6. **Given** un rapport contenant une comparaison non significative, **When** il est exporté, **Then** la mention de non-significativité figure dans le fichier.

---

### User Story 7 - Le Starter reste à l'écart, et l'historique des caddies désactivés reste intact (Priority: P3)

Un compte Starter ne dispose d'aucun accès aux rapports de performance, aux notes ni aux commentaires, par aucun chemin. Parallèlement, un caddie désactivé conserve l'intégralité de son historique, consultable par un administrateur, et continue de peser dans les moyennes historiques du terrain.

**Why this priority** : ce sont deux garanties, non deux fonctionnalités. Elles doivent être vérifiées, mais elles ne produisent aucun écran nouveau, d'où le P3. Elles ne sont pas pour autant optionnelles : la première relève du principe I, la seconde de FR-042.

**Independent Test** : on tente d'atteindre chaque écran et chaque export de rapport avec un compte Starter et l'on constate un refus à chaque fois ; puis on désactive un caddie de test et l'on vérifie que ses moyennes passées et celles du terrain sont inchangées.

**Acceptance Scenarios** :

1. **Given** un compte Starter, **When** il tente d'atteindre un tableau de bord, une fiche de performance, un commentaire ou un export, par l'interface ou par toute autre voie, **Then** l'accès est refusé sans révéler l'existence de la ressource.
2. **Given** un caddie passé au statut désactivé, **When** un administrateur consulte son historique, **Then** l'intégralité de ses évaluations et de ses jours travaillés reste consultable.
3. **Given** un caddie désactivé, **When** les moyennes du terrain sont recalculées sur une période passée, **Then** elles sont strictement identiques à celles d'avant la désactivation.
4. **Given** le filtre « statut du caddie », **When** l'administrateur choisit d'inclure les caddies désactivés, **Then** ils apparaissent dans la liste, identifiés comme tels.

---

### Edge Cases

- **Caddie sans aucune évaluation** : sa fiche s'ouvre et montre ses jours travaillés et ses affectations, avec une absence de score explicitement nommée. Le score n'est jamais présenté comme zéro, et le caddie n'est jamais classé en bas d'une liste pour cette raison.
- **Caddie avec une seule évaluation** : le score s'affiche, accompagné de son effectif de 1 et de la mention de non-significativité. La valeur n'est pas masquée : l'administrateur peut de toute façon la déduire du nombre d'évaluations affiché ailleurs, et masquer serait lui faire croire qu'il n'y a rien.
- **Tous les critères d'une évaluation en « non applicable »** : cette évaluation est comptée dans le nombre d'évaluations reçues mais ne contribue à aucune moyenne. Elle ne fait donc jamais baisser le score.
- **Période sans aucune activité** : tous les indicateurs indiquent l'absence de donnée. Aucune division par zéro, aucun zéro affiché à la place d'une mesure absente, aucun écran vide sans explication.
- **Caddie désactivé conservant son historique** : il disparaît des listes opérationnelles mais reste consultable par le filtre de statut, et ses évaluations passées continuent d'alimenter les moyennes historiques du terrain.
- **Changement de tarif en cours de période** : les résultats sur la valeur perçue sont ventilés par tarif mémorisé, et l'agrégat global porte la mention qu'il couvre plusieurs tarifs. Aucune analyse de prix n'utilise le tarif courant.
- **Commentaire purgé mais note conservée** : à l'échéance de conservation, le texte disparaît des écrans et des rapports tandis que l'évaluation chiffrée continue de compter. Le nombre d'évaluations ne baisse pas et les moyennes ne bougent pas.
- **Caddie n'ayant qu'un seul commentaire sur une période courte** : le rapport affiche le commentaire sans aucune référence à la partie, et avertit que le périmètre est trop étroit pour que l'anonymat soit autre chose qu'une formalité.
- **Un caddie affecté à plusieurs voiturettes le même jour** : chaque voiturette porte son affectation et peut recevoir ses propres évaluations, mais la journée ne compte qu'une fois dans les jours travaillés, et la réservation qu'une fois dans le nombre de réservations.
- **Quatre évaluations pour une même affectation** : les quatre comptent et pèsent chacune d'un poids égal. Le plafond de quatre interdit qu'une partie pèse davantage, mais une partie évaluée quatre fois pèse quatre fois plus qu'une partie évaluée une fois — ce fait est rappelé à l'écran plutôt que corrigé silencieusement.
- **Affectation annulée portant une évaluation** : l'évaluation n'est pas comptée comme valide et n'entre dans aucune moyenne, mais elle reste visible dans un décompte des anomalies pour que l'écart entre les deux totaux soit explicable.
- **Terrain archivé** : ses rapports restent consultables en lecture seule ; aucun nouvel indicateur n'y est produit.
- **Deux terrains aux noms de caddies identiques** : aucune agrégation ne les rapproche, la clé étant toujours le couple terrain–caddie.
- **Changement d'heure dans le fuseau du terrain** : une journée de 23 ou 25 heures reste une seule date locale et donc un seul jour travaillé.
- **Filtre de période incohérent** : une date de fin antérieure à la date de début est refusée avec un message explicite, plutôt que de produire un rapport vide qu'on pourrait croire véridique.
- **Période à cheval sur la purge des commentaires** : un rapport couvrant plus de deux ans montre des évaluations chiffrées complètes et des commentaires partiels ; l'écran explique cette asymétrie plutôt que de la laisser passer pour un défaut de recueil.

## Règles de calcul

Ces règles sont **déjà arrêtées**. Cette section les énonce et les illustre pour qu'elles soient testables ; elle ne les modifie pas.

### Vocabulaire — deux « parcours » à ne jamais confondre

Deux indicateurs portent le mot « parcours ». Ils sont distincts et ne se mélangent jamais :

| Terme retenu ici | Ce que c'est | Entre-t-il dans le score d'un caddie ? |
|---|---|---|
| **Note du parcours** | L'appréciation que le client donne du terrain lui-même (`evaluation.course_rating`). Elle appartient au terrain. | **Jamais** (FR-043 de la spéc. 1) |
| **Moyenne du parcours** | Le score moyen de l'ensemble des caddies du terrain sur un périmètre donné. C'est le point de repère de la comparaison. | Elle **est** un agrégat de scores de caddies |

### Les six critères et leur découpage

Les six critères et leur ordre sont fixés par la spéc. 1. Les **cinq premiers** — accueil et attitude, connaissance des règles et de l'étiquette, connaissance du parcours, lecture des verts, communication — forment le **score de compétences**. Le sixième, **expérience générale**, est distinct et pondéré séparément.

### Formule du score

```text
moyenne des compétences = somme des réponses chiffrées aux 5 critères de compétence
                          ÷ nombre de ces réponses chiffrées

score final = (moyenne des compétences × 0,70) + (expérience générale × 0,30)
```

Une réponse « non applicable » est une **absence de note**. Elle est retirée du numérateur **et** du dénominateur. Elle n'est jamais comptée zéro et n'abaisse jamais une moyenne.

Trois cas d'incomplétude, également arrêtés :

| Situation | Score |
|---|---|
| Au moins une compétence chiffrée **et** expérience générale chiffrée | Formule complète 70 / 30 |
| Toutes les compétences « non applicable », expérience générale chiffrée | **L'expérience générale seule** |
| Au moins une compétence chiffrée, expérience générale absente ou « non applicable » | **La moyenne des compétences seule** |
| Aucune réponse chiffrée sur les six critères | **Pas de score** — une absence, jamais un zéro |

### Exemple A — évaluation complète

| Critère | Note |
|---|---|
| Accueil et attitude | 5 |
| Règles et étiquette | 4 |
| Connaissance du parcours | 4 |
| Lecture des verts | 3 |
| Communication | 5 |
| *Moyenne des compétences* | *(5+4+4+3+5) ÷ 5 = **4,20*** |
| Expérience générale | 4 |

**Score final** = 4,20 × 0,70 + 4 × 0,30 = 2,94 + 1,20 = **4,14**

### Exemple B — l'effet d'un « non applicable »

Le même client, mais il n'a pas pu juger la connaissance du parcours et répond « non applicable ».

| Critère | Note |
|---|---|
| Accueil et attitude | 5 |
| Règles et étiquette | 4 |
| Connaissance du parcours | **non applicable** |
| Lecture des verts | 3 |
| Communication | 5 |
| *Moyenne des compétences* | *(5+4+3+5) ÷ **4** = **4,25*** |
| Expérience générale | 4 |

**Score final** = 4,25 × 0,70 + 4 × 0,30 = 2,975 + 1,20 = **4,175**, affiché **4,18**

**Ce qu'il ne faut jamais faire** : si « non applicable » était compté zéro, la moyenne des compétences vaudrait (5+4+0+3+5) ÷ 5 = **3,40** et le score final **3,58**. L'écart entre 4,18 et 3,58 est l'exacte mesure du dommage causé par cette erreur. Un caddie serait puni pour une question que le client n'était pas en mesure de juger.

### Exemple C — toutes les compétences « non applicable »

Cinq compétences « non applicable », expérience générale 4.
**Score final = 4,00** — l'expérience générale seule. Ni 0, ni 1,20.

### Exemple D — expérience générale manquante

Compétences 5, 4, 3, 5, « non applicable » → moyenne = 17 ÷ 4 = **4,25**. Expérience générale absente.
**Score final = 4,25** — la moyenne des compétences seule. Elle n'est pas réduite à 4,25 × 0,70 = 2,975.

### Exemple E — évaluation entièrement « non applicable »

Six critères « non applicable ». **Pas de score.** Cette évaluation est comptée dans le nombre d'évaluations reçues, mais ne contribue à aucune moyenne et ne fait donc baisser aucun chiffre.

### Agrégation sur un périmètre

Un périmètre est le croisement d'un terrain, d'une période, et éventuellement d'un caddie et d'autres filtres.

1. **Moyenne d'un critère** : moyenne de toutes les réponses chiffrées à ce critère dans le périmètre, réponses « non applicable » exclues. Un critère sans aucune réponse chiffrée est déclaré **non mesuré**.
2. **Moyenne des cinq compétences** : moyenne de **toutes** les réponses chiffrées portant sur les cinq critères de compétence, toutes évaluations du périmètre confondues.
3. **Note d'expérience générale** : moyenne des réponses chiffrées à ce seul critère.
4. **Score final du périmètre** : la formule 70 / 30 appliquée aux deux valeurs ci-dessus, avec les mêmes règles d'incomplétude.

Ce mode d'agrégation est celui qui rend l'écran **vérifiable à la main** : l'administrateur voit les deux moyennes affichées et retrouve le score en les pondérant lui-même. Un score obtenu autrement — par exemple en moyennant des scores par évaluation — afficherait un total que les lignes du tableau ne permettraient pas de reconstituer. Voir la section Assumptions.

### Exemple F — agrégation et vérification à l'écran

Un caddie, une semaine, trois évaluations. Réponses chiffrées sur les cinq compétences : 5, 4, 4, 3, 5 · 4, 4, « n/a », 3, 4 · 5, 5, 4, « n/a », 5.

- Réponses chiffrées de compétence retenues : **13** (sur 15 possibles)
- Somme : 21 + 15 + 19 = **55** → moyenne des compétences = 55 ÷ 13 = **4,2308**, affichée **4,23**
- Expérience générale : 4, 3, 5 → **4,00** sur 3 réponses
- **Score final** = 4,23… × 0,70 + 4,00 × 0,30 = 2,9615 + 1,20 = **4,1615**, affiché **4,16**

L'arrondi à deux décimales est un arrondi **d'affichage**. Tous les calculs intermédiaires se font sur les valeurs non arrondies, faute de quoi deux écrans affichant la même donnée pourraient différer au centième.

### Jour travaillé

Un jour travaillé est une **date locale du terrain** comportant **au moins une affectation en statut terminé** pour ce caddie. Elle est comptée **une seule fois**, quel que soit le nombre de réservations, d'affectations ou de voiturettes de ce caddie ce jour-là (FR-044 de la spéc. 1). C'est une notion **dérivée, jamais stockée**.

### Exemple G — jours travaillés

| Date locale | Affectations du caddie | Statuts | Compte |
|---|---|---|---|
| 2026-09-14 | 2 | terminée, terminée | **1** |
| 2026-09-15 | 1 | terminée | **1** |
| 2026-09-16 | 1 | en cours | 0 |
| 2026-09-17 | 1 | annulée | 0 |

**Jours travaillés = 2.** Quatre affectations, deux jours.

### Comparaison d'un caddie à la moyenne du parcours

La moyenne de référence est calculée sur **le même terrain**, **la même période**, **les mêmes critères**, et sur les **seules évaluations valides**. Aucun de ces quatre alignements n'est facultatif : une moyenne calculée sur une autre période ou sur un autre jeu de critères n'est pas un point de repère, c'est une coïncidence.

L'affichage comporte obligatoirement quatre éléments : la **note du caddie**, la **moyenne du parcours**, l'**écart signé**, et le **nombre d'évaluations utilisées**.

### Exemple H — comparaison significative et non significative

| | Cas 1 | Cas 2 |
|---|---|---|
| Note du caddie | 4,16 | 4,40 |
| Moyenne du parcours | 3,92 | 3,92 |
| Écart | **+0,24** | **+0,48** |
| Évaluations utilisées | **12** | **3** |
| Mention | — | **Non significatif : moins de 5 évaluations** |

Dans le cas 2, l'écart est deux fois plus grand et vaut deux fois moins. La comparaison est **affichée quand même** : le nombre d'évaluations est de toute façon visible ailleurs sur l'écran, et masquer la valeur laisserait croire à une absence de donnée là où il y a une donnée fragile. Une donnée fragile annoncée comme telle instruit ; une donnée cachée trompe.

## Requirements *(mandatory)*

### Score du caddie — formule

- **FR-401** : Le système DOIT calculer le **score de compétences** comme la moyenne arithmétique des réponses chiffrées portant sur les cinq critères accueil et attitude, connaissance des règles et de l'étiquette, connaissance du parcours, lecture des verts, et communication.
- **FR-402** : Le système DOIT calculer le **score final** comme `(moyenne des compétences × 0,70) + (expérience générale × 0,30)`.
- **FR-403** : Une réponse « non applicable » DOIT être exclue du numérateur et du dénominateur de toute moyenne ; elle NE DOIT JAMAIS être comptée zéro ni abaisser une moyenne.
- **FR-404** : Lorsque les cinq compétences sont toutes « non applicable » et que l'expérience générale porte une note chiffrée, le score final DOIT valoir l'expérience générale seule.
- **FR-405** : Lorsque au moins une compétence porte une note chiffrée et que l'expérience générale est absente ou « non applicable », le score final DOIT valoir la moyenne des compétences seule, sans application de la pondération.
- **FR-406** : Lorsque aucune réponse chiffrée n'existe sur les six critères, le système NE DOIT produire aucun score ; cette absence DOIT être présentée comme une absence et JAMAIS comme la valeur zéro.
- **FR-407** : La note du parcours NE DOIT JAMAIS entrer dans le calcul du score d'un caddie (FR-043 de la spéc. 1).
- **FR-408** : Les réponses sur le rapport qualité-prix et sur la perception du prix NE DOIVENT JAMAIS entrer dans le calcul du score d'un caddie (FR-043 de la spéc. 1).
- **FR-409** : Le système NE DOIT appliquer aucune pondération par ancienneté, par volume d'affectations ni par aucun autre facteur externe aux six critères.

### Score du caddie — agrégation sur un périmètre

- **FR-410** : Le système DOIT calculer la moyenne de **chaque** critère sur un périmètre comme la moyenne des réponses chiffrées à ce critère, les réponses « non applicable » étant exclues.
- **FR-411** : Un critère ne comptant aucune réponse chiffrée sur le périmètre DOIT être présenté comme **non mesuré**, et NE DOIT PAS être remplacé par une valeur par défaut.
- **FR-412** : Le système DOIT calculer la moyenne des cinq compétences sur un périmètre comme la moyenne de l'ensemble des réponses chiffrées portant sur ces cinq critères, toutes évaluations du périmètre confondues.
- **FR-413** : Le système DOIT calculer le score final d'un périmètre en appliquant FR-402 à la moyenne des compétences et à la note d'expérience générale du même périmètre, les règles FR-403 à FR-406 s'appliquant à l'identique.
- **FR-414** : Toute valeur affichée DOIT l'être arrondie à **deux décimales** ; tous les calculs intermédiaires DOIVENT être conduits sur les valeurs non arrondies.
- **FR-415** : Le système DOIT considérer comme **évaluation valide** une évaluation enregistrée, rattachée à une affectation non annulée du terrain, et comportant au moins une réponse chiffrée parmi les six critères. Les évaluations non valides NE DOIVENT entrer dans aucune moyenne.
- **FR-416** : Le système DOIT permettre de dénombrer séparément les évaluations écartées comme non valides, afin que tout écart entre deux totaux affichés soit explicable.

### Jours travaillés, réservations et volumes

- **FR-417** : Le système DOIT compter un **jour travaillé** comme une date locale du terrain comportant au moins une affectation en statut terminé pour le caddie, cette date étant comptée **une seule fois** quel que soit le nombre de réservations, d'affectations ou de voiturettes de ce caddie ce jour-là (FR-044 de la spéc. 1).
- **FR-418** : Les affectations en cours et les affectations annulées NE DOIVENT PAS être comptées comme jours travaillés.
- **FR-419** : Le système DOIT compter le **nombre de réservations** du périmètre comme le nombre de réservations distinctes portant au moins une affectation du périmètre ; une réservation portant plusieurs affectations NE DOIT être comptée qu'une fois.
- **FR-420** : Le système DOIT présenter le **nombre d'affectations** séparément du nombre de réservations, un même caddie pouvant servir plusieurs voiturettes d'une même partie (FR-052 de la spéc. 1).
- **FR-421** : Le système DOIT compter le **nombre d'évaluations** du périmètre comme le nombre d'évaluations valides au sens de FR-415.
- **FR-422** : Le système DOIT calculer un **taux de réponse** [NEEDS CLARIFICATION: le dénominateur du taux de réponse doit-il être le nombre d'affectations terminées, ou le nombre de voiturettes affectées ? Les deux divergent dès qu'un caddie sert plusieurs voiturettes pour une même partie (FR-052)].
- **FR-423** : Le taux de réponse DOIT être présenté avec son numérateur et son dénominateur explicites, et NE DOIT PAS être présenté comme une part de joueurs ayant répondu, une même affectation pouvant recevoir jusqu'à quatre réponses (FR-051 de la spéc. 1).

### Tableau de bord et indicateurs

- **FR-424** : Le système DOIT permettre à un administrateur de consulter, pour un périmètre filtré, l'ensemble des indicateurs suivants : nombre de jours travaillés, nombre de réservations, nombre d'évaluations, taux de réponse, moyenne de chacun des six critères, moyenne des cinq compétences, note d'expérience générale, score final, moyenne d'appréciation du parcours, écart entre le caddie et la moyenne du parcours, évolution hebdomadaire, évolution mensuelle, distribution des notes de 1 à 5, commentaires, résultats sur la valeur perçue du prix, et nombre de clics vers les avis Google.
- **FR-425** : Chaque indicateur affiché DOIT être accompagné de l'**effectif** sur lequel il est calculé.
- **FR-426** : Un indicateur ne reposant sur aucune donnée DOIT indiquer explicitement l'absence de donnée, et NE DOIT JAMAIS afficher zéro à la place d'une mesure absente.
- **FR-427** : La **moyenne d'appréciation du parcours** DOIT être présentée comme une mesure du terrain, distincte du score des caddies, et NE DOIT JAMAIS être agrégée avec lui.
- **FR-428** : Le nombre de **clics vers les avis Google** DOIT être présenté comme un nombre de clics, et NE DOIT JAMAIS être présenté ni nommé comme un nombre d'avis publiés.
- **FR-429** : Le système DOIT permettre de consulter les indicateurs pour un caddie donné comme pour l'ensemble des caddies du terrain.
- **FR-430** : Le système DOIT indiquer, à côté de toute liste de caddies, combien de caddies ont été écartés par les filtres en vigueur.

### Filtres

- **FR-431** : Le système DOIT permettre de filtrer tout rapport par **terrain**, ce filtre étant borné aux terrains auxquels le compte est rattaché et appliqué par le serveur (FR-023, FR-024 de la spéc. 1).
- **FR-432** : Le système DOIT permettre de filtrer par **caddie**.
- **FR-433** : Le système DOIT permettre de filtrer par **période**, exprimée en dates locales du terrain, bornes incluses.
- **FR-434** : Le système DOIT permettre de filtrer par **nombre minimal d'évaluations**, écartant de la liste les caddies n'atteignant pas ce nombre sur le périmètre.
- **FR-435** : Le système DOIT permettre de filtrer par **statut du caddie**, incluant ou excluant les caddies désactivés.
- **FR-436** : Les filtres DOIVENT être combinables, et le périmètre effectivement appliqué DOIT rester visible à l'écran en permanence.
- **FR-437** : Une période dont la borne de fin précède la borne de début DOIT être refusée avec un message explicite, et NE DOIT PAS produire un rapport vide.
- **FR-438** : Le filtre « nombre minimal d'évaluations » DOIT rester distinct du seuil de pertinence statistique de FR-441 ; l'un écarte des lignes, l'autre annote une comparaison.

### Comparaison à la moyenne du parcours

- **FR-439** : Toute comparaison d'un caddie à une moyenne DOIT être calculée sur le **même terrain**, la **même période**, les **mêmes critères**, et sur les **seules évaluations valides**.
- **FR-440** : Toute comparaison affichée DOIT présenter quatre éléments : la **note du caddie**, la **moyenne du parcours**, l'**écart signé** positif ou négatif, et le **nombre d'évaluations utilisées**.
- **FR-441** : Lorsque le nombre d'évaluations utilisées est **inférieur à 5**, la comparaison DOIT porter une mention explicite indiquant qu'elle n'est pas statistiquement significative.
- **FR-442** : Une comparaison non significative NE DOIT JAMAIS être masquée ; elle DOIT être affichée et annotée.
- **FR-443** : La moyenne du parcours DOIT inclure les évaluations du caddie comparé, et cette inclusion DOIT être indiquée, afin que la moyenne de référence reste identique quel que soit le caddie consulté.
- **FR-444** : Un critère non mesuré chez le caddie DOIT être retiré des **deux** côtés de la comparaison, et les critères retenus DOIVENT être indiqués à l'écran.
- **FR-445** : Aucune comparaison NE DOIT mélanger les données de deux terrains (FR-026 de la spéc. 1).
- **FR-446** : Le système DOIT [NEEDS CLARIFICATION: un classement des caddies les uns par rapport aux autres doit-il être visible par l'administrateur, ou seule la comparaison à la moyenne du parcours est-elle exposée ? Un classement change la nature de l'outil et ses effets sur les équipes].

### Évolution dans le temps et distribution

- **FR-447** : Le système DOIT présenter l'évolution **hebdomadaire** et l'évolution **mensuelle** du score d'un caddie et de la moyenne du terrain.
- **FR-448** : Chaque point d'une évolution DOIT porter le nombre d'évaluations dont il est issu.
- **FR-449** : Une semaine ou un mois sans évaluation DOIT apparaître comme une **absence de mesure**, et NE DOIT JAMAIS être tracé comme un score de zéro ni relié par interpolation à ses voisins sans mention.
- **FR-450** : Les bornes des semaines et des mois DOIVENT être exprimées dans les dates locales du terrain.
- **FR-451** : Le système DOIT présenter la **distribution des notes de 1 à 5**, par critère et tous critères de compétence confondus, en effectifs et en pourcentages.
- **FR-452** : Les réponses « non applicable » DOIVENT être dénombrées **à part** dans la distribution, et NE DOIVENT JAMAIS être assimilées à la note 1 ni à zéro.
- **FR-453** : Le système DOIT [NEEDS CLARIFICATION: les scores doivent-ils être conservés sous forme d'historique figé à chaque période close, ou recalculés à la demande à partir des évaluations ? Un historique figé protège les rapports déjà diffusés d'une variation rétroactive ; un recalcul garantit qu'un rapport reflète toujours l'état réel des données, purges de commentaires comprises].

### Commentaires

- **FR-454** : Le système DOIT permettre à un administrateur seul de consulter les commentaires libres des évaluations de ses terrains.
- **FR-455** : Un commentaire DOIT être présenté avec sa date et sa langue, et SANS numéro de réservation, SANS heure de départ, SANS référence d'affectation, SANS numéro de voiturette et SANS aucun élément permettant de désigner une partie.
- **FR-456** : Lorsque le périmètre filtré contient moins de **5** évaluations commentées, l'affichage DOIT porter un avertissement indiquant que le périmètre est trop étroit pour que l'anonymat soit préservé par la dilution.
- **FR-457** : Un commentaire effacé à son échéance de conservation DOIT disparaître de tous les écrans et de tous les rapports, tandis que l'évaluation chiffrée à laquelle il était rattaché DOIT continuer d'alimenter le nombre d'évaluations et toutes les moyennes (FR-034c de la spéc. 1).
- **FR-458** : Un rapport couvrant une période antérieure à l'échéance de purge DOIT expliquer que l'absence de certains commentaires provient de leur effacement et non d'un défaut de recueil.

### Valeur perçue du prix

- **FR-459** : Le système DOIT présenter les résultats sur le rapport qualité-prix et sur la perception du prix **séparément** du score du caddie et de la note du parcours.
- **FR-460** : Toute analyse portant sur le prix DOIT utiliser le **tarif mémorisé dans chaque évaluation** au moment de la réponse, et JAMAIS le tarif courant du terrain (FR-048 de la spéc. 1).
- **FR-461** : Lorsque le périmètre couvre plusieurs tarifs mémorisés distincts, les résultats DOIVENT être ventilés par tarif, et tout agrégat global DOIT porter la mention qu'il couvre plusieurs tarifs.
- **FR-462** : Aucun résultat sur le prix NE DOIT modifier, pondérer ni annoter le score d'un caddie.

### Rapports et exports

- **FR-463** : Le système DOIT permettre l'export d'un rapport au format **CSV**, et ce format seul pour le pilote.
- **FR-464** : Un export DOIT reproduire exactement le périmètre affiché à l'écran : mêmes filtres, mêmes lignes, mêmes valeurs.
- **FR-465** : Un export DOIT porter les **effectifs** de chaque valeur et les **mentions de non-significativité** présentes à l'écran.
- **FR-466** : Un export DOIT rappeler en tête le périmètre appliqué — terrain, période, filtres — afin qu'un fichier détaché de l'écran reste interprétable.
- **FR-467** : Un export NE DOIT contenir ni année de naissance, ni adresse de domicile, ni taille d'habits, ni aucune autre donnée personnelle (FR-028, FR-030 de la spéc. 1).
- **FR-468** : Un export NE DOIT contenir **aucun commentaire en texte libre**, celui-ci pouvant contenir des données personnelles saisies par le joueur et échappant par nature à tout contrôle de champ.
- **FR-469** : Un export NE DOIT contenir que des données du terrain actif (FR-026 de la spéc. 1).
- **FR-470** : Chaque export DOIT produire une entrée de journal portant son auteur, son terrain, le périmètre exporté et son horodatage, sans qu'aucune donnée personnelle n'y figure (FR-035, FR-037 de la spéc. 1).
- **FR-471** : Les dates figurant dans un export DOIVENT être exprimées dans le fuseau horaire du terrain (FR-005 de la spéc. 1).
- **FR-472** : Les valeurs numériques exportées DOIVENT porter la même précision que celle affichée à l'écran, de sorte qu'un écart entre le fichier et l'écran soit impossible.

### Confidentialité, permissions et cloisonnement

- **FR-473** : Un compte Starter NE DOIT avoir accès à aucun rapport de performance, à aucune note, à aucun commentaire et à aucun export, par aucun chemin (FR-020 de la spéc. 1).
- **FR-474** : Chaque demande de rapport, de comparaison ou d'export DOIT être autorisée par le serveur ; masquer un écran NE DOIT PAS tenir lieu de contrôle d'accès (FR-021 de la spéc. 1).
- **FR-475** : Un refus d'accès à un rapport NE DOIT révéler ni l'existence ni le contenu de la ressource visée (FR-022, FR-025 de la spéc. 1).
- **FR-476** : Aucun rapport, aucun agrégat, aucune comparaison et aucun export NE DOIT mélanger les données de deux terrains (FR-026 de la spéc. 1).
- **FR-477** : Aucun rapport général NE DOIT contenir d'année de naissance, d'adresse de domicile ni de taille d'habits (FR-028, FR-030 de la spéc. 1).
- **FR-478** : Les seuls éléments d'identification d'un caddie autorisés dans un rapport DOIVENT être son identifiant interne, son prénom et son nom.
- **FR-479** : Aucun rapport NE DOIT permettre de remonter d'une évaluation à l'identité d'un joueur, directement ou par recoupement de filtres (FR-032 de la spéc. 1).
- **FR-480** : Aucune donnée personnelle NE DOIT figurer dans une adresse Web de rapport, un paramètre de filtre transmis, un nom de fichier exporté ni un message d'erreur (FR-031 de la spéc. 1).

### Historique, cohérence et explicabilité

- **FR-481** : Un caddie désactivé DOIT conserver l'intégralité de son historique d'affectations et d'évaluations, consultable par un administrateur (FR-042 de la spéc. 1).
- **FR-482** : La désactivation d'un caddie NE DOIT modifier aucune moyenne, aucune comparaison ni aucune statistique historique du terrain.
- **FR-483** : L'effacement des renseignements personnels d'un caddie ou la purge d'un commentaire NE DOIVENT modifier aucune moyenne ni aucun agrégat (FR-033, FR-034b de la spéc. 1).
- **FR-484** : Un terrain archivé DOIT conserver ses rapports consultables en lecture seule.
- **FR-485** : Le système NE DOIT appliquer qu'**une seule** définition de chaque règle de calcul : le tableau de bord, les fiches de caddie, les comparaisons et les exports DOIVENT produire des valeurs identiques pour un même périmètre.
- **FR-486** : Le système DOIT rendre chaque score **explicable** : l'écran DOIT permettre de retrouver les moyennes par critère, les effectifs et la pondération qui l'ont produit.
- **FR-487** : Deux consultations d'un même périmètre sur des données inchangées DOIVENT produire des valeurs strictement identiques.

## Entités référencées

Aucune entité n'est définie ici. Les définitions font autorité dans [`specs/001-socle-comptes-terrains/data-model.md`](../001-socle-comptes-terrains/data-model.md) et dans la section « Key Entities » de [`specs/001-socle-comptes-terrains/spec.md`](../001-socle-comptes-terrains/spec.md).

| Entité | Rôle dans cette spécification | Définie dans |
|---|---|---|
| `golf_course` — Terrain | Frontière de tout rapport. Fournit le fuseau horaire qui détermine les dates locales, les semaines et les mois. | Spéc. 001 |
| `caddie` — Caddie | Sujet de la mesure. Seuls son identifiant interne, son prénom et son nom apparaissent dans un rapport. Son statut alimente le filtre de statut. | Spéc. 001 |
| `caddie_personal_data` — Renseignements personnels | **Jamais lue par cette spécification.** Aucun rapport, aucun export n'y accède. | Spéc. 001 |
| `booking` — Réservation | Source du nombre de réservations du périmètre. | Spéc. 001 |
| `assignment` — Affectation | Pivot de la mesure. Sa `local_date` et son statut terminé fondent le jour travaillé ; elle relie les évaluations au caddie et au terrain. | Spéc. 001 |
| `evaluation` — Évaluation anonyme | Unité de recueil. Porte la langue, le commentaire facultatif, la note du parcours, les réponses sur le prix, le tarif mémorisé et l'horodatage. | Spéc. 001 |
| `evaluation_criterion_answer` — Réponse par critère | Matière première du score. Une note de 1 à 5, ou l'absence de note valant « non applicable ». | Spéc. 001 |
| `google_review_click` — Clic vers les avis | Source de l'indicateur de clics. Mesure le clic, jamais la publication d'un avis. | Spéc. 001 |
| `audit_log` — Entrée de journal | Trace des exports et des consultations sensibles. | Spéc. 001 |
| **Jour travaillé** | Notion **dérivée, jamais stockée**, définie par FR-044 de la spéc. 1 et reprise ici sans modification. | Spéc. 001 |

**Rappels de règles détenues par la spéc. 001, reprises ici sans modification** :

- Les six critères, leur ordre et le découpage cinq compétences / expérience générale sont fixés par le modèle.
- Une réponse « non applicable » est une absence de note, exclue des moyennes, jamais comptée zéro (FR-043, `evaluation_criterion_answer`).
- Le score du caddie, la note du parcours et la valeur perçue du prix sont trois mesures distinctes (FR-043).
- Un jour travaillé est une date locale comportant au moins une affectation terminée, comptée une fois (FR-044).
- Chaque évaluation porte le tarif affiché au client au moment de sa réponse (FR-048).
- Quatre évaluations au maximum par affectation (FR-051).
- Un caddie peut servir plusieurs voiturettes, et une réservation porter plusieurs affectations (FR-052).
- Le commentaire est effacé 2 ans après son dépôt ; l'évaluation chiffrée subsiste sans limite (FR-034, FR-034c).
- Un caddie désactivé conserve l'intégralité de son historique (FR-042).
- Aucun agrégat ne mélange deux terrains (FR-026).

## Évolutions demandées à la spéc. 001

Ces points sont **signalés, non décidés ici**. Ils relèvent de la spécification 1, qui seule peut faire évoluer le modèle de données. Tant qu'ils ne sont pas tranchés, la présente spécification ne suppose aucun champ supplémentaire.

1. **Répercuter l'amendement du 2026-09-18 dans `data-model.md`.** Les exigences FR-047 à FR-052 ont été ajoutées à la spécification 1, mais le document `data-model.md` ne les reflète pas encore : la table `evaluation` n'y montre pas le tarif mémorisé exigé par FR-048, aucune table n'y accueille le signal « Non, ce n'est pas mon caddie » exigé par FR-047, et la table `caddie` n'y porte pas la disponibilité opérationnelle exigée par FR-049. **Demande** : mettre `data-model.md` en conformité avec l'amendement. Sans cela, la présente spécification s'appuie sur FR-048 pour FR-460 alors que le document qui fait autorité sur le schéma ne mentionne pas le champ correspondant.

2. **Nommer la devise et la précision du tarif mémorisé.** FR-048 fixe le montant en MAD. Les analyses de FR-460 et FR-461 regroupent les évaluations par tarif mémorisé : il faut savoir si ce montant est un entier de dirhams ou s'il admet des décimales, et si une évolution future vers une autre devise est envisagée. **Demande** : préciser le type et la devise du tarif mémorisé dans `data-model.md`.

3. **Trancher le sort des évaluations rattachées à une affectation annulée.** FR-415 les écarte des moyennes et FR-416 les dénombre à part. Le modèle actuel ne dit pas si ce cas peut survenir — une affectation peut passer à `cancelled` après qu'un client a évalué. **Demande** : confirmer que ce cas est possible et, si oui, indiquer s'il doit rester une simple anomalie dénombrée ou faire l'objet d'un traitement au niveau du modèle.

4. **Préciser la notion de « moyenne du parcours » dans le vocabulaire de référence.** Le modèle porte une « note du parcours » (`course_rating`) qui appartient au terrain, et la présente spécification introduit une « moyenne du parcours » qui est l'agrégat des scores des caddies du terrain. Les deux termes sont proches et désignent des mesures qui ne doivent jamais se mélanger. **Demande** : fixer les deux dénominations dans la spéc. 1 afin qu'aucune autre spécification ni aucun écran ne les confonde.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-401** : Sur 100 % des jeux de notes de test, le score calculé est **strictement égal** au score obtenu par application manuelle de la formule 70 / 30, au centième près.
- **SC-402** : Une moyenne calculée sur un jeu comportant des réponses « non applicable » est **strictement égale** à la moyenne des seules réponses chiffrées, sur l'ensemble des jeux de test, et **strictement supérieure** à la valeur qu'on obtiendrait en comptant ces réponses zéro dès qu'au moins une note dépasse zéro.
- **SC-403** : Deux évaluations portant les mêmes notes sur les six critères produisent un score **strictement identique**, quelles que soient la note du parcours et les réponses sur le prix, sur 100 % des combinaisons testées.
- **SC-404** : Sur 100 % des jeux d'affectations de test, le nombre de jours travaillés est égal au nombre de dates locales distinctes comportant au moins une affectation terminée, y compris lorsque plusieurs affectations, réservations ou voiturettes se présentent le même jour.
- **SC-405** : Un administrateur obtient le tableau de bord complet d'un caddie sur une période choisie en **moins de 3 clics** depuis son écran d'accueil, et l'écran s'affiche en **moins de 2 secondes** sur un terrain de 100 caddies et 300 départs par jour.
- **SC-406** : **100 %** des comparaisons affichées présentent les quatre éléments exigés — note du caddie, moyenne du parcours, écart signé, nombre d'évaluations utilisées.
- **SC-407** : **100 %** des comparaisons reposant sur moins de 5 évaluations portent la mention de non-significativité, et **aucune** n'est masquée.
- **SC-408** : Un administrateur retrouve à la main, à partir des seules valeurs affichées à l'écran, le score final d'un caddie sur **100 %** des fiches testées.
- **SC-409** : **Aucune** donnée personnelle — année de naissance, adresse, taille d'habits — n'est retrouvée dans un rapport, un export, une adresse Web de rapport, un nom de fichier ou un message d'erreur, sur un échantillon couvrant l'intégralité des écrans et des filtres.
- **SC-410** : **100 %** des tentatives d'accès d'un compte Starter à un rapport, une note, un commentaire ou un export sont refusées, y compris par manipulation directe d'un identifiant.
- **SC-411** : **Aucun** rapport, agrégat ni export ne contient de donnée d'un terrain non sélectionné, sur l'ensemble des combinaisons de filtres testées avec un compte rattaché à deux terrains.
- **SC-412** : Après désactivation d'un caddie, purge d'un commentaire ou effacement de renseignements personnels, les moyennes et comparaisons d'une période passée sont **strictement identiques** à celles calculées avant l'opération.
- **SC-413** : Un même périmètre consulté depuis le tableau de bord, depuis une fiche de caddie et depuis un export produit des valeurs **strictement identiques**, sur 100 % des périmètres testés.

## Assumptions

Ces choix ont été retenus faute de précision explicite. Ils sont modifiables tant que le développement n'a pas commencé.

- **Mode d'agrégation du score sur une période** : le score d'un périmètre est obtenu en appliquant la pondération 70 / 30 aux moyennes de période, et non en moyennant les scores évaluation par évaluation. Les deux méthodes donnent des résultats différents dès que les évaluations n'ont pas toutes le même nombre de réponses chiffrées. Celle retenue est la seule qui permette à l'administrateur de **refaire le calcul à partir des chiffres affichés** ; l'autre produirait un total que les lignes du tableau ne permettraient pas de reconstituer, ce qui est précisément ce qui détruit la confiance dans un indicateur.
- **Poids des évaluations d'une même partie** : les quatre évaluations possibles d'une même affectation pèsent chacune d'un poids égal. Aucune moyenne par partie n'est calculée avant l'agrégation. Conséquence assumée : une partie évaluée quatre fois pèse quatre fois plus qu'une partie évaluée une fois. Ce fait est affiché plutôt que corrigé, une correction silencieuse étant plus trompeuse que le déséquilibre qu'elle prétend réparer.
- **Seuil de pertinence statistique** : **5 évaluations**, décision du propriétaire du produit. En dessous, la comparaison est affichée et explicitement marquée comme non significative, jamais masquée.
- **Format d'export** : **CSV uniquement** pour le pilote, décision du propriétaire du produit. PDF, Excel et impression directe sont reportés.
- **Premier jour de la semaine** : le **lundi**, pour les découpages hebdomadaires. Choix aligné sur l'usage local et sur la lecture d'un calendrier d'exploitation.
- **Période par défaut** : les **30 derniers jours** en dates locales du terrain, un tableau de bord devant afficher quelque chose d'utile avant toute saisie de filtre.
- **Aucune alerte, aucune notification** : le produit affiche des mesures, il ne déclenche ni alerte de seuil ni notification. Un caddie dont le score baisse n'engendre aucun message automatique.
- **Aucun objectif ni cible chiffrée** : le produit ne porte aucune valeur cible de score. La comparaison se fait à la moyenne du parcours, jamais à un objectif fixé par l'outil.
- **Langue des rapports** : les écrans administrateur et les exports sont en français, conformément à la spéc. 1. Les cinq langues concernent le seul questionnaire client.
- **Devise** : les montants sont exprimés en dirhams marocains (MAD).

## Dependencies

- **Spécification 1** — modèle de données de référence, comptes, permissions, cloisonnement et journalisation. Les quatre évolutions signalées plus haut relèvent d'elle. Les exigences FR-460 et FR-461 s'appuient sur FR-048, dont la traduction dans `data-model.md` reste à porter.
- **Spécification 2** — caddies et voiturettes : sans caddies enregistrés, aucun sujet à mesurer.
- **Spécification 3** — réservations et affectations : sans affectations terminées, ni jour travaillé, ni taux de réponse, ni rattachement des évaluations à un caddie.
- **Spécification 4** — questionnaire client : seule source des évaluations, des commentaires, des réponses sur le prix et des clics vers les avis Google. Aucun indicateur de cette spécification n'a de matière sans elle.
- **Volume minimal d'exploitation** : les comparaisons ne deviennent significatives qu'à partir de 5 évaluations par caddie et par période. Le pilote doit atteindre ce volume avant que le tableau de bord ne délivre sa valeur complète — c'est une dépendance de calendrier, pas une tâche technique.
- **Fuseau horaire de chaque terrain**, correctement renseigné, sans quoi les dates locales, les jours travaillés, les semaines et les mois sont faux.

## Out of Scope

- Définition ou modification d'entités, de champs ou de règles de calcul du modèle de données — relève de la spécification 1.
- Recueil des évaluations, écrans clients et traductions — spécification 4.
- Création, correction et clôture des affectations — spécification 3.
- Import des caddies, gestion des voiturettes et des QR codes — spécification 2.
- Export au format PDF, au format tableur natif et impression directe — reportés après le pilote par décision du propriétaire du produit.
- Alertes automatiques, notifications et objectifs de performance chiffrés.
- Rapports comparatifs entre plusieurs terrains : interdits par le principe IV de la constitution, quel que soit le rattachement du compte.
- Modération des commentaires, détection de contenu inapproprié et réponse aux clients.
- Décompte et analyse des signaux « Non, ce n'est pas mon caddie » (FR-047) : cet indicateur n'a pas été demandé par le propriétaire du produit parmi les KPI de cette phase et n'est donc pas spécifié ici.
- Rémunération, primes, sanctions et toute conséquence contractuelle attachée à un score : le produit mesure, il ne décide pas.
- Prévision, projection de tendance et détection automatique d'anomalie.
