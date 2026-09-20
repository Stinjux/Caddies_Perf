import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../src/server/auth/password.ts";
import { uuidv7 } from "../src/lib/uuid.ts";

/**
 * AMORCAGE — CREE LE TOUT PREMIER ADMINISTRATEUR ET SON TERRAIN.
 *
 * Sans lui, une installation neuve est inaccessible : creer un compte exige
 * une portee, qui exige un compte. Les deux se demandent l'un l'autre, et le
 * seul outil qui cassait ce cercle etait `npm run seed` — qui pose des comptes
 * dont les mots de passe sont publics dans le depot.
 *
 * IL IMPORTE LA VRAIE FONCTION DE HACHAGE, contrairement a seed.ts qui la
 * reimplemente pour rester autonome. Ici la correction prime sur
 * l'independance : si les deux formats divergeaient un jour, l'unique
 * administrateur ne pourrait plus se connecter, et personne d'autre non plus.
 *
 * IL NE S'EXECUTE QU'UNE FOIS. Des qu'un compte existe, il refuse — un second
 * passage ne peut donc ni ecraser un administrateur, ni en ajouter un dans le
 * dos des autres.
 *
 * LE MOT DE PASSE N'EST JAMAIS AFFICHE NI JOURNALISE. Il arrive par
 * l'environnement, et rien de ce que ce script ecrit ne permet de le retrouver.
 *
 * Usage :
 *   AMORCE_EMAIL=... AMORCE_MOT_DE_PASSE=... AMORCE_PRENOM=... AMORCE_NOM=... \
 *   AMORCE_TERRAIN=... node --experimental-strip-types scripts/amorcer.ts
 */

/**
 * MODE DEPLOIEMENT. Ce script est enchaine aux migrations, avant chaque
 * demarrage. Il doit donc se taire et rendre la main SANS ERREUR dans les
 * deux cas ordinaires : aucune consigne d'amorcage, ou base deja peuplee.
 * Echouer la ferait echouer tous les deploiements suivants.
 *
 * Il ne reste bruyant que sur une consigne MAL FORMEE — une adresse invalide,
 * un mot de passe trop court : la, se taire laisserait croire a une creation
 * qui n'a pas eu lieu.
 */
function rienAFaire(raison: string): never {
  console.log(`  * amorcage : ${raison}`);
  process.exit(0);
}

function requis(nom: string): string {
  const valeur = process.env[nom]?.trim();
  if (!valeur) {
    console.error(`${nom} est absente.`);
    process.exit(1);
  }
  return valeur;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL est absente : impossible d'amorcer.");
  process.exit(1);
}

if (!process.env.AMORCE_EMAIL?.trim()) {
  rienAFaire("aucune consigne (AMORCE_EMAIL absente)");
}

const email = requis("AMORCE_EMAIL").toLowerCase();
const motDePasse = requis("AMORCE_MOT_DE_PASSE");
const prenom = requis("AMORCE_PRENOM");
const nom = requis("AMORCE_NOM");
const terrain = requis("AMORCE_TERRAIN");
const fuseau = process.env.AMORCE_FUSEAU?.trim() || "Africa/Casablanca";

// Memes regles que createAccount() : un compte cree ici doit pouvoir etre
// modifie ensuite par l'application sans etre rejete par sa propre validation.
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("AMORCE_EMAIL n'est pas une adresse valide.");
  process.exit(1);
}
if (motDePasse.length < 12) {
  console.error("AMORCE_MOT_DE_PASSE doit compter au moins 12 caracteres.");
  process.exit(1);
}

/**
 * Refus des mots de passe FICTIFS du depot. Ils sont publics : les accepter
 * ici reviendrait a ouvrir l'installation a quiconque a lu le code.
 */
