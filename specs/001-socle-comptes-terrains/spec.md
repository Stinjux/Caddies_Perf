# Feature Specification: Socle — données, comptes et terrains

**Feature Branch**: `001-socle-comptes-terrains`

**Created**: 2026-09-18

**Status**: Draft

**Input**: Spécification n°1 de CaddiePerf. Elle détient le modèle de données de référence du produit et couvre les terrains de golf, les comptes Administrateur et Starter, les permissions, le cloisonnement par terrain et la journalisation des actions sensibles.

## Rôle de cette spécification

Cette spécification est le **document de référence du modèle de données** pour l'ensemble de CaddiePerf.

- Elle définit **toutes** les entités du domaine, y compris celles dont le comportement détaillé appartient à une autre spécification.
- Les spécifications 2 à 5 **s'y réfèrent** et ne redéfinissent jamais une entité, un champ ou une règle de calcul posés ici.
- Toute évolution du modèle de données est portée par ce document et répercutée vers les autres, jamais introduite localement.

**Couvert ici** : terrains, comptes, authentification, permissions, cloisonnement, journalisation, et le modèle de données complet.

**Défini ici mais spécifié ailleurs** : import CSV et gestion des caddies (spéc. 2), voiturettes et QR codes (spéc. 2), réservations et affectations (spéc. 3), questionnaire client et Google Reviews (spéc. 4), scores, KPI et rapports (spéc. 5).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Créer et configurer un terrain de golf (Priority: P1)

Un administrateur enregistre un nouveau terrain dans la plateforme et le configure : nom, adresse, logo, couleurs de marque, fuseau horaire et lien Google Reviews. Le terrain devient alors le conteneur de tout ce qui s'y rattache — caddies, voiturettes, réservations, évaluations.

**Why this priority** : rien d'autre ne peut exister sans terrain. C'est la première brique du produit ; aucune autre fonctionnalité n'est démontrable sans elle.

**Independent Test** : un administrateur crée un terrain de test, le configure entièrement, et le retrouve dans la liste des terrains avec ses paramètres exacts. Cela suffit à démontrer de la valeur : la plateforme sait décrire un terrain.

**Acceptance Scenarios** :

1. **Given** un administrateur connecté, **When** il crée un terrain avec un nom, une adresse et un fuseau horaire, **Then** le terrain apparaît dans la liste et reçoit un identifiant unique et permanent.
2. **Given** un terrain existant, **When** l'administrateur y enregistre un lien Google Reviews, **Then** ce lien est mémorisé et rattaché à ce terrain seul.
3. **Given** un terrain existant, **When** l'administrateur téléverse un logo et définit deux couleurs de marque, **Then** l'identité visuelle est mémorisée et utilisable par les écrans destinés aux clients de ce terrain.
4. **Given** un terrain dont le fuseau horaire est défini, **When** une date ou une heure est affichée pour ce terrain, **Then** elle s'affiche dans le fuseau horaire du terrain, pas dans celui du navigateur du lecteur.
5. **Given** un administrateur qui tente de créer un terrain sans nom, **When** il valide, **Then** la création est refusée avec un message indiquant le champ manquant.

---

### User Story 2 - Créer des comptes et les rattacher à des terrains (Priority: P1)

Un administrateur crée des comptes pour ses collègues : d'autres administrateurs, et des comptes Starter destinés au personnel qui affecte les caddies sur le départ. Chaque compte est rattaché à un ou plusieurs terrains.

**Why this priority** : sans comptes rattachés, personne ne peut utiliser la plateforme et le cloisonnement n'a rien à cloisonner.

**Independent Test** : un administrateur crée un compte Starter rattaché à un seul terrain, ce compte se connecte, et il ne voit que ce terrain. Cela démontre à la fois la création de comptes et le cloisonnement.

**Acceptance Scenarios** :

