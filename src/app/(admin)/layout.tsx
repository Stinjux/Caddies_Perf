import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth/context";
import { logout } from "@/server/auth/current";
import { SESSION_COOKIE } from "@/server/auth/session";
import { listLinksForAccount } from "@/server/repositories/account";
import { CourseSwitcher } from "@/components/course-switcher";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/terrains" className="text-lg font-semibold text-[var(--color-brand)]">
            CaddiePerf
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <CourseSwitcher courses={links} activeId={ctx.activeGolfCourseId} />
            <span className="text-sm text-neutral-500">
              {ctx.firstName} {ctx.lastName}
            </span>
            <form action={deconnexion}>
              <button type="submit" className="text-sm text-neutral-500 underline">
                Déconnexion
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-5 px-4 pb-3 text-sm">
          <Link href="/terrains" className="text-neutral-700">
            Terrains
          </Link>
          {ctx.scope.role === "admin" && (
            <>
              <Link href="/caddies" className="text-neutral-700">
                Caddies
              </Link>
              <Link href="/voiturettes" className="text-neutral-700">
                Voiturettes
              </Link>
              <Link href="/comptes" className="text-neutral-700">
                Comptes
              </Link>
              <Link href="/rapports" className="text-neutral-700">
                Rapports
              </Link>
              <Link href="/journal" className="text-neutral-700">
                Journal
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
