# Feature Specification: Caddies, voiturettes et QR codes

**Feature Branch**: `002-caddies-voiturettes-qr`

**Created**: 2026-09-18

**Status**: Draft

**Input**: Spécification n°2 de CaddiePerf. Elle couvre les phases 7, 8, 9 et 12 du projet : l'import CSV des caddies réservé à l'administrateur, la gestion du cycle de vie des caddies, la gestion des voiturettes, ainsi que la génération et l'impression des QR codes permanents.

## Rôle de cette spécification

Cette spécification **ne détient pas le modèle de données**. Elle décrit des **comportements**.

- La [spécification n°1](../001-socle-comptes-terrains/spec.md) et son [modèle de données de référence](../001-socle-comptes-terrains/data-model.md) font autorité sur les entités `caddie`, `caddie_personal_data`, `cart` et `audit_log`.
- Le présent document **s'y réfère** et ne redéfinit jamais une entité, un champ, une contrainte ou une règle de calcul déjà posés dans la n°1.
- Lorsqu'un besoin de cette spécification semble appeler un champ absent du modèle de référence, il est consigné dans la section « Évolutions demandées à la spéc. 001 », jamais inventé localement.
- Les exigences fonctionnelles sont numérotées à partir de **FR-101** afin de ne pas entrer en collision avec les FR-001 à FR-046 de la spéc. 001, qui restent toutes applicables ici.

**Couvert ici** : import CSV des caddies, aperçu et validation avant importation, rapport d'importation, cycle de vie du caddie (création, modification, activation, désactivation), gestion du parc de voiturettes, génération et impression des QR codes permanents.

**Non couvert ici** : réservations et affectations (spéc. 3), questionnaire client résolu depuis un QR code (spéc. 4), scores et rapports (spéc. 5). Le présent document fournit le jeton de QR code ; la **résolution** de ce jeton vers une affectation active appartient aux spécifications 3 et 4.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Importer une liste de caddies depuis un fichier CSV (Priority: P1)

Un administrateur reçoit du terrain un fichier CSV contenant la liste de ses caddies. Il le dépose dans la plateforme, obtient un aperçu de ce qui sera réellement enregistré, corrige ou écarte les lignes problématiques, lit le résumé, confirme, puis reçoit un rapport d'importation.

**Why this priority** : c'est la porte d'entrée des données du produit. Sans caddies enregistrés, ni affectation, ni évaluation, ni score n'existent. C'est la première fonctionnalité démontrable de cette spécification.

**Independent Test** : un administrateur importe un fichier fictif de 30 caddies contenant quelques lignes volontairement fautives, les traite dans l'aperçu, confirme, et retrouve exactement le nombre annoncé de caddies dans la liste du terrain. Cela suffit à démontrer de la valeur : le terrain est peuplé en une opération.

**Acceptance Scenarios** :

1. **Given** un administrateur connecté sur un terrain, **When** il dépose un fichier CSV valide de 30 lignes, **Then** un aperçu s'affiche avant toute écriture, montrant ligne par ligne ce qui sera enregistré.
2. **Given** un aperçu affiché, **When** l'administrateur l'examine, **Then** il voit le nombre de lignes lues, le nombre de lignes valides, le nombre de lignes invalides et le nombre de doublons potentiels.
3. **Given** un aperçu comportant 3 lignes invalides, **When** l'administrateur choisit d'écarter ces 3 lignes, **Then** le résumé se met à jour et annonce 27 caddies à créer.
4. **Given** un aperçu comportant une ligne dont le prénom est manquant, **When** l'administrateur saisit la valeur manquante dans l'aperçu, **Then** la ligne devient valide sans qu'il ait à modifier et redéposer le fichier.
5. **Given** un résumé affiché, **When** l'administrateur n'a pas encore confirmé, **Then** aucun caddie n'a été créé et aucune donnée n'a été écrite.
6. **Given** un résumé affiché, **When** l'administrateur confirme explicitement l'importation, **Then** les caddies annoncés sont créés et un rapport d'importation est présenté.
7. **Given** une importation confirmée, **When** l'administrateur consulte le rapport, **Then** il y lit le nombre de caddies créés, le nombre de lignes écartées et le motif de chaque écart.

---

### User Story 2 - Aucune donnée interdite ne franchit la frontière de la base (Priority: P1)

Le fichier source contient sept colonnes, dont trois que le produit refuse : la taille d'habits, l'adresse du domicile et la force. Ces colonnes sont lues pour respecter la structure du fichier, puis immédiatement rejetées. L'âge, lui, devient une année de naissance rangée dans un espace séparé réservé aux administrateurs.

**Why this priority** : c'est le principe I de la constitution, non négociable. Il conditionne la conception même de l'importateur et ne peut pas être ajouté après coup.

**Independent Test** : on importe un fichier fictif dont les trois colonnes interdites sont remplies de valeurs reconnaissables, puis on recherche ces valeurs dans l'ensemble des données conservées, des journaux, des rapports et des fichiers téléchargeables ; aucune occurrence n'est trouvée.

**Acceptance Scenarios** :