1. **Given** un administrateur connecté, **When** il crée un compte Starter et le rattache au terrain A, **Then** le compte est créé avec le rôle Starter et le seul rattachement au terrain A.
2. **Given** un compte rattaché aux terrains A et B, **When** son titulaire se connecte, **Then** il peut choisir entre A et B, et rien d'autre.
3. **Given** un compte rattaché à un seul terrain, **When** son titulaire se connecte, **Then** ce terrain est sélectionné d'office sans lui demander de choisir.
4. **Given** un compte existant, **When** l'administrateur le désactive, **Then** son titulaire ne peut plus se connecter, mais l'historique des actions qu'il a réalisées est intégralement conservé.
5. **Given** un administrateur, **When** il tente de créer un compte avec une adresse de connexion déjà utilisée, **Then** la création est refusée avec un message explicite.
6. **Given** le dernier administrateur actif d'un terrain, **When** on tente de le désactiver ou de le détacher de ce terrain, **Then** l'opération est refusée : un terrain conserve toujours au moins un administrateur actif.

---

### User Story 3 - Le cloisonnement par terrain est infranchissable (Priority: P1)

Quel que soit le chemin emprunté, un utilisateur ne peut accéder qu'aux données des terrains auxquels son compte est rattaché. Tenter d'atteindre un terrain non rattaché échoue, même en manipulant directement une adresse ou un identifiant.

**Why this priority** : c'est la garantie centrale du produit multi-terrains. Une fuite entre deux terrains concurrents serait un incident grave et irréparable en confiance.

**Independent Test** : un compte rattaché au terrain A tente d'accéder à une donnée du terrain B par manipulation directe de l'identifiant ; l'accès est refusé et l'existence même de la donnée n'est pas révélée.

**Acceptance Scenarios** :

1. **Given** un utilisateur rattaché au terrain A seulement, **When** il tente d'accéder à une donnée identifiée du terrain B, **Then** l'accès est refusé et la réponse ne révèle pas si cette donnée existe.
2. **Given** un utilisateur rattaché aux terrains A et B ayant sélectionné A, **When** il consulte une liste quelconque, **Then** aucun élément du terrain B n'y figure.
3. **Given** un utilisateur rattaché au terrain A, **When** il tente de créer une donnée en la rattachant au terrain B, **Then** la création est refusée.
4. **Given** n'importe quelle demande de lecture ou d'écriture, **When** elle est traitée, **Then** le filtrage par terrain est appliqué par le serveur et ne dépend d'aucune information fournie par le navigateur.

---

### User Story 4 - Le Starter travaille sans jamais voir de données personnelles (Priority: P1)

Un compte Starter consulte ce dont il a besoin sur le départ et rien de plus. Aucune donnée personnelle de caddie ne lui est présentée, sous aucune forme, y compris en cas d'erreur ou d'export.

**Why this priority** : c'est une obligation de protection des renseignements personnels inscrite dans la constitution du projet, et elle conditionne la conception de chaque écran du Starter.

**Independent Test** : on inspecte tout ce que reçoit un compte Starter dans une journée de travail simulée ; aucune donnée personnelle n'y figure, ni à l'écran, ni dans les données transmises en arrière-plan.

**Acceptance Scenarios** :

1. **Given** un compte Starter, **When** il consulte la liste des caddies disponibles, **Then** il voit l'identifiant interne, le prénom, le nom et la disponibilité de chacun, et rien d'autre.
2. **Given** un compte Starter, **When** il consulte une affectation, **Then** il voit le numéro de réservation, l'heure de départ, le numéro de voiturette, le caddie affecté et le statut, et rien d'autre.
3. **Given** un compte Starter, **When** il tente par un moyen quelconque d'obtenir l'année de naissance d'un caddie, **Then** la demande est refusée.
4. **Given** un compte Starter, **When** il tente d'accéder aux évaluations, aux commentaires clients ou aux rapports de performance, **Then** l'accès est refusé.
5. **Given** un compte Starter, **When** il tente d'importer des caddies ou de modifier la configuration d'un terrain, **Then** l'action est refusée.

---

### User Story 5 - Tracer les actions administratives et les consultations sensibles (Priority: P2)

Chaque action administrative et chaque consultation de données personnelles laisse une trace horodatée, consultable par un administrateur. Le journal lui-même ne contient aucune donnée personnelle.

