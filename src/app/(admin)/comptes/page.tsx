import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import { requireAdmin, requireGeneralAdmin } from "@/server/scope";
import { listAccountsInScope } from "@/server/repositories/account";
import { createAccount } from "@/server/services/account";
import {
  listerAdminsGeneraux,
  accorderNiveauGeneral,
  retirerNiveauGeneral,
} from "@/server/services/admin-general";
import { AppError } from "@/server/errors";
import { tAdmin } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/**
 * Gestion des comptes du parcours actif (FR-009, FR-018).
 *
 * Le haché de mot de passe n'est jamais chargé : la projection du dépôt
 * l'exclut à la source (FR-017).
 *
 * DEUX NIVEAUX. Un administrateur gère son parcours ; un administrateur
 * général gère la plateforme. Seul le second voit — et modifie — la section
 * des niveaux généraux.
 */
export default async function ComptesPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; ok?: string }>;
}) {
  const { scope } = await requireScope();
  // Un Starter est renvoye vers son espace plutot que de recevoir une erreur :
  // le refus reste total, mais lisible (FR-022).
  if (scope.role !== "admin") redirect("/parcours");

  const { t } = await tAdmin();
  const { erreur, ok } = await searchParams;
  const comptes = await listAccountsInScope(scope);
  const generaux = scope.generalAdmin ? await listerAdminsGeneraux(scope) : [];

  async function creer(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    const { t } = await tAdmin();
    requireAdmin(scope);
    try {
      await createAccount(scope, {
        email: String(formData.get("email") ?? ""),
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        password: String(formData.get("password") ?? ""),
        role: formData.get("role") === "admin" ? "admin" : "starter",
      });
    } catch (e) {
      const message = e instanceof AppError ? e.message : t.comptes.creationImpossible;
      redirect(`/comptes?erreur=${encodeURIComponent(message)}`);
    }
    redirect("/comptes?ok=1");
  }

  async function promouvoir(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    requireGeneralAdmin(scope);
    try {
      await accorderNiveauGeneral(scope, String(formData.get("accountId")));
    } catch (e) {
      if (e instanceof AppError) redirect(`/comptes?erreur=${encodeURIComponent(e.message)}`);
      throw e;
    }
    redirect("/comptes?ok=2");
  }

  async function retrograder(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    requireGeneralAdmin(scope);
    try {
      await retirerNiveauGeneral(scope, String(formData.get("accountId")));
    } catch (e) {
      if (e instanceof AppError) redirect(`/comptes?erreur=${encodeURIComponent(e.message)}`);
      throw e;
    }
    redirect("/comptes?ok=3");
  }

  const confirmation =
    ok === "3" ? t.comptes.retire : ok === "2" ? t.comptes.promu : ok ? t.comptes.cree : null;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">{t.comptes.titre}</h1>
      <p className="mb-6 max-w-2xl text-sm text-neutral-500">
        <strong className="font-medium text-neutral-700">{t.comptes.niveaux}</strong> —{" "}
        {t.comptes.niveauxDetail}
      </p>

      {erreur && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {erreur}
        </p>
      )}
      {confirmation && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {confirmation}
        </p>
      )}

      <ul className="mb-8 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {comptes.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div>
              <p className="font-medium text-neutral-900">
                {c.firstName} {c.lastName}
              </p>
              <p className="text-sm text-neutral-500">{c.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                {c.role === "admin" ? t.commun.administrateur : t.commun.starter}
              </span>
              {c.generalAdmin && (
                <span className="rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-xs font-medium text-[var(--color-brand)]">
                  {t.commun.adminGeneral}
                </span>
              )}
              <span
                className={
                  c.status === "active"
                    ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                    : "rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
                }
              >
                {c.status === "active" ? t.commun.actif : t.commun.desactive}
              </span>
              {/* Accorder ET retirer se font ICI, depuis le parcours où la
                  personne est rattachée : c'est la condition du service, et
                  celle du cloisonnement (voir migration 0007). */}
              {scope.generalAdmin && c.status === "active" && !c.generalAdmin && (
                <form action={promouvoir}>
                  <input type="hidden" name="accountId" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700"
                  >
                    {t.comptes.promouvoir}
                  </button>
                </form>
              )}
              {scope.generalAdmin && c.generalAdmin && c.id !== scope.accountId && (
                <form action={retrograder}>
                  <input type="hidden" name="accountId" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700"
                  >
                    {t.comptes.retirer}
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>

      {scope.generalAdmin && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-neutral-900">{t.comptes.sectionGeneraux}</h2>
          {/* Liste de CONSULTATION, valable pour toute la plateforme : savoir
              qui détient ce niveau est une information qu'un administrateur
              général doit avoir sous les yeux, quel que soit le parcours où
              il se trouve. Les boutons, eux, sont plus haut — auprès des
              comptes de CE parcours. */}
          <p className="mb-3 text-sm text-neutral-500">{t.comptes.rosterDetail}</p>
          {generaux.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
              {t.comptes.aucunGeneral}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
              {generaux.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-neutral-900">
                      {g.firstName} {g.lastName}
                      {g.id === scope.accountId && (
                        <span className="ml-2 text-sm font-normal text-neutral-500">
                          {t.comptes.cestVous}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-neutral-500">{g.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <form
        action={creer}
        className="max-w-lg space-y-4 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <h2 className="font-medium text-neutral-900">{t.comptes.ajouter}</h2>
        <div className="grid grid-cols-2 gap-4">
          <input
            name="firstName"
            required
            placeholder={t.comptes.prenom}
            className="rounded-lg border border-neutral-300 px-3 py-2.5"
          />
          <input
            name="lastName"
            required
            placeholder={t.comptes.nom}
            className="rounded-lg border border-neutral-300 px-3 py-2.5"
          />
        </div>
        <input
          name="email"
          type="email"
          required
          placeholder={t.comptes.courriel}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
        />
        <input
          name="password"
          type="password"
          required
          minLength={12}
          placeholder={t.comptes.motDePasse}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
        />
        <select
          name="role"
          defaultValue="starter"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
        >
          <option value="starter">{t.commun.starter}</option>
          <option value="admin">{t.commun.administrateur}</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white"
        >
          {t.comptes.creer}
        </button>
      </form>
    </div>
  );
}