1. **Given** un fichier source dont la colonne « taille d'habits » est renseignée, **When** l'importation est confirmée, **Then** aucune trace de cette valeur n'existe dans les données conservées.
2. **Given** un fichier source dont la colonne « adresse du domicile » est renseignée, **When** l'importation est confirmée, **Then** aucune trace de cette valeur n'existe dans les données conservées, les journaux ni les fichiers téléchargeables.
3. **Given** un fichier source dont la colonne « force » est renseignée, **When** l'aperçu s'affiche, **Then** cette colonne est présentée comme ignorée et son contenu n'est pas affiché.
4. **Given** un fichier source comportant un âge, **When** l'importation est confirmée, **Then** seule une année de naissance est conservée, dans l'espace réservé aux administrateurs.
5. **Given** un compte Starter, **When** il consulte un caddie importé, **Then** aucune année de naissance ne lui est présentée, ni à l'écran ni dans les échanges en arrière-plan.
6. **Given** une importation quelconque, **When** on examine le journal technique et le journal d'audit, **Then** ils ne contiennent ni nom de fichier révélateur, ni contenu de ligne, ni donnée personnelle.

---

### User Story 3 - Gérer le cycle de vie d'un caddie (Priority: P1)

Un administrateur crée un caddie à la main lorsqu'un nouvel arrivant se présente hors campagne d'import, corrige une information erronée, désactive un caddie qui quitte le terrain, et le réactive s'il revient. L'historique du caddie n'est jamais perdu.

**Why this priority** : l'import peuple le terrain une fois ; le quotidien se joue ensuite ligne par ligne. Sans cycle de vie, la liste des caddies se périme dès la première semaine d'exploitation.

**Independent Test** : un administrateur crée un caddie à la main, le modifie, le désactive, vérifie qu'il ne peut plus être affecté, le réactive, et constate que son identifiant interne et son historique sont intacts.

**Acceptance Scenarios** :

1. **Given** un administrateur connecté sur un terrain, **When** il crée un caddie avec un prénom, un nom et un identifiant interne, **Then** le caddie apparaît dans la liste du terrain avec le statut actif.
2. **Given** un identifiant interne déjà utilisé sur le terrain, **When** l'administrateur tente de créer un caddie avec cet identifiant, **Then** la création est refusée avec un message explicite.
3. **Given** un caddie actif, **When** l'administrateur le désactive, **Then** il disparaît des listes de caddies affectables tout en conservant l'intégralité de son historique d'affectations et d'évaluations.
4. **Given** un caddie désactivé, **When** l'administrateur le réactive, **Then** il redevient affectable sans avoir perdu son identifiant interne ni son historique.
5. **Given** un caddie désactivé, **When** un administrateur crée un nouveau caddie, **Then** l'identifiant interne du caddie désactivé n'est jamais proposé ni accepté pour ce nouveau caddie.
6. **Given** un caddie quelconque, **When** un administrateur cherche à le supprimer définitivement, **Then** aucune fonction de suppression ne lui est offerte : seule la désactivation existe.

---

### User Story 4 - Gérer le parc de voiturettes (Priority: P2)

Un administrateur enregistre les voiturettes de son terrain avec leur numéro visible, suit leur état, place une voiturette en entretien lorsqu'elle est immobilisée, et la retire du parc lorsqu'elle est réformée.

**Why this priority** : l'affectation d'un caddie se fait par voiturette ; sans parc enregistré, le Starter ne peut rien affecter. Vient après les caddies car une démonstration d'import reste possible sans voiturettes.

**Independent Test** : un administrateur enregistre 10 voiturettes, en place une en entretien, et constate qu'elle n'est plus proposée à l'affectation tandis que les 9 autres le restent.

**Acceptance Scenarios** :

1. **Given** un administrateur connecté sur un terrain, **When** il enregistre une voiturette avec son numéro visible, **Then** elle apparaît dans le parc du terrain avec le statut disponible.
2. **Given** un numéro visible déjà utilisé sur le terrain, **When** l'administrateur tente de l'attribuer à une seconde voiturette, **Then** l'enregistrement est refusé avec un message explicite.
3. **Given** une voiturette disponible, **When** l'administrateur la place en entretien, **Then** elle cesse d'être proposée à l'affectation sans perdre son historique.
4. **Given** une voiturette portant une affectation en cours, **When** l'administrateur tente de la placer en entretien ou de la rendre inactive, **Then** l'opération est refusée tant que l'affectation n'a pas été terminée ou annulée.
5. **Given** une voiturette quelconque, **When** l'administrateur consulte le parc, **Then** il voit pour chacune son numéro visible et son statut parmi disponible, affectée, entretien et inactive.
6. **Given** une voiturette en statut affectée, **When** l'administrateur tente de lui attribuer ce statut à la main ou de l'en retirer à la main, **Then** l'opération est refusée : ce statut découle exclusivement d'une affectation.

---

### User Story 5 - Générer et imprimer les QR codes permanents (Priority: P2)

Chaque voiturette reçoit un QR code dès son enregistrement. L'administrateur imprime une planche de QR codes, les colle sur les voiturettes, et n'y revient plus : le code est permanent. Si une étiquette est abîmée, il réimprime la même, sans changer le code.

**Why this priority** : le QR code est le point d'entrée unique du parcours client. Il doit exister avant la première partie évaluée, mais l'impression physique n'est pas nécessaire aux démonstrations internes.

