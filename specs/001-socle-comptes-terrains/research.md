# Phase 0 — Recherche et décisions techniques

**Feature**: Socle — données, comptes et terrains | **Date**: 2026-09-18

Chaque décision est présentée avec sa justification et les options écartées. **Toutes les approbations requises ont été obtenues le 2026-09-18** ; seul le choix d'hébergement (§11) reste inconnu, et il ne bloque que le déploiement.

---

## 1. Hachage des mots de passe

**Décision** : `scrypt`, fourni par le module `crypto` de la bibliothèque standard de Node.js. Aucune dépendance ajoutée.

**Justification** : `scrypt` est un algorithme de dérivation de clé conçu pour résister aux attaques par force brute matérielle, recommandé par l'OWASP, et présent nativement dans Node. Zéro dépendance signifie zéro risque de chaîne d'approvisionnement et zéro maintenance, ce qui sert directement le principe III. Pour 100 comptes au maximum, la différence de robustesse avec Argon2id est théorique.

**Alternatives écartées** :
- *Argon2id via `argon2`* : légèrement supérieur en résistance, mais exige une compilation native à l'installation, ce qui complique le déploiement sur un serveur marocain qu'on administre soi-même.
- *bcrypt* : très répandu, mais limité à 72 octets de mot de passe et moins résistant au matériel spécialisé que scrypt.

---

## 2. Mécanisme d'authentification — **APPROUVÉ le 2026-09-18**

**Décision proposée** : sessions maison, stockées en base, transmises par un cookie `HttpOnly`, `Secure` et `SameSite=Lax`. Aucune bibliothèque d'authentification.

**Justification** : le besoin est réduit — deux rôles, pas de connexion sociale, pas de fédération, pas d'inscription publique. Une session en base tient en une table et une centaine de lignes de code, et permet d'appliquer l'exigence FR-016 (interrompre une session dès la désactivation du compte), que la plupart des bibliothèques à jeton ne savent pas faire sans registre de révocation. Le principe III bénéficie de l'absence de tout appel sortant.

**Alternatives écartées** :
- *Auth.js (NextAuth)* : conçu pour la fédération d'identité, dont nous n'avons aucun besoin ; sa complexité de configuration dépasse ici son apport.
- *better-auth* : solide, mais introduit une dépendance structurante pour un besoin que le produit n'a pas.
- *Jetons JWT sans état* : inadaptés, car révoquer un compte immédiatement exigerait de toute façon un registre en base — c'est-à-dire ce qu'on cherchait à éviter.

**Statut** : approuvé par le propriétaire du produit le 2026-09-18. Aucune bibliothèque d'authentification ne sera ajoutée.

---

## 3. Mise en œuvre du cloisonnement par terrain

**Décision** : deux barrières superposées.

1. **Portée obligatoire dans la couche d'accès** — aucune fonction de lecture ou d'écriture n'est appelable sans un objet de portée issu de la session vérifiée côté serveur. Le système de types rend impossible d'écrire une requête sans portée : ce n'est pas une convention, c'est une erreur de compilation.
2. **Contraintes en base** — chaque table porte `golf_course_id` non nul, et les clés étrangères composites `(golf_course_id, id)` empêchent qu'une ligne d'un terrain référence une ligne d'un autre. Une erreur applicative se heurte alors à un refus de la base.

**Justification** : le principe IV exige un filtrage serveur vérifié par tests. Une seule barrière applicative repose sur la vigilance humaine à chaque nouvelle requête. Les clés composites transforment une classe entière de bogues en impossibilité structurelle, à coût nul à l'exécution.

**Alternatives écartées** :
- *Sécurité au niveau des lignes de PostgreSQL (RLS)* : garantie la plus forte, mais impose une connexion par utilisateur ou la propagation de variables de session à travers le pool de connexions — une complexité d'exploitation notable. **À reconsidérer** si un audit externe l'exige ; la conception retenue ne l'empêche pas.
- *Une base de données par terrain* : isolation parfaite, mais rend les migrations, les sauvegardes et l'administration cinq fois plus lourdes pour cinq terrains de taille modeste.
- *Filtrage applicatif seul, par convention* : rejeté — une seule requête oubliée provoque une fuite entre deux clubs concurrents.

