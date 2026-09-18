import Link from "next/link";
import { formatInCourseTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

/**
 * Liste des terrains rattaches au compte (FR-023).
 *
 * L'ecran se branchera sur listCoursesForAccount() des que la session sera
 * posee (phase 4, US2). En attendant, il n'affiche rien plutot que d'inventer
 * des donnees.
 */
export default async function TerrainsPage() {
  const courses: { id: string; name: string; timezone: string; status: string }[] = [];
  const now = new Date();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
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
          <p className="text-neutral-700">Aucun terrain n&apos;est encore enregistré.</p>
          <p className="mt-1 text-sm text-neutral-500">
            La connexion des comptes arrive à la phase suivante ; cette liste restera vide
            d&apos;ici là.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {courses.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <Link href={`/terrains/${c.id}`} className="font-medium text-neutral-900">
                  {c.name}
                </Link>
                <p className="text-sm text-neutral-500">
                  {c.timezone} · {formatInCourseTimezone(now, c.timezone)}
                </p>
              </div>
              <span
                className={
                  c.status === "active"
                    ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                    : "rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
                }
              >
                {c.status === "active" ? "Actif" : "Archivé"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
