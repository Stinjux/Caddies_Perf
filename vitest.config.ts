import { defineConfig } from "vitest/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

// Les tests d'integration frappent TOUJOURS la base de test, jamais celle de
// developpement. Cette redirection est faite ici, avant tout import de src/db.
//
// Et ils la frappent avec le ROLE APPLICATIF, soumis au RLS. C'est ce qui
// donne sa valeur au cloisonnement : les 350 tests passent alors a travers
// les memes politiques que la production. Le proprietaire de la base reste
// reserve a la reinitialisation (TRUNCATE), qu'un role applicatif ne peut pas
// faire — et ne doit pas pouvoir faire.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.APP_DATABASE_URL = process.env.TEST_APP_DATABASE_URL ?? process.env.TEST_DATABASE_URL;

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
