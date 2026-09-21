import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  LANGUES_ADMIN,
  COOKIE_LANGUE,
  textesAdmin,
  type LangueAdmin,
} from "@/lib/i18n/admin/commun";

/**
 * Choix de la langue de l'interface.
 *
 * Un formulaire, pas un script : l'interface d'administration fonctionne sans
 * JavaScript client, comme le parcours joueur. Le temoin est relu au rendu
 * suivant et toute la page change de langue d'un coup.
 */
export async function LanguageSwitcher({ langue }: { langue: LangueAdmin }) {
  const t = textesAdmin(langue);

  async function changer(formData: FormData) {
    "use server";
    const choisie = String(formData.get("langue"));
    const valide = (LANGUES_ADMIN as readonly string[]).includes(choisie)
      ? (choisie as LangueAdmin)
      : "fr";

    (await cookies()).set(COOKIE_LANGUE, valide, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    revalidatePath("/", "layout");
  }

  return (
    <form action={changer} className="flex items-center gap-1">
      <label htmlFor="langue" className="sr-only">
        {t.langue.label}
      </label>
      <select
        id="langue"
        name="langue"
        defaultValue={langue}
        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
      >
        {LANGUES_ADMIN.map((l) => (
          <option key={l} value={l}>
            {textesAdmin(l).langue[l]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-700"
      >
        OK
      </button>
    </form>
  );
}
