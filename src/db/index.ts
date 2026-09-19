import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * CONNEXION PARESSEUSE — ouverte au PREMIER USAGE, jamais a l'import.
 *
 * Pourquoi : `next build` importe chaque module de route pour y lire sa
 * configuration (`export const dynamic`, etc.). Un `throw` a l'evaluation du
 * module faisait donc echouer la CONSTRUCTION la ou aucune base n'est
 * joignable — sur Railway, ou les variables de base ne sont pas fournies a
 * l'etape de build. Et `force-dynamic` n'y changeait rien : Next doit
 * justement importer le module pour lire cette directive.
 *
 * L'exigence n'est pas affaiblie, elle est deplacee au bon moment. La
 * premiere requete qui touche la base leve la meme erreur, et le point
 * d'aptitude /api/sante la rencontre avant tout trafic : l'hebergeur refuse
 * alors de promouvoir la version, ce qu'un echec de build ne disait pas mieux.
 *
 * Le RLS ne s'applique qu'a un role qui n'est ni superutilisateur ni
 * proprietaire des tables. APP_DATABASE_URL designe ce role et l'emporte donc
 * des qu'elle existe ; DATABASE_URL reste la connexion proprietaire, reservee
 * aux migrations et au peuplement, qui doivent pouvoir tout faire.
 */

function creer() {
  const url = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    // Le message ne cite QUE des noms de variables : une URL de base porte un
    // mot de passe, et ce texte finit dans les journaux de l'hebergeur.
    throw new Error("APP_DATABASE_URL et DATABASE_URL sont absentes de l'environnement.");
  }
  return drizzle(postgres(url, { max: 10 }), { schema });
}

type Connexion = ReturnType<typeof creer>;

let instance: Connexion | null = null;

function connexion(): Connexion {
  return (instance ??= creer());
}

/**
 * Se comporte en tout point comme l'objet Drizzle : aucun appelant ne change.
 * Les methodes sont liees a la connexion REELLE et non au mandataire, faute
 * de quoi `this` designerait un objet vide.
 */
export const db = new Proxy({} as Connexion, {
  get(_cible, propriete) {
    const reelle = connexion();
    const valeur = Reflect.get(reelle, propriete) as unknown;
    return typeof valeur === "function" ? valeur.bind(reelle) : valeur;
  },
  has(_cible, propriete) {
    return Reflect.has(connexion(), propriete);
  },
}) as Connexion;

export type Db = Connexion;
export { schema };
