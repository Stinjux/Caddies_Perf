# Feature Specification: Réservations et affectations — l'écran du Starter

**Feature Branch**: `003-reservations-affectations`

**Created**: 2026-09-18

**Status**: Draft

**Input**: Spécification n°3 de CaddiePerf. Elle couvre les phases 10 et 11 du projet : l'import et la gestion des réservations issues du système existant du terrain, l'écran du Starter sur le départ, et le cycle de vie complet d'une affectation, y compris tous ses cas d'erreur.

## Rôle de cette spécification

Cette spécification **ne détient pas le modèle de données**. Elle s'appuie sur la [spécification n°1](../001-socle-comptes-terrains/spec.md) et sur son [modèle de données de référence](../001-socle-comptes-terrains/data-model.md).

- Les entités `booking`, `assignment`, `cart` et `caddie` sont **définies dans la spéc. 1**. Ce document ne redéfinit ni leurs champs, ni leurs contraintes, ni leurs règles de calcul.
- Ce document décrit **ce qui se passe** avec ces entités : qui agit, dans quel ordre, ce que le système accepte, ce qu'il refuse, et ce qu'il affiche.
- Toute lacune du modèle constatée ici est consignée dans la section « [Évolutions demandées à la spécification 1](#évolutions-demandées-à-la-spécification-1) ». Aucun champ n'est inventé localement.
- Le [contrat de non-exposition pour le Starter](../001-socle-comptes-terrains/contracts/server-contracts.md#7-contrat-de-non-exposition-pour-le-starter) s'applique intégralement à tous les écrans décrits ici, sans exception ni assouplissement.

**Couvert ici** : import CSV des réservations, cycle de vie d'une réservation, écran d'affectation du Starter, création, correction, terminaison et annulation d'une affectation, signalement d'indisponibilité, et les cas d'erreur de résolution d'une voiturette vers son affectation.

**Défini ailleurs** : modèle de données et cloisonnement (spéc. 1), import des caddies et génération des QR codes des voiturettes (spéc. 2), questionnaire client déclenché depuis le QR code (spéc. 4), score du caddie et décompte présenté des jours travaillés (spéc. 5).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Le Starter affecte un caddie et une voiturette sur le départ (Priority: P1)

C'est le parcours central du produit. Un joueur se présente au départ. Le Starter, debout, téléphone en main, en plein soleil, ouvre l'écran des départs de son terrain, repère la réservation correspondante, choisit une voiturette disponible, choisit un caddie disponible, et valide. L'affectation existe désormais et relie la réservation, la voiturette et le caddie.

Le Starter **ne crée pas** la réservation : elle provient du système de réservation existant du terrain. Il **associe** à une réservation déjà présente une voiturette et un caddie.

**Why this priority** : sans affectation, rien d'autre du produit n'existe. L'affectation est le pivot entre l'exploitation du terrain et toute la mesure de performance : aucune évaluation client, aucun score, aucun jour travaillé ne peut être produit sans elle. C'est aussi le seul geste que le produit demande au personnel du terrain plusieurs dizaines de fois par jour.

**Independent Test** : sur un terrain de test contenant des réservations importées, des voiturettes et des caddies, un Starter crée une affectation complète depuis un téléphone et la retrouve immédiatement dans la liste des affectations du jour. Cela suffit à démontrer de la valeur : le terrain sait qui accompagne quel départ, sur quelle voiturette.

**Acceptance Scenarios** :

1. **Given** un Starter connecté ayant sélectionné son terrain, **When** il ouvre l'écran des départs, **Then** il voit les réservations du jour en cours et à venir de ce terrain seul, ordonnées par heure de départ, avec leur numéro de réservation, leur heure de départ et l'indication de leur affectation éventuelle.
2. **Given** une réservation sans affectation, **When** le Starter sélectionne une voiturette disponible et un caddie disponible puis valide, **Then** l'affectation est créée en statut actif, avec l'heure de début, la date locale du terrain, et le compte Starter qui l'a créée.
3. **Given** une affectation qui vient d'être créée, **When** le Starter revient à la liste des départs, **Then** la réservation porte visiblement le numéro de voiturette et le nom du caddie affectés.
4. **Given** un caddie déjà affecté à une partie en cours, **When** le Starter ouvre la liste des caddies, **Then** ce caddie n'apparaît pas parmi les caddies proposés, et la raison affichée est « déjà sur un départ ».
5. **Given** une voiturette déjà affectée à une partie en cours, **When** le Starter ouvre la liste des voiturettes, **Then** cette voiturette n'est pas proposée.
6. **Given** un caddie qui a déjà terminé une partie aujourd'hui, **When** le Starter ouvre la liste des caddies, **Then** ce caddie est proposé normalement : plusieurs réservations le même jour pour un même caddie sont attendues et permises.
7. **Given** le Starter sur l'écran d'affectation, **When** il consulte les informations d'un caddie, **Then** il ne voit que l'identifiant interne, le prénom, le nom et la disponibilité — ni année de naissance, ni note, ni commentaire, ni jeton de QR code.
8. **Given** deux Starters du même terrain affectant simultanément le même caddie à deux réservations différentes, **When** le second valide, **Then** sa demande est refusée avec un message indiquant que le caddie vient d'être affecté, et l'écran se rafraîchit.

---

### User Story 2 - Importer les réservations du système existant du terrain (Priority: P1)

Le terrain dispose déjà d'un système de réservation. Ce système produit un export au format CSV des départs. Un administrateur dépose ce fichier dans la plateforme ; les réservations y apparaissent, prêtes à être affectées par le Starter.

Aucune intégration directe avec le système de réservation n'est prévue pour le pilote.

**Why this priority** : sans réservations dans la plateforme, le Starter n'a rien à quoi rattacher un caddie. C'est la condition d'existence du parcours 1.

**Independent Test** : un administrateur importe un fichier fictif de 60 départs pour un terrain ; les 60 réservations apparaissent dans l'écran des départs de ce terrain, avec le bon numéro de réservation et la bonne heure, exprimée dans le fuseau horaire du terrain.

**Acceptance Scenarios** :

1. **Given** un administrateur connecté sur un terrain, **When** il dépose un fichier d'export de réservations valide, **Then** le système présente un aperçu du nombre de lignes lues, du nombre de réservations nouvelles, mises à jour et ignorées, **avant** toute écriture.
2. **Given** l'aperçu affiché, **When** l'administrateur confirme, **Then** les réservations sont enregistrées sur le terrain actif et sur lui seul.
3. **Given** un import déjà réalisé, **When** le même fichier est importé une seconde fois, **Then** aucune réservation n'est dupliquée : le numéro de réservation du système source identifie la ligne de façon stable.
4. **Given** un fichier contenant une ligne dont le numéro de réservation est vide ou dont l'heure de départ est illisible, **When** l'import est exécuté, **Then** cette ligne est rejetée, comptée dans un rapport de rejet indiquant son numéro de ligne et la raison, et les autres lignes sont importées normalement.
5. **Given** un fichier contenant des colonnes non attendues, **When** l'import est exécuté, **Then** ces colonnes sont ignorées et leur contenu n'est ni stocké, ni affiché, ni journalisé.
6. **Given** un fichier dont l'heure de départ est exprimée sans fuseau horaire, **When** l'import est exécuté, **Then** l'heure est interprétée dans le fuseau horaire du terrain et affichée ensuite dans ce même fuseau.
7. **Given** un compte Starter, **When** il tente d'importer un fichier de réservations, **Then** l'action est refusée.

---

### User Story 3 - Corriger une affectation erronée sans perdre la trace (Priority: P1)

Le Starter s'est trompé, ou la situation a changé : ce n'est pas le bon caddie, la voiturette est tombée en panne, le caddie doit être remplacé alors que la partie a déjà commencé. Il corrige depuis son téléphone, en quelques secondes, sans appeler personne.

**Why this priority** : l'erreur de saisie sur le départ est certaine, pas hypothétique — écran au soleil, joueur qui attend, gants, précipitation. Une correction impossible ou pénible rendrait les données inexploitables et ferait abandonner l'outil dès la première semaine. C'est la contrepartie indispensable du parcours 1.

**Independent Test** : un Starter crée une affectation avec le mauvais caddie, s'en aperçoit, le remplace ; l'affectation porte ensuite le bon caddie, et le décompte des jours travaillés n'attribue rien au caddie retiré si la partie ne lui a jamais été comptée comme terminée.

**Acceptance Scenarios** :

1. **Given** une affectation active portant le mauvais caddie, **When** le Starter la modifie et choisit un autre caddie disponible, **Then** l'affectation porte le nouveau caddie, le caddie retiré redevient disponible, et la modification est journalisée.
2. **Given** une affectation active dont la voiturette tombe en panne, **When** le Starter y substitue une autre voiturette disponible, **Then** l'affectation porte la nouvelle voiturette, l'ancienne cesse d'être considérée comme affectée, et le questionnaire client ultérieur pointe vers la nouvelle.
3. **Given** une affectation active, **When** le Starter en modifie le caddie ou la voiturette, **Then** la réservation d'origine reste inchangée : une correction d'affectation ne modifie jamais le départ.
4. **Given** une affectation déjà terminée, **When** le Starter tente d'en changer le caddie, **Then** l'opération est refusée avec un message indiquant que la partie est terminée et qu'un administrateur peut seul intervenir.
5. **Given** une affectation active créée par erreur sur la mauvaise réservation, **When** le Starter l'annule, **Then** elle passe en statut annulé, ne compte pour aucun jour travaillé, et la réservation redevient disponible pour une nouvelle affectation.
6. **Given** une affectation modifiée plusieurs fois, **When** un administrateur consulte le journal, **Then** il retrouve chaque modification avec son auteur et son horodatage, sans qu'aucune donnée personnelle n'y figure.

---

### User Story 4 - Terminer une affectation et alimenter le jour travaillé (Priority: P2)

La partie est finie. Le Starter, ou le personnel qui récupère la voiturette, marque l'affectation comme terminée. Le caddie et la voiturette redeviennent disponibles, et la journée compte pour le caddie.

**Why this priority** : c'est ce geste qui transforme une affectation en donnée de gestion : seul le statut terminé alimente le décompte des jours travaillés, et seule une affectation terminée ferme proprement la disponibilité du caddie et de la voiturette. Non bloquant pour la première démonstration du parcours 1, d'où P2.

**Independent Test** : un Starter termine trois affectations du même caddie le même jour ; le décompte des jours travaillés de ce caddie augmente exactement de un.

**Acceptance Scenarios** :

1. **Given** une affectation active, **When** le Starter la termine, **Then** elle passe en statut terminé, porte une heure de fin, et son caddie comme sa voiturette redeviennent disponibles.
2. **Given** un caddie ayant trois affectations terminées le même jour local du terrain, **When** on calcule ses jours travaillés, **Then** cette date compte pour **un** seul jour.
3. **Given** un caddie n'ayant que des affectations actives ou annulées à une date, **When** on calcule ses jours travaillés, **Then** cette date ne compte pas.
4. **Given** une affectation commencée avant minuit et terminée après minuit dans le fuseau du terrain, **When** on détermine le jour travaillé, **Then** c'est la date locale du **début** de l'affectation qui compte, fixée à la création.
5. **Given** une affectation déjà terminée, **When** le Starter tente de la terminer une seconde fois, **Then** l'opération est sans effet et aucun doublon de jour travaillé n'est produit.

---

### User Story 5 - Signaler un caddie ou une voiturette indisponible (Priority: P2)

Un caddie est parti, malade ou déjà réservé ailleurs. Une voiturette a une batterie à plat. Le Starter le signale immédiatement pour qu'aucun collègue ne les propose au départ suivant.

**Why this priority** : sans ce geste, la liste des disponibles ment dès la première heure de la journée, et le Starter cesse de lui faire confiance. Important, mais démontrable après le parcours d'affectation lui-même.

**Independent Test** : un Starter signale une voiturette indisponible ; elle disparaît immédiatement de la liste des voiturettes proposables, sur son écran comme sur celui d'un second Starter du même terrain.

**Acceptance Scenarios** :

1. **Given** une voiturette libre, **When** le Starter la signale indisponible, **Then** elle cesse d'être proposée à l'affectation sur ce terrain, et le signalement est journalisé avec son auteur.
2. **Given** un caddie libre, **When** le Starter le signale indisponible pour la journée, **Then** il cesse d'être proposé, sans que son historique ni son statut permanent ne soient modifiés.
3. **Given** un caddie ou une voiturette signalé indisponible, **When** le Starter rétablit sa disponibilité, **Then** il redevient proposable immédiatement.
4. **Given** une voiturette engagée dans une affectation active, **When** le Starter la signale indisponible, **Then** le système demande d'abord de lui substituer une autre voiturette ou de terminer la partie : une affectation active ne reste jamais accrochée à une voiturette déclarée hors service.
5. **Given** un compte Starter, **When** il signale une indisponibilité, **Then** aucune donnée personnelle n'est demandée ni enregistrée pour justifier le signalement.

---

### User Story 6 - Le système résout une voiturette vers la bonne affectation, ou explique proprement pourquoi il ne peut pas (Priority: P2)

Un joueur scanne le QR code permanent d'une voiturette. Le serveur, et lui seul, cherche l'affectation active correspondante. Cette recherche doit répondre correctement dans tous les cas : aucune affectation, plusieurs affectations, partie terminée depuis trop longtemps, réservation annulée, voiturette indisponible.

**Why this priority** : c'est la porte d'entrée du questionnaire client spécifié en n°4. Cette spécification n'en décrit pas le contenu, mais elle doit garantir que la **résolution** vers l'affectation est exacte et couvre tous les cas d'échec — sans quoi le questionnaire évaluerait le mauvais caddie.

**Independent Test** : pour chacun des cinq cas d'échec, on présente au serveur l'identifiant d'une voiturette et l'on vérifie que la réponse est celle attendue, sans jamais exposer de donnée personnelle.

**Acceptance Scenarios** :

1. **Given** une voiturette portant exactement une affectation active, **When** son identifiant est présenté au serveur, **Then** le serveur renvoie cette affectation et elle seule.
2. **Given** une voiturette sans aucune affectation active, **When** son identifiant est présenté, **Then** le serveur répond par un message neutre invitant à s'adresser au personnel, sans révéler l'existence ou non de la voiturette.
3. **Given** une voiturette portant plusieurs affectations actives, **When** son identifiant est présenté, **Then** le serveur ne devine pas : il traite la situation comme une ambiguïté à lever par le personnel et la signale aux administrateurs du terrain.
4. **Given** une affectation terminée depuis plus longtemps que le délai retenu, **When** l'identifiant de sa voiturette est présenté, **Then** la résolution échoue avec un message indiquant que la partie est close.
5. **Given** une affectation dont la réservation a été annulée, **When** l'identifiant de sa voiturette est présenté, **Then** la résolution échoue proprement, sans erreur technique et sans données du départ annulé.
6. **Given** une voiturette signalée indisponible, **When** son identifiant est présenté, **Then** la résolution échoue avec un message neutre.
7. **Given** n'importe lequel de ces cas d'échec, **When** on inspecte l'adresse consultée, le message affiché et les journaux techniques, **Then** aucun nom, aucun numéro de réservation et aucune donnée personnelle n'y figure.

---

### User Story 7 - Suivre les affectations de la journée (Priority: P3)

En milieu de journée, le Starter veut savoir où en est son terrain : combien de parties en cours, quels caddies sont sur le parcours, quels départs restent à couvrir.

**Why this priority** : confort d'exploitation, utile mais non bloquant. Le produit fonctionne sans cette vue ; elle améliore la coordination entre deux Starters qui se relaient.

**Independent Test** : après création de dix affectations dont quatre terminées, l'écran de suivi montre exactement six parties en cours et quatre terminées pour la journée locale du terrain.

**Acceptance Scenarios** :

1. **Given** un Starter connecté, **When** il consulte les affectations du jour, **Then** il voit les affectations actives et terminées de la journée locale de son terrain, et d'aucun autre.
2. **Given** l'écran de suivi, **When** le Starter le consulte, **Then** chaque ligne porte le numéro de réservation, l'heure de départ, le numéro de voiturette, le caddie et le statut, et rien d'autre.
3. **Given** un départ à venir sans affectation, **When** son heure approche, **Then** il est mis en évidence comme restant à couvrir.
4. **Given** un Starter rattaché à deux terrains, **When** il change de terrain actif, **Then** l'écran ne conserve aucune affectation du terrain précédent.

---

### Edge Cases

Les huit premiers cas sont exigés par le propriétaire du produit.

1. **Aucune affectation active pour une voiturette scannée** — le serveur répond par un message neutre invitant le joueur à s'adresser au personnel du départ. Il ne révèle ni l'existence de la voiturette, ni celle d'affectations passées.
2. **Plusieurs affectations actives trouvées pour une même voiturette** — le système ne choisit jamais arbitrairement. Il refuse de résoudre, invite à s'adresser au personnel, et signale l'anomalie aux administrateurs du terrain pour qu'elle soit corrigée. Ce cas doit rester impossible en exploitation normale : la création d'une affectation sur une voiturette déjà engagée est refusée.
3. **Mauvais caddie affiché** — le Starter constate que le caddie porté par l'affectation n'est pas celui qui accompagne réellement le joueur. Il corrige l'affectation en place ; le caddie retiré redevient disponible et ne conserve aucune trace de cette partie dans son décompte.
4. **Changement de caddie en cours de partie** — le premier caddie est remplacé alors que la partie a commencé. Le système doit conserver la trace du remplacement, faute de quoi ni le décompte des jours travaillés ni l'évaluation client ne seraient attribuables correctement. *La façon de conserver cette trace relève du modèle de données — voir [Évolutions demandées à la spécification 1](#évolutions-demandées-à-la-spécification-1).*
5. **Changement de voiturette** — la voiturette tombe en panne. Le Starter en substitue une autre à l'affectation. Le QR code de la nouvelle voiturette résout désormais vers cette affectation ; celui de l'ancienne ne résout plus vers elle.
6. **Réservation annulée** — une réservation annulée dans le système source, puis réimportée, ne peut plus recevoir de nouvelle affectation. Si elle en portait une active, celle-ci est signalée au Starter pour décision explicite ; elle n'est jamais annulée en silence.
7. **Voiturette indisponible** — une voiturette signalée hors service n'est plus proposée, et son QR code ne résout plus vers une affectation. Si elle portait une affectation active, le Starter doit d'abord lui substituer une voiturette ou terminer la partie.
8. **Partie terminée depuis trop longtemps** — passé le délai retenu, la résolution du QR code échoue avec un message indiquant que la partie est close. Le délai s'apprécie à partir de l'heure de fin de l'affectation, dans le fuseau du terrain.
9. **Réservation importée alors qu'une affectation est déjà en cours dessus** — l'import ne détruit jamais une affectation active. Si la ligne réimportée diverge de ce qui est enregistré, elle est marquée en conflit et présentée à l'administrateur, qui tranche.
10. **Import d'un fichier portant sur un autre terrain** — les réservations sont écrites sur le terrain actif de l'importateur et sur lui seul. Aucune colonne du fichier ne peut désigner un autre terrain.
11. **Départ passé jamais affecté** — une réservation dont l'heure de départ est dépassée et qui n'a reçu aucune affectation reste visible comme non couverte, sans bloquer la journée ; elle n'entre dans aucun décompte de jour travaillé.
12. **Affectation active oubliée en fin de journée** — une affectation restée active bien après son heure de départ est mise en évidence pour que le Starter la termine ou l'annule ; le système ne la termine jamais de lui-même, car une terminaison automatique fabriquerait de faux jours travaillés.
13. **Deux Starters affectant simultanément le même caddie ou la même voiturette** — le second geste est refusé avec un message clair, jamais résolu par écrasement silencieux.
14. **Caddie désactivé alors qu'il est sur une partie** — l'affectation active suit son cours et peut être terminée ; le caddie n'est simplement plus proposé pour un nouveau départ, et son historique reste intact.
15. **Changement d'heure légale pendant une partie** — la date locale de l'affectation est celle calculée à sa création et ne change plus, ce qui évite qu'une partie bascule de jour au milieu du parcours.
16. **Perte de réseau sur le départ** — le Starter doit comprendre sans ambiguïté si son affectation a été enregistrée ou non ; aucune affectation ne doit être créée en double à la suite d'une nouvelle tentative.

## Requirements *(mandatory)*

### Import des réservations

- **FR-201** : Le système DOIT permettre à un administrateur d'importer les réservations d'un terrain à partir d'un fichier d'export au format CSV produit par le système de réservation existant de ce terrain.
- **FR-202** : L'import DOIT présenter un aperçu du résultat — lignes lues, réservations nouvelles, mises à jour, rejetées — **avant** toute écriture, et n'écrire qu'après confirmation explicite.
- **FR-203** : Le système DOIT reconnaître les colonnes suivantes dans le fichier source : **Décision du 2026-09-18** : l'import CSV des réservations est **retiré du périmètre du pilote**. Le Starter saisit lui-même le numéro de réservation et l'heure de départ au moment où il crée l'affectation. Le champ `booking.source` vaut alors `manual`. L'import CSV reste possible plus tard sans modification du modèle.
- **FR-204** : Le système DOIT identifier chaque réservation par le numéro de réservation du système source, unique à l'intérieur d'un terrain ; un second import du même fichier NE DOIT créer aucun doublon.
- **FR-205** : Le système DOIT rejeter individuellement toute ligne dont le numéro de réservation est absent ou dont l'heure de départ est illisible, en poursuivant l'import des autres lignes, et DOIT produire un rapport de rejet indiquant le numéro de ligne et la raison.
- **FR-206** : Le système DOIT ignorer toute colonne du fichier source qui ne sert pas une fonctionnalité du produit ; son contenu NE DOIT être ni stocké, ni affiché, ni journalisé.
- **FR-207** : Le système DOIT interpréter une heure de départ dépourvue de fuseau horaire dans le fuseau horaire du terrain, et la présenter ensuite dans ce même fuseau.
- **FR-208** : L'import DOIT écrire les réservations sur le terrain actif de l'importateur et sur lui seul ; aucune donnée du fichier NE DOIT pouvoir désigner un autre terrain.
- **FR-209** : L'import DOIT être réservé aux comptes administrateurs ; un compte Starter NE DOIT pas pouvoir l'exécuter.
- **FR-210** : Chaque import DOIT être journalisé avec son auteur, son terrain, son horodatage et le nombre de lignes traitées, sans qu'aucune donnée personnelle ne figure dans le journal.
- **FR-211** : Le système NE DOIT JAMAIS supprimer ni annuler en silence une affectation active du fait d'un import ; une divergence entre la ligne importée et l'état enregistré DOIT être signalée à l'administrateur pour décision.

### Cycle de vie d'une réservation

- **FR-212** : Une réservation importée DOIT être visible dans l'écran des départs du terrain dès la fin de l'import confirmé.
- **FR-213** : Le système DOIT refuser la création d'une affectation sur une réservation annulée.
- **FR-214** : Lorsqu'une réservation portant une affectation active devient annulée, le système DOIT le signaler au Starter et attendre une décision explicite ; il NE DOIT pas clore l'affectation de lui-même.
- **FR-215** : Une réservation dont l'heure de départ est dépassée et qui ne porte aucune affectation DOIT rester consultable et signalée comme non couverte.
- **FR-216** : Un compte Starter NE DOIT pouvoir ni créer, ni modifier, ni annuler une réservation ; il ne fait que lui associer une voiturette et un caddie.

### Écran du Starter — consultation

- **FR-217** : Le système DOIT présenter au Starter les réservations en cours et à venir du terrain actif, ordonnées par heure de départ.
- **FR-218** : Pour chaque réservation, le Starter NE DOIT voir que : le numéro de réservation, l'heure de départ, le numéro de voiturette affectée le cas échéant, l'identifiant interne du caddie affecté, son prénom, son nom, et le statut de l'affectation.
- **FR-219** : Le système DOIT présenter au Starter la liste des voiturettes proposables et la liste des caddies proposables du terrain actif, chacune indiquant la disponibilité.
- **FR-220** : Pour chaque caddie, le Starter NE DOIT voir que : l'identifiant interne, le prénom, le nom, la disponibilité et l'affectation courante. Toute autre information — année de naissance, ancienneté, notes, scores, commentaires, rapports, jeton de QR code — NE DOIT lui être transmise sous aucune forme, y compris dans les échanges en arrière-plan.
- **FR-221** : Le système DOIT présenter les dates et heures dans le fuseau horaire du terrain, jamais dans celui de l'appareil du Starter.
- **FR-222** : L'interface du Starter DOIT être conçue pour un usage mobile à une main, debout et en plein soleil : cibles tactiles larges, fort contraste, texte lisible, et aucune action destructrice atteignable par erreur.
- **FR-223** : Le système DOIT permettre au Starter de retrouver une réservation par son numéro ou par son heure de départ sans faire défiler l'ensemble de la journée.

### Création d'une affectation

- **FR-224** : Le système DOIT permettre à un Starter de créer une affectation reliant une réservation, une voiturette et un caddie de son terrain actif.
- **FR-225** : Le système DOIT refuser toute affectation reliant des entités appartenant à des terrains différents.
- **FR-226** : Le système DOIT refuser la création d'une affectation sur une voiturette déjà engagée dans une affectation active.
- **FR-227** : Le système DOIT refuser la création d'une affectation sur un caddie déjà engagé dans une affectation active.
- **FR-228** : Le système DOIT permettre qu'un même caddie soit affecté à **plusieurs réservations le même jour**, dès lors que ses affectations précédentes de la journée sont terminées ou annulées.
- **FR-229** : Le système DOIT refuser la création d'une affectation sur un caddie ou une voiturette signalé indisponible.
- **FR-230** : Le système DOIT enregistrer, à la création d'une affectation, le compte Starter auteur et l'heure de début.
- **FR-231** : Le système DOIT garantir qu'une nouvelle tentative de création après une interruption réseau ne produit pas deux affectations pour la même réservation.
- **FR-232** : Le système DOIT indiquer au Starter, en cas de refus, la raison exacte du refus et l'action corrective possible, sans jamais révéler de donnée personnelle.
- **FR-233** : Le système DOIT traiter le nombre de caddies et de voiturettes attendus par départ conformément à la règle suivante : **Décision du 2026-09-18** : **une voiturette par caddie** en règle générale. Une partie à quatre joueurs mobilise au moins deux voiturettes, ou quatre chariots — donc autant de QR codes. Lorsqu'un seul caddie sert deux voiturettes, il est **affecté aux deux** : deux affectations distinctes, même caddie. Scanner l'un ou l'autre QR mène au même caddie (FR-052 de la spéc. 001).

### Modification, terminaison et annulation d'une affectation

- **FR-234** : Le système DOIT permettre à un Starter de remplacer le caddie d'une affectation active par un autre caddie proposable du même terrain.
- **FR-235** : Le système DOIT permettre à un Starter de remplacer la voiturette d'une affectation active par une autre voiturette proposable du même terrain.
- **FR-236** : Après remplacement, le caddie ou la voiturette retiré DOIT redevenir proposable, et le nouveau DOIT être considéré comme engagé.
- **FR-237** : Le système DOIT conserver la trace de tout remplacement de caddie ou de voiturette sur une affectation, afin que l'attribution d'une évaluation et le décompte des jours travaillés restent explicables.
- **FR-238** : Une modification d'affectation NE DOIT JAMAIS modifier la réservation associée.
- **FR-239** : Le système DOIT permettre à un Starter de terminer une affectation active, ce qui enregistre son heure de fin et rend son caddie et sa voiturette de nouveau proposables.
- **FR-240** : Le système DOIT permettre à un Starter d'annuler une affectation active créée par erreur ; une affectation annulée NE DOIT compter pour aucun jour travaillé.
- **FR-241** : Le système DOIT refuser à un Starter la modification d'une affectation déjà terminée ou annulée, en lui indiquant qu'un administrateur seul peut intervenir.
- **FR-242** : Terminer une affectation déjà terminée DOIT être sans effet et NE DOIT produire aucun jour travaillé supplémentaire.
- **FR-243** : Le système NE DOIT JAMAIS terminer une affectation de lui-même ; une affectation restée active anormalement longtemps DOIT être mise en évidence pour décision humaine.
- **FR-244** : Chaque création, modification, terminaison et annulation d'affectation DOIT être journalisée avec son auteur, son terrain, sa cible et son horodatage, sans donnée personnelle.

### Disponibilité des caddies et des voiturettes

- **FR-245** : Le système DOIT permettre à un Starter de signaler un caddie indisponible et de rétablir sa disponibilité.
- **FR-246** : Le système DOIT permettre à un Starter de signaler une voiturette indisponible et de rétablir sa disponibilité.
- **FR-247** : Un signalement d'indisponibilité par un Starter NE DOIT pas modifier le statut permanent du caddie ou de la voiturette, ni altérer leur historique.
- **FR-248** : Le système DOIT refuser de signaler indisponible une voiturette engagée dans une affectation active tant que celle-ci n'a pas été terminée ou réaffectée à une autre voiturette.
- **FR-249** : Le système NE DOIT demander ni enregistrer aucune donnée personnelle pour justifier un signalement d'indisponibilité.
- **FR-250** : La disponibilité présentée au Starter DOIT refléter l'état réel du terrain à l'instant de la consultation, y compris les actions d'un autre Starter du même terrain.

### Résolution d'une voiturette vers son affectation

- **FR-251** : Le serveur seul DOIT résoudre l'identifiant opaque d'une voiturette vers son affectation ; aucune information ne DOIT permettre cette résolution côté navigateur.
- **FR-252** : La résolution DOIT renvoyer exactement une affectation active lorsqu'il en existe une seule pour cette voiturette.
- **FR-253** : Lorsqu'aucune affectation active n'existe, la résolution DOIT échouer avec un message neutre, sans révéler l'existence de la voiturette ni celle d'affectations passées.
- **FR-254** : Lorsque plusieurs affectations actives existent pour une même voiturette, le système NE DOIT PAS en choisir une : la résolution échoue, invite à s'adresser au personnel, et l'anomalie est signalée aux administrateurs du terrain.
- **FR-255** : La résolution DOIT échouer lorsque l'affectation est terminée depuis plus de **Décision du 2026-09-18** : le délai est **paramétrable par terrain** (`golf_course.evaluation_window_hours`, FR-050 de la spéc. 001). En l'absence de valeur, la limite est la **fin de la journée locale du terrain**., le délai s'appréciant dans le fuseau horaire du terrain.
- **FR-256** : La résolution DOIT échouer lorsque la réservation associée est annulée, ou lorsque la voiturette est signalée indisponible.
- **FR-257** : Aucun message d'échec, aucune adresse consultée et aucun journal technique produit par la résolution NE DOIT contenir de nom, de numéro de réservation ou de donnée personnelle.

### Cloisonnement, permissions et traçabilité

- **FR-258** : Toute lecture et toute écriture décrites ici DOIVENT être filtrées par le terrain actif, ce filtrage étant appliqué par le serveur et jamais déduit d'une information fournie par le navigateur.
- **FR-259** : Le système DOIT empêcher deux modifications concurrentes d'une même affectation de s'écraser silencieusement, et présenter au second auteur un message l'invitant à recharger.
- **FR-260** : Un refus lié à un terrain non rattaché DOIT être présenté comme une ressource introuvable, sans révéler son existence.
- **FR-261** : Les écrans et les échanges de cette fonctionnalité DOIVENT être vérifiés par un test de bout en bout simulant une journée complète de Starter et inspectant toutes les réponses réseau ; la présence d'un seul champ interdit fait échouer le test.

## Entités référencées

Aucune entité n'est définie ici. Les définitions font autorité dans [`specs/001-socle-comptes-terrains/data-model.md`](../001-socle-comptes-terrains/data-model.md). Cette section précise uniquement le **comportement** et les **transitions d'état** que cette spécification met en œuvre.

### Réservation — `booking` *(définie en spéc. 1)*

Ce que cette spécification ajoute :

- **Origine** : alimentée par import CSV depuis le système de réservation existant du terrain. Aucune création manuelle par le Starter.
- **Identification stable** : le numéro de réservation du système source sert de clé de réconciliation d'un import à l'autre.
- **Transitions mises en œuvre** : `scheduled` → `cancelled` et `scheduled` → `completed`, toutes deux à l'initiative du système source via un import, jamais du Starter. Aucun retour arrière, conformément à la spéc. 1.
- **Cardinalité observée** : une réservation porte au plus une affectation active à la fois dans l'état actuel du modèle. Le cas d'un départ à plusieurs caddies reste ouvert (FR-233).

### Affectation — `assignment` *(définie en spéc. 1)*

Ce que cette spécification ajoute :

- **Créateur** : un compte Starter du terrain, jamais un administrateur en exploitation courante.
- **Transitions mises en œuvre** :
  | Depuis | Vers | Déclencheur | Effet |
  |---|---|---|---|
  | — | `active` | Le Starter valide une affectation | Heure de début enregistrée, date locale du terrain figée, caddie et voiturette marqués engagés |
  | `active` | `active` | Remplacement de caddie ou de voiturette | L'entité retirée redevient proposable, la nouvelle devient engagée, la réservation ne bouge pas |
  | `active` | `completed` | Le Starter termine la partie | Heure de fin enregistrée, caddie et voiturette libérés, la date locale devient un jour travaillé |
  | `active` | `cancelled` | Le Starter annule une affectation erronée | Caddie et voiturette libérés, aucun jour travaillé, réservation de nouveau affectable |
  | `completed` / `cancelled` | — | Aucune transition pour le Starter | Toute reprise relève d'un administrateur |
- **Jour travaillé** : notion dérivée définie en spéc. 1, jamais stockée ici. Cette spécification garantit seulement que le statut `completed` est atteint exactement quand la partie est réellement terminée, et jamais par une automatisation.
- **Cloisonnement** : les clés étrangères composites définies en spéc. 1 rendent impossible qu'une affectation relie des entités de deux terrains différents — la base refuse l'écriture. Cette spécification s'appuie sur cette garantie et ne la duplique pas au niveau applicatif.

### Voiturette — `cart` *(définie en spéc. 1, mise en œuvre en spéc. 2)*

Ce que cette spécification ajoute :

- **Proposable** : une voiturette est proposable au Starter lorsqu'elle est disponible et qu'aucune affectation active ne la porte.
- **Transitions mises en œuvre** : `available` ↔ `assigned` au rythme des affectations ; `available` ↔ `maintenance` au rythme des signalements du Starter.
- **Jeton de QR code** : permanent, jamais exposé au Starter, utilisé uniquement par le serveur pour résoudre vers une affectation.

### Caddie — `caddie` *(défini en spéc. 1, mis en œuvre en spéc. 2)*

Ce que cette spécification ajoute :

- **Proposable** : un caddie est proposable lorsqu'il est actif, qu'aucune affectation active ne le porte, et qu'il n'a pas été signalé indisponible pour la journée.
- **Champs visibles par le Starter** : identifiant interne, prénom, nom, disponibilité, affectation courante. Rien d'autre, en aucune circonstance.
- **Aucune transition de statut** n'est déclenchée par cette spécification : le passage `active` ↔ `disabled` reste une action administrateur relevant de la spéc. 2.

## Évolutions demandées à la spécification 1

Ces points sont des lacunes constatées du modèle de référence. Conformément à la règle de cohérence du projet, ils ne sont **pas** résolus ici : ils sont soumis au propriétaire du produit pour être portés, le cas échéant, par la spécification 1.

1. **Indisponibilité temporaire d'un caddie** — FR-245 et FR-247 exigent qu'un Starter puisse retirer un caddie de la liste du jour sans toucher à son statut permanent. Le modèle ne connaît que `active` et `disabled`, tous deux gérés par un administrateur. Il manque une notion de disponibilité opérationnelle, distincte du cycle de vie du caddie. *Aucun champ n'est inventé ici.*
2. **Traçabilité d'un remplacement de caddie ou de voiturette** — FR-237 exige que l'on sache qui accompagnait réellement la partie après un changement en cours de route. Le modèle enregistre l'état courant de l'affectation, pas son historique de composition. Un mécanisme est nécessaire ; sa forme appartient à la spécification 1.
3. **Traçabilité d'un import** — FR-210 et FR-211 supposent que l'on puisse rattacher une réservation à l'import qui l'a produite, pour expliquer une divergence ou un conflit. Le modèle porte `source` mais aucune trace de lot d'import.
4. **Départ à plusieurs caddies** — si la réponse à FR-233 est positive, la relation entre une réservation et ses affectations devra être explicitée dans la spécification 1, ainsi que son effet sur la résolution d'un QR code.
5. **Délai de clôture d'une partie** — la valeur retenue pour FR-255 est un paramètre d'exploitation. Sa place naturelle est dans les paramètres du terrain définis en spécification 1, plutôt qu'en constante applicative.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-201** : Un Starter crée une affectation complète — réservation, voiturette, caddie — en **moins de 20 secondes** depuis un téléphone, debout sur le départ, sans assistance.
- **SC-202** : Un Starter corrige une affectation erronée, caddie ou voiturette, en **moins de 15 secondes**.
- **SC-203** : Un Starter non formé réussit sa première affectation du premier coup dans **au moins 9 cas sur 10**, après une démonstration unique de moins de deux minutes.
- **SC-204** : L'écran des départs d'une journée de 60 réservations s'affiche en **moins de 2 secondes** sur un téléphone d'entrée de gamme en réseau mobile ordinaire.
- **SC-205** : Sur une journée simulée de 60 départs par terrain et 5 terrains, **100 %** des affectations créées relient des entités d'un seul et même terrain.
- **SC-206** : **100 %** des tentatives d'affectation d'un caddie ou d'une voiturette déjà engagé sont refusées, y compris lorsque deux Starters agissent au même instant.
- **SC-207** : Les huit cas d'erreur exigés — aucune affectation, plusieurs affectations, mauvais caddie, changement de caddie, changement de voiturette, réservation annulée, voiturette indisponible, partie close depuis trop longtemps — sont tous couverts par un test automatisé et produisent chacun le comportement attendu.
- **SC-208** : Un import de 60 réservations rejoué à l'identique produit **zéro** réservation dupliquée et **zéro** affectation active détruite.
- **SC-209** : Un fichier d'import contenant 5 % de lignes invalides importe **100 %** des lignes valides et rapporte chacune des lignes rejetées avec sa raison.
- **SC-210** : Aucune donnée personnelle ni aucun champ interdit n'apparaît dans les échanges reçus par un compte Starter sur une journée de travail simulée complète, écrans et réponses réseau compris.
- **SC-211** : Aucun nom, numéro de réservation ou donnée personnelle n'est retrouvé dans les adresses consultées, les messages d'erreur et les journaux techniques produits par la résolution d'une voiturette, sur l'ensemble des cas d'échec.
- **SC-212** : **100 %** des créations, modifications, terminaisons et annulations d'affectation sont retrouvées dans le journal avec leur auteur et leur horodatage.

## Assumptions

Ces choix ont été retenus faute de précision explicite, en restant dans la limite de trois marqueurs de clarification. Ils sont modifiables tant que le développement n'a pas commencé.

- **Fréquence de l'import** : import manuel déclenché par un administrateur, réalisé au moins une fois le matin pour la journée, et rejouable autant de fois que nécessaire dans la journée. L'import étant idempotent sur le numéro de réservation (FR-204), le rejouer est sans risque. Ce fonctionnement évite d'introduire une tâche planifiée avant d'avoir observé le rythme réel du terrain.
- **Réservation réimportée portant déjà une affectation** : l'affectation active prime. La ligne réimportée qui diverge est marquée en conflit et présentée à l'administrateur (FR-211). Un import ne détruit jamais le travail du Starter.
- **Format du fichier** : un fichier par terrain et par import, encodé en UTF-8, première ligne d'en-tête. Le détail des colonnes reste ouvert (FR-203).
- **Portée temporelle de l'écran du Starter** : la journée locale du terrain, plus les départs à venir des prochaines heures. Le Starter n'a pas besoin d'un historique sur son écran de départ.
- **Un caddie, une voiturette par affectation** : conformément au modèle de la spéc. 1, tant que FR-233 n'est pas tranché.
- **Pas de mode hors ligne** : le Starter travaille en réseau. Le produit garantit seulement qu'une nouvelle tentative après coupure ne crée pas de doublon (FR-231), sans prétendre fonctionner sans réseau.
- **Terminaison manuelle** : la fin d'une partie est toujours un geste humain. Une terminaison automatique à l'heure présumée fabriquerait de faux jours travaillés, donc de faux scores.
- **Langue de l'écran du Starter** : français, comme l'ensemble des interfaces internes.

## Dependencies

- **Spécification 1** — modèle de données, comptes, rôles, cloisonnement par terrain, journalisation, et contrat de non-exposition pour le Starter. Cette spécification n'a aucun sens sans elle.
- **Spécification 2** — caddies et voiturettes réellement enregistrés sur le terrain, et jetons de QR code générés. Sans caddies ni voiturettes, il n'y a rien à affecter.
- **Le système de réservation existant du terrain** — producteur du fichier d'export CSV. Aucune intégration directe n'est prévue pour le pilote.
- **Le fuseau horaire du terrain**, défini en spéc. 1, indispensable au calcul de la date locale d'une affectation et donc du jour travaillé.
- **Un appareil mobile par Starter**, avec accès réseau sur le départ.

## Out of Scope

- **Définition du modèle de données** — appartient à la spécification 1 ; ce document s'y réfère sans le redéfinir.
- **Import et cycle de vie des caddies**, création des voiturettes et impression des QR codes — spécification 2.
- **Contenu du questionnaire client**, traductions, note du parcours, valeur perçue et lien Google Reviews — spécification 4. Cette spécification ne couvre que la **résolution** d'une voiturette vers son affectation, pas ce qui est présenté ensuite au joueur.
- **Calcul du score du caddie, des KPI et des rapports** — spécification 5. Cette spécification garantit seulement l'exactitude de la donnée d'entrée.
- **Intégration directe avec le système de réservation** par interface applicative — hors périmètre du pilote, décision arrêtée.
- **Import automatique planifié** des réservations — à reconsidérer après observation du rythme réel d'exploitation.
- **Mode hors ligne du Starter** — hors périmètre.
- **Affectation prévisionnelle de la veille pour le lendemain** — le Starter affecte au moment du départ.
- **Gestion des équipements autres que la voiturette** — un seul type d'équipement existe, décision arrêtée en spécification 1.
