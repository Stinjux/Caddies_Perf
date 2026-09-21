import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { ENTETE_CHEMIN } from "@/lib/entetes";

/**
 * Pre-filtre des routes protegees.
 *
 * ATTENTION — ce filtre n'est PAS la barriere de securite. Il s'execute dans
 * un contexte sans acces a la base : il ne peut que constater l'absence de
 * cookie et eviter un aller-retour inutile.
 *
 * La VRAIE verification — session valide, compte actif, rattachement au
 * parcours, role — se fait cote serveur dans requireScope() et dans chaque
 * service (FR-021, FR-024). Un cookie forge passe ici et echoue la-bas.
 */

// Le parcours client (/e/<jeton>) est PUBLIC : aucun compte n'est requis.
// Le point d'aptitude est interroge par l'hebergeur, qui n'a pas de session :
// le rediriger vers /connexion lui ferait conclure que l'application est morte.
const PUBLIC = ["/connexion", "/e/", "/_next", "/favicon.ico", "/api/sante"];

/**
 * Le chemin demande, transmis a la mise en page racine.
 *
 * Une mise en page ne connait pas l'URL : Next ne la lui passe pas. Or c'est
 * elle qui porte la balise <html>, donc la langue et la direction du document.
 * Sans ce renseignement, une page arabe du parcours client s'annoncerait en
 * francais et de gauche a droite, quoi qu'affiche l'ecran.
 */
export { ENTETE_CHEMIN };

function avecChemin(request: NextRequest) {
  const entetes = new Headers(request.headers);
  entetes.set(ENTETE_CHEMIN, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers: entetes } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) return avecChemin(request);

  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return avecChemin(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