**Why this priority** : indispensable pour répondre à une demande de vérification et pour établir la responsabilité en cas de contestation. Non bloquant pour les premières démonstrations, d'où P2.

**Independent Test** : un administrateur modifie un terrain puis consulte l'année de naissance d'un caddie ; les deux événements apparaissent dans le journal, avec leur auteur et leur horodatage, et sans aucune donnée personnelle.

**Acceptance Scenarios** :

1. **Given** un administrateur qui crée, modifie ou désactive un terrain, un compte ou un caddie, **When** l'action aboutit, **Then** un enregistrement de journal est créé avec l'auteur, le terrain, la nature de l'action, la cible et l'horodatage.
2. **Given** un administrateur qui consulte des données personnelles d'un caddie, **When** la consultation a lieu, **Then** elle est journalisée comme consultation sensible.
3. **Given** un enregistrement de journal quelconque, **When** on l'examine, **Then** il ne contient ni année de naissance, ni adresse, ni commentaire client, ni aucune autre donnée personnelle — uniquement des identifiants internes.
4. **Given** un administrateur, **When** il consulte le journal, **Then** il peut le filtrer par terrain, par auteur, par nature d'action et par période.
5. **Given** un enregistrement de journal existant, **When** un utilisateur quelconque tente de le modifier ou de le supprimer, **Then** l'opération est refusée : le journal est en écriture seule.

---

### User Story 6 - Corriger ou supprimer des renseignements personnels (Priority: P3)

Un administrateur autorisé peut corriger ou effacer les renseignements personnels d'un caddie lorsque celui-ci en fait la demande, sans détruire l'historique de performance ni fausser les statistiques du terrain.

**Why this priority** : obligation de protection des renseignements personnels, mais qui n'a d'objet qu'une fois des caddies réellement enregistrés — d'où sa place après les fonctions structurantes.

**Independent Test** : on efface les renseignements personnels d'un caddie de test ; ses évaluations passées et les moyennes du terrain restent inchangées.

**Acceptance Scenarios** :

1. **Given** un caddie enregistré, **When** un administrateur corrige son année de naissance, **Then** la correction est enregistrée et journalisée comme modification sensible.
2. **Given** un caddie enregistré, **When** un administrateur efface ses renseignements personnels, **Then** ces renseignements disparaissent définitivement tandis que ses affectations et évaluations passées demeurent.
3. **Given** un caddie dont les renseignements personnels ont été effacés, **When** on recalcule les moyennes du terrain, **Then** les résultats sont identiques à ceux d'avant l'effacement.

---

### Edge Cases

- **Compte sans rattachement** : un compte dont tous les rattachements ont été retirés ne peut se connecter à aucun terrain ; il reçoit un message explicite plutôt qu'une page vide.
- **Dernier administrateur** : un terrain ne peut jamais se retrouver sans administrateur actif ; toute opération qui aboutirait à cet état est refusée.
- **Suppression d'un terrain** : un terrain qui porte des données historiques n'est pas supprimé mais archivé ; ses évaluations passées restent consultables en lecture seule.
- **Rattachement multiple** : un utilisateur rattaché à plusieurs terrains doit toujours savoir lequel est sélectionné ; le terrain actif est visible en permanence à l'écran.
- **Changement de terrain en cours de session** : changer de terrain actif ne doit jamais laisser à l'écran des données du terrain précédent.
- **Identifiant interne de caddie** : il est unique à l'intérieur d'un terrain et n'est jamais réattribué, même après désactivation.
- **Fuseau horaire et changement d'heure** : une affectation réalisée pendant un changement d'heure reste rattachée à la bonne date locale du terrain.
- **Compte désactivé pendant une session active** : la session est interrompue à la prochaine action plutôt que de laisser l'accès ouvert jusqu'à expiration.
- **Conflit de modification** : deux administrateurs modifiant simultanément le même terrain ne doivent pas écraser silencieusement le travail l'un de l'autre.
- **Logo trop volumineux ou format non pris en charge** : le téléversement est refusé avec un message indiquant les formats et la taille acceptés.

## Requirements *(mandatory)*

### Terrains de golf

