import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import { listAuditInScope } from "@/server/repositories/audit";
import { listAccountsInScope } from "@/server/repositories/account";
import { getActiveCourse } from "@/server/repositories/golf-course";
import { formatInCourseTimezone } from "@/lib/timezone";
import { tAdmin } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/**
 * Consultation du journal (FR-039).
 *
 * N'affiche que des identifiants internes et le nom de l'AUTEUR. Le contenu
 * des actions n'est pas journalise, donc rien de metier ne peut s'afficher
 * ici (FR-037).
 */

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; auteur?: string; du?: string; au?: string }>;
}) {
  const { scope } = await requireScope();
  if (scope.role !== "admin") redirect("/parcours");

  const { t } = await tAdmin();
  // Les libellés viennent du dictionnaire : le journal se lit dans la langue
  // de celui qui le consulte, alors que les codes stockés, eux, ne changent
  // jamais — c'est ce qui les rend comparables d'une langue à l'autre.
  const LIBELLES: Record<string, string> = t.journal.actions;

  const params = await searchParams;
  const course = await getActiveCourse(scope);
  const auteurs = await listAccountsInScope(scope);

  const entries = await listAuditInScope(scope, {
    action: params.action || undefined,
    actorAccountId: params.auteur || undefined,
    from: params.du ? new Date(params.du) : undefined,
    to: params.au ? new Date(`${params.au}T23:59:59`) : undefined,
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">{t.journal.titre}</h1>
      <p className="mb-6 text-sm text-neutral-500">{t.journal.explication}</p>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">{t.journal.nature}</span>
          <select
            name="action"
            defaultValue={params.action ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">{t.commun.toutes}</option>
            {Object.entries(LIBELLES).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">{t.journal.auteur}</span>
          <select
            name="auteur"
            defaultValue={params.auteur ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">{t.commun.tous}</option>
            {auteurs.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">{t.commun.du}</span>
          <input
            type="date"
            name="du"
            defaultValue={params.du ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">{t.commun.au}</span>
          <input
            type="date"
            name="au"
            defaultValue={params.au ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          {t.commun.filtrer}
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">
          {t.journal.aucune}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <div>
                <p className="text-neutral-900">{LIBELLES[e.action] ?? e.action}</p>
                <p className="text-sm text-neutral-500">
                  {t.journal.par} {e.actorFirstName} {e.actorLastName} · {e.targetType}
                </p>
              </div>
              <span className="text-sm text-neutral-500">
                {course && formatInCourseTimezone(e.occurredAt, course.timezone)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