**Independent Test** : un administrateur enregistre 10 voiturettes, imprime la planche, change le statut de plusieurs voiturettes, réimprime, et constate que les 10 codes sont strictement identiques d'une impression à l'autre.

**Acceptance Scenarios** :

1. **Given** une voiturette nouvellement enregistrée, **When** l'enregistrement aboutit, **Then** un jeton de QR code opaque, permanent et unique sur l'ensemble de la plateforme lui est attribué automatiquement.
2. **Given** un QR code généré, **When** on examine son contenu et l'adresse Web qu'il porte, **Then** on n'y trouve ni nom de caddie, ni nom de client, ni numéro de réservation, ni aucune donnée personnelle, ni aucune information permettant de deviner un autre code.
3. **Given** une voiturette dont le statut passe de disponible à entretien puis à disponible, **When** on compare son QR code avant et après, **Then** il est strictement identique.
4. **Given** un parc de voiturettes, **When** l'administrateur demande l'impression, **Then** il obtient une planche imprimable où chaque étiquette porte le QR code et le numéro visible de la voiturette en clair.
5. **Given** une étiquette abîmée, **When** l'administrateur réimprime celle de cette seule voiturette, **Then** le code imprimé est identique au précédent et aucune fonction de régénération ne lui est offerte.
6. **Given** un QR code d'une voiturette placée en entretien, **When** un client le scanne, **Then** le serveur reconnaît le jeton et répond par un message neutre, sans révéler le statut interne du parc ni aucune donnée personnelle.

---

### User Story 6 - Comprendre et corriger un import qui s'est mal passé (Priority: P2)

Un administrateur importe un fichier fourni par le terrain et découvre que 12 lignes sur 80 posent problème. Il télécharge la liste des erreurs, la transmet au terrain pour correction, et réimporte le fichier corrigé sans créer de doublon.

**Why this priority** : c'est ce qui distingue un importateur utilisable d'un importateur qui décourage. Il reste P2 car le parcours nominal de la story 1 délivre déjà de la valeur.

**Independent Test** : on importe un fichier fictif comportant des erreurs variées, on télécharge la liste des erreurs, on la corrige, on réimporte, et on obtient le nombre attendu de caddies sans aucun doublon.

**Acceptance Scenarios** :

1. **Given** un aperçu comportant des lignes invalides, **When** l'administrateur télécharge la liste des erreurs, **Then** il obtient un fichier indiquant pour chaque ligne fautive son numéro de ligne d'origine et le motif précis du rejet.
2. **Given** la liste des erreurs téléchargée, **When** on l'examine, **Then** elle ne contient aucune des trois colonnes rejetées ni aucune année de naissance.
3. **Given** un import dont l'exécution est interrompue par une défaillance technique, **When** l'administrateur revient sur la liste des caddies, **Then** aucun caddie de ce lot n'a été créé et un message lui indique que rien n'a été importé.
4. **Given** un fichier déjà importé, **When** l'administrateur le réimporte à l'identique, **Then** chaque ligne est signalée comme doublon potentiel avant toute écriture.
5. **Given** un rapport d'importation, **When** l'administrateur le consulte, **Then** le nombre de caddies créés correspond exactement au nombre annoncé dans le résumé avant confirmation.

---

### User Story 7 - Le Starter voit juste ce qu'il lui faut du caddie (Priority: P3)

Sur le départ, le Starter consulte la liste des caddies du terrain pour choisir qui affecter. Il y voit l'identifiant interne, le prénom, le nom et la disponibilité, et rien d'autre.

**Why this priority** : il s'agit d'une vue en lecture seule, conséquence directe des règles posées en spéc. 1. Elle se vérifie en même temps que le reste, d'où P3.

**Independent Test** : un compte Starter consulte la liste des caddies d'un terrain peuplé par import ; on inspecte l'écran et les échanges en arrière-plan, qui ne contiennent que les quatre éléments autorisés.

**Acceptance Scenarios** :

1. **Given** un compte Starter, **When** il consulte la liste des caddies, **Then** il voit l'identifiant interne, le prénom, le nom et la disponibilité de chacun, et rien d'autre.
2. **Given** un compte Starter, **When** il consulte la liste des caddies, **Then** les caddies désactivés n'y figurent pas.
3. **Given** un compte Starter, **When** il tente d'importer un fichier de caddies, de créer un caddie ou de modifier une voiturette, **Then** l'action est refusée.
4. **Given** un compte Starter, **When** il consulte le parc de voiturettes, **Then** il voit le numéro visible et la disponibilité de chacune, sans accès aux fonctions de gestion ni à l'impression des QR codes.

---

### Edge Cases

