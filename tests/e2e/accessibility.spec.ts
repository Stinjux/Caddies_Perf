import { test, expect } from "@playwright/test";

/**
 * T083 — accessibilite et rendu mobile.
 *
 * L'interface doit rester utilisable sur telephone, au depart, en plein
 * soleil : cibles tactiles genereuses, contraste fort, aucun debordement
 * horizontal.
 */

import { connexion, ADMIN, STARTER } from "./helpers";

test("l'écran de connexion a un titre et des champs étiquetés", async ({ page }) => {
  await page.goto("/connexion");

  await expect(page).toHaveTitle(/CaddiePerf/);
  await expect(page.getByText("Adresse de courriel")).toBeVisible();
  await expect(page.getByText("Mot de passe")).toBeVisible();
});

test("aucun débordement horizontal sur les écrans d'administration", async ({ page }) => {
  await connexion(page, ADMIN);

  for (const chemin of ["/terrains", "/comptes", "/journal"]) {
    await page.goto(chemin);
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(debordement, `débordement horizontal sur ${chemin}`).toBe(false);
  }
});

test("l'écran du Starter présente de grandes cibles tactiles", async ({ page }) => {
  await connexion(page, STARTER);
  await page.goto("/depart");

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
