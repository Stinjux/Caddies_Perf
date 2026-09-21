import { defineRailway, preserve, project, service } from "railway/iac";

/**
 * CONFIGURATION DE DEPLOIEMENT (Infrastructure as Code).
 *
 * Remplace railway.json, que Railway n'applique plus. La preuve en a ete
 * faite : le premier deploiement a ete PROMU alors que /api/sante repondait
 * 503, et aucune migration n'avait tourne — ni le healthcheck ni le preDeploy
 * n'avaient ete lus.
 *
 * `partial` limite ce fichier a ses propres ressources. Le projet
 * lavish-adventure heberge aussi le service MONDAIX et la base Postgres :
 * sans cette mention, appliquer cette configuration proposerait de les
 * supprimer, puisqu'ils n'y figurent pas.
 */
export const partial = "caddieperf";

export default defineRailway(() => {
  const caddieperf = service("caddieperf", {
    build: "npm run build",
    start: "npm start",

    /**
     * Les migrations tournent AVANT le demarrage, avec les variables du
     * service donc l'acces au reseau prive de la base. Le script interrompt
     * le deploiement si APP_DB_PASSWORD manque : l'application se
     * connecterait sinon en superutilisateur, qui contourne le RLS en
     * silence.
     */
    preDeploy:
      "node scripts/migrate.mjs" +
      " && node --experimental-strip-types scripts/amorcer.ts" +
      " && node --experimental-strip-types scripts/demo.ts",

    /**
     * La sonde interroge la base. Une version qui ne peut pas la joindre
     * n'est donc jamais promue — c'est exactement ce qui a manque au premier
     * deploiement.
     */
    healthcheck: "/api/sante",
    healthcheckTimeout: 120,

    replicas: 1,

    /**
     * LES VALEURS NE SONT PAS ICI, ET NE DOIVENT JAMAIS Y ETRE.
     *
     * Ce fichier est declaratif : sans cette liste, appliquer la
     * configuration SUPPRIMERAIT les huit variables du service — le plan
     * l'annoncait noir sur blanc. Les nommer avec preserve() dit a Railway
     * de garder les valeurs deja posees, qui restent de son cote.
     *
     * Une variable oubliee ici serait donc effacee au prochain apply : cette
     * liste doit suivre celle de DEPLOIEMENT.md.
     */
    variables: {
      DATABASE_URL: preserve(),
      APP_DB_PASSWORD: preserve(),
      APP_DATABASE_URL: preserve(),
      SESSION_SECRET: preserve(),
      SESSION_TTL_HOURS_ADMIN: preserve(),
      SESSION_TTL_HOURS_STARTER: preserve(),
      NODE_ENV: preserve(),
      NPM_CONFIG_PRODUCTION: preserve(),
      // Adresse publique encodee dans les QR codes des voiturettes. Absente,
      // les etiquettes imprimees pointent vers localhost et ne menent nulle
      // part — on ne s'en apercoit qu'au 18e trou, devant un client.
      PUBLIC_BASE_URL: preserve(),
      // Consigne d'amorcage du premier administrateur. Absentes, elles ne
      // declenchent rien ; posees sur une base vide, elles creent le compte
      // une fois. Le mot de passe se retire une fois le compte cree.
      AMORCE_EMAIL: preserve(),
      AMORCE_MOT_DE_PASSE: preserve(),
      AMORCE_PRENOM: preserve(),
      AMORCE_NOM: preserve(),
      AMORCE_PARCOURS: preserve(),
      AMORCE_REINITIALISER: preserve(),
      // Jeu de demonstration : une voiturette scannable et son affectation,
      // toutes fictives. A retirer avant tout usage reel.
      DEMO: preserve(),
    },
  });

  return project("lavish-adventure", {
    resources: [caddieperf],
  });
});
