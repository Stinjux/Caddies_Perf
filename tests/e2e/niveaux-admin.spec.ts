import { test, expect } from "@playwright/test";
import { connexion, ADMIN, ADMIN_GENERAL } from "./helpers";

/**
 * LES DEUX NIVEAUX D'ADMINISTRATION, VUS DE L'ÉCRAN.
 *
 * Les tests d'intégration prouvent que le service refuse. Ceux-ci prouvent
 * autre chose, qui compte tout autant : qu'un administrateur ordinaire ne se
 * voit pas proposer une porte qui lui sera fermée, et qu'un administrateur
 * général trouve la sienne.
 */

test.describe("administrateur général", () => {
  test("atteint tous les parcours sans y être rattaché", async ({ page }) => {
    await connexion(page, ADMIN_GENERAL);
    await page.goto("/parcours");

    // Le compte fictif n'a AUCUN rattachement ; il voit pourtant les deux
    // parcours de démonstration.
    await expect(page.getByRole("link", { name: "Golf des Cèdres" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Royal Atlas" })).toBeVisible();
  });

  test("porte son niveau en évidence, sur chaque écran", async ({ page }) => {
    await connexion(page, ADMIN_GENERAL);
    // Agir sur tous les parcours sans le savoir serait le meilleur moyen de
    // modifier le mauvais : l'étiquette est permanente.
    await expect(page.getByText("Administrateur général").first()).toBeVisible();
  });

  test("se voit proposer la création d'un parcours", async ({ page }) => {
    await connexion(page, ADMIN_GENERAL);
    await page.goto("/parcours");
    await expect(page.getByRole("link", { name: "Ajouter un parcours" })).toBeVisible();
  });

  test("atteint le formulaire de création", async ({ page }) => {
    await connexion(page, ADMIN_GENERAL);
    await page.goto("/parcours/nouveau");
    await expect(page.getByRole("heading", { name: "Nouveau parcours" })).toBeVisible();
  });
});

test.describe("administrateur ordinaire", () => {
  test("ne se voit PAS proposer la création d'un parcours", async ({ page }) => {
    await connexion(page, ADMIN);
    await page.goto("/parcours");
    await expect(page.getByRole("link", { name: "Ajouter un parcours" })).toHaveCount(0);
  });

  test("est renvoyé s'il demande le formulaire de création à la main", async ({ page }) => {
    // Masquer un lien n'est PAS un contrôle d'accès : la même demande, tapée
    // dans la barre d'adresse, doit se heurter au même refus.
    await connexion(page, ADMIN);
    await page.goto("/parcours/nouveau");

    await expect(page).toHaveURL(/\/parcours$/);
    await expect(page.getByRole("heading", { name: "Nouveau parcours" })).toHaveCount(0);
  });

  test("lit pourquoi la création lui est fermée", async ({ page }) => {
    await connexion(page, ADMIN);
    await page.goto("/parcours");
    await expect(
      page.getByText("Seul un administrateur général peut créer un parcours."),
    ).toBeVisible();
  });

  test("ne voit ni la section ni les boutons du niveau général", async ({ page }) => {
    await connexion(page, ADMIN);
    await page.goto("/comptes");

    await expect(page.getByRole("heading", { name: "Comptes du parcours" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Administrateurs généraux" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Promouvoir administrateur général" })).toHaveCount(0);
  });
});
