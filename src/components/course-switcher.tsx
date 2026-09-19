import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { selectCourse } from "@/server/auth/current";
import { SESSION_COOKIE } from "@/server/auth/session";

/**
 * Selecteur de terrain actif (FR-012, FR-013).
 *
 * FR-027 : changer de terrain provoque une redirection complete, ce qui
 * ecarte de l'ecran toute donnee du terrain precedent — aucun etat client
 * ne survit au changement.
 */

export async function CourseSwitcher({
  courses,
  activeId,
}: {
  courses: { golfCourseId: string; name: string; role: "admin" | "starter" }[];
  activeId: string | null;
}) {
  async function changer(formData: FormData) {
    "use server";
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) redirect("/connexion");

    await selectCourse(token, String(formData.get("golfCourseId")));
    redirect("/");
  }

  const active = courses.find((c) => c.golfCourseId === activeId);

  if (courses.length <= 1) {
    return active ? (
      <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700">
        {active.name}
      </span>
    ) : null;
  }

  return (
    <form action={changer} className="flex items-center gap-2">
      <label htmlFor="golfCourseId" className="sr-only">
        Terrain actif
      </label>
      <select
        id="golfCourseId"
        name="golfCourseId"
        defaultValue={activeId ?? ""}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
      >
        {courses.map((c) => (
          <option key={c.golfCourseId} value={c.golfCourseId}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">
        Changer
      </button>
    </form>
  );
}