- **FR-001** : Le système DOIT permettre à un administrateur de créer, consulter, modifier et archiver un terrain de golf.
- **FR-002** : Chaque terrain DOIT posséder un identifiant unique et permanent, distinct de son nom.
- **FR-003** : Chaque terrain DOIT porter un nom, une adresse, un fuseau horaire, un logo, des couleurs de marque, un lien Google Reviews et ses paramètres propres.
- **FR-004** : Le nom et le fuseau horaire DOIVENT être obligatoires ; la création DOIT être refusée s'ils manquent.
- **FR-005** : Toutes les dates et heures relatives à un terrain DOIVENT être présentées dans le fuseau horaire de ce terrain.
- **FR-006** : Un terrain portant des données historiques NE DOIT PAS être supprimé ; il DOIT être archivé et rester consultable en lecture seule.
- **FR-007** : Le lien Google Reviews DOIT être propre à chaque terrain, et le système DOIT sélectionner automatiquement celui du terrain concerné.

### Comptes et authentification

- **FR-008** : Le système DOIT gérer exactement deux rôles : Administrateur et Starter.
- **FR-009** : Le système DOIT permettre à un administrateur de créer, modifier, désactiver et réactiver des comptes des deux rôles.
- **FR-010** : Chaque compte DOIT être rattaché à au moins un terrain, et PEUT l'être à plusieurs.
- **FR-011** : Le système DOIT refuser la création d'un compte dont l'identifiant de connexion est déjà utilisé.
- **FR-012** : Un utilisateur rattaché à plusieurs terrains DOIT pouvoir choisir son terrain actif ; s'il n'en a qu'un, celui-ci DOIT être sélectionné sans intervention.
- **FR-013** : Le terrain actif DOIT rester visible à l'écran pendant toute la session.
- **FR-014** : Un compte désactivé NE DOIT PLUS pouvoir se connecter, tout en conservant intégralement l'historique des actions qu'il a réalisées.
- **FR-015** : Le système DOIT empêcher toute opération laissant un terrain sans administrateur actif.
- **FR-016** : Une session active DOIT être interrompue dès la première action suivant la désactivation du compte.
- **FR-017** : Le système DOIT authentifier les utilisateurs et protéger les éléments d'authentification de manière qu'ils ne soient jamais lisibles, y compris par un administrateur.

### Permissions

- **FR-018** : Un administrateur DOIT pouvoir gérer les terrains, les comptes, les caddies, les voiturettes, les réservations, les affectations, les évaluations, les KPI, les rapports et les exports de ses terrains.
- **FR-019** : Un Starter DOIT pouvoir sélectionner son terrain, consulter les réservations actives ou à venir, voir les voiturettes et les caddies disponibles, créer une affectation, la modifier en cas d'erreur, la terminer, consulter les affectations du jour et signaler un caddie ou une voiturette indisponible.
- **FR-020** : Un Starter NE DOIT PAS pouvoir importer des caddies, modifier des renseignements personnels, consulter une année de naissance, consulter des évaluations, des commentaires ou des rapports de performance, modifier ou supprimer une évaluation, gérer des comptes, ni modifier des règles de calcul ou la configuration générale.
- **FR-021** : Chaque permission DOIT être vérifiée par le serveur à chaque demande ; masquer un élément à l'écran NE DOIT PAS tenir lieu de contrôle d'accès.
- **FR-022** : Un refus de permission DOIT produire un message clair sans révéler l'existence ni le contenu de la ressource visée.

### Cloisonnement par terrain

- **FR-023** : Toute lecture et toute écriture DOIVENT être filtrées par le terrain actif de l'utilisateur, ce filtrage étant appliqué par le serveur.
- **FR-024** : Le système NE DOIT JAMAIS se fier à un identifiant de terrain fourni par le navigateur pour décider d'un droit d'accès.
- **FR-025** : Une tentative d'accès à un terrain non rattaché DOIT être refusée sans révéler l'existence de la ressource.
- **FR-026** : Aucun agrégat, moyenne, comparaison ou rapport NE DOIT mélanger les données de deux terrains.
- **FR-027** : Le changement de terrain actif DOIT écarter de l'écran toute donnée du terrain précédent.

