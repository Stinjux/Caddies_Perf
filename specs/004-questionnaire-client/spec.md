# Feature Specification: Questionnaire client, multilingue et avis Google

**Feature Branch**: `004-questionnaire-client`

**Created**: 2026-09-18

**Status**: Draft

**Input**: Spécification n°4 de CaddiePerf. Elle couvre le parcours du client de golf, du scan du QR code collé sur la voiturette jusqu'à l'envoi de son évaluation anonyme, l'interface en cinq langues, les questions sur la valeur perçue du prix et le renvoi vers les avis Google du terrain. Phases 13, 14, 18 et 19 du projet.

## Rôle de cette spécification

Cette spécification décrit un **parcours**, pas un modèle de données.

- La **spécification n°1 détient le modèle de données** de référence. Ce document s'y réfère et ne redéfinit jamais une entité, un champ, une valeur d'énumération ni une règle de calcul déjà posés dans [`specs/001-socle-comptes-terrains/data-model.md`](../001-socle-comptes-terrains/data-model.md).
- Les entités manipulées ici — `evaluation`, `evaluation_criterion_answer`, `google_review_click`, `cart`, `assignment`, `booking`, `caddie`, `golf_course` — sont **définies ailleurs**. Voir la section « Entités référencées ».
- Lorsque ce document estime qu'un champ manque au modèle, il le **signale** dans la section « Évolutions demandées à la spéc. 001 » et ne l'invente pas.

**Couvert ici** : résolution du jeton de QR code vers une affectation, écran d'accueil et confirmation du caddie, notation des six critères, note du parcours, valeur perçue du prix, commentaire facultatif, envoi, écran de remerciement, renvoi vers les avis Google, interface en cinq langues avec arabe de droite à gauche, identité visuelle du terrain, accessibilité et robustesse réseau.

**Hors de ce document** : création et impression des QR codes et gestion des voiturettes (spéc. 2), création des affectations par le Starter (spéc. 3), calcul des scores, moyennes, comparaisons, tableaux de bord et rapports (spéc. 5), protection contre les abus automatisés à grande échelle (phase transversale de sécurité).

**Statut de conformité constitutionnelle** : cette spécification est soumise aux principes I (minimisation des données personnelles), III (souveraineté des données) et IV (cloisonnement par terrain), tous trois structurants pour le parcours client. Elle est également soumise à l'exigence d'approbation des traductions inscrite dans la section « Expérience client » de la constitution.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Le client évalue son caddie au 18e trou (Priority: P1)

Un joueur termine sa partie. Son caddie lui montre le QR code collé sur la voiturette. Le joueur le scanne avec l'appareil photo de son téléphone. Sans créer de compte, sans télécharger d'application, il arrive sur un écran aux couleurs du terrain qui lui propose sa langue, lui indique le prénom du caddie et lui demande de confirmer. Il confirme, note six critères en étoiles, note son expérience sur le parcours, répond à deux questions sur le prix, ajoute éventuellement un commentaire, envoie, et voit un écran de remerciement. L'ensemble tient en moins de trente secondes.

**Why this priority** : c'est la raison d'être du produit. Sans ce parcours, aucune donnée d'évaluation n'entre dans le système et les spécifications 2, 3 et 5 n'ont rien à exploiter. Tout le reste de cette spécification en découle.

**Independent Test** : on colle un QR code de test sur une voiturette de test rattachée à une affectation active, on le scanne avec un téléphone, on remplit le questionnaire et on constate que l'évaluation est enregistrée, rattachée à la bonne affectation, sans qu'aucune donnée identifiant le joueur n'existe nulle part. Ce seul parcours délivre déjà de la valeur : le terrain recueille des évaluations.

**Acceptance Scenarios** :

1. **Given** une voiturette portant un QR code permanent et une affectation active reliant cette voiturette à un caddie, **When** le client scanne le QR code, **Then** l'écran d'accueil s'affiche avec le prénom du caddie affecté, aux couleurs et au logo du terrain, sans demander ni compte ni installation.
2. **Given** l'écran d'accueil affichant le bon caddie, **When** le client confirme qu'il évalue bien ce caddie, **Then** le questionnaire s'ouvre sur les six critères présentés dans l'ordre imposé.
3. **Given** le questionnaire ouvert, **When** le client attribue une note de 1 à 5 étoiles à chacun des six critères, **Then** chaque note est retenue et le client peut poursuivre.
4. **Given** les six critères notés, **When** le client poursuit, **Then** la question sur l'expérience du parcours lui est posée, puis les deux questions sur le prix, puis la proposition de commentaire.
5. **Given** un questionnaire entièrement rempli, **When** le client envoie son évaluation, **Then** l'évaluation est enregistrée, rattachée à l'affectation résolue par le serveur, et l'écran de remerciement s'affiche.
6. **Given** une évaluation envoyée, **When** on examine tout ce qui a été conservé, **Then** on n'y trouve ni nom, ni courriel, ni numéro de téléphone, ni adresse IP, ni empreinte de navigateur du joueur.
7. **Given** un client qui ne souhaite pas noter un critère parce qu'il ne s'applique pas, **When** il choisit « Non applicable », **Then** ce choix est accepté et l'envoi reste possible.

---

### User Story 2 - Le client répond dans sa langue, arabe compris (Priority: P1)

Un joueur germanophone, hispanophone, anglophone ou arabophone scanne le même QR code que tout le monde et choisit sa langue sur le premier écran. Tout le questionnaire bascule dans cette langue. En arabe, la mise en page entière se lit de droite à gauche : l'ordre des étoiles, la position des boutons, l'alignement des textes.

**Why this priority** : la clientèle des terrains marocains est largement internationale. Un questionnaire disponible en français seulement écarte une grande partie des répondants et fausse la mesure. Les cinq langues sont exigées dès le MVP par la constitution.

