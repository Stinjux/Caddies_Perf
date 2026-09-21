import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth/context";
import { listLinksForAccount } from "@/server/repositories/account";
import { formatInCourseTimezone } from "@/lib/timezone";
import { tAdmin } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/**
 * Liste des parcours ACCESSIBLES au compte (FR-023).
 *
 * Pour un administrateur ordinaire : ceux auxquels il est rattaché, et eux
 * seuls. Pour un administrateur général : tous, y compris ceux créés après
 * lui. La distinction est faite par le dépôt, pas ici.
 */
export default async function ParcoursPage() {
  const ctx = await currentSession();
  if (!ctx) redirect("/connexion");

  const { t } = await tAdmin();
  const courses = await listLinksForAccount(ctx.accountId);
  const now = new Date();

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">{t.parcours.titre}</h1>
        {/* Créer un parcours est un acte de plateforme : le bouton n'apparaît
            qu'à qui peut réellement aboutir. Le service refuserait de toute
            façon — masquer le lien évite seulement une impasse. */}
        {ctx.generalAdmin && (
          <Link
            href="/parcours/nouveau"
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white"
          >
            {t.parcours.ajouter}
          </Link>
        )}
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        {ctx.generalAdmin ? t.parcours.tousLesParcours : t.parcours.reserveGeneral}
      </p>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-neutral-700">
            {ctx.generalAdmin ? t.parcours.aucunDuTout : t.parcours.aucunRattache}
          </p>
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
                    href={`/parcours/${c.golfCourseId}`}
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
                  {c.role === "admin" ? t.commun.administrateur : t.commun.starter}
                </span>
                <span
                  className={
                    c.status === "active"
                      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                      : "rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
                  }
                >
                  {c.status === "active" ? t.commun.actif : t.commun.archive}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