if (/^MotDePasseFictif\d*!?$/i.test(motDePasse)) {
  console.error(
    "Ce mot de passe est celui des comptes de demonstration, publie dans le depot.\n" +
      "Choisissez-en un autre : n'importe qui pourrait entrer.",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  const [compte] = await sql<{ total: string }[]>`SELECT count(*) AS total FROM account`;
  const total = compte?.total ?? "0";
  if (Number(total) > 0) {
    /**
     * REINITIALISATION PAR L'OPERATEUR.
     *
     * L'application n'offre AUCUN ecran de changement de mot de passe : un
     * administrateur qui perd le sien est enferme dehors, definitivement.
     * Ce mode est la seule issue, et il exige un acces aux variables de
     * l'hebergeur — c'est-a-dire le meme niveau de privilege que celui qui a
     * installe le service.
     *
     * Il ne cree rien et ne touche a RIEN d'autre : ni le second facteur, ni
     * les donnees, ni les autres comptes. Seul le mot de passe du compte
     * nomme par AMORCE_EMAIL est remplace.
     */
    if (process.env.AMORCE_REINITIALISER === "1") {
      const sqlControle = postgres(url, { max: 1, onnotice: () => {} });
      const hacheNeuf = await hashPassword(motDePasse);
      const maj = await sql`
        UPDATE account SET password_hash = ${hacheNeuf}, updated_at = now()
        WHERE email = ${email}
        RETURNING id
      `;
      await sql.end();
      if (maj.length === 0) {
        console.error(`Aucun compte a l'adresse ${email} : rien n'a ete reinitialise.`);
        process.exit(1);
      }
      console.log(`  * mot de passe reinitialise pour ${email}`);

      /**
       * CONTROLE IMMEDIAT. Ecrire un hache ne prouve pas qu'on pourra se
       * connecter avec : il faut le relire et le verifier avec la fonction
       * meme qu'utilise l'ouverture de session. Sans cela, on croit avoir
       * repare et on decouvre le contraire a l'ecran de connexion.
       */
      const relu = await sqlControle`
        SELECT password_hash AS hache, status, email FROM account WHERE email = ${email}
      `;
      const ligne = relu[0] as { hache: string; status: string; email: string } | undefined;
      const rattachements = await sqlControle`
        SELECT count(*) AS n FROM account_golf_course agc
        JOIN account a ON a.id = agc.account_id WHERE a.email = ${email}
      `;
      console.log(
        "  * controle : mot de passe verifie =",
        ligne ? await verifyPassword(motDePasse, ligne.hache) : "compte introuvable",
        "| statut =",
        ligne?.status,
        "| adresse stockee =",
        JSON.stringify(ligne?.email),
        "| terrains rattaches =",
        (rattachements[0] as { n: string } | undefined)?.n,
      );
      await sqlControle.end();
      process.exit(0);
    }

    await sql.end();
    rienAFaire(`${total} compte(s) existent deja, rien a creer`);
  }

  const hache = await hashPassword(motDePasse);
  const idCompte = uuidv7();
  const idTerrain = uuidv7();

  // Un seul aller-retour : un terrain sans administrateur, ou un administrateur
  // sans terrain, seraient tous deux inutilisables et il faudrait tout reprendre
  // a la main en SQL.
  await sql.begin(async (tx) => {
    // Le terrain nait avec son QR : c'est lui que le client scanne au depart,
    // et il est PERMANENT — la meme affiche vaut d'une saison a l'autre.
    await tx`
      INSERT INTO golf_course (id, name, timezone, qr_token)
      VALUES (${idTerrain}, ${terrain}, ${fuseau}, ${randomBytes(32).toString("base64url")})
    `;
    await tx`
      INSERT INTO account (id, email, first_name, last_name, password_hash)
      VALUES (${idCompte}, ${email}, ${prenom}, ${nom}, ${hache})
    `;
    await tx`
      INSERT INTO account_golf_course (account_id, golf_course_id, role)
      VALUES (${idCompte}, ${idTerrain}, 'admin')
    `;
    await tx`
      INSERT INTO audit_log (id, golf_course_id, actor_account_id, action, target_type, target_id)
      VALUES (${uuidv7()}, ${idTerrain}, ${idCompte}, 'course.create', 'golf_course', ${idTerrain})
    `;
  });

  console.log(`\nAdministrateur cree : ${email}`);
  console.log(`Terrain cree        : ${terrain} (${fuseau})`);
  console.log(
    "\nA la premiere connexion, l'application exigera l'inscription au second\n" +
      "facteur avant de donner acces a quoi que ce soit. Prevoyez une application\n" +
      "d'authentification et de quoi noter les codes de secours.",
  );
} finally {
  await sql.end();
}
