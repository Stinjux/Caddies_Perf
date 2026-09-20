import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { withCourse } from "@/db/scope-tx";
import { caddie, golfCourse } from "@/db/schema";

/**
 * RÉSOLUTION DU QR CODE DU TERRAIN.
 *
 * Un seul QR pour tout le parcours, affiché au départ. Le serveur le traduit
 * en terrain, puis rend la liste des caddies dans laquelle le client choisit
 * le sien. Aucune donnée ne transite par le QR : le jeton est opaque.
 *
 * LA LISTE EST PUBLIQUE — quiconque a scanné le QR la voit. Le nom de famille
 * n'en sort donc JAMAIS en entier : seule son initiale accompagne le numéro
 * et le prénom. Publier l'annuaire du personnel sur une affiche accessible à
 * tous serait un manquement au principe I.
 */

export type EchecResolution = "jeton_inconnu" | "aucun_caddie";

export interface CaddieChoisissable {
  id: string;
  /** Le numéro que le caddie porte, et que le client a sous les yeux. */
  numero: string;
  /** « 12 — Hassan F. » : de quoi reconnaître, pas de quoi ficher. */
  libelle: string;
}

export interface ResolutionReussie {
  ok: true;
  golfCourseId: string;
  courseName: string;
  brandColorPrimary: string | null;
  logoPath: string | null;
  googleReviewUrl: string | null;
  priceMad: number;
  caddies: CaddieChoisissable[];
}

export type Resolution = ResolutionReussie | { ok: false; raison: EchecResolution };

/** Tarif en vigueur : 200 MAD par caddie pour 18 trous (FR-048). */
export const TARIF_CADDIE_MAD = 200;

/** « Hassan », « Fictif » → « 12 — Hassan F. » */
export function libelleCaddie(numero: string, prenom: string, nom: string): string {
  const initiale = nom.trim().charAt(0).toUpperCase();
  return initiale ? `${numero} — ${prenom} ${initiale}.` : `${numero} — ${prenom}`;
}

/**
 * @public-client-path — le client n'a pas de compte, donc pas de portée. Le
 * jeton se résout hors portée, puis tout le reste se fait sous celle du
 * terrain qu'il désigne.
 */
export async function resoudreJeton(token: string): Promise<Resolution> {
  if (!token || token.length < 16) return { ok: false, raison: "jeton_inconnu" };

  const [terrain] = await db
    .select({
      id: golfCourse.id,
      name: golfCourse.name,
      brandColorPrimary: golfCourse.brandColorPrimary,
      logoPath: golfCourse.logoPath,
      googleReviewUrl: golfCourse.googleReviewUrl,
    })
    .from(golfCourse)
    .where(and(eq(golfCourse.qrToken, token), eq(golfCourse.status, "active")))
    .limit(1);

  if (!terrain) return { ok: false, raison: "jeton_inconnu" };

  const rangs = await withCourse(terrain.id, (tx) =>
    tx
      .select({
        id: caddie.id,
        numero: caddie.internalRef,
        prenom: caddie.firstName,
        nom: caddie.lastName,
      })
      .from(caddie)
      .where(and(eq(caddie.golfCourseId, terrain.id), eq(caddie.status, "active")))
      .orderBy(asc(caddie.internalRef)),
  );

  if (rangs.length === 0) return { ok: false, raison: "aucun_caddie" };

  return {
    ok: true,
    golfCourseId: terrain.id,
    courseName: terrain.name,
    brandColorPrimary: terrain.brandColorPrimary,
    logoPath: terrain.logoPath,
    googleReviewUrl: terrain.googleReviewUrl,
    priceMad: TARIF_CADDIE_MAD,
    caddies: rangs.map((c) => ({
      id: c.id,
      numero: c.numero,
      libelle: libelleCaddie(c.numero, c.prenom, c.nom),
    })),
  };
}
