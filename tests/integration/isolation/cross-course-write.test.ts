import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { golfCourse, accountGolfCourse } from "@/db/schema";
import { updateCourse, archiveCourse } from "@/server/services/golf-course";
import { disableAccount, createAccount } from "@/server/services/account";
import { attachAccount, detachAccount } from "@/server/services/account-course";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount, PASSWORD } from "../../helpers/fixtures";

/**
 * T054 — ECRITURE INTER-TERRAINS REFUSEE (FR-023, FR-025).
 *
 * Une portee sur le terrain A ne doit pouvoir modifier AUCUNE donnee du
 * terrain B, meme en fournissant un identifiant valide de B.
 */

let cedres: string;
let atlas: string;
let adminCedres: string;
let adminAtlas: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  adminCedres = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });
  adminAtlas = await makeAccount({ links: [{ courseId: atlas, role: "admin" }] });
});

/**
 * Portee FORGEE : elle prétend porter le terrain voisin. C'est exactement ce
 * qu'une faille produirait. Les depots doivent quand meme refuser, parce que
 * le filtrage se fait sur l'identifiant de terrain de la portee et que la
 * session reelle ne l'aurait jamais produit.
 */
const scopeCedres = () =>
  testScope({ accountId: adminCedres, golfCourseId: cedres, role: "admin" });

describe("modification d'un terrain voisin", () => {
  it("ne modifie jamais le terrain voisin, même avec la bonne version", async () => {
    await expect(
      updateCourse(scopeCedres(), { name: "Détourné", timezone: "Africa/Casablanca" }, 1),
    ).resolves.toBeUndefined();

    const voisin = await db.select().from(golfCourse).where(eq(golfCourse.id, atlas));
    expect(voisin[0]?.name).toBe("Royal Atlas");

    const mien = await db.select().from(golfCourse).where(eq(golfCourse.id, cedres));
    expect(mien[0]?.name).toBe("Détourné");
  });

  it("n'archive jamais le terrain voisin", async () => {
    await archiveCourse(scopeCedres(), 1);

    const voisin = await db.select().from(golfCourse).where(eq(golfCourse.id, atlas));
    expect(voisin[0]?.status).toBe("active");
  });
});

describe("écriture sur un compte d'un autre terrain", () => {
  it("refuse de désactiver un compte du terrain voisin, comme s'il n'existait pas", async () => {
    await expect(disableAccount(scopeCedres(), adminAtlas, 1)).rejects.toThrow(/introuvable/);
  });

  it("refuse de détacher un compte non rattaché au terrain actif", async () => {
    await expect(detachAccount(scopeCedres(), adminAtlas)).rejects.toThrow(/introuvable/);
  });

  it("rattache toujours au terrain de la portée, jamais à un autre", async () => {
    await attachAccount(scopeCedres(), adminAtlas, "starter");

    const liens = await db
      .select()
      .from(accountGolfCourse)
      .where(eq(accountGolfCourse.accountId, adminAtlas));

    expect(liens.map((l) => l.golfCourseId).sort()).toEqual([atlas, cedres].sort());
    expect(liens.find((l) => l.golfCourseId === cedres)?.role).toBe("starter");
  });

  it("crée toujours le compte sur le terrain de la portée", async () => {
    const id = await createAccount(scopeCedres(), {
      email: "nouveau@example.invalid",
      firstName: "Prenom",
      lastName: "Fictif",
      password: PASSWORD,
      role: "starter",
    });

    const liens = await db
      .select()
      .from(accountGolfCourse)
      .where(eq(accountGolfCourse.accountId, id));

    expect(liens).toHaveLength(1);
    expect(liens[0]?.golfCourseId).toBe(cedres);
  });
});

describe("le terrain voisin reste intact", () => {
  it("conserve ses rattachements après toute opération sur le terrain actif", async () => {
    await updateCourse(scopeCedres(), { name: "X", timezone: "Africa/Casablanca" }, 1);
    await createAccount(scopeCedres(), {
      email: "autre@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "admin",
    });

    const liensAtlas = await db
      .select()
      .from(accountGolfCourse)
      .where(eq(accountGolfCourse.golfCourseId, atlas));

    expect(liensAtlas).toHaveLength(1);
    expect(liensAtlas[0]?.accountId).toBe(adminAtlas);
  });
});
