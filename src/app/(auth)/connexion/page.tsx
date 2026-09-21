import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login } from "@/server/auth/current";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

async function connexion(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  let resultat;
  try {
    resultat = await login(email, password);
  } catch (e) {
    const message = e instanceof AppError ? e.message : "Connexion impossible.";
    redirect(`/connexion?erreur=${encodeURIComponent(message)}`);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, resultat.token, sessionCookieOptions);

  // La racine oriente selon le role et le nombre de terrains rattaches.
  // Rediriger directement vers /terrains provoquerait une double redirection
  // visible pour un compte rattache a plusieurs terrains.
  redirect("/");
}

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold text-[var(--color-brand)]">
          CaddiePerf
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-500">Connexion</p>

        {erreur && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {erreur}
          </p>
        )}

                  <form
            action={connexion}
            className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6"
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">
                Adresse de courriel
              </span>
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">
                Mot de passe
              </span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--color-brand)] px-4 py-3 text-base font-medium text-white"
            >
              Se connecter
            </button>
          </form>
      </div>
    </div>
  );
}
