import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Pre-filtre des routes protegees.
 *
 * ATTENTION — ce filtre n'est PAS la barriere de securite. Il s'execute dans
 * un contexte sans acces a la base : il ne peut que constater l'absence de
 * cookie et eviter un aller-retour inutile.
 *
 * La VRAIE verification — session valide, compte actif, rattachement au
 * terrain, role — se fait cote serveur dans requireScope() et dans chaque
 * service (FR-021, FR-024). Un cookie forge passe ici et echoue la-bas.
 */

const PUBLIC = ["/connexion", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