- **Fichier vide** : un fichier ne contenant aucune ligne de données est refusé avant l'aperçu, avec un message indiquant qu'aucune ligne exploitable n'a été trouvée — et non un aperçu vide laissant croire à une réussite.
- **Colonnes manquantes ou en désordre** : un fichier qui ne présente pas les sept colonnes attendues dans l'ordre attendu est refusé globalement, avec la liste des colonnes trouvées et celle des colonnes attendues. Aucune importation partielle n'est proposée.
- **Encodage inattendu** : un fichier dont l'encodage produit des caractères indéchiffrables dans les noms est signalé avant l'aperçu ; l'administrateur voit un échantillon de ce qui a été lu et peut renoncer plutôt que d'enregistrer des noms corrompus.
- **Séparateur inattendu** : un fichier utilisant un séparateur différent de celui détecté produit des lignes à une seule colonne ; ce cas est reconnu et signalé comme un problème de séparateur, pas comme 80 lignes invalides.
- **Ligne d'en-tête ambiguë** : si la première ligne ressemble à la fois à un en-tête et à une donnée, l'aperçu indique explicitement comment elle a été interprétée et permet de changer cette interprétation.
- **Doublon sur l'identifiant interne** : une ligne dont l'identifiant interne existe déjà sur le terrain est signalée comme doublon dans l'aperçu ; elle n'est jamais créée silencieusement en double.
- **Doublon à l'intérieur du fichier** : deux lignes du même fichier portant le même identifiant interne ou le même couple prénom-nom sont signalées avant toute écriture, sans dépendre d'une vérification en base.
- **Caddie désactivé réimporté** : une ligne correspondant à un caddie désactivé est signalée comme telle ; elle ne réactive jamais le caddie sans décision explicite de l'administrateur.
- **Âge aberrant** : un âge qui produirait une année de naissance hors des bornes admises par le modèle de référence rend la ligne invalide ; le reste de la ligne n'est pas enregistré à moitié.
- **Ancienneté non numérique ou négative** : la ligne est invalide et le motif précise le champ fautif ; l'ancienneté n'est jamais remplacée par une valeur par défaut silencieuse.
- **Prénom ou nom manquant** : la ligne est invalide ; aucun caddie n'est créé avec un nom vide ou un nom de remplacement.
- **Fichier volumineux** : un fichier dépassant la taille ou le nombre de lignes admis est refusé avec un message indiquant les limites, avant toute tentative de lecture complète.
- **Interruption pendant l'exécution** : une défaillance survenant après la confirmation ne laisse aucun caddie créé ; l'état est celui d'avant l'importation.
- **Double confirmation** : un administrateur qui confirme deux fois la même importation, par double clic ou par retour arrière du navigateur, ne crée pas deux fois les mêmes caddies.
- **Deux administrateurs importent en même temps** : deux importations concurrentes sur le même terrain ne créent pas de caddies en double et ne s'écrasent pas l'une l'autre.
- **QR code d'une voiturette en entretien ou inactive** : le jeton reste reconnu par le serveur, qui répond par un message neutre plutôt que par une page d'erreur technique ou un silence.
- **QR code inconnu ou altéré** : un jeton qui ne correspond à aucune voiturette produit la même réponse neutre qu'un jeton valide sans affectation, afin de ne pas permettre de deviner quels codes existent.
- **Numéro visible réutilisé après réforme** : réattribuer à une nouvelle voiturette le numéro visible d'une voiturette inactive est refusé tant que l'ancienne conserve ce numéro ; les deux ne peuvent coexister.

## Requirements *(mandatory)*

Les exigences FR-001 à FR-046 de la spéc. 001 restent intégralement applicables. Les exigences ci-dessous les complètent sans les remplacer.

### Import CSV — lecture et validation du fichier

- **FR-101** : L'import de caddies DOIT être réservé aux comptes administrateurs ; un compte Starter NE DOIT en aucun cas y accéder.
- **FR-102** : Le système NE DOIT accepter que les formats de fichier explicitement autorisés et DOIT refuser tout autre format avec un message indiquant les formats admis.
- **FR-103** : Le système DOIT refuser, avant toute lecture complète, un fichier dépassant la taille maximale ou le nombre de lignes maximal admis, en indiquant ces limites.
- **FR-104** : Le système DOIT interpréter le fichier selon un encodage déterminé et DOIT signaler à l'administrateur, avant l'aperçu, tout caractère non déchiffrable rencontré dans un nom ou un prénom. **Décision du 2026-09-18** : accepter **UTF-8 et Windows-1252**, détectés automatiquement, l'encodage retenu étant annoncé dans l'aperçu et corrigeable avant importation. Windows-1252 est retenu parce qu'un export Excel le produit sans prévenir.
- **FR-105** : Le système DOIT déterminer le séparateur de colonnes du fichier, l'indiquer dans l'aperçu, et permettre à l'administrateur de le corriger si l'interprétation est erronée.
- **FR-106** : Le système DOIT déterminer si la première ligne est une ligne d'en-tête, l'indiquer explicitement dans l'aperçu, et permettre à l'administrateur de changer cette interprétation.
- **FR-107** : Le système DOIT valider que le fichier présente les **sept colonnes attendues dans l'ordre attendu** : nom, prénom, âge, taille d'habits, ancienneté, force, adresse du domicile.
- **FR-108** : Le système DOIT refuser globalement un fichier vide ou dont les colonnes attendues sont absentes ou en désordre, en présentant les colonnes trouvées face aux colonnes attendues, sans proposer d'importation partielle.
- **FR-109** : Lorsque l'interprétation du séparateur produit des lignes à une seule colonne sur la quasi-totalité du fichier, le système DOIT signaler un problème de séparateur plutôt que d'énumérer autant de lignes invalides.

