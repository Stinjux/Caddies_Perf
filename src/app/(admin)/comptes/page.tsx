import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import { requireAdmin } from "@/server/scope";
import { listAccountsInScope } from "@/server/repositories/account";
import { createAccount } from "@/server/services/account";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * Gestion des comptes du terrain actif (FR-009, FR-018).
 * Le hache de mot de passe n'est jamais charge : la projection du depot
 * l'exclut a la source (FR-017).
 */
export default async function ComptesPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; ok?: string }>;
}) {
  const { scope } = await requireScope();
  // Un Starter est renvoye vers son espace plutot que de recevoir une erreur :
  // le refus reste total, mais lisible (FR-022).
  if (scope.role !== "admin") redirect("/terrains");

  const { erreur, ok } = await searchParams;
  const comptes = await listAccountsInScope(scope);

  async function creer(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
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
      const message = e instanceof AppError ? e.message : "Création impossible.";
      redirect(`/comptes?erreur=${encodeURIComponent(message)}`);
    }
    redirect("/comptes?ok=1");
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Comptes du terrain</h1>

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
          Compte créé.
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
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                {c.role === "admin" ? "Administrateur" : "Starter"}
              </span>
              <span
                className={
                  c.status === "active"
                    ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                    : "rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
                }
              >
                {c.status === "active" ? "Actif" : "Désactivé"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <form
        action={creer}
        className="max-w-lg space-y-4 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <h2 className="font-medium text-neutral-900">Ajouter un compte</h2>
        <div className="grid grid-cols-2 gap-4">
          <input
            name="firstName"
            required
            placeholder="Prénom"
            className="rounded-lg border border-neutral-300 px-3 py-2.5"
          />
          <input
            name="lastName"
            required
            placeholder="Nom"
            className="rounded-lg border border-neutral-300 px-3 py-2.5"
          />
        </div>
        <input
          name="email"
          type="email"
          required
          placeholder="Adresse de courriel"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
        />
        <input
          name="password"
          type="password"
          required
          minLength={12}
          placeholder="Mot de passe (12 caractères minimum)"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
        />
        <select
          name="role"
          defaultValue="starter"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
        >
          <option value="starter">Starter</option>
          <option value="admin">Administrateur</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white"
        >
          Créer le compte
        </button>
      </form>
    </div>
  );
}
