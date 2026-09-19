import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cart, booking, golfCourse } from "@/db/schema";
import { createCart } from "@/server/services/cart";
import { createCaddie } from "@/server/services/caddie";
import {
  creerAffectation,
  terminerAffectation,
  annulerAffectation,
} from "@/server/services/assignment";
import { resoudreJeton, TARIF_CADDIE_MAD } from "@/server/services/qr-resolution";
import { resetDb } from "../helpers/reset-db";
import { testScope } from "../helpers/scope";
import { makeCourse, makeAccount } from "../helpers/fixtures";

/**
 * RÉSOLUTION DU QR CODE (spéc. 3, FR-250 a FR-261).
 * Tous les cas d'échec du parcours client sont nommés et éprouvés.
 */

let cedres: string;
let compteId: string;
let v1: string, v2: string, c1: string, c2: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  compteId = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });
  v1 = await createCart(scope(), "12");
  v2 = await createCart(scope(), "13");
  c1 = await createCaddie(scope(), {
    internalRef: "C-0001",
    firstName: "Hassan",
    lastName: "Fictif",
  });
  c2 = await createCaddie(scope(), {
    internalRef: "C-0002",
    firstName: "Omar",
    lastName: "Fictif",
  });
});

function scope() {
  return testScope({ accountId: compteId, golfCourseId: cedres, role: "admin" });
}
async function jeton(cartId: string): Promise<string> {
  return (await db.select().from(cart).where(eq(cart.id, cartId)))[0]!.qrToken;
}
const depart = () => new Date(Date.now() + 3_600_000);

describe("résolution réussie", () => {
  it("retrouve le caddie affecté, sans passer par le navigateur", async () => {
    await creerAffectation(scope(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });

    const r = await resoudreJeton(await jeton(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.caddieFirstName).toBe("Hassan");
    expect(r.cartNumber).toBe("12");
    expect(r.courseName).toBe("Golf des Cèdres");
    expect(r.priceMad).toBe(TARIF_CADDIE_MAD);
  });

  it("porte l'identité visuelle du terrain", async () => {
    await db
      .update(golfCourse)
      .set({ brandColorPrimary: "#1b4d3e", googleReviewUrl: "https://example.invalid/avis" })
      .where(eq(golfCourse.id, cedres));
    await creerAffectation(scope(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });

    const r = await resoudreJeton(await jeton(v1));
    if (!r.ok) throw new Error("résolution attendue");
    expect(r.brandColorPrimary).toBe("#1b4d3e");
    expect(r.googleReviewUrl).toBe("https://example.invalid/avis");
  });

  it("fonctionne encore après la fin de la partie, le même jour", async () => {
    const id = await creerAffectation(scope(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(scope(), id);

    expect((await resoudreJeton(await jeton(v1))).ok).toBe(true);
  });

  it("mène au même caddie depuis l'une ou l'autre de ses voiturettes (FR-052)", async () => {
    await creerAffectation(scope(), {
      bookingRef: "RES-004",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await creerAffectation(scope(), {
      bookingRef: "RES-004",
      teeTime: depart(),
      cartId: v2,
      caddieId: c1,
    });

    const a = await resoudreJeton(await jeton(v1));
    const b = await resoudreJeton(await jeton(v2));

    if (!a.ok || !b.ok) throw new Error("résolutions attendues");
    expect(a.caddieRef).toBe("C-0001");
    expect(b.caddieRef).toBe("C-0001");
    expect(a.assignmentId).not.toBe(b.assignmentId);
  });
});

describe("cas d'échec, tous nommés", () => {
  it("jeton inconnu", async () => {
    const r = await resoudreJeton("jeton-inexistant-mais-suffisamment-long-pour-etre-teste");
    expect(r).toEqual({ ok: false, raison: "jeton_inconnu" });
  });

  it("jeton trop court, sans consulter la base", async () => {
    expect(await resoudreJeton("court")).toEqual({ ok: false, raison: "jeton_inconnu" });
  });

  it("aucune affectation sur cette voiturette", async () => {
    const r = await resoudreJeton(await jeton(v1));
    expect(r).toEqual({ ok: false, raison: "aucune_affectation" });
  });

  it("plusieurs affectations évaluables sur la même voiturette", async () => {
    const id = await creerAffectation(scope(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(scope(), id);
    await creerAffectation(scope(), {
      bookingRef: "RES-002",
      teeTime: depart(),
      cartId: v1,
      caddieId: c2,
    });

    const r = await resoudreJeton(await jeton(v1));
    expect(r).toEqual({ ok: false, raison: "plusieurs_affectations" });
  });

  it("affectation annulée", async () => {
    const id = await creerAffectation(scope(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await annulerAffectation(scope(), id);

    const r = await resoudreJeton(await jeton(v1));
    expect(r).toEqual({ ok: false, raison: "reservation_annulee" });
  });

  it("réservation annulée alors que l'affectation reste active", async () => {
    await creerAffectation(scope(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await db.update(booking).set({ status: "cancelled" }).where(eq(booking.golfCourseId, cedres));

    const r = await resoudreJeton(await jeton(v1));
    expect(r).toEqual({ ok: false, raison: "reservation_annulee" });
  });

  it("partie terminée depuis trop longtemps — au lendemain", async () => {
    const id = await creerAffectation(scope(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(scope(), id);

    const demain = new Date(Date.now() + 36 * 3_600_000);
    const r = await resoudreJeton(await jeton(v1), demain);
    expect(r).toEqual({ ok: false, raison: "partie_trop_ancienne" });
  });

  it("respecte une fenêtre en heures quand le terrain en définit une (FR-050)", async () => {
    await db.update(golfCourse).set({ evaluationWindowHours: 2 }).where(eq(golfCourse.id, cedres));
    const id = await creerAffectation(scope(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(scope(), id);

    const dansUneHeure = new Date(Date.now() + 3_600_000);
    const dansTroisHeures = new Date(Date.now() + 3 * 3_600_000);

    expect((await resoudreJeton(await jeton(v1), dansUneHeure)).ok).toBe(true);
    expect(await resoudreJeton(await jeton(v1), dansTroisHeures)).toEqual({
      ok: false,
      raison: "partie_trop_ancienne",
    });
  });
});

describe("le QR ne révèle jamais rien", () => {
  it("la résolution ne renvoie aucune donnée personnelle du caddie", async () => {
    await creerAffectation(scope(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    const r = await resoudreJeton(await jeton(v1));
    if (!r.ok) throw new Error("résolution attendue");

    const serialise = JSON.stringify(r);
    expect(serialise).not.toContain("birthYear");
    expect(serialise).not.toContain("seniority");
    expect(serialise).not.toContain("qrToken");
  });

  it("un échec ne révèle ni terrain, ni caddie, ni voiturette", async () => {
    const r = await resoudreJeton(await jeton(v1));
    expect(Object.keys(r)).toEqual(["ok", "raison"]);
  });
});
