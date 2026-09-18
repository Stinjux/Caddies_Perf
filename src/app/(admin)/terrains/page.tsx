import Link from "next/link";
import { currentSession } from "@/server/auth/context";
import { listLinksForAccount } from "@/server/repositories/account";
import { formatInCourseTimezone } from "@/lib/timezone";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Liste des terrains RATTACHÉS au compte, jamais les autres (FR-023). */
export default async function TerrainsPage() {
  const ctx = await currentSession();
  if (!ctx) redirect("/connexion");

  const courses = await listLinksForAccount(ctx.accountId);
  const now = new Date();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Terrains</h1>
        <Link
          href="/terrains/nouveau"
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white"
        >
          Ajouter un terrain
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-neutral-700">Aucun terrain n&apos;est rattaché à votre compte.</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {courses.map((c) => (
            <li
              key={c.golfCourseId}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"
            >
              <div>
                {c.role === "admin" ? (
                  <Link
                    href={`/terrains/${c.golfCourseId}`}
                    className="font-medium text-neutral-900 underline"
                  >
                    {c.name}
                  </Link>
                ) : (
                  <span className="font-medium text-neutral-900">{c.name}</span>
                )}
                <p className="text-sm text-neutral-500">
                  {c.timezone} · {formatInCourseTimezone(now, c.timezone)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                  {c.role === "admin" ? "Administrateur" : "Starter"}
                </span>
                <span
                  className={
                    c.status === "active"
                      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                      : "rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
                  }
                >
                  {c.status === "active" ? "Actif" : "Archivé"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
