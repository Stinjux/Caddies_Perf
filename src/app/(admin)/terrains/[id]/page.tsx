import Link from "next/link";
import { ALLOWED_LOGO_TYPES } from "@/server/services/logo-upload";

export const dynamic = "force-dynamic";

const TIMEZONES = [
  "Africa/Casablanca",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Berlin",
  "America/Montreal",
];

/**
 * Formulaire de creation et de modification d'un terrain (FR-003, FR-007).
 * L'action serveur sera branchee sur createCourse/updateCourse des que la
 * session portera une portee (phase 4, US2).
 */
export default async function TerrainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creation = id === "nouveau";

  return (
    <div className="max-w-2xl">
      <Link href="/terrains" className="text-sm text-neutral-500">
        ← Terrains
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-neutral-900">
        {creation ? "Nouveau terrain" : "Modifier le terrain"}
      </h1>

      <form className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6">
        <Field label="Nom du terrain" required hint="Obligatoire.">
          <input
            name="name"
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
            placeholder="Golf des Cèdres"
          />
        </Field>

        <Field label="Adresse">
          <input
            name="address"
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
            defaultValue="Africa/Casablanca"
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
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
              placeholder="#1b4d3e"
            />
          </Field>
          <Field label="Couleur secondaire">
            <input
              name="brandColorSecondary"
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
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
            placeholder="https://..."
          />
        </Field>

        <div className="flex gap-3 border-t border-neutral-200 pt-5">
          <button
            type="submit"
            disabled
            className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Enregistrer
          </button>
          <p className="self-center text-sm text-neutral-500">
            L&apos;enregistrement sera actif une fois la connexion des comptes en place.
          </p>
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
