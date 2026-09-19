# Constitution de CaddiePerf

Plateforme de gestion et d'évaluation des caddies pour terrains de golf.

Ce document énonce les règles qui priment sur toute autre pratique, spécification ou plan technique. En cas de conflit entre une spécification et cette constitution, la constitution l'emporte.

## Core Principles

### I. Minimisation des données personnelles (NON NÉGOCIABLE)

Aucune donnée personnelle qui ne sert pas une fonctionnalité identifiée n'est collectée, stockée ni transmise.

- La **taille d'habits** et l'**adresse du domicile** ne sont jamais stockées, jamais journalisées, jamais exportées. L'importateur CSV accepte ces colonnes dans le fichier source mais les rejette à la lecture ; elles ne franchissent jamais la frontière de la base de données.
- L'**âge** est conservé sous forme d'**année de naissance uniquement**, dans une table séparée des données de performance, accessible aux seuls comptes administrateurs. Il n'apparaît dans aucun rapport ni export.
- Le compte **Starter** n'a accès à aucune donnée personnelle : ni âge, ni adresse, ni taille d'habits. Son interface se limite au numéro de réservation, à l'heure de départ, au numéro de voiturette, à l'identifiant interne du caddie, à son prénom et nom, à sa disponibilité et à son affectation courante.
- Aucune donnée personnelle ne figure dans une **URL**, un **QR code**, un **paramètre de requête**, un **journal technique** ou un **message d'erreur**.
- Les évaluations clients sont **anonymes** et le restent. Aucun mécanisme ne doit permettre de remonter d'une évaluation à l'identité du joueur.

Toute nouvelle donnée personnelle proposée dans une spécification doit nommer la fonctionnalité précise qu'elle sert, sans quoi elle est refusée.

### II. Aucune donnée réelle hors production (NON NÉGOCIABLE)

Le dépôt Git, les tests, les fixtures, les captures d'écran et la documentation ne contiennent que des **données fictives**.

- Aucun nom réel de caddie, de client ou d'employé.
- Aucune adresse, aucun numéro de téléphone, aucun identifiant réel.
- Aucun export de production, même partiel, même anonymisé « à la main ».
- Le `.gitignore` bloque `*.csv` hors du dossier `fixtures/`, ainsi que `.env`, les clés et le dossier `.claude/`. Ce garde-fou est vérifié par un test à chaque phase.

Une violation de ce principe est un incident, pas un oubli : le fichier est retiré de l'historique Git, pas seulement du dernier commit.

**Cela s'étend aux assistants d'intelligence artificielle.** Aucune donnée réelle d'employé, de client ou de réservation ne doit figurer dans un prompt adressé à Claude ou à tout autre modèle — ni collée dans une conversation, ni lue depuis la base de production par un outil, ni jointe sous forme de fichier.

- Un prompt est transmis à un tiers, traité hors du Maroc, et peut être conservé. Cela contredit à la fois ce principe et le principe III.
- Pour illustrer un cas réel, on le **reformule avec des données fictives** : le comportement à corriger ne dépend jamais de l'identité de la personne concernée.
- Un assistant connecté à une base de données doit l'être à la base de **développement**, peuplée de fixtures, jamais à celle de production.
- Le doute se tranche dans le sens de l'abstention : un prompt envoyé ne se rappelle pas.

### III. Souveraineté des données — hébergement au Maroc

L'application et sa base de données sont hébergées **au Maroc**.

- Aucun transfert de données personnelles hors du territoire marocain sans décision explicite du propriétaire du produit.
- Les services tiers qui recevraient des données personnelles sont interdits par défaut. Un service tiers ne peut être introduit qu'après examen de ce qu'il reçoit réellement.
- Les sauvegardes sont chiffrées et restent soumises à la même règle de localisation.
- Conséquence assumée : les plateformes sans région marocaine (Vercel et équivalents) sont exclues de l'hébergement de production.

### IV. Cloisonnement strict par terrain

Chaque terrain de golf est une frontière de données étanche.

- Toute requête de lecture ou d'écriture porte un identifiant de terrain, et ce filtrage est appliqué côté serveur, jamais côté client.
- Un administrateur ou un Starter ne voit que les terrains auxquels il est rattaché.
- Les moyennes, comparaisons et rapports ne mélangent jamais deux terrains. La comparaison d'un caddie à une moyenne se fait toujours à l'intérieur du même terrain, sur la même période et sur les mêmes critères.
- Le cloisonnement est vérifié par des tests automatisés dédiés, pas seulement par revue de code.

### V. Approbation explicite par phase (NON NÉGOCIABLE)

Le développement suit les 24 phases définies par le propriétaire du produit, une seule à la fois.

