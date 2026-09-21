import { describe, it, expect, beforeEach } from "vitest";
import { login, resolveSession, selectCourse, logout } from "@/server/auth/current";
import { listLinksForAccount } from "@/server/repositories/account";
import { resetDb } from "../helpers/reset-db";
import { makeCourse, makeAccount, PASSWORD } from "../helpers/fixtures";

/** T045 — choix du parcours actif (FR-012, FR-013). */

let cedres: string;
let atlas: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
});

describe("sélection du parcours à la connexion (FR-012)", () => {
  it("sélectionne d'office le parcours quand il n'y en a qu'un", async () => {
    await makeAccount({
      email: "solo@example.invalid",
      links: [{ courseId: cedres, role: "starter" }],
    });

    const token = (await login("solo@example.invalid", PASSWORD)).token;
    const ctx = await resolveSession(token);

    expect(ctx?.activeGolfCourseId).toBe(cedres);
    expect(ctx?.scope?.role).toBe("starter");
  });

  it("ne sélectionne aucun parcours quand le compte en a plusieurs", async () => {
    await makeAccount({
      email: "double@example.invalid",
      links: [
        { courseId: cedres, role: "admin" },
        { courseId: atlas, role: "starter" },
      ],
    });

    const token = (await login("double@example.invalid", PASSWORD)).token;
    const ctx = await resolveSession(token);

    expect(ctx?.activeGolfCourseId).toBeNull();
    expect(ctx?.scope).toBeNull();
  });

  it("ne propose que les parcours rattachés, jamais les autres (FR-023)", async () => {
    const id = await makeAccount({
      email: "limite@example.invalid",
      links: [{ courseId: cedres, role: "admin" }],
    });

    const links = await listLinksForAccount(id);
    expect(links.map((l) => l.golfCourseId)).toEqual([cedres]);
  });

  it("porte le rôle du parcours choisi, pas un rôle global", async () => {
    await makeAccount({
      email: "roles@example.invalid",
      links: [
        { courseId: cedres, role: "admin" },
        { courseId: atlas, role: "starter" },
      ],
    });

    const token = (await login("roles@example.invalid", PASSWORD)).token;

    await selectCourse(token, cedres);
    expect((await resolveSession(token))?.scope?.role).toBe("admin");

    await selectCourse(token, atlas);
    expect((await resolveSession(token))?.scope?.role).toBe("starter");
  });

  it("refuse de sélectionner un parcours non rattaché", async () => {
    await makeAccount({
      email: "refus@example.invalid",
      links: [{ courseId: cedres, role: "admin" }],
    });
    const token = (await login("refus@example.invalid", PASSWORD)).token;

    await expect(selectCourse(token, atlas)).rejects.toThrow();
    expect((await resolveSession(token))?.activeGolfCourseId).toBe(cedres);
  });
});

describe("connexion (FR-017)", () => {
  it("donne le même message que l'adresse soit inconnue ou le mot de passe faux", async () => {
    await makeAccount({
      email: "connu@example.invalid",
      links: [{ courseId: cedres, role: "admin" }],
    });

    const inconnue = await login("inexistant@example.invalid", PASSWORD).catch((e) => e.message);
    const mauvais = await login("connu@example.invalid", "MauvaisMotDePasse!").catch(
      (e) => e.message,
    );

    expect(inconnue).toBe(mauvais);
    expect(inconnue).toBe("Adresse ou mot de passe incorrect.");
  });

  it("refuse la connexion d'un compte désactivé, sans le dire", async () => {
    await makeAccount({
      email: "desactive@example.invalid",
      status: "disabled",
      links: [{ courseId: cedres, role: "admin" }],
    });

    await expect(login("desactive@example.invalid", PASSWORD)).rejects.toThrow(
      "Adresse ou mot de passe incorrect.",
    );
  });

  it("refuse un compte sans aucun rattachement, avec un message explicite", async () => {
    await makeAccount({ email: "orphelin@example.invalid" });
    await expect(login("orphelin@example.invalid", PASSWORD)).rejects.toThrow(
      /rattaché à aucun parcours/,
    );
  });

  it("détruit la session à la déconnexion", async () => {
    await makeAccount({
      email: "sortie@example.invalid",
      links: [{ courseId: cedres, role: "admin" }],
    });
    const token = (await login("sortie@example.invalid", PASSWORD)).token;

    expect(await resolveSession(token)).not.toBeNull();
    await logout(token);
    expect(await resolveSession(token)).toBeNull();
  });

  it("ignore un jeton inconnu", async () => {
    expect(await resolveSession("jeton-inexistant")).toBeNull();
    expect(await resolveSession(undefined)).toBeNull();
  });
});