### Import CSV — aperçu, correction et confirmation

- **FR-110** : Le système DOIT présenter un **aperçu avant toute écriture**, montrant ligne par ligne ce qui sera réellement enregistré.
- **FR-111** : L'aperçu DOIT indiquer le nombre de lignes lues, de lignes valides, de lignes invalides et de doublons potentiels.
- **FR-112** : Le système DOIT détecter les lignes invalides et présenter pour chacune son numéro de ligne d'origine et le motif précis du rejet.
- **FR-113** : Le système DOIT signaler distinctement les champs obligatoires manquants, sans jamais leur substituer une valeur par défaut.
- **FR-114** : Le système DOIT détecter les doublons potentiels **à l'intérieur du fichier** et **par rapport aux caddies déjà enregistrés sur le terrain**, avant toute écriture.
- **FR-115** : Le système DOIT traiter un doublon détecté selon une règle explicite et annoncée à l'administrateur avant la confirmation. **Décision du 2026-09-18** : **demander une décision ligne par ligne**. Remplacer en silence écraserait une correction faite à la main ; ignorer en silence ferait croire à un import réussi alors qu'une mise à jour a été perdue.
- **FR-116** : L'administrateur DOIT pouvoir **écarter** une ligne de l'importation depuis l'aperçu.
- **FR-117** : L'administrateur DOIT pouvoir **corriger** la valeur d'un champ d'une ligne depuis l'aperçu, sans avoir à modifier et redéposer le fichier.
- **FR-118** : Le système DOIT mettre à jour le décompte du résumé à chaque correction ou mise à l'écart, de sorte que le nombre annoncé corresponde toujours à ce qui sera créé.
- **FR-119** : Le système DOIT présenter un **résumé final** avant l'écriture, indiquant le nombre exact de caddies à créer et le nombre de lignes écartées.
- **FR-120** : Le système DOIT exiger une **confirmation explicite** de l'administrateur ; tant qu'elle n'est pas donnée, aucune donnée NE DOIT être écrite.

### Import CSV — exécution, atomicité et rapport

- **FR-121** : L'importation DOIT être **tout ou rien** : soit toutes les lignes retenues sont créées, soit aucune. Aucune importation partielle silencieuse NE DOIT être possible.
- **FR-122** : Une défaillance survenant pendant l'exécution DOIT laisser le terrain dans l'état exact d'avant l'importation, et l'administrateur DOIT en être informé explicitement.
- **FR-123** : Une confirmation répétée de la même importation, par double validation ou par retour arrière du navigateur, NE DOIT PAS créer les caddies une seconde fois.
- **FR-124** : Deux importations concurrentes sur le même terrain NE DOIVENT PAS créer de caddies en double ni s'écraser l'une l'autre.
- **FR-125** : Le système DOIT produire un **rapport d'importation** indiquant le nombre de caddies créés, le nombre de lignes écartées et le motif de chaque écart.
- **FR-126** : Le nombre de caddies créés annoncé dans le rapport DOIT correspondre exactement au nombre annoncé dans le résumé avant confirmation.
- **FR-127** : L'administrateur DOIT pouvoir **télécharger la liste des erreurs**, exploitable pour correction par le terrain, indiquant pour chaque ligne fautive son numéro de ligne d'origine et son motif.
- **FR-128** : Le système DOIT journaliser chaque importation comme action administrative, avec son auteur, son terrain, son horodatage et le nombre de caddies créés, sans aucun contenu de ligne.
- **FR-129** : Le fichier source déposé NE DOIT PAS être conservé après l'importation.

### Import CSV — protection des renseignements personnels

- **FR-130** : Les colonnes **taille d'habits**, **adresse du domicile** et **force** DOIVENT être lues pour respecter la structure du fichier puis **rejetées** : leur contenu NE DOIT être ni stocké, ni affiché, ni journalisé, ni inclus dans un rapport ou un fichier téléchargeable.
- **FR-131** : L'aperçu DOIT présenter ces trois colonnes comme **ignorées** et NE DOIT PAS en afficher le contenu.
- **FR-132** : L'âge lu dans le fichier DOIT être converti en **année de naissance**, seule forme conservée, rangée dans l'espace réservé aux administrateurs défini en spéc. 001.
- **FR-133** : Une ligne dont l'âge produirait une année de naissance hors des bornes admises par le modèle de référence DOIT être déclarée invalide, sans enregistrement partiel de cette ligne.
- **FR-134** : L'ancienneté DOIT être enregistrée comme un **nombre entier d'années** accompagné de la **date de son enregistrement**, qui est la date de l'importation. Une ancienneté non numérique ou négative rend la ligne invalide.
- **FR-135** : Le rapport d'importation et la liste des erreurs téléchargeable NE DOIVENT contenir aucune année de naissance ni aucune des trois colonnes rejetées.
- **FR-136** : Aucun nom de fichier, contenu de ligne ou donnée personnelle NE DOIT apparaître dans un journal technique, un message d'erreur ou une adresse Web produits par l'importateur.

### Cycle de vie du caddie