**Independent Test** : on parcourt le questionnaire complet dans chacune des cinq langues et l'on vérifie qu'aucun texte ne reste dans une autre langue, qu'aucun texte n'est tronqué, et qu'en arabe la lecture et les interactions se font bien de droite à gauche.

**Acceptance Scenarios** :

1. **Given** l'écran d'accueil, **When** le client choisit l'une des cinq langues, **Then** l'intégralité des écrans suivants s'affiche dans cette langue, sans aucun texte restant dans une autre langue.
2. **Given** le client a choisi l'arabe, **When** un écran quelconque du questionnaire s'affiche, **Then** la mise en page entière est orientée de droite à gauche, y compris l'ordre des étoiles et la position des boutons d'action.
3. **Given** une évaluation envoyée, **When** on l'examine, **Then** la langue dans laquelle elle a été remplie est connue.
4. **Given** une traduction proposée pour l'une des quatre langues autres que le français, **When** elle n'a pas été approuvée par le propriétaire du produit, **Then** elle n'est pas intégrée au produit.
5. **Given** un client dont la langue du téléphone est l'une des cinq langues, **When** il arrive sur l'écran d'accueil, **Then** cette langue est présélectionnée, le client restant libre d'en changer d'un seul geste.
6. **Given** un client dont la langue du téléphone n'est aucune des cinq, **When** il arrive sur l'écran d'accueil, **Then** le français est présélectionné.

---

### User Story 3 - Le QR code ne mène pas à une évaluation exploitable (Priority: P1)

Un QR code est permanent et collé sur une voiturette. Il sera donc scanné en dehors de tout contexte utile : voiturette au garage, partie annulée, partie terminée depuis plusieurs jours, curieux qui scanne en passant. Dans chacun de ces cas, le client voit un message clair et courtois, jamais une page d'erreur technique, et le système n'enregistre aucune évaluation orpheline.

**Why this priority** : le QR code étant permanent et exposé au public, ces situations sont la règle et non l'exception. Un parcours qui ne les traite pas produirait des évaluations rattachées au mauvais caddie — un défaut qui contaminerait durablement les scores de la spécification 5.

**Independent Test** : on scanne successivement un QR code sans affectation active, un QR code dont la réservation est annulée et un QR code dont la partie est terminée depuis trop longtemps ; chaque cas produit son propre message compréhensible et aucune évaluation n'est enregistrée.

**Acceptance Scenarios** :

1. **Given** une voiturette sans aucune affectation active, **When** le QR code est scanné, **Then** un message courtois explique qu'aucune partie en cours n'est associée à cette voiturette, et aucun questionnaire ne s'ouvre.
2. **Given** une voiturette dont la réservation associée est annulée, **When** le QR code est scanné, **Then** le même type de message s'affiche et aucun questionnaire ne s'ouvre.
3. **Given** une affectation terminée depuis plus longtemps que le délai d'acceptation, **When** le QR code est scanné, **Then** un message indique que la période d'évaluation est close, et remercie le client.
4. **Given** un jeton de QR code inconnu, mal recopié ou modifié, **When** il est soumis, **Then** la réponse est indifférenciable de celle d'un jeton valide sans affectation : elle ne révèle ni l'existence ni l'inexistence de la voiturette.
5. **Given** plusieurs affectations candidates pour la même voiturette au même instant, **When** le QR code est scanné, **Then** le serveur applique une règle déterministe de sélection et, si l'ambiguïté persiste, n'ouvre pas le questionnaire plutôt que de risquer le mauvais caddie.
6. **Given** un client qui voit s'afficher un caddie qui n'est pas le sien, **When** il répond « Non, ce n'est pas mon caddie », **Then** le questionnaire ne s'ouvre pas, aucune note n'est enregistrée pour ce caddie, et un message invite le client à se signaler auprès de l'accueil du terrain.

---

### User Story 4 - Trois mesures distinctes qui ne se contaminent jamais (Priority: P2)

Le même questionnaire recueille trois choses que le terrain doit pouvoir lire séparément : la qualité du travail du caddie, la qualité du parcours ce jour-là, et le jugement du client sur le prix du service. Un client qui trouve le prix trop élevé mais le caddie excellent doit produire un score de caddie excellent.

**Why this priority** : c'est une exigence de la constitution et le principal risque d'erreur de conception du produit. Elle est en P2 parce que le parcours de base (US1) reste démontrable sans elle, mais aucune mise en exploitation n'est envisageable sans qu'elle soit vérifiée.

**Independent Test** : on envoie deux évaluations identiques sur les six critères du caddie, l'une avec les pires réponses possibles sur le prix et le parcours, l'autre avec les meilleures ; le score du caddie calculé est rigoureusement identique dans les deux cas.

**Acceptance Scenarios** :

1. **Given** une évaluation où les six critères du caddie sont notés 5, **When** le client répond « Beaucoup trop élevé » à la question sur le prix et 1 étoile au rapport qualité-prix, **Then** le score du caddie reste celui de six notes à 5, inchangé.
2. **Given** une évaluation où les six critères du caddie sont notés 5, **When** le client note le parcours à 1 étoile, **Then** le score du caddie reste inchangé et la note du parcours est attribuée au terrain.
3. **Given** un ensemble d'évaluations, **When** on consulte la note du parcours, **Then** elle est agrégée au niveau du terrain et à aucun moment au niveau d'un caddie.
4. **Given** une réponse « Non applicable » sur un critère, **When** la moyenne du caddie est calculée, **Then** ce critère est exclu du calcul et la moyenne n'en est pas abaissée.
5. **Given** une évaluation où les six critères sont marqués « Non applicable », **When** elle est envoyée, **Then** l'envoi est accepté, l'évaluation est enregistrée et elle ne contribue à aucune moyenne de compétence.

---

### User Story 5 - Le client est invité à laisser un avis Google (Priority: P2)