---

## 4. Isolation des renseignements personnels

**Décision** : table `caddie_personal_data` distincte, ne contenant que `caddie_id` et `birth_year`. Un seul module du code peut la lire, et cette lecture écrit systématiquement une entrée de journal. Aucune requête de liste ni aucune jointure générale ne la traverse.

**Justification** : le principe I exige une séparation entre données personnelles et données de performance. Une colonne `birth_year` posée dans la table `caddie` finirait tôt ou tard dans un `SELECT *`, un export ou un journal de débogage. Une table séparée avec un point d'entrée unique rend la fuite visible en revue de code : toute consultation passe par un appel repérable.

**Conséquence assumée** : obtenir l'année de naissance coûte une requête supplémentaire. C'est voulu — cela décourage de la charger « au cas où ».

**Alternatives écartées** :
- *Chiffrement au niveau de la colonne* : protège contre le vol du fichier de base, mais pas contre une fuite applicative, qui est le risque réel ici. Ajoute une gestion de clés sans bénéfice proportionné pour une simple année.
- *Colonne dans la table `caddie` avec masquage à l'affichage* : rejeté — le masquage à l'écran ne protège ni les journaux, ni les exports, ni les échanges en arrière-plan.

---

## 5. Journal en écriture seule

**Décision** : table `audit_log` dont l'utilisateur applicatif de la base ne possède que le droit d'insertion et de lecture. Les droits de modification et de suppression lui sont retirés au niveau de PostgreSQL.

**Justification** : FR-038 exige un journal inaltérable depuis l'application. Retirer le droit en base rend l'exigence vraie même en cas de bogue ou de compromission du code applicatif — ce qu'un contrôle applicatif ne garantit jamais.

**Alternatives écartées** :
- *Contrôle applicatif seul* : ne résiste pas à une erreur de développement ni à une injection.
- *Journal en fichier* : plus difficile à filtrer (FR-039) et plus facile à perdre lors d'un déploiement.

---

## 6. Dates, heures et fuseaux horaires

**Décision** : tous les instants sont stockés en `timestamptz`. Chaque terrain porte son fuseau horaire au format IANA (par exemple `Africa/Casablanca`). La **date locale du terrain** est calculée à partir de l'instant et de ce fuseau, et c'est elle qui sert de clé au décompte des jours travaillés.

**Justification** : FR-005 impose l'affichage dans le fuseau du terrain, et FR-044 définit le jour travaillé par une date. Stocker une date nue provoquerait des erreurs de comptage lors des changements d'heure ou si un terrain futur se trouvait dans un autre fuseau.

**Alternatives écartées** :
- *Stocker l'heure locale sans fuseau* : rend tout calcul ambigu et irrattrapable après coup.
- *Supposer que tout est à Casablanca* : fonctionne aujourd'hui, casse au premier terrain ajouté ailleurs — et le produit est multi-terrains par conception.

---

## 7. Jeton de QR code des voiturettes

**Décision** : 32 octets aléatoires issus d'un générateur cryptographique, encodés en base64url, stockés avec une contrainte d'unicité. Défini ici car le modèle de données lui appartient ; sa mise en œuvre relève de la spécification 2.

**Justification** : la constitution impose un identifiant opaque et non devinable. Un identifiant séquentiel permettrait d'énumérer les voiturettes de tous les terrains ; un identifiant technique de ligne révélerait l'ordre de création.

---

## 8. Modifications concurrentes

**Décision** : verrouillage optimiste par une colonne `version` incrémentée à chaque écriture. Une écriture portant une version périmée est refusée avec un message invitant à recharger.

**Justification** : FR-045 interdit l'écrasement silencieux. Le verrouillage optimiste convient à un usage où les conflits sont rares — deux administrateurs modifiant le même terrain à la même seconde — sans immobiliser de ressources.

**Alternative écartée** : *dernier écrivain gagne* — c'est précisément ce que FR-045 interdit.

---

## 9. Outils de test — **APPROUVÉS le 2026-09-18**

