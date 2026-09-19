import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import { requireRole } from "@/server/auth/require-role";
import { formatInCourseTimezone } from "@/lib/timezone";
import { getActiveCourse } from "@/server/repositories/golf-course";
import { listCaddiesForStarter } from "@/server/repositories/caddie";
import { listCartsForStarter } from "@/server/services/cart";
import {
  creerAffectation,
  terminerAffectation,
  affectationsDuJour,
} from "@/server/services/assignment";
import { setCaddieAvailability } from "@/server/services/caddie";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * ÉCRAN DU STARTER, sur le départ (spéc. 3).
 *
 * PRINCIPE I — n'affiche QUE : numéro de réservation, heure de départ,
 * numéro de voiturette, identifiant interne du caddie, prénom et nom,
 * disponibilité, affectation courante. Les projections du serveur ne
 * laissent rien d'autre passer.
 *
 * Gros boutons, fort contraste : l'écran se lit en plein soleil, téléphone
 * en main, entre deux groupes.
 */
export default async function DepartPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { scope } = await requireScope();
  requireRole(scope, "starter", "admin");

  const { erreur } = await searchParams;
  const course = await getActiveCourse(scope);
  const [caddies, voiturettes, affectations] = await Promise.all([
    listCaddiesForStarter(scope),
    listCartsForStarter(scope),
    affectationsDuJour(scope),
  ]);

  const libres = voiturettes.filter((v) => v.status === "available");
  const dispos = caddies.filter((c) => c.available);
  const enCours = affectations.filter((a) => a.status === "active");

  async function affecter(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    try {
      const heure = String(formData.get("teeTime") ?? "");
      await creerAffectation(scope, {
        bookingRef: String(formData.get("bookingRef") ?? ""),
        teeTime: heure ? new Date(heure) : new Date(),
        cartId: String(formData.get("cartId") ?? ""),
        caddieId: String(formData.get("caddieId") ?? ""),
      });
    } catch (e) {
      const m = e instanceof AppError ? e.message : "Affectation impossible.";
      redirect("/depart?erreur=" + encodeURIComponent(m));
    }
    redirect("/depart");
  }

  async function terminer(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    await terminerAffectation(scope, String(formData.get("id")));
    redirect("/depart");
  }

  async function basculerDispo(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    await setCaddieAvailability(
      scope,
      String(formData.get("caddieId")),
      formData.get("vers") === "unavailable" ? "unavailable" : "available",
    );
    redirect("/depart");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{course?.name}</h1>
        <p className="text-base text-neutral-600">
          {course && formatInCourseTimezone(new Date(), course.timezone)}
        </p>
      </div>

      {erreur && (
        <p
          role="alert"
          className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-base font-medium text-red-900"
        >
          {erreur}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold text-neutral-900">Nouvelle affectation</h2>
        <form action={affecter} className="space-y-4 rounded-xl border-2 border-neutral-900 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-base font-medium">Numéro de réservation</span>
              <input
                name="bookingRef"
                required
                placeholder="RES-001"
                className="w-full rounded-lg border-2 border-neutral-400 px-3 py-3 text-base"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-base font-medium">Heure de départ</span>
              <input
                name="teeTime"
                type="datetime-local"
                required
                className="w-full rounded-lg border-2 border-neutral-400 px-3 py-3 text-base"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-base font-medium">Voiturette</span>
            <select
              name="cartId"
              required
              className="w-full rounded-lg border-2 border-neutral-400 px-3 py-3 text-base"
            >
              {libres.length === 0 && <option value="">Aucune voiturette disponible</option>}
              {libres.map((v) => (
                <option key={v.id} value={v.id}>
                  N° {v.visibleNumber}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-base font-medium">Caddie</span>
            <select
              name="caddieId"
              required
              className="w-full rounded-lg border-2 border-neutral-400 px-3 py-3 text-base"
            >
              {dispos.length === 0 && <option value="">Aucun caddie disponible</option>}
              {dispos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.internalRef} — {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={libres.length === 0 || dispos.length === 0}
            className="w-full rounded-lg bg-[var(--color-brand)] px-5 py-4 text-lg font-bold text-white disabled:opacity-40"
          >
            Affecter
          </button>
        </form>
      </section>

      <Section titre="Affectations en cours" vide="Aucune affectation en cours.">
        {enCours.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <p className="text-base font-bold text-neutral-900">
                {a.bookingRef} · Voiturette {a.cartNumber}
              </p>
              <p className="text-base text-neutral-700">
                {a.caddieRef} — {a.caddieFirstName} {a.caddieLastName}
              </p>
              <p className="text-sm text-neutral-500">
                Départ {course && formatInCourseTimezone(a.teeTime, course.timezone)}
              </p>
            </div>
            <form action={terminer}>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                className="rounded-lg border-2 border-neutral-900 px-4 py-3 text-base font-medium"
              >
                Terminer
              </button>
            </form>
          </li>
        ))}
      </Section>

      <Section titre="Caddies" vide="Aucun caddie enregistré.">
        {caddies.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <span className="text-base font-medium text-neutral-900">
              {c.internalRef} — {c.firstName} {c.lastName}
            </span>
            <form action={basculerDispo} className="flex items-center gap-3">
              <input type="hidden" name="caddieId" value={c.id} />
              <input type="hidden" name="vers" value={c.available ? "unavailable" : "available"} />
              <span className={c.available ? "text-emerald-700" : "text-amber-700"}>
                {c.available ? "Disponible" : "Indisponible"}
              </span>
              <button
                type="submit"
                className="rounded-lg border-2 border-neutral-400 px-3 py-2 text-sm"
              >
                {c.available ? "Signaler absent" : "Rendre disponible"}
              </button>
            </form>
          </li>
        ))}
      </Section>

      <Section titre="Voiturettes" vide="Aucune voiturette enregistrée.">
        {voiturettes.map((v) => (
          <li key={v.id} className="flex items-center justify-between px-4 py-4 text-base">
            <span className="font-medium text-neutral-900">N° {v.visibleNumber}</span>
            <span className="text-neutral-700">
              {v.status === "available"
                ? "Disponible"
                : v.status === "assigned"
                  ? "Affectée"
                  : v.status === "maintenance"
                    ? "Entretien"
                    : "Inactive"}
            </span>
          </li>
        ))}
      </Section>
    </div>
  );
}

function Section({
  titre,
  vide,
  children,
}: {
  titre: string;
  vide: string;
  children: React.ReactNode;
}) {
  const vides = !Array.isArray(children) || children.length === 0;
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-neutral-900">{titre}</h2>
      {vides ? (
        <p className="rounded-xl border-2 border-dashed border-neutral-300 px-4 py-8 text-center text-neutral-600">
          {vide}
        </p>
      ) : (
        <ul className="divide-y-2 divide-neutral-200 rounded-xl border-2 border-neutral-900">
          {children}
        </ul>
      )}
    </section>
  );
}