Après l'envoi, le client est remercié puis se voit proposer de partager son expérience sur Google. Le bouton est présenté à tous les clients, quelle que soit la note qu'ils viennent de donner. Chaque terrain renvoie vers son propre lien d'avis. Le système compte les clics et ne prétend jamais savoir si un avis a réellement été publié.

**Why this priority** : c'est un bénéfice commercial direct pour le terrain, mais il n'a de sens qu'une fois le parcours d'évaluation en place. La neutralité de la proposition — même bouton pour une note de 1 et pour une note de 5 — est une contrainte éthique ferme et non une option de réglage.

**Independent Test** : on envoie deux évaluations, l'une avec les notes les plus basses et l'autre avec les plus hautes, et l'on constate que l'écran de remerciement est identique dans les deux cas, bouton Google compris, et que chaque clic est compté une fois.

**Acceptance Scenarios** :

1. **Given** une évaluation envoyée avec des notes basses, **When** l'écran de remerciement s'affiche, **Then** le bouton « Laisser un avis sur Google » y figure exactement comme pour une évaluation aux notes hautes.
2. **Given** un client sur l'écran de remerciement d'un terrain donné, **When** il clique sur le bouton Google, **Then** il est dirigé vers le lien d'avis propre à ce terrain et non à un autre.
3. **Given** un clic sur le bouton Google, **When** il est enregistré, **Then** le système consigne un clic anonyme rattaché au terrain, sans jamais affirmer qu'un avis a été publié.
4. **Given** un terrain pour lequel aucun lien d'avis n'est enregistré, **When** l'écran de remerciement s'affiche, **Then** le bouton Google n'est pas présenté et l'écran reste complet et cohérent.
5. **Given** un client sur l'écran de remerciement, **When** il clique sur « Terminer », **Then** le parcours se clôt sans aucune autre sollicitation.

---

### User Story 6 - Quatre joueurs d'une même partie répondent chacun (Priority: P3)

Une réservation compte quatre joueurs partageant une voiturette et un caddie. Chacun scanne le même QR code, parfois à quelques secondes d'intervalle, et remplit son propre questionnaire. Les quatre évaluations sont légitimes et distinctes. Le même joueur qui rescanne par curiosité ou par inadvertance ne doit pas pouvoir multiplier les envois sans limite.

**Why this priority** : le cas est courant mais n'invalide pas le parcours de base. Il est en P3 parce qu'un pilote sur un terrain peut démarrer avec un plafond simple, quitte à l'affiner ensuite.

**Independent Test** : on fait remplir quatre questionnaires sur quatre appareils différents à partir du même QR code et de la même affectation ; les quatre évaluations sont enregistrées et rattachées à cette affectation, et la tentative suivante est traitée selon la règle de plafond retenue.

**Acceptance Scenarios** :

1. **Given** une affectation active, **When** plusieurs joueurs de la même réservation scannent le même QR code et envoient chacun leur évaluation, **Then** chaque évaluation est enregistrée séparément et rattachée à cette affectation.
2. **Given** un client qui vient d'envoyer son évaluation, **When** il rescanne immédiatement le même QR code sur le même appareil, **Then** le système le reconnaît comme ayant déjà répondu et lui présente l'écran de remerciement plutôt qu'un nouveau questionnaire vierge.
3. **Given** le plafond de réponses atteint pour une affectation, **When** une nouvelle tentative d'envoi survient, **Then** elle est refusée avec un message courtois, sans dévoiler le nombre d'évaluations déjà reçues.
4. **Given** un même envoi transmis deux fois à la suite d'un double appui ou d'une reprise réseau, **When** le serveur le reçoit, **Then** une seule évaluation est enregistrée.

---

### Edge Cases

1. **Aucune affectation active pour la voiturette** — la voiturette est au garage, disponible ou en entretien. Le client voit un message courtois expliquant qu'aucune partie en cours n'est associée à cette voiturette ; aucun questionnaire ne s'ouvre et rien n'est enregistré.
2. **Plusieurs affectations actives trouvées pour la même voiturette** — le serveur applique une règle de sélection déterministe et documentée ; si elle ne tranche pas, il refuse d'ouvrir le questionnaire plutôt que de risquer d'attribuer des notes au mauvais caddie.
3. **Le mauvais caddie est affiché et le client répond « Non, ce n'est pas mon caddie »** — le questionnaire ne s'ouvre pas, aucune note n'est enregistrée pour ce caddie, le client est invité à se signaler à l'accueil, et le terrain doit pouvoir constater qu'une affectation a été contestée.
4. **Réservation annulée** — l'affectation rattachée à une réservation annulée n'ouvre jamais le questionnaire, même si son propre statut n'a pas encore été mis à jour.
5. **Partie terminée depuis trop longtemps** — passé le délai d'acceptation, le QR code affiche un message de clôture de la période d'évaluation. Le délai est le même pour tous les terrains.
6. **Affectation annulée par le Starter après une correction d'erreur** — le questionnaire n'est plus ouvert ; une évaluation déjà envoyée avant l'annulation reste enregistrée et rattachée à l'affectation annulée, pour ne pas effacer la parole du client.
7. **Quatre joueurs d'une même réservation répondent chacun légitimement** — les quatre évaluations sont enregistrées et distinctes ; aucune n'écrase les autres.
8. **Soumissions répétées depuis le même appareil** — le même appareil qui a déjà envoyé une évaluation pour une affectation donnée revoit l'écran de remerciement. Cette reconnaissance se fait sans stocker la moindre donnée identifiante côté serveur.
9. **Double envoi du même formulaire** — double appui, reprise réseau ou rechargement de page ne produisent qu'une seule évaluation.
10. **Abandon en cours de questionnaire** — le client ferme l'onglet à mi-parcours. Rien n'est enregistré côté serveur. S'il revient dans un délai court sur le même appareil, ses réponses en cours lui sont restituées ; sinon il repart d'un questionnaire vierge.
11. **Connexion mobile lente** — le premier écran reste utilisable sur une liaison dégradée ; les écrans suivants ne dépendent d'aucun chargement long. L'objectif des trente secondes se mesure hors temps de réseau.
12. **Connexion interrompue au moment de l'envoi** — le client voit que l'envoi n'a pas abouti, ses réponses ne sont pas perdues, et il peut réessayer sans tout ressaisir. Une réussite n'est jamais annoncée avant confirmation du serveur.
13. **Le client change de langue en cours de questionnaire** — les réponses déjà saisies sont conservées ; seul l'affichage change. Le passage vers ou depuis l'arabe réoriente la mise en page sans perte de réponse.
14. **Terrain sans logo, sans couleurs de marque ou sans lien Google Reviews** — chaque écran reste lisible et complet ; les éléments absents sont remplacés par une présentation neutre, jamais par un espace vide ou une image cassée.
15. **Prénom du caddie long, ou écrit dans un alphabet différent de la langue choisie** — le prénom s'affiche entièrement, sans troncature ni chevauchement, y compris en arabe.
16. **Caddie désactivé entre le départ et le retour au club** — une affectation déjà active reste évaluable ; la désactivation d'un caddie ne prive pas le client de la possibilité de s'exprimer sur la partie qu'il vient de jouer.
17. **Texte traduit plus long que le texte français** — aucun libellé de bouton ni aucune question n'est tronqué dans l'une des cinq langues ; la mise en page s'adapte à la longueur.
18. **Client en plein soleil sur un écran de téléphone** — les contrastes et la taille des cibles tactiles restent suffisants pour répondre sans s'abriter.

