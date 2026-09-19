import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assignment, booking, cart } from "@/db/schema";
import { createCart, setCartStatus } from "@/server/services/cart";
import { createCaddie, setCaddieAvailability, setCaddieStatus } from "@/server/services/caddie";
import {
  creerAffectation,
  corrigerAffectation,
  terminerAffectation,
  annulerAffectation,
  affectationsDuJour,
  joursTravailles,
} from "@/server/services/assignment";
import { resetDb } from "../helpers/reset-db";
import { testScope } from "../helpers/scope";
import { makeCourse, makeAccount } from "../helpers/fixtures";

/** AFFECTATIONS (spéc. 3). Le Starter saisit lui-même la réservation. */

let cedres: string;
let atlas: string;
let compteId: string;
let v1: string, v2: string, c1: string, c2: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  compteId = await makeAccount({
    links: [
      { courseId: cedres, role: "admin" },
      { courseId: atlas, role: "admin" },
    ],
  });
  v1 = await createCart(admin(), "12");
  v2 = await createCart(admin(), "13");
  c1 = await createCaddie(admin(), {
    internalRef: "C-0001",
    firstName: "Hassan",
    lastName: "Fictif",
  });
  c2 = await createCaddie(admin(), {
    internalRef: "C-0002",
    firstName: "Omar",
    lastName: "Fictif",
  });
});

function admin(c = cedres) {
  return testScope({ accountId: compteId, golfCourseId: c, role: "admin" });
}
function starter(c = cedres) {
  return testScope({ accountId: compteId, golfCourseId: c, role: "starter" });
}
const depart = () => new Date(Date.now() + 3_600_000);

describe("création d'une affectation par le Starter", () => {
  it("crée la réservation au passage, en source manuelle", async () => {
    await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });

    const resas = await db.select().from(booking).where(eq(booking.golfCourseId, cedres));
    expect(resas).toHaveLength(1);
    expect(resas[0]?.externalRef).toBe("RES-001");
    expect(resas[0]?.source).toBe("manual");
  });

  it("réutilise une réservation déjà saisie au lieu d'en créer une seconde", async () => {
    await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v2,
      caddieId: c2,
    });

    expect(await db.select().from(booking).where(eq(booking.golfCourseId, cedres))).toHaveLength(1);
    expect(
      await db.select().from(assignment).where(eq(assignment.golfCourseId, cedres)),
    ).toHaveLength(2);
  });

  it("marque la voiturette comme affectée", async () => {
    await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    const rows = await db.select().from(cart).where(eq(cart.id, v1));
    expect(rows[0]?.status).toBe("assigned");
  });

  it("refuse un numéro de réservation vide", async () => {
    await expect(
      creerAffectation(starter(), {
        bookingRef: "  ",
        teeTime: depart(),
        cartId: v1,
        caddieId: c1,
      }),
    ).rejects.toThrow(/obligatoire/);
  });

  it("refuse une voiturette en entretien", async () => {
    await setCartStatus(admin(), v1, "maintenance");
    await expect(
      creerAffectation(starter(), {
        bookingRef: "RES-001",
        teeTime: depart(),
        cartId: v1,
        caddieId: c1,
      }),
    ).rejects.toThrow(/pas disponible/);
  });

  it("refuse un caddie signalé indisponible", async () => {
    await setCaddieAvailability(starter(), c1, "unavailable");
    await expect(
      creerAffectation(starter(), {
        bookingRef: "RES-001",
        teeTime: depart(),
        cartId: v1,
        caddieId: c1,
      }),
    ).rejects.toThrow(/indisponible/);
  });

  it("refuse un caddie désactivé", async () => {
    await setCaddieStatus(admin(), c1, "disabled", 1);
    await expect(
      creerAffectation(starter(), {
        bookingRef: "RES-001",
        teeTime: depart(),
        cartId: v1,
        caddieId: c1,
      }),
    ).rejects.toThrow(/plus actif/);
  });

  it("refuse une voiturette déjà engagée dans une affectation active", async () => {
    await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await expect(
      creerAffectation(starter(), {
        bookingRef: "RES-002",
        teeTime: depart(),
        cartId: v1,
        caddieId: c2,
      }),
    ).rejects.toThrow(/modifiée entre-temps/);
  });

  it("traite une voiturette d'un autre terrain comme inexistante", async () => {
    const etrangere = await createCart(admin(atlas), "01");
    await expect(
      creerAffectation(starter(cedres), {
        bookingRef: "RES-001",
        teeTime: depart(),
        cartId: etrangere,
        caddieId: c1,
      }),
    ).rejects.toThrow(/introuvable/);
  });
});

