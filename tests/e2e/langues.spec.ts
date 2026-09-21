import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import postgres from "postgres";
import { connexion, ADMIN } from "./helpers";

config({ path: ".env", quiet: true });

/**
 * LANGUES, DE BOUT EN BOUT.
 *
 * Deux publics distincts, deux mécanismes distincts :
 *   - l'ADMINISTRATION suit le navigateur, puis le témoin de préférence ;
 *   - le QUESTIONNAIRE du joueur suit l'adresse (?lang=), parce que le
 *     téléphone qui scanne n'est pas forcément réglé dans la langue de
 *     celui qui le tient.
 *
 * Ces tests vérifient ce qu'aucun test unitaire ne peut voir : que la balise
 * <html> porte bien la langue et la direction, ce dont dépendent les lecteurs
 * d'écran et la mise en miroir de la page en arabe.
 */

test.describe("interface d'administration", () => {
  test("s'affiche en anglais pour un navigateur anglophone", async ({ browser }) => {
    const contexte = await browser.newContext({ locale: "en-US" });
    const page = await contexte.newPage();
    await page.goto("/connexion");

    await expect(page.getByText("Email address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(await page.locator("html").getAttribute("lang")).toBe("en");

    await contexte.close();
  });

  test("s'affiche en français pour un navigateur francophone", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByText("Adresse de courriel")).toBeVisible();
    expect(await page.locator("html").getAttribute("lang")).toBe("fr");
  });

  test("retient le choix explicite, contre l'avis du navigateur", async ({ browser }) => {
    // Un navigateur anglophone dont l'utilisateur veut du français : le choix
    // explicite doit l'emporter, et SURVIVRE au changement de page.
    const contexte = await browser.newContext({ locale: "en-US" });
    const page = await contexte.newPage();
    await page.goto("/connexion");

    await page.locator("select#langue").selectOption("fr");
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByText("Adresse de courriel")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Adresse de courriel")).toBeVisible();
    expect(await page.locator("html").getAttribute("lang")).toBe("fr");

    await contexte.close();
  });

  test("traduit l'espace connecté, pas seulement l'écran d'entrée", async ({ page }) => {
    await connexion(page, ADMIN);
    await page.goto("/rapports");
    await expect(page.getByRole("heading", { name: "Rapports" })).toBeVisible();

    await page.locator("select#langue").selectOption("en");
    await page.getByRole("button", { name: "OK" }).click();

    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Courses" })).toBeVisible();
  });
});

test.describe("questionnaire du joueur", () => {
  let jeton: string;

  test.beforeAll(async () => {
    const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
    const [parcours] = await sql<{ qr_token: string }[]>`SELECT qr_token FROM golf_course LIMIT 1`;
    await sql.end();
    jeton = parcours?.qr_token ?? "";
  });

  test("propose les cinq langues sur l'écran d'accueil", async ({ page }) => {
    test.skip(!jeton, "aucun parcours amorcé");
    await page.goto(`/e/${jeton}`);

    for (const nom of ["Français", "English", "العربية", "Deutsch", "Español"]) {
      await expect(page.getByRole("link", { name: nom })).toBeVisible();
    }
  });

  const attendus = [
    { lang: "fr", texte: "Quel caddie vous a accompagné ?", dir: "ltr" },
    { lang: "en", texte: "Which caddie was with you?", dir: "ltr" },
    { lang: "de", texte: "Welcher Caddie hat Sie begleitet?", dir: "ltr" },
    { lang: "es", texte: "¿Qué caddie le acompañó?", dir: "ltr" },
    { lang: "ar", texte: "أي كادي رافقك اليوم؟", dir: "rtl" },
  ];

  for (const { lang, texte, dir } of attendus) {
    test(`s'affiche en « ${lang} » et déclare sa direction`, async ({ page }) => {
      test.skip(!jeton, "aucun parcours amorcé");
      await page.goto(`/e/${jeton}?lang=${lang}`);

      await expect(page.getByRole("heading", { name: texte })).toBeVisible();
      // La balise <html> est la SEULE qui compte pour un lecteur d'écran :
      // un <div dir="rtl"> à l'intérieur ne corrige pas un document annoncé
      // comme français et de gauche à droite.
      expect(await page.locator("html").getAttribute("lang")).toBe(lang);
      expect(await page.locator("html").getAttribute("dir")).toBe(dir);
    });
  }

  test("traduit aussi les questions, pas seulement l'accueil", async ({ page }) => {
    test.skip(!jeton, "aucun parcours amorcé");
    await page.goto(`/e/${jeton}?lang=en`);

    const premier = await page.locator('select[name="caddie"] option').nth(1).getAttribute("value");
    test.skip(!premier, "aucun caddie évaluable");

    await page.goto(`/e/${jeton}?lang=en&etape=questions&caddie=${premier}`);
    await expect(page.getByText("Question 1 of 8")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send my evaluation" })).toBeVisible();
  });

  test("retombe sur le français pour une langue inconnue", async ({ page }) => {
    test.skip(!jeton, "aucun parcours amorcé");
    await page.goto(`/e/${jeton}?lang=zz`);
    await expect(page.getByRole("heading", { name: "Quel caddie vous a accompagné ?" })).toBeVisible();
    expect(await page.locator("html").getAttribute("lang")).toBe("fr");
  });
});
