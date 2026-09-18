import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3200",
    // Indispensable au scenario V-4 : la capture reseau prouve qu'aucune
    // donnee personnelle n'atteint le Starter, meme sans etre affichee.
    trace: "retain-on-failure",
  },
  // Le serveur de developpement doit tourner (npm run dev, port 3200) avant
  // de lancer ces tests. Next refuse un second serveur de developpement sur
  // le meme projet, donc le harnais n'en demarre pas un lui-meme.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
