import { randomBytes } from "node:crypto";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { cart } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { requireAdmin, type Scope } from "../scope";
import { requireRole } from "../auth/require-role";
import { writeAudit } from "../audit/write";
import { ValidationError, NotFoundError } from "../errors";
import { toStarterCart, type StarterCartView } from "../serializers/starter";

/**
 * Voiturettes et QR codes (spéc. 2, FR-156 a FR-171).
 *
 * UN SEUL TYPE D'EQUIPEMENT : une voiturette electrique et un chariot pousse
 * sont deux lignes de cette meme entite, distinguees par leur numero visible.
 * Chacune porte SON PROPRE QR code (FR-052).
 */

export type CartRow = typeof cart.$inferSelect;
export type CartStatus = CartRow["status"];

/**
 * 32 octets aleatoires en base64url. Opaque et non devinable : un
 * identifiant sequentiel permettrait d'enumerer les voiturettes de tous les
 * terrains, et un identifiant technique revelerait l'ordre de creation.
 * Ne contient AUCUNE donnee (FR-031).
 */
export function genererJetonQr(): string {
  return randomBytes(32).toString("base64url");
}

export async function listCarts(scope: Scope): Promise<CartRow[]> {
  return db
    .select()
    .from(cart)
    .where(eq(cart.golfCourseId, scope.golfCourseId))
    .orderBy(asc(cart.visibleNumber));
}

/** Vue restreinte du Starter : ni jeton de QR code, ni horodatage (FR-020). */
export async function listCartsForStarter(scope: Scope): Promise<StarterCartView[]> {
  const rows = await db
    .select({ id: cart.id, visibleNumber: cart.visibleNumber, status: cart.status })
    .from(cart)
    .where(eq(cart.golfCourseId, scope.golfCourseId))
    .orderBy(asc(cart.visibleNumber));
  return rows.map(toStarterCart);
}

export async function createCart(scope: Scope, visibleNumber: string): Promise<string> {
  requireAdmin(scope);

  const numero = visibleNumber?.trim();
  if (!numero) throw new ValidationError("visibleNumber", "Le numéro visible est obligatoire.");

  const id = uuidv7();

  await db.transaction(async (tx) => {
    const existe = await tx
      .select({ id: cart.id })
      .from(cart)
      .where(and(eq(cart.golfCourseId, scope.golfCourseId), eq(cart.visibleNumber, numero)))
      .limit(1);
    if (existe.length > 0) {
      throw new ValidationError("visibleNumber", `Le numéro « ${numero} » est déjà utilisé.`);
    }

    await tx.insert(cart).values({
      id,
      golfCourseId: scope.golfCourseId,
      visibleNumber: numero,
      qrToken: genererJetonQr(),
    });

    await writeAudit(tx, scope, { action: "caddie.create", targetType: "cart", targetId: id });
  });

  return id;
}

/**
 * Changer le statut n'altère JAMAIS le jeton : le QR code est PERMANENT et
 * survit à la mise en entretien comme à la réforme de la voiturette.
 */
export async function setCartStatus(scope: Scope, id: string, status: CartStatus): Promise<void> {
  requireRole(scope, "admin", "starter");

  const maj = await db
    .update(cart)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(cart.id, id), eq(cart.golfCourseId, scope.golfCourseId)))
    .returning({ id: cart.id });

  if (maj.length === 0) throw new NotFoundError();
}

/**
 * Resolution d'un jeton scanné. Le serveur SEUL fait cette traduction.
 *
 * @public-client-path — EXCEPTION ASSUMEE a la regle de portee obligatoire.
 * Le client n'a AUCUN compte : il ne peut donc pas porter de portee. La
 * securite ne repose pas ici sur une portee mais sur l'OPACITE du jeton,
 * 32 octets aleatoires, et sur le fait que cette fonction ne renvoie qu'une
 * voiturette — jamais une donnee personnelle.
 */
export async function findCartByToken(token: string): Promise<CartRow | null> {
  if (!token || token.length < 32) return null;
  const rows = await db.select().from(cart).where(eq(cart.qrToken, token)).limit(1);
  return rows[0] ?? null;
}
