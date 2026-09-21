import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireScope } from "@/server/auth/context";
import { listCaddies } from "@/server/repositories/caddie";
import { archiverCaddie } from "@/server/services/caddie";
import { tAdmin } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

export default async function CaddiesPage() {
  const { scope } = await requireScope();
  if (scope.role !== "admin") redirect("/");

  const { t } = await tAdmin();

  /**
   * DÉPART D'UN CADDIE. Le numéro de version voyage avec le formulaire : deux
   * administrateurs qui archivent le même caddie en même temps ne peuvent pas
   * s'écraser en silence (FR-045).
   */
  async function archiver(formData: FormData) {
    "use server";
    const { scope: portee } = await requireScope();
    await archiverCaddie(portee, String(formData.get("id")), Number(formData.get("version")));
    revalidatePath("/caddies");
  }

  const caddies = await listCaddies(scope);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">{t.caddies.titre}</h1>
        <Link
          href="/caddies/import"
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white"
        >
          {t.caddies.importer}
        </Link>
      </div>

      {caddies.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">
          {t.caddies.aucun}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {caddies.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div>
                <p className="font-medium text-neutral-900">
                  {c.internalRef} — {c.firstName} {c.lastName}
                </p>
                <p className="text-sm text-neutral-500">
                  {c.seniorityYears !== null
                    ? t.caddies.anciennete(c.seniorityYears)
                    : t.caddies.ancienneteInconnue}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    c.availability === "available"
                      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                      : "rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700"
                  }
                >
                  {c.availability === "available" ? t.caddies.disponible : t.caddies.indisponible}
                </span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                  {c.status === "active" ? t.commun.actif : t.commun.desactive}
                </span>
                <Link
                  href={`/caddies/${c.id}/donnees-personnelles`}
                  className="text-sm text-neutral-500 underline"
                >
                  {t.caddies.renseignements}
                </Link>
                {c.status === "active" && (
                  <form action={archiver}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="version" value={c.version} />
                    <button
                      type="submit"
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
                    >
                      {t.caddies.depart}
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