### Protection des renseignements personnels

- **FR-028** : Le système NE DOIT JAMAIS stocker la taille d'habits ni l'adresse du domicile d'un caddie, sous aucune forme et à aucun moment.
- **FR-028b** : Le système NE DOIT conserver aucune colonne du fichier source qui ne sert pas une fonctionnalité du produit. Le champ « force » entre dans ce cas : sa colonne est tolérée à la lecture, son contenu n'est ni stocké, ni affiché, ni journalisé.
- **FR-029** : L'année de naissance DOIT être le seul élément d'âge conservé, dans un espace séparé des données de performance.
- **FR-030** : L'année de naissance NE DOIT être accessible qu'aux administrateurs, et n'apparaître dans aucun rapport ni export.
- **FR-031** : Aucune donnée personnelle NE DOIT figurer dans une adresse Web, un paramètre de requête, un QR code, un journal technique ou un message d'erreur.
- **FR-032** : Les évaluations clients DOIVENT être anonymes ; aucun mécanisme NE DOIT permettre de remonter d'une évaluation à l'identité du joueur.
- **FR-033** : Un administrateur autorisé DOIT pouvoir corriger ou effacer les renseignements personnels d'un caddie sans altérer son historique de performance ni les statistiques du terrain.
- **FR-034** : Le système DOIT appliquer une durée de conservation définie aux données personnelles et aux évaluations. [NEEDS CLARIFICATION : durée de conservation à confirmer pour les renseignements personnels des caddies, pour les commentaires clients et pour les évaluations agrégées]

### Journalisation

- **FR-035** : Le système DOIT journaliser chaque action administrative avec son auteur, son terrain, sa nature, sa cible et son horodatage.
- **FR-036** : Le système DOIT journaliser chaque consultation et chaque modification de données personnelles.
- **FR-037** : Les journaux NE DOIVENT contenir aucune donnée personnelle, uniquement des identifiants internes.
- **FR-038** : Les journaux DOIVENT être en écriture seule : aucune modification ni suppression NE DOIT être possible depuis l'application.
- **FR-039** : Un administrateur DOIT pouvoir filtrer le journal par terrain, auteur, nature d'action et période.

### Intégrité du modèle de données

- **FR-040** : Chaque entité rattachée à un terrain DOIT porter ce rattachement de façon obligatoire et non modifiable après création.
- **FR-041** : L'identifiant interne d'un caddie DOIT être unique au sein d'un terrain et NE DOIT JAMAIS être réattribué, même après désactivation.
- **FR-041b** : L'ancienneté d'un caddie DOIT être conservée comme un nombre entier d'années, accompagné de la date d'enregistrement de cette valeur. Sa mise à jour DOIT se faire par un nouvel import ou une saisie administrateur, le système NE la recalculant pas de lui-même.
- **FR-042** : Un caddie désactivé DOIT conserver l'intégralité de son historique d'affectations et d'évaluations.
- **FR-043** : Le score du caddie, la note du parcours et la valeur perçue du prix DOIVENT être conservés comme trois mesures distinctes ; aucune NE DOIT influencer le calcul d'une autre.
- **FR-044** : Un jour travaillé DOIT être défini comme une date comportant au moins une affectation valide et terminée pour ce caddie, comptée une seule fois quel que soit le nombre de réservations de ce caddie ce jour-là.
- **FR-045** : Le système DOIT empêcher deux modifications concurrentes de s'écraser silencieusement.

### Données fictives

- **FR-046** : Les jeux de données de test DOIVENT être entièrement fictifs ; aucune donnée réelle de caddie, de client ou d'employé NE DOIT figurer dans le dépôt, les tests, la documentation ou les captures d'écran.

### Key Entities

Ce référentiel est la source de vérité du modèle de données. Les spécifications 2 à 5 s'y réfèrent sans le redéfinir.

- **Terrain** : un terrain de golf. Identifiant permanent, nom, adresse, fuseau horaire, logo, couleurs de marque, lien Google Reviews, paramètres, statut (actif ou archivé). Conteneur de toutes les autres entités opérationnelles.

