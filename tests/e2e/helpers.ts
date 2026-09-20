import type { Page } from "@playwright/test";
import { codeActuel } from "../../src/lib/totp";
import { SECRET_TOTP_FICTIF } from "../../fixtures/seed-data";

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
    page.waitForURL((u) => !u.pathname.includes("/connexion") || u.search.includes("etape=code")),
    page.getByRole("button", { name: "Se connecter" }).click(),
  ]);

  // SECOND FACTEUR. Les administrateurs d'amorcage y sont inscrits avec un
  // secret FICTIF partage (fixtures/seed-data.ts) : le test calcule donc le
  // code lui-meme, exactement comme le ferait une application
  // d'authentification. C'est aussi la seule facon d'eprouver cet ecran a
  // chaque passage plutot que de le contourner.
  if (page.url().includes("etape=code")) {
    await page.locator('input[name="code"]').fill(codeActuel(SECRET_TOTP_FICTIF));
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("/connexion")),
      page.getByRole("button", { name: "Vérifier" }).click(),
    ]);
  }

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

