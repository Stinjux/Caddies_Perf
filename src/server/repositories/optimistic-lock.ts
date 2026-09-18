import { eq, and, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * FR-045 : deux modifications concurrentes ne doivent jamais s'ecraser
 * silencieusement. La condition ci-dessous n'apparie la ligne que si sa
 * version est bien celle que l'appelant a lue.
 */
export function withVersion(versionColumn: PgColumn, expected: number, base: SQL): SQL {
  return and(base, eq(versionColumn, expected))!;
}