## Texte exact des écrans *(langue de référence : français)*

Les textes ci-dessous font foi en **français**, langue de référence du produit. Les versions anglaise, arabe, allemande et espagnole seront rédigées séparément et **présentées au propriétaire du produit pour approbation avant toute intégration**, conformément à la constitution. Aucune traduction n'est proposée dans ce document.

Les mentions entre crochets sont des valeurs substituées par le système et ne sont jamais traduites : `[Prénom du caddie]`, `[Nom du terrain]`, `[Montant] MAD`.

### Écran 1 — Accueil, langue et confirmation du caddie

- Sélecteur de langue : cinq choix, présentés chacun dans sa propre langue.
- Titre : **« Évaluez-vous bien [Prénom du caddie] ? »**
- Mention de durée : **« Cela prend moins de 30 secondes. »**
- Bouton principal : **« Oui »**
- Bouton secondaire : **« Non, ce n'est pas mon caddie »**

### Écran 2 — Les six critères

- Titre : **« Comment évaluez-vous votre caddie ? »**
- Les six critères, dans cet ordre exact et non modifiable :
  1. **« Accueil et attitude »**
  2. **« Connaissance des règles et de l'étiquette »**
  3. **« Connaissance du parcours »**
  4. **« Lecture des verts »**
  5. **« Capacité à communiquer clairement avec vous »**
  6. **« Expérience générale »**
- Libellés des étoiles, affichés au client :
  - 1 étoile : **« Très insatisfaisant »**
  - 2 étoiles : **« Insatisfaisant »**
  - 3 étoiles : **« Satisfaisant »**
  - 4 étoiles : **« Très bien »**
  - 5 étoiles : **« Excellent »**
- Option proposée sur chaque critère : **« Non applicable »**

### Écran 3 — Expérience sur le parcours

- Question : **« Dans l'ensemble, comment évaluez-vous votre expérience sur notre terrain aujourd'hui ? »**
- Réponse : 1 à 5 étoiles, mêmes libellés qu'à l'écran 2.

### Écran 4 — Valeur perçue du prix

- Question 1 : **« Compte tenu de la qualité du service reçu, comment évaluez-vous le rapport qualité-prix du service de caddie à [Montant] MAD ? »**
  - Réponse : 1 à 5 étoiles, mêmes libellés qu'à l'écran 2.
- Question 2 : **« Comment considérez-vous le prix de [Montant] MAD pour ce service de caddie ? »**
  - Réponses proposées, dans cet ordre :
    1. **« Beaucoup trop bas »**
    2. **« Plutôt bas »**
    3. **« Juste et raisonnable »**
    4. **« Plutôt élevé »**
    5. **« Beaucoup trop élevé »**

### Écran 5 — Commentaire facultatif

- Question : **« Souhaitez-vous ajouter un commentaire ? »**
- Mention : **« Facultatif »**
- Bouton d'envoi : **« Envoyer mon évaluation »**

### Écran 6 — Remerciement et avis Google

- Message de remerciement : **« Merci pour votre évaluation ! Votre avis nous aide à améliorer l'expérience de nos joueurs et la qualité de notre service. »**
- Proposition : **« Souhaitez-vous également partager votre expérience sur Google ? »**
- Bouton principal : **« Laisser un avis sur Google »**
- Bouton secondaire : **« Terminer »**

### Écrans de situation particulière

- **Aucune partie associée** : **« Aucune partie en cours n'est associée à cette voiturette. Si vous venez de terminer votre partie, adressez-vous à l'accueil du club. »**
- **Période d'évaluation close** : **« La période d'évaluation de cette partie est terminée. Merci d'avoir joué avec nous. »**
- **Ce n'est pas le bon caddie** : **« Merci de nous l'avoir signalé. Pour que votre évaluation soit attribuée au bon caddie, présentez-vous à l'accueil du club. »**
- **Évaluation déjà envoyée** : **« Vous avez déjà envoyé votre évaluation pour cette partie. Merci ! »**
- **Envoi impossible** : **« Votre évaluation n'a pas pu être envoyée. Vos réponses sont conservées, vous pouvez réessayer. »** avec un bouton **« Réessayer »**.

