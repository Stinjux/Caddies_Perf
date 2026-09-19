# Déploiement

## Avertissement de souveraineté

Le principe III de la constitution exige un **hébergement au Maroc**. Railway n'a
aucune région marocaine : ses zones sont aux États-Unis, en Europe (Amsterdam) et
à Singapour. Un déploiement Railway est donc un **banc d'essai**, pas une mise en
production.

Tant que l'hébergement souverain n'est pas tranché :

- aucun nom de caddie réel, aucune année de naissance réelle, aucun commentaire
  de client réel ne doit être importé sur cette instance ;
- les comptes d'essai suffisent (`fixtures/seed-data.ts`), ils sont fictifs.

Cette instance sert à montrer le produit et à éprouver le déploiement. Elle ne
sert pas à exploiter un terrain.

---

## Ce que le déploiement met en place

| Élément                                  | Où                                                     |
| ---------------------------------------- | ------------------------------------------------------ |
| Migrations, appliquées une fois chacune  | `scripts/migrate.mjs`, avant chaque démarrage          |
| Rôle applicatif `caddieperf_app`         | créé par la migration `0001`, mot de passe au déploiement |
| Row Level Security sur 14 tables         | migration `0004`                                       |
| Point d'aptitude                         | `GET /api/sante` — interroge la base, ne révèle rien   |

**Le point capital** : l'application ne doit **jamais** se connecter avec le
compte propriétaire de la base. Un superutilisateur contourne le RLS _en
silence_ — les quatorze politiques deviendraient décoratives sans le moindre
message d'erreur. C'est la raison d'être de `APP_DATABASE_URL`.

Trois garde-fous le rappellent, dans cet ordre :

1. `scripts/migrate.mjs` **interrompt le déploiement** si `APP_DB_PASSWORD`
   manque en production ;
2. `src/db/index.ts` préfère `APP_DATABASE_URL` dès qu'elle existe ;
3. `src/db/scope-tx.ts` vérifie le rôle à la première requête et **refuse de
   servir** en production s'il peut contourner le RLS.

---

## Mise en place sur Railway

### 1. Créer le projet et la base

```bash
npm i -g @railway/cli && railway login && railway init && railway add --database postgres
```

### 2. Générer les deux secrets

```bash
echo "SESSION_SECRET=$(openssl rand -base64 32)" && echo "APP_DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)"
```

Ces deux valeurs ne doivent **jamais** entrer dans le dépôt. `.gitignore` bloque
déjà `.env`, et un test échoue si `.env.example` porte autre chose qu'un
gabarit.

### 3. Déclarer les variables du service applicatif

Dans Railway → service → **Variables**. Les `${{...}}` sont des références
résolues par Railway ; recopiez-les telles quelles.

| Variable                  | Valeur                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | `${{Postgres.DATABASE_URL}}`                                                                         |
| `APP_DB_PASSWORD`         | le secret généré à l'étape 2                                                                        |
| `APP_DATABASE_URL`        | `postgresql://caddieperf_app:${{APP_DB_PASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `SESSION_SECRET`          | le secret généré à l'étape 2                                                                        |
| `SESSION_TTL_HOURS_ADMIN` | `8`                                                                                                  |
| `SESSION_TTL_HOURS_STARTER` | `24`                                                                                               |
| `NODE_ENV`                | `production`                                                                                         |

`DATABASE_URL` sert **uniquement** aux migrations, qui doivent pouvoir modifier
le schéma. L'application, elle, lit `APP_DATABASE_URL`.

### 4. Déployer

```bash
railway up
```

`railway.json` enchaîne : construction, puis `node scripts/migrate.mjs`, puis
`npm start`. Railway n'envoie le trafic vers la nouvelle version qu'une fois
`/api/sante` répondu.

### 5. Vérifier — et ne pas s'en dispenser

```bash
railway run node -e "const p=require('postgres');const s=p(process.env.APP_DATABASE_URL,{max:1});s\`SELECT current_user AS nom, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user\`.then(r=>{console.log(r[0]);return s.end()})"
```

La réponse attendue est `caddieperf_app`, `rolsuper: false`,
`rolbypassrls: false`. **Tout autre résultat signifie que le cloisonnement entre
terrains ne s'applique pas**, quelles que soient les apparences.

### 6. Peupler avec des données fictives (facultatif)

```bash
railway run npm run seed
```

Les identifiants d'essai s'affichent à la fin. Les administrateurs sont inscrits
d'office à la vérification en deux étapes, avec le secret **fictif** partagé de
`fixtures/seed-data.ts` — utilisable dans n'importe quelle application
d'authentification pour la démonstration.

---

## Ce que Railway ne fait pas

- **Sauvegardes.** `scripts/sauvegarde.sh` existe, avec sa ligne de cron, mais
  suppose un serveur que l'on administre. Sur Railway, il faut soit activer les
  sauvegardes de la plateforme, soit exécuter le script depuis une machine
  tierce — auquel cas la copie quitte encore une fois le Maroc.
- **Chiffrement au repos maîtrisé.** Les clés appartiennent à la plateforme.
- **La souveraineté.** Voir l'avertissement en tête de ce fichier.
