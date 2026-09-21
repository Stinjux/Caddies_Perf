import { randomBytes } from "node:crypto";
import { db } from "./raw-db";
import { account, accountGolfCourse, golfCourse } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { hashPassword } from "@/server/auth/password";

/** Constructeurs de donnees FICTIVES pour les tests (principe II). */

export const PASSWORD = "MotDePasseFictif123!";

export async function makeCourse(name: string, timezone = "Africa/Casablanca"): Promise<string> {
  const id = uuidv7();
  await db.insert(golfCourse).values({
    id,
    name,
    timezone,
    qrToken: randomBytes(32).toString("base64url"),
  });
  return id;
}

export async function makeAccount(opts: {
  email?: string;
  password?: string;
  status?: "active" | "disabled";
  /** Administrateur general : portee admin sur TOUS les parcours. */
  generalAdmin?: boolean;
  links?: { courseId: string; role: "admin" | "starter" }[];
}): Promise<string> {
  const id = uuidv7();
  await db.insert(account).values({
    id,
    email: opts.email ?? `compte.${id}@example.invalid`,
    firstName: "Prenom",
    lastName: "Fictif",
    passwordHash: await hashPassword(opts.password ?? PASSWORD),
    status: opts.status ?? "active",
    generalAdmin: opts.generalAdmin === true,
  });
  for (const l of opts.links ?? []) {
    await db
      .insert(accountGolfCourse)
      .values({ accountId: id, golfCourseId: l.courseId, role: l.role });
  }
  return id;
}