## Requirements *(mandatory)*

### Accès par QR code et résolution de l'affectation

- **FR-301** : Le client NE DOIT avoir besoin d'aucun compte, d'aucune identification et d'aucune installation d'application pour accéder au questionnaire et l'envoyer.
- **FR-302** : Le QR code apposé sur une voiturette DOIT être permanent et NE DOIT contenir qu'un jeton opaque, sans nom de caddie, sans nom de client, sans numéro de réservation ni aucune autre donnée personnelle.
- **FR-303** : Le **serveur seul** DOIT résoudre le jeton vers l'affectation active. Le navigateur du client NE DOIT jamais fournir, deviner ni influencer l'identifiant de l'affectation, du caddie ou du terrain.
- **FR-304** : La résolution DOIT traiter explicitement chacun des cas suivants : aucune affectation active, plusieurs affectations candidates, réservation annulée, affectation annulée, affectation terminée au-delà du délai d'acceptation, voiturette inactive ou en entretien, jeton inconnu.
- **FR-305** : Lorsque la résolution n'aboutit pas, le système DOIT présenter un message compréhensible par un client non technique et NE DOIT JAMAIS afficher un message d'erreur technique ni un identifiant interne.
- **FR-306** : La réponse à un jeton inconnu DOIT être indifférenciable de celle d'un jeton valide sans affectation, afin de ne rien révéler sur l'existence des voiturettes.
- **FR-307** : Le système DOIT cesser d'accepter une évaluation au-delà d'un délai fixe suivant la fin de l'affectation. **Décision du 2026-09-18** : délai **paramétrable par terrain** (FR-050 de la spéc. 001). En l'absence de valeur, la limite est la **fin de la journée locale du terrain**.
- **FR-308** : En présence de plusieurs affectations candidates, le système DOIT appliquer une règle de sélection déterministe et documentée ; si l'ambiguïté subsiste, il DOIT refuser d'ouvrir le questionnaire plutôt que de risquer un rattachement erroné.

### Écran d'accueil et confirmation du caddie

- **FR-309** : L'écran d'accueil DOIT présenter, sur un seul écran : le choix de la langue, le prénom du caddie affecté, la demande de confirmation et la mention que le questionnaire prend moins de 30 secondes.
- **FR-310** : L'écran d'accueil NE DOIT afficher du caddie que son **prénom** — ni nom de famille, ni identifiant interne, ni aucun autre renseignement le concernant.
- **FR-311** : Le client DOIT pouvoir répondre « Oui » ou « Non, ce n'est pas mon caddie ».
- **FR-312** : Une réponse « Non, ce n'est pas mon caddie » NE DOIT ouvrir aucun questionnaire et NE DOIT enregistrer aucune note pour ce caddie.
- **FR-313** : Une réponse « Non, ce n'est pas mon caddie » DOIT être consignée comme un signalement d'affectation contestée, exploitable par le terrain, et sans aucune donnée identifiant le joueur.

### Interface multilingue

- **FR-314** : Le questionnaire DOIT être disponible dans cinq langues : français, anglais, arabe, allemand, espagnol.
- **FR-315** : Le client DOIT pouvoir choisir sa langue dès l'écran d'accueil, chaque langue étant présentée dans sa propre langue.
- **FR-316** : Lorsque l'arabe est choisi, la mise en page entière DOIT s'afficher de droite à gauche, y compris l'ordre des étoiles, la position des boutons d'action et l'alignement des textes.
- **FR-317** : Le changement de langue en cours de questionnaire NE DOIT PAS faire perdre les réponses déjà saisies.
- **FR-318** : La langue dans laquelle l'évaluation a été remplie DOIT être conservée avec l'évaluation.
- **FR-319** : Le **français** est la langue de référence. Les quatre autres versions DOIVENT être **présentées au propriétaire du produit pour approbation avant intégration** ; une traduction non approuvée NE DOIT PAS être mise en service.
- **FR-320** : Le système DOIT présélectionner la langue du téléphone du client lorsqu'elle fait partie des cinq langues, et le français dans le cas contraire, le client restant libre d'en changer d'un seul geste.
- **FR-321** : Aucun libellé, aucune question et aucun bouton NE DOIT être tronqué ni chevaucher un autre élément dans l'une quelconque des cinq langues.

### Notation des six critères du caddie

- **FR-322** : Le questionnaire DOIT présenter exactement six critères, dans cet ordre imposé et non modifiable : accueil et attitude, connaissance des règles et de l'étiquette, connaissance du parcours, lecture des verts, capacité à communiquer clairement, expérience générale.
- **FR-323** : Chaque critère DOIT être notable de 1 à 5 étoiles, avec les libellés : 1 très insatisfaisant, 2 insatisfaisant, 3 satisfaisant, 4 très bien, 5 excellent.
- **FR-324** : Chaque critère DOIT proposer l'option « Non applicable ».
- **FR-325** : Une réponse « Non applicable » DOIT être exclue du calcul des moyennes et NE DOIT JAMAIS les abaisser.
- **FR-326** : Le système DOIT accepter l'envoi d'une évaluation où certains critères, voire tous, sont marqués « Non applicable ».
- **FR-327** : Les libellés des étoiles DOIVENT être visibles par le client et non déductibles du seul nombre d'étoiles.

### Note du parcours et valeur perçue du prix