- Avant chaque phase : au maximum **cinq questions courtes**, chacune assortie d'une recommandation et de son avantage lorsqu'elle est technique.
- Aucun code n'est écrit ni modifié avant une **approbation explicite** de la phase.
- Le passage à la phase suivante n'est jamais automatique.
- Une décision déjà approuvée n'est jamais révisée sans consultation préalable.
- Aucune dépendance n'est installée sans que son utilité ait été expliquée et acceptée.
- Une information manquante donne lieu à une question, jamais à une invention.

### VI. Tests avant clôture de phase

Une phase n'est close qu'après exécution de tests et présentation de leurs résultats réels.

- Les résultats sont rapportés fidèlement : un test qui échoue est annoncé comme tel, avec sa sortie.
- Chaque phase produit un rapport indiquant ce qui a été développé, les fichiers créés ou modifiés, les tests réalisés, leurs résultats, ce qui reste à faire, puis les questions de la phase suivante.
- Les règles des principes I, II et IV font l'objet de tests permanents, rejoués à chaque phase, et non de vérifications ponctuelles.

## Contraintes techniques et de sécurité

**Pile technique arrêtée** — toute déviation exige un amendement de cette constitution :

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- PostgreSQL, accès aux données via Drizzle
- Hébergement sur serveur marocain

**Sécurité du parcours client :**

- Le QR code de chaque voiturette est **permanent** et ne contient qu'un **identifiant opaque et non devinable**. Il ne contient jamais le nom du client, le nom du caddie, le numéro de réservation, ni aucune donnée personnelle.
- Le serveur seul résout l'identifiant de voiturette vers l'affectation active. Cette résolution gère explicitement les cas : aucune affectation, plusieurs affectations, partie terminée depuis trop longtemps, réservation annulée, voiturette indisponible.
- Le client n'a **aucun compte** et ne fournit **aucune donnée identifiante**.
- Les données personnelles sont protégées en transit et au repos.
- Les consultations et modifications de données sensibles, ainsi que les actions administratives, sont journalisées — sans que ces journaux ne contiennent eux-mêmes de données personnelles.

**Séparation des mesures :**

- Le score du caddie, la note du parcours et les réponses sur la valeur perçue du prix sont trois mesures **distinctes**. Une réponse sur le prix ne modifie jamais la note d'un caddie. La note du parcours n'entre jamais dans le score d'un caddie.
- Les réponses « Non applicable » sont exclues du calcul des moyennes et ne les abaissent jamais.
- Un caddie désactivé conserve l'intégralité de son historique.

**Expérience client :**

- Conception mobile d'abord, remplissage du questionnaire visé sous 30 secondes, sans téléchargement d'application et sans compte.
- Cinq langues dès le MVP : français, anglais, arabe, allemand, espagnol. L'arabe s'affiche correctement de droite à gauche.
- Interface lisible en plein soleil, gros boutons, accessible.
- Chaque traduction est présentée au propriétaire du produit pour approbation avant intégration.

## Processus de développement

**Découpage en cinq spécifications.** Le produit est spécifié en cinq documents. Pour prévenir toute divergence entre eux :

- La **spécification n°1 détient le modèle de données** de référence.
- Les spécifications 2 à 5 **s'y réfèrent** et ne redéfinissent jamais une entité, un champ ou une règle de calcul déjà posés dans la n°1.
- Toute évolution du modèle de données est portée par la n°1 et répercutée, jamais introduite localement dans une autre spécification.
- `/speckit-analyze` est exécuté après chaque génération de tâches pour détecter les incohérences entre spécifications.

**Portes de qualité avant la clôture d'une phase :**

1. Les tests de la phase passent, et leurs résultats sont présentés tels quels.
2. Les garde-fous des principes I, II et IV sont rejoués et passent.
3. Le rapport de phase est présenté au propriétaire du produit.
4. L'approbation de la phase suivante est obtenue avant toute nouvelle écriture.

## Governance

Cette constitution prime sur toute spécification, tout plan et toute pratique de développement.

- **Amendement** : toute modification exige l'accord explicite du propriétaire du produit, une justification écrite et l'indication de son effet sur les spécifications déjà approuvées.
- **Versionnage** : `MAJEUR.MINEUR.CORRECTIF`. Majeur pour la suppression ou la redéfinition d'un principe ; mineur pour l'ajout d'un principe ou d'une section ; correctif pour une clarification sans changement de sens.
- **Conformité** : chaque plan et chaque revue vérifie la conformité aux six principes. Une complexité non justifiée est refusée.
- **Principes non négociables** : les principes I, II et V ne peuvent pas être assouplis pour des raisons de délai, de coût ou de commodité technique.

**Version**: 1.0.0 | **Ratified**: 2026-09-18 | **Last Amended**: 2026-09-18
