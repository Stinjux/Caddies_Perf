import { test, expect, type Response } from "@playwright/test";

/**
 * T062 / SCENARIO V-4 — LE STARTER NE RECOIT AUCUNE DONNEE PERSONNELLE.
 *
 * Ce test est la seule preuve reelle du principe I cote interface.
 *
 * Il ne regarde PAS l'ecran : il capture TOUT le trafic reseau d'une journee
 * de travail simulee et echoue si une valeur interdite y apparait, meme
 * jamais affichee. C'est ce qui distingue une interdiction d'un simple
 * masquage visuel.
 */

const STARTER = { email: "starter.cedres@example.invalid", password: "MotDePasseFictif2!" };

/** Valeurs qui ne doivent JAMAIS atteindre un Starter. */
const INTERDITS = [
  "birthYear",
  "birth_year",
  "1988", // annee de naissance fictive du caddie CED-001
  "1999",
  "1979",
  "passwordHash",
  "password_hash",
  "scrypt$",
  "qrToken",
  "qr_token",
  "caddie_personal_data",
];

async function corpsDe(reponse: Response): Promise<string> {
  try {
    return await reponse.text();
  } catch {
    return "";
  }
}

test("aucune donnée personnelle dans le trafic d'une journée de Starter", async ({ page }) => {
  const captures: { url: string; corps: string }[] = [];

  page.on("response", async (reponse) => {
    const type = reponse.headers()["content-type"] ?? "";
    if (/text|json|javascript/.test(type)) {
      captures.push({ url: reponse.url(), corps: await corpsDe(reponse) });
    }
  });

  // Journee de travail : connexion, ecran de depart, navigation.
  await page.goto("/connexion");
  await page.getByRole("textbox").first().fill(STARTER.email);
  await page.locator('input[type="password"]').fill(STARTER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/depart|terrains|choisir-terrain/);

  await page.goto("/depart");
  await expect(page.getByRole("heading", { name: /Golf des Cèdres/ })).toBeVisible();

  // Tentatives d'acces direct a des routes reservees a l'administration.
  await page.goto("/comptes");
  await page.goto("/terrains");
  await page.goto("/depart");

  expect(captures.length).toBeGreaterThan(0);

  const fautes: string[] = [];
  for (const { url, corps } of captures) {
    // On ignore les fichiers de l'outillage de developpement.
    if (/_next\/static|\.map$/.test(url)) continue;
    for (const interdit of INTERDITS) {
      if (corps.includes(interdit)) fautes.push(`${interdit} → ${url}`);
    }
  }

  expect(fautes, `Données interdites détectées dans le trafic :\n${fautes.join("\n")}`).toEqual([]);
});

test("le Starter ne voit aucun lien vers l'administration", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("textbox").first().fill(STARTER.email);
  await page.locator('input[type="password"]').fill(STARTER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/depart|terrains/);

  await page.goto("/depart");
  await expect(page.getByRole("link", { name: "Comptes" })).toHaveCount(0);
});

test("un accès direct à l'administration renvoie le Starter vers son écran", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("textbox").first().fill(STARTER.email);
  await page.locator('input[type="password"]').fill(STARTER.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/depart|terrains/);

  await page.goto("/comptes");
  await expect(page).not.toHaveURL(/comptes/);
});