- **FR-328** : Le questionnaire DOIT poser une question distincte sur l'expérience du client sur le terrain, notée de 1 à 5 étoiles.
- **FR-329** : La note du parcours DOIT appartenir au terrain et NE DOIT JAMAIS entrer dans le score d'un caddie.
- **FR-330** : Le questionnaire DOIT poser une question sur le rapport qualité-prix du service de caddie, notée de 1 à 5 étoiles, en mentionnant le montant du service.
- **FR-331** : Le questionnaire DOIT poser une question sur le niveau du prix, avec cinq réponses exclusives : beaucoup trop bas, plutôt bas, juste et raisonnable, plutôt élevé, beaucoup trop élevé.
- **FR-332** : Les réponses sur le prix NE DOIVENT JAMAIS modifier la note ni le score du caddie.
- **FR-333** : Le score du caddie, la note du parcours et la valeur perçue du prix DOIVENT rester trois mesures distinctes, aucune n'influençant le calcul d'une autre.
- **FR-334** : Le montant affiché dans les deux questions sur le prix DOIT correspondre au tarif du service de caddie applicable au terrain concerné. **Décision du 2026-09-18** : **200 MAD par caddie pour 18 trous**, tarif identique sur les cinq terrains. Le tarif affiché au client est néanmoins **mémorisé dans chaque évaluation** (FR-048 de la spéc. 001) : sans cela, une révision du tarif rendrait illisible tout l'historique des réponses sur le prix.

### Commentaire libre

- **FR-335** : Le questionnaire DOIT proposer un commentaire en texte libre, explicitement **facultatif**.
- **FR-336** : L'envoi NE DOIT JAMAIS être conditionné à la saisie d'un commentaire.
- **FR-337** : Le commentaire DOIT pouvoir être saisi dans l'alphabet de n'importe laquelle des cinq langues, arabe compris.
- **FR-338** : Le commentaire DOIT être effacé **2 ans** après son dépôt, sans que cet effacement ne supprime l'évaluation chiffrée à laquelle il était rattaché.

### Envoi, unicité et robustesse

- **FR-339** : L'envoi DOIT être possible dès lors que le client a confirmé le caddie, sans qu'aucune question ne soit rendue obligatoire au-delà de cette confirmation.
- **FR-340** : Le système NE DOIT annoncer la réussite de l'envoi qu'après confirmation par le serveur.
- **FR-341** : Un même envoi reçu plusieurs fois — double appui, rechargement, reprise réseau — NE DOIT produire qu'une seule évaluation.
- **FR-342** : Le système DOIT accepter plusieurs évaluations distinctes pour une même affectation, plusieurs joueurs d'une même réservation étant légitimes à répondre chacun. **Décision du 2026-09-18** : **quatre réponses au maximum** par affectation, soit le nombre de joueurs d'une partie (FR-051 de la spéc. 001).
- **FR-343** : Un appareil ayant déjà envoyé une évaluation pour une affectation donnée DOIT se voir présenter l'écran de remerciement plutôt qu'un questionnaire vierge, **sans qu'aucune donnée identifiant l'appareil ou le joueur ne soit conservée côté serveur**.
- **FR-344** : Lorsque le plafond de réponses d'une affectation est atteint, une nouvelle tentative DOIT être refusée avec un message courtois, sans révéler le nombre d'évaluations déjà reçues.
- **FR-345** : En cas d'interruption réseau pendant l'envoi, les réponses du client DOIVENT être conservées et il DOIT pouvoir réessayer sans tout ressaisir.
- **FR-346** : L'abandon en cours de questionnaire NE DOIT rien enregistrer côté serveur. Une reprise sur le même appareil dans un délai court DOIT restituer les réponses en cours.

### Écran de remerciement et avis Google

- **FR-347** : Après un envoi réussi, le système DOIT afficher un message de remerciement puis proposer le partage de l'expérience sur Google.
- **FR-348** : Le bouton d'avis Google DOIT être présenté à **tous** les clients, quelle que soit la note qu'ils viennent d'attribuer ; aucune règle NE DOIT le réserver aux clients satisfaits.
- **FR-349** : Le lien d'avis utilisé DOIT être celui du terrain concerné, sélectionné par le serveur.
- **FR-350** : Le système DOIT enregistrer le **clic** sur le bouton d'avis Google, et NE DOIT JAMAIS prétendre savoir si un avis a été publié.
- **FR-351** : Lorsqu'un terrain n'a pas de lien d'avis enregistré, l'écran de remerciement DOIT rester complet et cohérent sans ce bouton.
- **FR-352** : Le bouton « Terminer » DOIT clore le parcours sans aucune sollicitation supplémentaire.

### Anonymat et protection des renseignements personnels

- **FR-353** : Les évaluations DOIVENT être anonymes et le rester ; aucun mécanisme NE DOIT permettre de remonter d'une évaluation à l'identité du joueur.
- **FR-354** : Le système NE DOIT conserver, en lien avec une évaluation, ni nom, ni courriel, ni numéro de téléphone, ni adresse IP, ni empreinte de navigateur.
- **FR-355** : Aucune donnée personnelle NE DOIT figurer dans une adresse Web, un paramètre de requête, un journal technique ou un message d'erreur du parcours client.
- **FR-356** : Les notes chiffrées DOIVENT être conservées sans limite de durée, l'anonymat les rendant non identifiantes.
- **FR-357** : Le parcours client NE DOIT faire appel à aucun service tiers recevant des données du client, à l'exception du renvoi explicite vers le lien d'avis Google déclenché par le client lui-même.
- **FR-358** : Chaque évaluation DOIT être rattachée à un seul terrain, et aucune évaluation NE DOIT pouvoir être rattachée à une affectation d'un autre terrain.

### Interface, accessibilité et identité visuelle

