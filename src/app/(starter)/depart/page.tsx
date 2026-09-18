import { requireScope } from "@/server/auth/context";
import { requireRole } from "@/server/auth/require-role";
import { formatInCourseTimezone } from "@/lib/timezone";
import { getActiveCourse } from "@/server/repositories/golf-course";
import type {
  StarterAssignmentView,
  StarterCaddieView,
  StarterCartView,
} from "@/server/serializers/starter";

export const dynamic = "force-dynamic";

/**
 * Ecran du Starter (FR-019).
 *
 * N'affiche QUE : numero de reservation, heure de depart, numero de
 * voiturette, identifiant interne du caddie, prenom et nom, disponibilite,
 * affectation courante. Rien d'autre ne transite (FR-020).
 *
 * Les listes sont vides tant que les specifications 2 et 3 n'ont pas livre
 * caddies, voiturettes et reservations. L'ecran le dit plutot que de
 * simuler des donnees.
 */
export default async function DepartPage() {
  const { scope } = await requireScope();
  requireRole(scope, "starter", "admin");

  const course = await getActiveCourse(scope);
  const caddies: StarterCaddieView[] = [];
  const carts: StarterCartView[] = [];
  const assignments: StarterAssignmentView[] = [];

  const now = new Date();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{course?.name}</h1>
        <p className="text-base text-neutral-600">
          {course && formatInCourseTimezone(now, course.timezone)}
        </p>
      </div>

      <Section title="Affectations du jour" count={assignments.length}>
        {assignments.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-4 py-4 text-base">
            <div>
              <p className="font-semibold text-neutral-900">
                {a.bookingRef} · Voiturette {a.cartNumber}
              </p>
              <p className="text-neutral-700">
                {a.caddieRef} — {a.caddieName}
              </p>
            </div>
            <span className="text-neutral-700">
              {course && formatInCourseTimezone(a.teeTime, course.timezone)}
            </span>
          </li>
        ))}
      </Section>

      <Section title="Caddies disponibles" count={caddies.length}>
        {caddies.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-4 text-base">
            <span className="font-semibold text-neutral-900">
              {c.internalRef} — {c.firstName} {c.lastName}
            </span>
            <span className={c.available ? "text-emerald-700" : "text-neutral-500"}>
              {c.available ? "Disponible" : "Indisponible"}
            </span>
          </li>
        ))}
      </Section>

      <Section title="Voiturettes" count={carts.length}>
        {carts.map((v) => (
          <li key={v.id} className="flex items-center justify-between px-4 py-4 text-base">
            <span className="font-semibold text-neutral-900">N° {v.visibleNumber}</span>
            <span className="text-neutral-700">{v.status}</span>
          </li>
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-neutral-900">{title}</h2>
      {count === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-neutral-300 px-4 py-8 text-center text-neutral-600">
          Rien à afficher pour l&apos;instant.
        </p>
      ) : (
        <ul className="divide-y-2 divide-neutral-200 rounded-xl border-2 border-neutral-900">
          {children}
        </ul>
      )}
    </section>
  );
}
