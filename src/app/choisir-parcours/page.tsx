import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth/context";
import { selectCourse } from "@/server/auth/current";
import { SESSION_COOKIE } from "@/server/auth/session";
import { listLinksForAccount } from "@/server/repositories/account";
import { tAdmin } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/** FR-012 : ne propose QUE les parcours rattachés au compte. */
export default async function ChoisirParcoursPage() {
  const ctx = await currentSession();
  if (!ctx) redirect("/connexion");

  const { t } = await tAdmin();
  const links = await listLinksForAccount(ctx.accountId);

  async function choisir(formData: FormData) {
    "use server";
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) redirect("/connexion");
    await selectCourse(token, String(formData.get("golfCourseId")));
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-neutral-900">
          {t.choisir.titre}
        </h1>
        <ul className="space-y-3">
          {links.map((l) => (
            <li key={l.golfCourseId}>
              <form action={choisir}>
                <input type="hidden" name="golfCourseId" value={l.golfCourseId} />
                <button
                  type="submit"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-5 py-4 text-left"
                >
                  <span className="block font-medium text-neutral-900">{l.name}</span>
                  <span className="block text-sm text-neutral-500">
                    {l.role === "admin" ? t.commun.administrateur : t.commun.starter} · {l.timezone}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
