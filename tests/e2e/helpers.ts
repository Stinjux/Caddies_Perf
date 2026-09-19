import type { Page } from "@playwright/test";

/**
 * Connexion de bout en bout, robuste au nombre de terrains rattaches :
 * un compte a rattachement unique entre directement, un compte multiple
 * passe par l'ecran de choix (FR-012).
 */
export async function connexion(
  page: Page,
  identifiants: { email: string; password: string },
): Promise<void> {
  await page.goto("/connexion");
  await page.getByRole("textbox").first().fill(identifiants.email);
  await page.locator('input[type="password"]').fill(identifiants.password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/connexion")),
    page.getByRole("button", { name: "Se connecter" }).click(),
  ]);

  // Un compte rattache a plusieurs terrains transite par l'ecran de choix
  // (FR-012). On en sort en selectionnant le premier terrain propose.
  if (page.url().includes("choisir-terrain")) {
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("choisir-terrain")),
      page.getByRole("button").first().click(),
    ]);
  }
}

/**
 * Administrateur a rattachement UNIQUE : entre directement dans son espace,
 * sans passer par l'ecran de choix. Utilise par les tests de rendu, dont le
 * sujet n'est pas la selection de terrain — celle-ci est couverte par
 * tests/integration/course-selection.test.ts.
 */
export const ADMIN = {
  email: "admin.atlas@example.invalid",
  password: "MotDePasseFictif3!",
};

/** Administrateur a rattachements MULTIPLES : transite par l'ecran de choix. */
export const ADMIN_MULTI = {
  email: "admin.deux@example.invalid",
  password: "MotDePasseFictif4!",
};

export const STARTER = {
  email: "starter.cedres@example.invalid",
  password: "MotDePasseFictif2!",
};
