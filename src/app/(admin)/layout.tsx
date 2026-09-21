import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth/context";
import { logout } from "@/server/auth/current";
import { SESSION_COOKIE } from "@/server/auth/session";
import { listLinksForAccount } from "@/server/repositories/account";
import { CourseSwitcher } from "@/components/course-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";
import { tAdmin } from "@/lib/i18n/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentSession();
  if (!ctx) redirect("/connexion");
  if (!ctx.scope) redirect("/choisir-parcours");

  const { langue, t } = await tAdmin();
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
          <Link href="/parcours" className="text-lg font-semibold text-[var(--color-brand)]">
            CaddiePerf
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <CourseSwitcher
              courses={links}
              activeId={ctx.activeGolfCourseId}
              label={t.nav.parcoursActif}
              bouton={t.nav.changer}
            />
            <LanguageSwitcher langue={langue} />
            <span className="text-sm text-neutral-500">
              {ctx.firstName} {ctx.lastName}
            </span>
            {/* Le niveau général se voit en permanence : agir sur tous les
                parcours sans le savoir serait le meilleur moyen de modifier
                le mauvais. */}
            {ctx.generalAdmin && (
              <span className="rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-xs font-medium text-[var(--color-brand)]">
                {t.commun.adminGeneral}
              </span>
            )}
            <form action={deconnexion}>
              <button type="submit" className="text-sm text-neutral-500 underline">
                {t.nav.deconnexion}
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-2 px-4 pb-3 text-sm">
          <Link href="/parcours" className="text-neutral-700">
            {t.nav.parcours}
          </Link>
          {ctx.scope.role === "admin" && (
            <>
              <Link href="/caddies" className="text-neutral-700">
                {t.nav.caddies}
              </Link>
              <Link href="/qr" className="text-neutral-700">
                {t.nav.qr}
              </Link>
              <Link href="/comptes" className="text-neutral-700">
                {t.nav.comptes}
              </Link>
              <Link href="/rapports" className="text-neutral-700">
                {t.nav.rapports}
              </Link>
              <Link href="/journal" className="text-neutral-700">
                {t.nav.journal}
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