- **FR-137** : Un administrateur DOIT pouvoir créer un caddie à la main, sans passer par un import.
- **FR-138** : Le système DOIT refuser la création d'un caddie dont l'identifiant interne est déjà utilisé sur le terrain, y compris par un caddie désactivé.
- **FR-139** : L'identifiant interne d'un caddie NE DOIT JAMAIS être réattribué ni modifié après création.
- **FR-140** : Un administrateur DOIT pouvoir modifier le prénom, le nom et l'ancienneté d'un caddie, chaque modification étant journalisée.
- **FR-141** : Un administrateur DOIT pouvoir désactiver un caddie ; le caddie désactivé conserve l'intégralité de son historique d'affectations et d'évaluations.
- **FR-142** : Un caddie désactivé NE DOIT PLUS être proposé à l'affectation ni figurer dans les listes destinées au Starter.
- **FR-143** : Un administrateur DOIT pouvoir réactiver un caddie désactivé, sans perte de son identifiant interne ni de son historique.
- **FR-144** : Une ligne d'import correspondant à un caddie désactivé DOIT être signalée comme telle dans l'aperçu et NE DOIT PAS réactiver ce caddie sans décision explicite de l'administrateur.
- **FR-145** : Aucune fonction de suppression définitive d'un caddie NE DOIT être offerte ; seule la désactivation existe.
- **FR-146** : Un compte Starter NE DOIT voir d'un caddie que son identifiant interne, son prénom, son nom et sa disponibilité, à l'écran comme dans les échanges en arrière-plan.

### Voiturettes

- **FR-147** : Un administrateur DOIT pouvoir enregistrer, modifier et rendre inactive une voiturette sur son terrain.
- **FR-148** : Le numéro visible d'une voiturette DOIT être unique au sein du terrain ; toute tentative d'attribuer un numéro déjà porté par une autre voiturette du terrain DOIT être refusée.
- **FR-149** : Le système NE DOIT gérer qu'un **seul type d'équipement**, la voiturette, avec les quatre statuts : disponible, affectée, entretien, inactive.
- **FR-150** : Le statut **affectée** NE DOIT résulter que d'une affectation en cours ; il NE DOIT PAS être attribué ni retiré à la main.
- **FR-151** : Une voiturette en entretien ou inactive NE DOIT PAS être proposée à l'affectation.
- **FR-152** : Le système DOIT refuser de placer en entretien ou de rendre inactive une voiturette portant une affectation en cours, tant que cette affectation n'a pas été terminée ou annulée.
- **FR-153** : Une voiturette inactive DOIT conserver l'intégralité de son historique ainsi que son jeton de QR code.
- **FR-154** : Aucune fonction de suppression définitive d'une voiturette NE DOIT être offerte.
- **FR-155** : Un compte Starter NE DOIT voir d'une voiturette que son numéro visible et sa disponibilité, sans accès aux fonctions de gestion ni à l'impression.

### QR codes

- **FR-156** : Chaque voiturette DOIT recevoir automatiquement, dès son enregistrement, un jeton de QR code **unique sur l'ensemble de la plateforme**.
- **FR-157** : Le jeton DOIT être **opaque** : il NE DOIT contenir aucune donnée, ne permettre de deviner aucun autre jeton, et ne révéler ni terrain, ni voiturette, ni volume du parc.
- **FR-158** : Le jeton DOIT être **permanent** : il survit aux changements de statut, aux affectations, aux mises en entretien et à la mise hors service de la voiturette.
- **FR-159** : Aucune fonction de régénération d'un jeton NE DOIT être offerte à l'administrateur.
- **FR-160** : L'adresse Web portée par le QR code NE DOIT contenir aucune donnée personnelle, aucun numéro de réservation et aucun nom.
- **FR-161** : L'administrateur DOIT pouvoir produire une **planche imprimable** couvrant tout ou partie du parc de son terrain. [REPORTÉ : le format d'impression des QR codes (planche A4 ou étiquettes) sera arrêté à la phase de génération. Il n'affecte ni le modèle de données ni le jeton, qui reste identique quel que soit le support.]
- **FR-162** : Chaque étiquette imprimée DOIT porter, à côté du QR code, le **numéro visible** de la voiturette en clair, afin de permettre un rapprochement humain sans scan.
- **FR-163** : L'administrateur DOIT pouvoir réimprimer l'étiquette d'une seule voiturette à tout moment, le code imprimé restant strictement identique au précédent.
- **FR-164** : Une planche imprimée NE DOIT contenir aucune donnée personnelle ni aucune information sur les affectations.
- **FR-165** : Le jeton d'une voiturette en entretien ou inactive DOIT rester reconnu par le serveur, qui répond par un message neutre, sans révéler le statut interne du parc.
- **FR-166** : Un jeton inconnu ou altéré DOIT produire une réponse **indiscernable** de celle d'un jeton valide sans affectation en cours, afin de ne pas permettre d'énumérer les codes existants.

### Permissions, cloisonnement et journalisation

