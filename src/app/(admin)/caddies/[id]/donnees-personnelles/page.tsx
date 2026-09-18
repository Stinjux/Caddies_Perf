import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { caddie } from "@/db/schema";
import { requireScope } from "@/server/auth/context";
import { readBirthYear } from "@/server/pii";
import { writeBirthYear, eraseBirthYear } from "@/server/pii/mutate";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * Consultation et correction des renseignements personnels d'UN caddie
 * (FR-030, FR-033).
 *
 * Reserve aux administrateurs. L'affichage de cette page journalise deja une
 * consultation : c'est voulu — ouvrir l'ecran EST une consultation.
 */
export default async function DonneesPersonnellesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; ok?: string }>;
}) {
  const { scope } = await requireScope();
  if (scope.role !== "admin") redirect("/terrains");

  const { id } = await params;
  const { erreur, ok } = await searchParams;

  const fiche = await db
    .select({
      id: caddie.id,
      internalRef: caddie.internalRef,
      firstName: caddie.firstName,
      lastName: caddie.lastName,
      status: caddie.status,
    })
    .from(caddie)
    .where(and(eq(caddie.id, id), eq(caddie.golfCourseId, scope.golfCourseId)))
    .limit(1);

  if (fiche.length === 0) redirect("/terrains");
  const c = fiche[0]!;

  const birthYear = await readBirthYear(scope, id);

  async function corriger(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    const cible = String(formData.get("caddieId"));
    try {
      await writeBirthYear(scope, cible, Number(formData.get("birthYear")));
    } catch (e) {
      const m = e instanceof AppError ? e.message : "Correction impossible.";
      redirect(`/caddies/${cible}/donnees-personnelles?erreur=${encodeURIComponent(m)}`);
    }
    redirect(`/caddies/${cible}/donnees-personnelles?ok=1`);
  }

  async function effacer(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    const cible = String(formData.get("caddieId"));
    await eraseBirthYear(scope, cible);
    redirect(`/caddies/${cible}/donnees-personnelles?ok=2`);
  }

  return (
    <div className="max-w-xl">
      <Link href="/terrains" className="text-sm text-neutral-500">
        ← Retour
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
        {c.internalRef} — {c.firstName} {c.lastName}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">
        Renseignements personnels · accès réservé aux administrateurs. Chaque consultation et chaque
        modification est journalisée.
      </p>

      {erreur && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {erreur}
        </p>
      )}
      {ok && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok === "2" ? "Renseignements effacés." : "Correction enregistrée."}
        </p>
      )}

      <div className="space-y-6 rounded-xl border border-neutral-200 bg-white p-6">
        <form action={corriger} className="space-y-4">
          <input type="hidden" name="caddieId" value={c.id} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">
              Année de naissance
            </span>
            <input
              name="birthYear"
              type="number"
              required
              min={1940}
              max={new Date().getFullYear() - 15}
              defaultValue={birthYear ?? ""}
              className="w-40 rounded-lg border border-neutral-300 px-3 py-2.5"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Seule donnée d&apos;âge conservée. Ni date complète, ni taille d&apos;habits, ni
              adresse : le schéma de la base ne peut pas les recevoir.
            </span>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white"
          >
            Enregistrer la correction
          </button>
        </form>

        <form action={effacer} className="border-t border-neutral-200 pt-5">
          <input type="hidden" name="caddieId" value={c.id} />
          <p className="mb-3 text-sm text-neutral-600">
            L&apos;effacement est définitif. Les affectations, les évaluations et les moyennes du
            terrain restent inchangées.
          </p>
          <button
            type="submit"
            className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700"
          >
            Effacer les renseignements personnels
          </button>
        </form>
      </div>
    </div>
  );
}
