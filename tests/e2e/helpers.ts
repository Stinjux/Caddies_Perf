import type { Page } from "@playwright/test";

/**
 * Connexion de bout en bout, robuste au nombre de parcours rattaches :
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
  await page.getByRole("button", { name: "Se connecter" }).click();

  /**
   * ON ATTEND QUE LA REDIRECTION SE POSE, et pas seulement qu'elle commence.
   *
   * La connexion renvoie vers « / », qui renvoie a son tour soit vers
   * /parcours, soit vers /choisir-parcours. Attendre « une URL qui n'est plus
   * /connexion » s'arretait donc sur « / », l'etape intermediaire : l'ecran
   * de choix n'etait pas encore affiche, le test croyait etre entre, et le
   * clic de selection n'avait jamais lieu. Les ecrans suivants renvoyaient
   * alors sans fin vers le choix du parcours.
   */
  await page.waitForURL((u) => /\/(choisir-)?parcours/.test(u.pathname));

  // Un compte qui atteint plusieurs parcours transite par l'ecran de choix
  // (FR-012) — qu'il y soit rattache, ou qu'il soit administrateur general.
  // On en sort en selectionnant le premier parcours propose.
  if (page.url().includes("choisir-parcours")) {
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("choisir-parcours")),
      page.getByRole("button").first().click(),
    ]);
  }
}

/**
 * Administrateur a rattachement UNIQUE : entre directement dans son espace,
 * sans passer par l'ecran de choix. Utilise par les tests de rendu, dont le
 * sujet n'est pas la selection de parcours — celle-ci est couverte par
 * tests/integration/course-selection.test.ts.
 */
export const ADMIN = {
  email: "admin.atlas@example.invalid",
  password: "MotDePasseFictif3!",
};

/**
 * ADMINISTRATEUR GENERAL, rattache a AUCUN parcours.
 *
 * Il atteint pourtant les deux : c'est exactement ce que le niveau general
 * ajoute, et rien dans ses rattachements ne pourrait l'expliquer.
 */
export const ADMIN_GENERAL = {
  email: "admin.general@example.invalid",
  password: "MotDePasseFictif5!",
};

/** Administrateur a rattachements MULTIPLES : transite par l'ecran de choix. */
export const ADMIN_MULTI = {
  email: "admin.deux@example.invalid",
  password: "MotDePasseFictif4!",
};