- **Compte** : un utilisateur de la plateforme. Identifiant de connexion, rôle (Administrateur ou Starter), statut (actif ou désactivé), éléments d'authentification protégés. N'existe jamais sans au moins un rattachement.

- **Rattachement compte-terrain** : lie un compte à un terrain auquel il a accès. Un compte peut en avoir plusieurs ; un terrain conserve toujours au moins un administrateur actif.

- **Session** : période d'accès authentifié d'un compte, portant le terrain actif sélectionné. Prend fin à l'expiration, à la déconnexion, ou à la désactivation du compte.

- **Caddie** : identité professionnelle d'un caddie sur un terrain. Identifiant interne unique au terrain et jamais réattribué, nom, prénom, ancienneté, statut (actif ou désactivé), terrain de rattachement. L'ancienneté est un **nombre entier d'années**, accompagné de la date à laquelle cette valeur a été enregistrée afin de rester interprétable dans le temps. Ne contient aucune donnée personnelle protégée. Le champ « force » du fichier source n'est pas conservé. Détaillé dans la spécification 2.

- **Renseignements personnels du caddie** : espace séparé, accessible aux seuls administrateurs, contenant l'**année de naissance** et rien d'autre. La taille d'habits et l'adresse du domicile n'y figurent jamais. Effaçable indépendamment du caddie et de son historique.

- **Voiturette** : équipement rattaché à un terrain. Identifiant interne, numéro visible, jeton de QR code opaque et permanent, statut parmi disponible, affectée, entretien, inactive. Un seul type d'équipement existe. Détaillée dans la spécification 2.

- **Réservation** : un départ enregistré sur un terrain. Numéro de réservation, terrain, date, heure de départ, statut. Provient du système de réservation existant du terrain. Détaillée dans la spécification 3.

- **Affectation** : lie un terrain, une réservation, une voiturette et un caddie. Porte une date, une heure de début, une heure de fin, un statut, le compte Starter qui l'a créée, et l'horodatage de ses modifications. Pivot entre l'exploitation et la mesure. Détaillée dans la spécification 3.

- **Évaluation** : réponse anonyme d'un client rattachée à une affectation. Porte la langue de réponse, l'horodatage, les réponses par critère, un commentaire facultatif, la note du parcours et les réponses sur la valeur perçue. Ne contient aucune donnée identifiante. Détaillée dans la spécification 4.

- **Critère d'évaluation** : référentiel des six critères notés et de leur ordre d'affichage — accueil et attitude, connaissance des règles et de l'étiquette, connaissance du parcours, lecture des verts, communication, expérience générale. Les cinq premiers forment les compétences ; le sixième est distinct.

- **Réponse par critère** : note d'un critère pour une évaluation, valant de 1 à 5 étoiles ou « non applicable ». Une réponse « non applicable » est exclue des moyennes et ne les abaisse jamais.

- **Note du parcours** : appréciation de l'expérience sur le terrain, portée par l'évaluation. Appartient au terrain et n'entre jamais dans le score d'un caddie.

- **Valeur perçue** : deux réponses distinctes sur le rapport qualité-prix et sur le niveau du prix du service de caddie. N'influencent jamais la note d'un caddie. Détaillée dans la spécification 4.

- **Clic Google Reviews** : trace anonyme d'un clic vers le lien d'avis du terrain. Mesure uniquement le clic, jamais la publication d'un avis.

- **Entrée de journal** : trace en écriture seule d'une action administrative ou d'une consultation sensible. Auteur, terrain, nature, cible par identifiant interne, horodatage. Ne contient aucune donnée personnelle.