- **FR-167** : Toutes les opérations de cette spécification DOIVENT être filtrées par le terrain actif de l'utilisateur, ce filtrage étant appliqué par le serveur.
- **FR-168** : L'import de caddies, la gestion du cycle de vie des caddies, la gestion des voiturettes et l'impression des QR codes DOIVENT être réservés aux comptes administrateurs.
- **FR-169** : Chaque création, modification, désactivation et réactivation de caddie ou de voiturette DOIT être journalisée avec son auteur, son terrain, sa nature, sa cible et son horodatage, sans aucun contenu de donnée.
- **FR-170** : Un refus de permission DOIT produire un message clair sans révéler l'existence ni le contenu de la ressource visée.
- **FR-171** : Les fichiers d'exemple, jeux d'essai et captures d'écran associés à cette spécification DOIVENT être entièrement fictifs.

## Entités référencées

Cette spécification **ne définit aucune entité**. Elle décrit le comportement d'entités posées par la [spéc. 001](../001-socle-comptes-terrains/data-model.md), rappelées ici par leur seul nom et par ce que le présent document leur ajoute.

- **`caddie`** — défini en spéc. 001. *Ce que cette spec ajoute* : les voies par lesquelles une ligne naît (import CSV confirmé ou création manuelle par un administrateur), les règles de validation appliquées avant création, les transitions actif ↔ désactivé déclenchées par l'administrateur, et le comportement d'un réimport portant sur un caddie existant ou désactivé. Aucun champ nouveau.

- **`caddie_personal_data`** — défini en spéc. 001. *Ce que cette spec ajoute* : la conversion de l'âge du fichier source en année de naissance au moment de l'import, le rejet d'une ligne dont l'année de naissance serait hors bornes, et l'exclusion de cette donnée de tout aperçu, rapport, liste d'erreurs et vue Starter. Aucun champ nouveau.

- **`cart`** — défini en spéc. 001. *Ce que cette spec ajoute* : l'enregistrement d'une voiturette par un administrateur, l'unicité du numéro visible au sein du terrain, les transitions de statut autorisées à la main et celles réservées au moteur d'affectation, l'attribution automatique du jeton de QR code à la création, sa permanence, et la production des planches imprimables. Aucun champ nouveau.

- **`audit_log`** — défini en spéc. 001. *Ce que cette spec ajoute* : les natures d'action produites par ce périmètre (import de caddies, création, modification, désactivation et réactivation de caddie ou de voiturette, impression de QR codes), sans jamais y porter de contenu.

- **`assignment`** — défini en spéc. 001, spécifié en spéc. 003. *Référencé ici uniquement* pour établir qu'une voiturette portant une affectation en cours ne peut changer de statut, et que la résolution d'un jeton vers une affectation appartient aux spéc. 003 et 004.

## Évolutions demandées à la spéc. 001

Ces points ne sont **pas** décidés ici. Ils sont soumis au propriétaire du produit pour arbitrage et, s'ils sont retenus, portés par la spéc. 001 puis répercutés.

- **E-01 — Conservation du rapport d'importation** : les exigences FR-125 et FR-127 supposent qu'un rapport d'importation et une liste d'erreurs existent au moins le temps de la session. Le modèle de référence ne comporte aucune entité pour un lot d'importation, et `audit_log` est explicitement dépourvu de colonne de contenu. Deux voies : (a) le rapport reste **éphémère**, consultable et téléchargeable uniquement pendant la session de l'administrateur, sans aucune écriture durable ; (b) la spéc. 001 introduit une entité de lot d'importation portant les décomptes, sans aucun contenu de ligne. L'option (a) est celle que cette spécification suppose faute d'arbitrage, car elle n'ajoute aucune surface de stockage.

- **E-02 — Origine du caddie** : `booking` porte une colonne `source` valant `csv_import` ou `manual`, mais `caddie` n'en porte pas. Une symétrie serait utile pour distinguer un caddie importé d'un caddie saisi à la main lors d'un contrôle. Cette spécification **n'ajoute pas** ce champ et n'en dépend pas ; elle signale l'asymétrie.

- **E-03 — Origine de l'identifiant interne** : `caddie.internal_ref` est obligatoire, unique par terrain et jamais réattribué, mais la spéc. 001 ne dit pas d'où il provient à l'import. Si le fichier source ne le fournit pas, le système doit l'attribuer, ce qui change la nature de la détection de doublons : elle ne peut alors reposer que sur le couple prénom-nom, moins fiable. Cette spécification suppose faute d'arbitrage que le fichier source **ne fournit pas** d'identifiant et que le système l'attribue — voir Assumptions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101** : Un administrateur importe un fichier de 100 caddies, de son dépôt au rapport final, en moins de 10 minutes et sans assistance, à l'échelle cible de 5 terrains, environ 100 caddies et 60 départs par jour et par terrain.
- **SC-102** : Sur un fichier de 100 lignes dont 15 sont fautives, 100 % des lignes fautives sont signalées dans l'aperçu avant toute écriture, avec leur numéro de ligne d'origine et un motif exploitable.
- **SC-103** : Le nombre de caddies créés correspond exactement au nombre annoncé dans le résumé avant confirmation, sur 100 % des importations testées.
- **SC-104** : Aucune importation partielle n'est constatée sur l'ensemble des scénarios d'échec testés, y compris interruption en cours d'exécution, double confirmation et importations concurrentes.
- **SC-105** : Aucune occurrence de taille d'habits, d'adresse de domicile, de force ou d'année de naissance n'est retrouvée dans les données conservées, les journaux, les aperçus, les rapports, les listes d'erreurs téléchargeables et les écrans Starter, quel que soit le contenu du fichier source.
- **SC-106** : Un fichier réimporté à l'identique produit 100 % de lignes signalées comme doublons potentiels et zéro caddie créé en double.
- **SC-107** : Sur 100 % des caddies désactivés puis réactivés, l'identifiant interne et l'historique d'affectations sont identiques avant et après.
- **SC-108** : Aucun identifiant interne n'est réattribué sur l'ensemble des scénarios de désactivation, de réactivation et de réimport testés.
- **SC-109** : Le jeton de QR code d'une voiturette est strictement identique avant et après un cycle complet disponible → affectée → entretien → inactive → disponible, sur 100 % des voiturettes testées.
- **SC-110** : Aucune donnée personnelle, aucun numéro de réservation et aucun nom n'est retrouvé dans le contenu d'un QR code, dans l'adresse Web qu'il porte ni sur une planche imprimée, sur l'intégralité d'un parc de 30 voiturettes.
- **SC-111** : Un jeton inconnu et un jeton valide sans affectation en cours produisent des réponses indiscernables, sur 100 % des tentatives d'énumération testées.
- **SC-112** : Un administrateur enregistre une voiturette et obtient son étiquette imprimable en moins de 2 minutes, sur un parc de 30 voiturettes.

