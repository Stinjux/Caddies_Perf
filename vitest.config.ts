import { defineConfig } from "vitest/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

// Les tests d'integration frappent TOUJOURS la base de test, jamais celle de
// developpement. Cette redirection est faite ici, avant tout import de src/db.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    globals: false,
    // Les tests d'integration partagent une seule base : les executer en
    // parallele ferait qu'une reinitialisation efface les donnees d'un autre
    // fichier en cours. La serialisation est ici une exigence, pas un reglage.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