describe("FR-052 — un caddie sur plusieurs voiturettes", () => {
  it("autorise le même caddie sur deux voiturettes simultanément", async () => {
    await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await expect(
      creerAffectation(starter(), {
        bookingRef: "RES-001",
        teeTime: depart(),
        cartId: v2,
        caddieId: c1,
      }),
    ).resolves.toMatch(/^[0-9a-f-]{36}$/);

    const aff = await db.select().from(assignment).where(eq(assignment.caddieId, c1));
    expect(aff).toHaveLength(2);
  });

  it("une réservation à quatre joueurs porte deux affectations et deux QR codes", async () => {
    await creerAffectation(starter(), {
      bookingRef: "RES-004",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await creerAffectation(starter(), {
      bookingRef: "RES-004",
      teeTime: depart(),
      cartId: v2,
      caddieId: c1,
    });

    const jour = await affectationsDuJour(starter());
    expect(jour).toHaveLength(2);
    expect(new Set(jour.map((a) => a.cartNumber))).toEqual(new Set(["12", "13"]));
    expect(new Set(jour.map((a) => a.caddieRef))).toEqual(new Set(["C-0001"]));
  });
});

describe("correction d'une erreur de saisie", () => {
  it("change le caddie d'une affectation active", async () => {
    const id = await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await corrigerAffectation(starter(), id, { caddieId: c2 });

    const rows = await db.select().from(assignment).where(eq(assignment.id, id));
    expect(rows[0]?.caddieId).toBe(c2);
  });

  it("change la voiturette et libère l'ancienne", async () => {
    const id = await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await corrigerAffectation(starter(), id, { cartId: v2 });

    expect((await db.select().from(cart).where(eq(cart.id, v1)))[0]?.status).toBe("available");
    expect((await db.select().from(cart).where(eq(cart.id, v2)))[0]?.status).toBe("assigned");
  });

  it("refuse de corriger une affectation déjà terminée", async () => {
    const id = await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(starter(), id);

    await expect(corrigerAffectation(starter(), id, { caddieId: c2 })).rejects.toThrow(
      /déjà terminée/,
    );
  });
});

describe("terminaison et annulation", () => {
  it("termine l'affectation et libère la voiturette", async () => {
    const id = await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(starter(), id);

    const rows = await db.select().from(assignment).where(eq(assignment.id, id));
    expect(rows[0]?.status).toBe("completed");
    expect(rows[0]?.endedAt).toBeInstanceOf(Date);
    expect((await db.select().from(cart).where(eq(cart.id, v1)))[0]?.status).toBe("available");
  });

  it("refuse de terminer deux fois", async () => {
    const id = await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(starter(), id);
    await expect(terminerAffectation(starter(), id)).rejects.toThrow(/plus active/);
  });

  it("annule une affectation et libère la voiturette", async () => {
    const id = await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await annulerAffectation(starter(), id);

    expect((await db.select().from(assignment).where(eq(assignment.id, id)))[0]?.status).toBe(
      "cancelled",
    );
  });
});

describe("FR-044 — jours travaillés", () => {
  it("ne compte QU'UNE journée malgré plusieurs réservations le même jour", async () => {
    const a1 = await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(starter(), a1);
    const a2 = await creerAffectation(starter(), {
      bookingRef: "RES-002",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(starter(), a2);
    const a3 = await creerAffectation(starter(), {
      bookingRef: "RES-003",
      teeTime: depart(),
      cartId: v2,
      caddieId: c1,
    });
    await terminerAffectation(starter(), a3);

    expect(await joursTravailles(admin(), c1)).toBe(1);
  });

  it("ne compte pas une affectation encore active", async () => {
    await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    expect(await joursTravailles(admin(), c1)).toBe(0);
  });

  it("ne compte pas une affectation annulée", async () => {
    const id = await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await annulerAffectation(starter(), id);
    expect(await joursTravailles(admin(), c1)).toBe(0);
  });

  it("ne compte pas les journées d'un autre terrain", async () => {
    const id = await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    await terminerAffectation(starter(), id);
    expect(await joursTravailles(admin(atlas), c1)).toBe(0);
  });
});

describe("vue du Starter sur les affectations du jour (FR-020)", () => {
  it("n'expose que les champs autorisés", async () => {
    await creerAffectation(starter(), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    const jour = await affectationsDuJour(starter());

    expect(Object.keys(jour[0]!).sort()).toEqual([
      "bookingRef",
      "caddieFirstName",
      "caddieLastName",
      "caddieRef",
      "cartNumber",
      "id",
      "status",
      "teeTime",
    ]);
    expect(JSON.stringify(jour)).not.toContain("qrToken");
    expect(JSON.stringify(jour)).not.toContain("birthYear");
  });

  it("ne montre aucune affectation d'un autre terrain", async () => {
    await creerAffectation(starter(cedres), {
      bookingRef: "RES-001",
      teeTime: depart(),
      cartId: v1,
      caddieId: c1,
    });
    expect(await affectationsDuJour(starter(atlas))).toEqual([]);
  });
});