**Décision proposée** :
- **Vitest** pour les tests unitaires et d'intégration. *Utilité* : exécute les tests TypeScript sans étape de compilation séparée, démarre en quelques centaines de millisecondes, ce qui permet de les lancer à chaque modification plutôt qu'une fois par jour.
- **Playwright** pour les parcours de bout en bout. *Utilité* : pilote un vrai navigateur, ce qui est le seul moyen de vérifier réellement que le Starter ne reçoit aucune donnée personnelle — y compris dans les échanges en arrière-plan, qu'un test unitaire ne voit pas. Sert aussi à valider l'affichage de droite à gauche en arabe et le rendu sur téléphone.
- **PostgreSQL local** pour les tests d'intégration, sur une base dédiée réinitialisée entre les séries.

**Justification** : les exigences de cloisonnement (FR-023 à FR-027) et de non-exposition (FR-020, SC-004) ne sont vérifiables qu'en exécutant de vraies requêtes contre une vraie base et un vrai navigateur. Un test fondé sur des simulacres validerait notre propre imagination.

**Statut** : approuvés par le propriétaire du produit le 2026-09-18. Vitest et Playwright sont des outils de développement, non embarqués en production.

---

## 10. Version de PostgreSQL — **DÉCISION DE CONTOURNEMENT**

**Constat** : la machine de développement porte PostgreSQL 14.21. La version du serveur de production est **inconnue**, l'hébergement n'étant pas encore arrêté.

**Décision** : développer sur le PostgreSQL 14 déjà installé, en se limitant strictement aux fonctionnalités présentes **depuis la version 14**.

**Justification** : tout ce que le schéma exige existe en 14 — `citext`, `jsonb`, clés étrangères composites, contraintes de vérification, retrait de droits sur une table. Aucune fonctionnalité de 15, 16 ou 17 n'est nécessaire. Les migrations tourneront donc à l'identique sur n'importe quelle version à partir de 14, ce qui **retire entièrement la dépendance au choix d'hébergement**. Aucune installation supplémentaire n'est requise.

**Contrainte à respecter** : toute migration utilisant une fonctionnalité postérieure à la version 14 doit être refusée en revue, tant que la version de production n'est pas connue.

**Alternative écartée** : *installer PostgreSQL 16 en local et viser cette version* — reporterait le risque sur le déploiement si l'hébergeur ne proposait qu'une version antérieure.

---

## 11. Hébergement — **INCONNUE À LEVER**

**Constat** : le propriétaire du produit a confirmé disposer d'un hébergeur marocain, sans en préciser les caractéristiques.

**Informations nécessaires avant la mise en service** :
- S'agit-il d'un serveur dédié ou virtuel, et avec quelles ressources ?
- PostgreSQL y est-il déjà installé, et dans quelle version ?
- L'accès se fait-il par SSH, avec les droits d'administration ?
- Existe-t-il déjà une politique de sauvegarde, et où les sauvegardes sont-elles conservées ?
- Un nom de domaine et un certificat sont-ils disponibles ?

**Impact** : aucun sur la conception, qui ne suppose rien d'autre qu'un serveur Linux et une base PostgreSQL. Bloquant en revanche pour le déploiement (phase 24) et pour la stratégie de sauvegarde exigée par le principe III.

---

## Synthèse des points bloquants

| # | Point | Nature | Bloque |
|---|---|---|---|
| 2 | Authentification maison plutôt qu'une bibliothèque | ✅ **Approuvé le 2026-09-18** | Plus rien |
| 9 | Ajout de Vitest et Playwright | ✅ **Approuvé le 2026-09-18** | Plus rien |
| 10 | Version de PostgreSQL | ✅ **Contournée** — développement sur 14, compatibilité 14+ | Plus rien |
| 11 | Caractéristiques de l'hébergeur | ⏳ Toujours inconnue | Le déploiement uniquement (phase 24) |

**Aucun point ne bloque plus le développement.** Seul le déploiement reste suspendu au choix d'hébergement.

Les points 1 et 3 à 8 sont des décisions de conception prises et documentées ; elles ne requièrent pas d'approbation distincte mais peuvent être contestées avant le début du codage.