## Assumptions

Ces choix ont été retenus faute de précision explicite, en respectant la limite de trois marqueurs de clarification. Ils sont modifiables tant que le développement n'a pas commencé.

- **Ligne d'en-tête** : le système détermine seul si la première ligne est un en-tête, l'annonce dans l'aperçu et laisse l'administrateur corriger cette interprétation. Aucun fichier n'est donc rejeté pour cette seule raison, et aucune ligne de données n'est silencieusement avalée comme en-tête.
- **Séparateur de colonnes** : le système reconnaît la virgule, le point-virgule et la tabulation, retient celui qui produit sept colonnes cohérentes, l'annonce dans l'aperçu et laisse l'administrateur le corriger. Le point-virgule est fréquent sur les tableurs configurés en français, ce qui rend cette tolérance nécessaire en pratique.
- **Identifiant interne du caddie** : le fichier source n'en fournit pas ; le système l'attribue à la création. Conséquence assumée : la détection de doublons à l'import repose sur le couple prénom-nom, moins fiable qu'un identifiant. Voir E-03.
- **Rapport d'importation** : éphémère, consultable et téléchargeable pendant la session de l'administrateur, sans écriture durable au-delà de l'entrée de journal. Voir E-01.
- **Correction dans l'aperçu** : les corrections saisies dans l'aperçu portent sur les seuls champs conservés — nom, prénom, âge, ancienneté. Les trois colonnes rejetées ne sont jamais corrigeables puisqu'elles ne sont jamais lues au-delà du contrôle de structure.
- **Fichier source non conservé** : le fichier déposé est écarté à l'issue de l'importation. Le conserver reviendrait à stocker durablement les trois colonnes interdites, ce que le principe I exclut.
- **Volumétrie de l'import** : un import porte sur au plus quelques centaines de lignes, l'échelle cible étant de 5 terrains et environ 100 caddies. Les limites de taille et de nombre de lignes sont dimensionnées en conséquence.
- **Impression** : l'impression passe par la fonction d'impression du navigateur sur une page prévue pour cela ; aucun service tiers d'impression n'est introduit, conformément au principe III.
- **Langue** : les écrans d'import, de gestion des caddies et des voiturettes sont en français, comme le reste de l'interface administrateur.

## Dependencies

- La **spécification 001** : entités `caddie`, `caddie_personal_data`, `cart`, `audit_log`, comptes, rôles, cloisonnement par terrain et journalisation. Rien de cette spécification n'est réalisable avant elle.
- Le **fichier CSV fourni par chaque terrain**, à sept colonnes dans l'ordre convenu. Aucune intégration directe avec le système du terrain n'est prévue.
- La **spécification 003** pour la résolution d'un jeton de QR code vers une affectation active, et pour le statut *affectée* d'une voiturette.
- Un moyen d'**impression** sur site pour la pose physique des étiquettes.

## Out of Scope

- Import des réservations et des départs — spécification 3.
- Écran d'affectation du Starter, création et clôture d'une affectation — spécification 3.
- Résolution d'un jeton de QR code vers une affectation active et traitement des cas particuliers de cette résolution — spécifications 3 et 4.
- Questionnaire client, traductions et lien Google Reviews — spécification 4.
- Scores, KPI, comparaisons et rapports exportables — spécification 5.
- Photographie ou tout autre élément d'identification visuelle d'un caddie : hors périmètre, aucune fonctionnalité identifiée ne le justifie.
- Gestion d'un second type d'équipement : un seul type existe, la voiturette.
- Import de caddies par un compte Starter : définitivement exclu par la spéc. 001.
- Suivi d'entretien détaillé des voiturettes — kilométrage, batteries, historique de maintenance : hors périmètre du pilote, seul le statut est suivi.
- Effacement automatique de l'année de naissance à échéance : règle posée et portée par la spéc. 001.
