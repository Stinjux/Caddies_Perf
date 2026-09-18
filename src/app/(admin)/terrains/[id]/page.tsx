import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth/context";
import { createCourse, updateCourse } from "@/server/services/golf-course";
import { findCourseInScope } from "@/server/repositories/golf-course";
import { roleOnCourse } from "@/server/repositories/account";
import { ALLOWED_LOGO_TYPES } from "@/server/services/logo-upload";
import { createScopeFromVerifiedSession } from "@/server/scope";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

const TIMEZONES = [
  "Africa/Casablanca",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Berlin",
  "America/Montreal",
];

function read(formData: FormData) {
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length > 0 ? v : null;
  };
  return {
    name: String(formData.get("name") ?? ""),
    address: str("address"),
    timezone: String(formData.get("timezone") ?? ""),
    brandColorPrimary: str("brandColorPrimary"),
    brandColorSecondary: str("brandColorSecondary"),
    googleReviewUrl: str("googleReviewUrl"),
  };
}

export default async function TerrainPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { id } = await params;
  const { erreur } = await searchParams;
  const ctx = await currentSession();
  if (!ctx) redirect("/connexion");

  const creation = id === "nouveau";

  // Le formulaire d'un terrain existant exige d'etre administrateur SUR CE
  // terrain, jamais un role global (FR-021).
  let existing = null;
  if (!creation) {
    const role = await roleOnCourse(ctx.accountId, id);
    if (role !== "admin") redirect("/terrains");
    const scope = createScopeFromVerifiedSession({
      accountId: ctx.accountId,
      golfCourseId: id,
      role,
    });
    existing = await findCourseInScope(scope, id);
    if (!existing) redirect("/terrains");
  }

  async function enregistrer(formData: FormData) {
    "use server";
    const ctx = await currentSession();
    if (!ctx) redirect("/connexion");
    const input = read(formData);
    const target = String(formData.get("courseId") ?? "");

    try {
      if (target === "nouveau") {
        const newId = await createCourse(ctx.accountId, input);
        redirect(`/terrains/${newId}`);
      } else {
        const role = await roleOnCourse(ctx.accountId, target);
        if (role !== "admin") redirect("/terrains");
        const scope = createScopeFromVerifiedSession({
          accountId: ctx.accountId,
          golfCourseId: target,
          role,
        });
        await updateCourse(scope, input, Number(formData.get("version") ?? 1));
      }
    } catch (e) {
      if (e instanceof AppError) {
        redirect(`/terrains/${target}?erreur=${encodeURIComponent(e.message)}`);
      }
      throw e;
    }
    redirect("/terrains");
  }

  return (
    <div className="max-w-2xl">
      <Link href="/terrains" className="text-sm text-neutral-500">
        ← Terrains
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-neutral-900">
        {creation ? "Nouveau terrain" : existing?.name}
      </h1>

      {erreur && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {erreur}
        </p>
      )}

      <form
        action={enregistrer}
        className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <input type="hidden" name="courseId" value={creation ? "nouveau" : id} />
        <input type="hidden" name="version" value={existing?.version ?? 1} />

        <Field label="Nom du terrain" required hint="Obligatoire.">
          <input
            name="name"
            required
            defaultValue={existing?.name ?? ""}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
            placeholder="Golf des Cèdres"
          />
        </Field>

        <Field label="Adresse">
          <input
            name="address"
            defaultValue={existing?.address ?? ""}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
          />
        </Field>

        <Field
          label="Fuseau horaire"
          required
          hint="Toutes les dates du terrain s'affichent dans ce fuseau, jamais celui du lecteur."
        >
          <select
            name="timezone"
            required
            defaultValue={existing?.timezone ?? "Africa/Casablanca"}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Couleur principale">
            <input
              name="brandColorPrimary"
              defaultValue={existing?.brandColorPrimary ?? ""}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
              placeholder="#1b4d3e"
            />
          </Field>
          <Field label="Couleur secondaire">
            <input
              name="brandColorSecondary"
              defaultValue={existing?.brandColorSecondary ?? ""}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
              placeholder="#d4af37"
            />
          </Field>
        </div>

        <Field
          label="Logo"
          hint={`Formats acceptés : ${ALLOWED_LOGO_TYPES.join(", ")}. 512 Ko maximum.`}
        >
          <input
            type="file"
            name="logo"
            accept={ALLOWED_LOGO_TYPES.join(",")}
            className="w-full text-sm"
          />
        </Field>

        <Field label="Lien Google Reviews" hint="Adresse https propre à ce terrain.">
          <input
            name="googleReviewUrl"
            defaultValue={existing?.googleReviewUrl ?? ""}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
            placeholder="https://..."
          />
        </Field>

        <div className="border-t border-neutral-200 pt-5">
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-800">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}
