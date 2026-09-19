import { test, expect } from "@playwright/test";

/**
 * T082 / SC-008 — les ecrans d'exploitation s'affichent en moins de
 * 2 secondes.
 *
 * Mesure du temps jusqu'au contenu utile, du point de vue de l'utilisateur,
 * et non d'une metrique technique interne.
 */

import { connexion, ADMIN } from "./helpers";

const BUDGET_MS = 2000;

for (const [nom, chemin, repere] of [
  ["liste des terrains", "/terrains", "Terrains"],
  ["gestion des comptes", "/comptes", "Comptes du terrain"],
  ["journal des actions", "/journal", "Journal des actions"],
] as const) {
  test(`${nom} : affichage sous ${BUDGET_MS} ms`, async ({ page }) => {
    await connexion(page, ADMIN);

    const debut = Date.now();
    await page.goto(chemin);
    await expect(page.getByRole("heading", { name: repere })).toBeVisible();
    const duree = Date.now() - debut;

    expect(duree, `${nom} a mis ${duree} ms`).toBeLessThan(BUDGET_MS);
  });
}