- **FR-359** : Le questionnaire DOIT être conçu pour mobile d'abord et rester utilisable sur les tailles d'écran de téléphone courantes.
- **FR-360** : Les cibles tactiles DOIVENT être suffisamment grandes pour être atteintes du pouce, sans zoom et sans précision particulière.
- **FR-361** : Les contrastes DOIVENT permettre la lecture en plein soleil sur un écran de téléphone.
- **FR-362** : Le questionnaire DOIT être utilisable au clavier et avec un lecteur d'écran : chaque étoile, chaque option et chaque bouton porte un libellé explicite, et l'état sélectionné est annoncé.
- **FR-363** : L'information NE DOIT JAMAIS reposer sur la seule couleur ; chaque niveau de note porte son libellé textuel.
- **FR-364** : Les écrans clients DOIVENT refléter le logo et les couleurs de marque du terrain concerné.
- **FR-365** : En l'absence de logo ou de couleurs de marque, les écrans DOIVENT rester lisibles et complets grâce à une présentation neutre par défaut.
- **FR-366** : Le premier écran DOIT rester utilisable sur une liaison mobile dégradée, et les écrans suivants NE DOIVENT dépendre d'aucun chargement long.

## Entités référencées

Aucune entité n'est définie ici. Les définitions font autorité dans [`specs/001-socle-comptes-terrains/data-model.md`](../001-socle-comptes-terrains/data-model.md) et dans la section « Key Entities » de [`specs/001-socle-comptes-terrains/spec.md`](../001-socle-comptes-terrains/spec.md).

| Entité | Rôle dans ce parcours | Défini dans |
|---|---|---|
| `cart` — Voiturette | Porte le jeton de QR code opaque et permanent scanné par le client. Point d'entrée du parcours. | Spéc. 001 |
| `assignment` — Affectation | Cible de la résolution du jeton. Relie le terrain, la réservation, la voiturette et le caddie. Toute évaluation s'y rattache. | Spéc. 001 |
| `booking` — Réservation | Son statut conditionne l'ouverture du questionnaire : une réservation annulée ne mène jamais à une évaluation. | Spéc. 001 |
| `caddie` — Caddie | Seul son **prénom** est présenté au client, pour confirmation. | Spéc. 001 |
| `golf_course` — Terrain | Fournit le logo, les couleurs de marque et le lien d'avis Google utilisés par les écrans clients. | Spéc. 001 |
| `evaluation` — Évaluation anonyme | Résultat du parcours : langue, commentaire facultatif, note du parcours, rapport qualité-prix, perception du prix, horodatage, échéance d'effacement du commentaire. | Spéc. 001 |
| `evaluation_criterion_answer` — Réponse par critère | Une ligne par critère noté ; l'absence de note y signifie « Non applicable » et est exclue des moyennes. | Spéc. 001 |
| `google_review_click` — Clic vers les avis | Trace anonyme d'un clic sur le bouton d'avis Google, rattachée au terrain. | Spéc. 001 |

**Rappels de règles détenues par la spéc. 001, reprises ici sans modification** :

- Les six valeurs de critère sont fixées par le modèle et leur ordre d'affichage est imposé.
- Les cinq langues sont fixées par le modèle.
- Les cinq niveaux de perception du prix sont fixés par le modèle.
- Une réponse « Non applicable » se traduit par l'absence de note et est exclue des moyennes (FR-043 de la spéc. 001).
- Le commentaire est effacé 2 ans après son dépôt ; la ligne d'évaluation et ses notes chiffrées subsistent (FR-034, FR-034c de la spéc. 001).
- Aucune colonne ne permet d'identifier le joueur (FR-032 de la spéc. 001).

## Évolutions demandées à la spéc. 001

Ces points sont **signalés, non décidés ici**. Ils relèvent de la spécification 1, qui seule peut faire évoluer le modèle de données. Tant qu'ils ne sont pas tranchés, la présente spécification ne suppose aucun champ supplémentaire.

1. **Mémoriser le tarif présenté au client.** Les deux questions sur le prix mentionnent un montant. Si ce montant est paramétrable par terrain (FR-334) ou s'il évolue dans le temps, une réponse « Beaucoup trop élevé » devient ininterprétable a posteriori sans savoir quel montant était affiché. **Demande** : ajouter à `evaluation` le montant affiché au moment de la réponse, avec sa devise. Sans cette évolution, les analyses de la spéc. 5 sur la valeur perçue ne seront comparables que sur une période à tarif constant.

2. **Consigner un signalement d'affectation contestée.** FR-313 exige de consigner la réponse « Non, ce n'est pas mon caddie ». Aucune entité du modèle actuel n'accueille ce signal : ce n'est pas une évaluation, puisque aucune note n'est donnée. **Demande** : prévoir une trace anonyme rattachée au terrain et à l'affectation contestée, sur le modèle de `google_review_click`. Sans cette évolution, FR-313 ne peut pas être satisfaite et le terrain ne saura jamais qu'un client a signalé une erreur d'affectation.

