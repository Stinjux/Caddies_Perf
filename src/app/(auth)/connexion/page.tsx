import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login } from "@/server/auth/current";
import { verifierSecondFacteur } from "@/server/auth/mfa";
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

  // Le cookie est pose dans les deux cas, mais une session en attente
  // n'authentifie rien : resolveSession la refuse tant que le code manque.
  if (resultat.secondFacteurRequis) redirect("/connexion?etape=code");

  // La racine oriente selon le role et le nombre de terrains rattaches.
  // Rediriger directement vers /terrains provoquerait une double redirection
  // visible pour un compte rattache a plusieurs terrains.
  redirect("/");
}

/** Deuxieme ecran : le mot de passe est verifie, le code ne l'est pas encore. */
async function verifierCode(formData: FormData) {
  "use server";
  const store = await cookies();
  const jeton = store.get(SESSION_COOKIE)?.value;
  if (!jeton) redirect("/connexion?erreur=Session%20expir%C3%A9e.");

  try {
    await verifierSecondFacteur(jeton, String(formData.get("code") ?? ""));
  } catch (e) {
    const message = e instanceof AppError ? e.message : "Code incorrect.";
    redirect(`/connexion?etape=code&erreur=${encodeURIComponent(message)}`);
  }

  redirect("/");
}

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; etape?: string }>;
}) {
  const { erreur, etape } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold text-[var(--color-brand)]">
          CaddiePerf
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-500">
          {etape === "code" ? "Vérification en deux étapes" : "Connexion"}
        </p>

        {erreur && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {erreur}
          </p>
        )}

        {etape === "code" ? (
          <form
            action={verifierCode}
            className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6"
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">
                Code de votre application d&apos;authentification
              </span>
              <input
                name="code"
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                /* Ni minLength ni pattern : un code de secours fait onze
                   caracteres et contient un tiret. Le serveur distingue les
                   deux formes — une contrainte de saisie enfermerait dehors
                   l'utilisateur qui a perdu son telephone. */
                className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-center font-mono text-xl tracking-widest"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--color-brand)] px-4 py-3 text-base font-medium text-white"
            >
              Vérifier
            </button>

            <p className="text-center text-xs text-neutral-500">
              Vous pouvez aussi saisir l&apos;un de vos codes de secours.
            </p>
          </form>
        ) : (
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
        )}
      </div>
    </div>
  );
}