- **Jour travaillé** : notion **dérivée**, jamais stockée. Une date comportant au moins une affectation valide et terminée pour un caddie, comptée une seule fois quel que soit le nombre de réservations de ce caddie ce jour-là.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** : Un administrateur crée un terrain entièrement configuré en moins de 5 minutes, sans assistance.
- **SC-002** : Un administrateur crée un compte Starter rattaché à un terrain en moins de 2 minutes.
- **SC-003** : 100 % des tentatives d'accès à un terrain non rattaché sont refusées, y compris par manipulation directe d'un identifiant.
- **SC-004** : Aucune donnée personnelle n'est présentée à un compte Starter sur l'ensemble d'une journée de travail simulée, écran et échanges en arrière-plan compris.
- **SC-005** : Aucune occurrence de taille d'habits ou d'adresse de domicile n'est retrouvée dans les données conservées, quel que soit le contenu du fichier source importé.
- **SC-006** : 100 % des actions administratives et des consultations de données personnelles sont retrouvées dans le journal, avec leur auteur et leur horodatage.
- **SC-007** : Aucune donnée personnelle n'est retrouvée dans les journaux, les adresses Web et les messages d'erreur, sur un échantillon couvrant tous les parcours.
- **SC-008** : La plateforme sert 5 terrains, 100 caddies et 300 départs par jour sans que les écrans d'exploitation ne dépassent 2 secondes d'affichage.
- **SC-009** : Après effacement des renseignements personnels d'un caddie, les moyennes du terrain sont strictement identiques à celles calculées avant l'effacement.
- **SC-010** : Un terrain ne se retrouve jamais sans administrateur actif, sur l'ensemble des scénarios de désactivation et de détachement testés.
- **SC-011** : Aucune donnée réelle n'est présente dans le dépôt, les jeux de test et la documentation, vérifié automatiquement.

## Assumptions

Ces choix ont été retenus faute de précision explicite. Ils sont modifiables tant que le développement n'a pas commencé.

- **Authentification** : identifiant et mot de passe, sans second facteur au lancement. Le personnel de terrain travaille sur des appareils partagés, où un second facteur par téléphone personnel serait un frein quotidien. Un second facteur pourra être ajouté pour les comptes administrateurs.
- **Durée de session** : session longue pour le Starter, qui travaille toute la journée sur le même appareil ; session plus courte pour l'administrateur, qui manipule des données sensibles.
- **Réinitialisation de mot de passe** : réalisée par un administrateur, sans envoi de courriel automatique au lancement, pour éviter d'introduire un service tiers recevant des données.
- **Identifiant de connexion** : une adresse de courriel, unique sur l'ensemble de la plateforme.
- **Archivage plutôt que suppression** : terrains, comptes et caddies sont désactivés ou archivés, jamais supprimés, afin de préserver l'intégrité des historiques et des comparaisons.
- **Portée du pilote** : un seul terrain en exploitation réelle, la plateforme étant multi-terrains dès le premier jour.
- **Langue de l'administration** : les interfaces administrateur et Starter sont en français ; les cinq langues concernent le questionnaire client.
- **Format de l'ancienneté** : décision arrêtée — un **nombre entier d'années**, tel que fourni dans le fichier source. Conséquence assumée : cette valeur ne se met pas à jour toute seule et vieillit d'un an chaque année. Pour qu'elle reste interprétable, le système enregistre la date à laquelle elle a été saisie, et sa mise à jour se fait par un nouvel import.
- **Champ « force »** : décision arrêtée — cette catégorie est **retirée du produit**. La colonne est tolérée dans le fichier source mais son contenu n'est ni stocké, ni affiché, ni journalisé.

## Dependencies

- Le système de réservation existant de chaque terrain, qui produit un export au format CSV des départs. Aucune intégration directe n'est prévue pour le pilote.
- Un compte Google Business par terrain, fournissant le lien d'avis.
- Un hébergement situé au Maroc, conformément au principe de souveraineté des données.

## Out of Scope

- Import CSV et gestion du cycle de vie des caddies — spécification 2.
- Voiturettes, génération et impression des QR codes — spécification 2.
- Import des réservations, écran d'affectation du Starter et cas d'erreur d'affectation — spécification 3.
- Questionnaire client, traductions, valeur perçue et lien Google Reviews — spécification 4.
- Calcul des scores, tableau de bord, comparaisons et rapports exportables — spécification 5.
- Stratégie de protection contre les abus et les soumissions répétées — traitée en phase transversale de sécurité.
- Application mobile installable : hors périmètre définitif, le parcours client passant par le navigateur.