3. **Clarifier la portée de `google_review_click.evaluation_id`.** Ce champ est déclaré « NULL possible ». Le parcours de cette spécification ne propose le bouton Google qu'après un envoi réussi, donc toujours avec une évaluation. **Demande** : confirmer si un clic sans évaluation reste prévu — par exemple depuis un futur écran de fin de partie sans questionnaire — ou si le champ peut devenir obligatoire. Aucune décision n'est prise ici.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-301** : Un client remplit et envoie le questionnaire complet en **moins de 30 secondes**, temps de réseau exclu, sur au moins 9 tests utilisateur sur 10.
- **SC-302** : **Au moins 40 %** des affectations terminées donnent lieu à au moins une évaluation envoyée, mesuré sur un mois d'exploitation.
- **SC-303** : 100 % des clients atteignent l'écran de remerciement sans aide, sans créer de compte et sans installer d'application, sur l'ensemble des tests utilisateur.
- **SC-304** : L'écran d'accueil est utilisable en **moins de 3 secondes** après le scan, sur une liaison mobile dégradée représentative d'un parcours de golf.
- **SC-305** : Aucune donnée identifiant un joueur n'est retrouvée dans les données conservées, les adresses Web, les journaux techniques ni les messages d'erreur, sur un échantillon couvrant l'intégralité du parcours dans les cinq langues.
- **SC-306** : 100 % des scans qui ne mènent pas à une affectation exploitable — aucune affectation, ambiguïté, réservation annulée, délai dépassé, jeton inconnu — produisent un message compréhensible par un client non technique, et **aucune** évaluation orpheline n'est enregistrée.
- **SC-307** : Deux évaluations portant les mêmes notes sur les six critères du caddie produisent un score de caddie **strictement identique**, quelles que soient les réponses sur le prix et sur le parcours.
- **SC-308** : Une moyenne calculée sur des critères comportant des réponses « Non applicable » est **strictement égale** à la moyenne des seules réponses chiffrées, sur l'ensemble des jeux de test.
- **SC-309** : Les cinq langues couvrent **100 %** des textes du parcours, sans un seul libellé restant dans une autre langue et sans troncature, vérifié écran par écran.
- **SC-310** : En arabe, **100 %** des écrans s'affichent et s'utilisent de droite à gauche, ordre des étoiles et position des boutons compris.
- **SC-311** : 100 % des clients se voient proposer le bouton d'avis Google, quelle que soit la note donnée, vérifié sur l'ensemble des combinaisons de notes testées ; et 100 % des clics sont comptés une fois et une seule.
- **SC-312** : Aucune soumission répétée — double appui, rechargement, reprise réseau — ne produit plus d'une évaluation, sur 100 tentatives de test.

## Assumptions

Ces choix ont été retenus faute de précision explicite. Ils sont modifiables tant que le développement n'a pas commencé.

- **Retour en arrière dans le questionnaire** : le client **peut** revenir à l'écran précédent et corriger une réponse tant qu'il n'a pas envoyé. Un questionnaire sans retour arrière irrite plus qu'il n'accélère, et le gain de temps espéré est nul dès lors que la progression tient en quelques écrans. Après l'envoi, aucune modification n'est possible.
- **Découpage en écrans** : le questionnaire est découpé en écrans courts plutôt que présenté d'un seul bloc déroulant, afin que chaque question reste lisible en plein soleil sur un téléphone sans exiger de défilement précis. Un indicateur de progression est affiché.
- **Progression conservée côté appareil** : les réponses en cours sont conservées sur l'appareil du client, jamais sur le serveur, ce qui satisfait à la fois la reprise après interruption et l'anonymat. Cette conservation est de courte durée et ne contient aucune donnée identifiante.
- **Reconnaissance d'un appareil ayant déjà répondu** : réalisée par une marque locale posée sur l'appareil du client, sans aucun enregistrement côté serveur. Conséquence assumée : un client qui efface les données de son navigateur ou change d'appareil pourra répondre à nouveau, dans la limite du plafond de FR-342. C'est le prix de l'anonymat, et il est accepté.
- **Aucune notification, aucun rappel** : le client n'est sollicité ni par courriel ni par message, puisque aucune coordonnée n'est recueillie.
- **Devise** : les montants sont exprimés en dirhams marocains (MAD).
- **Interface du questionnaire uniquement** : les cinq langues concernent le parcours client. Les interfaces administrateur et Starter restent en français, conformément à la spéc. 1.
- **Le questionnaire s'ouvre sans lien avec l'heure de fin déclarée** : tant que l'affectation est active ou terminée depuis moins que le délai de FR-307, le questionnaire s'ouvre. Un client qui évalue au 18e trou avant que le Starter n'ait clos l'affectation est un cas normal, pas une exception.

## Dependencies

- **Spécification 1** — modèle de données de référence : `evaluation`, `evaluation_criterion_answer`, `google_review_click`, `cart`, `assignment`, `booking`, `caddie`, `golf_course`. Les trois évolutions signalées plus haut doivent être tranchées par la spéc. 1 avant la mise en œuvre des exigences FR-313 et FR-334.
- **Spécification 2** — voiturettes et jetons de QR code : sans jeton permanent apposé sur une voiturette, le parcours n'a pas de point d'entrée.
- **Spécification 3** — réservations et affectations : sans affectation active, la résolution du jeton n'a pas de cible. Les statuts d'affectation et de réservation utilisés ici sont ceux définis par la spéc. 1 et mis en œuvre par la spéc. 3.
- **Spécification 5** — scores et rapports : consomme les évaluations produites ici. Aucune règle de calcul n'est définie dans le présent document.
- **Configuration du terrain** : logo, couleurs de marque et lien Google Reviews, saisis par l'administrateur (spéc. 1).
- **Traductions approuvées** : les versions anglaise, arabe, allemande et espagnole doivent être approuvées par le propriétaire du produit avant mise en service (FR-319). Cette approbation est une dépendance de calendrier, pas une tâche technique.
- **Un compte Google Business par terrain**, fournissant le lien d'avis.

## Out of Scope

- Définition ou modification d'entités, de champs ou de règles de calcul du modèle de données — relève de la spécification 1.
- Calcul des scores de caddie, moyennes, comparaisons, tableaux de bord, KPI et rapports exportables — spécification 5.
- Génération, impression et pose des QR codes, gestion du parc de voiturettes — spécification 2.
- Création, correction et clôture des affectations par le Starter — spécification 3.
- Consultation des évaluations et des commentaires par l'administrateur — spécification 5.
- Modération des commentaires, détection de contenu inapproprié et réponse aux clients.
- Protection contre les abus automatisés à grande échelle — phase transversale de sécurité.
- Vérification de la publication effective d'un avis Google : le système mesure le clic et rien d'autre, par choix assumé.
- Envoi du questionnaire par un autre canal que le QR code — courriel, message, lien partagé — hors périmètre du MVP.
- Application mobile installable : hors périmètre définitif, le parcours client passant par le navigateur.
- Rédaction des traductions elles-mêmes : elles sont produites et approuvées séparément, cette spécification ne fixant que le texte français de référence et l'exigence d'approbation.
