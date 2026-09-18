import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { currentSession } from "@/server/auth/context";
import { logout } from "@/server/auth/current";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { listLinksForAccount } from "@/server/repositories/account";
import { CourseSwitcher } from "@/components/course-switcher";

/**
 * Espace Starter.
 *
 * PRINCIPE I — aucune donnee personnelle n'entre ici. Ni age, ni adresse,
 * ni note, ni commentaire, ni jeton de QR code. Les projections de
 * src/server/serializers/starter.ts en sont la seule source autorisee.
 *
 * Interface pensee pour le depart : gros boutons, fort contraste, lisible
 * en plein soleil.
 */
export default async function StarterLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentSession();
  if (!ctx) redirect("/connexion");
  if (!ctx.scope) redirect("/choisir-terrain");

  const links = await listLinksForAccount(ctx.accountId);

  async function deconnexion() {
    "use server";
    const store = await cookies();
    await logout(store.get(SESSION_COOKIE)?.value);
    store.delete(SESSION_COOKIE);
    redirect("/connexion");
  }

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 border-b-2 border-neutral-900 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/depart" className="text-xl font-bold text-neutral-900">
            Départ
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <CourseSwitcher courses={links} activeId={ctx.activeGolfCourseId} />
            <form action={deconnexion}>
              <button type="submit" className="text-base text-neutral-700 underline">
                Quitter
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
