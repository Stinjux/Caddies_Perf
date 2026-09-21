import { test, expect } from "@playwright/test";

/**
 * T083 — accessibilite et rendu mobile.
 *
 * L'interface doit rester utilisable sur telephone, au depart, en plein
 * soleil : cibles tactiles genereuses, contraste fort, aucun debordement
 * horizontal.
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env", quiet: true });
import { connexion, ADMIN } from "./helpers";

test("l'écran de connexion a un titre et des champs étiquetés", async ({ page }) => {
  await page.goto("/connexion");

  await expect(page).toHaveTitle(/CaddiePerf/);
  await expect(page.getByText("Adresse de courriel")).toBeVisible();
  await expect(page.getByText("Mot de passe")).toBeVisible();
});

test("aucun débordement horizontal sur les écrans d'administration", async ({ page }) => {
  await connexion(page, ADMIN);

  for (const chemin of ["/parcours", "/comptes", "/journal"]) {
    await page.goto(chemin);
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(debordement, `débordement horizontal sur ${chemin}`).toBe(false);
  }
});

test("le parcours client présente de grandes cibles tactiles", async ({ page }) => {
  // C'est l'écran d'un client debout au 18e trou, sur son téléphone, parfois
  // en plein soleil. Les cibles doivent y être généreuses.
  // La MEME base que le serveur interrogé : celle de développement. Viser la
  // base de test donnerait un parcours vidé entre deux séries, et le test se
  // contenterait de se taire.
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
  const [parcours] = await sql<{ qr_token: string }[]>`SELECT qr_token FROM golf_course LIMIT 1`;
  await sql.end();
  test.skip(!parcours, "aucun parcours amorcé");

  await page.goto(`/e/${parcours!.qr_token}`);

  const liste = page.locator('select[name="caddie"]');
  const boiteListe = await liste.boundingBox();
  expect(boiteListe?.height, "la liste des caddies est trop basse").toBeGreaterThanOrEqual(44);

  const boutons = page.getByRole("button");
  const total = await boutons.count();
  expect(total).toBeGreaterThan(0);

  for (let i = 0; i < total; i++) {
    const boite = await boutons.nth(i).boundingBox();
    if (boite) {
      expect(boite.height, `bouton ${i} trop petit`).toBeGreaterThanOrEqual(24);
    }
  }
});

test("la langue du document est déclarée en français", async ({ page }) => {
  await page.goto("/connexion");
  expect(await page.locator("html").getAttribute("lang")).toBe("fr");
});
