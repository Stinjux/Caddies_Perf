import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import { listAuditInScope } from "@/server/repositories/audit";
import { listAccountsInScope } from "@/server/repositories/account";
import { getActiveCourse } from "@/server/repositories/golf-course";
import { formatInCourseTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

/**
 * Consultation du journal (FR-039).
 *
 * N'affiche que des identifiants internes et le nom de l'AUTEUR. Le contenu
 * des actions n'est pas journalise, donc rien de metier ne peut s'afficher
 * ici (FR-037).
 */

const LIBELLES: Record<string, string> = {
  "course.create": "Terrain créé",
  "course.update": "Terrain modifié",
  "course.archive": "Terrain archivé",
  "account.create": "Compte créé",
  "account.update": "Compte modifié",
  "account.disable": "Compte désactivé",
  "account.enable": "Compte réactivé",
  "account.attach": "Compte rattaché",
  "account.detach": "Compte détaché",
  "account.password_reset": "Mot de passe réinitialisé",
  "caddie.create": "Caddie créé",
  "caddie.update": "Caddie modifié",
  "caddie.disable": "Caddie désactivé",
  "pii.read": "Renseignements personnels consultés",
  "pii.write": "Renseignements personnels modifiés",
  "pii.erase": "Renseignements personnels effacés",
  "retention.purge": "Purge à échéance",
  // Consultations. Une lecture ne laisse aucune trace naturelle : sans ces
  // entrées, on ne saurait jamais qui a regardé quoi.
  "caddie.list": "Liste des caddies consultée",
  "caddie.read": "Fiche caddie consultée",
  "account.list": "Liste des comptes consultée",
  "report.read": "Rapport consulté",
  "report.export": "Rapport exporté",
  "audit.read": "Journal consulté",
};

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; auteur?: string; du?: string; au?: string }>;
}) {
  const { scope } = await requireScope();
  if (scope.role !== "admin") redirect("/terrains");

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
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Journal des actions</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Ce journal est en écriture seule. Aucune entrée ne peut être modifiée ni supprimée, et
        aucune donnée personnelle n&apos;y figure.
      </p>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">Nature</span>
          <select
            name="action"
            defaultValue={params.action ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">Toutes</option>
            {Object.entries(LIBELLES).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">Auteur</span>
          <select
            name="auteur"
            defaultValue={params.auteur ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">Tous</option>
            {auteurs.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">Du</span>
          <input
            type="date"
            name="du"
            defaultValue={params.du ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">Au</span>
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
          Filtrer
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">
          Aucune action ne correspond à ces critères.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <div>
                <p className="text-neutral-900">{LIBELLES[e.action] ?? e.action}</p>
                <p className="text-sm text-neutral-500">
                  par {e.actorFirstName} {e.actorLastName} · {e.targetType}
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
