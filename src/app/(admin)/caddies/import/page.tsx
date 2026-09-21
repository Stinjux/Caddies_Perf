import Link from "next/link";
import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import {
  construireApercu,
  executerImport,
  COLONNES_SOURCE,
  COLONNES_REJETEES,
} from "@/server/services/caddie-import";
import { AppError } from "@/server/errors";
import { tAdmin } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/**
 * Import CSV des caddies (spéc. 2).
 *
 * L'aperçu montre CE QUI SERA IMPORTÉ et CE QUI SERA REJETÉ avant toute
 * écriture. Aucune importation partielle silencieuse : l'exécution se fait
 * en une transaction.
 */
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; crees?: string; remplaces?: string; ignores?: string }>;
}) {
  const { scope } = await requireScope();
  if (scope.role !== "admin") redirect("/");

  const { t } = await tAdmin();
  const { erreur, crees, remplaces, ignores } = await searchParams;

  async function importer(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    const { t } = await tAdmin();
    const fichier = formData.get("fichier");
    if (!(fichier instanceof File) || fichier.size === 0) {
      redirect("/caddies/import?erreur=" + encodeURIComponent(t.import.aucunFichier));
    }

    try {
      const bytes = new Uint8Array(await fichier.arrayBuffer());
      const apercu = await construireApercu(scope, {
        bytes,
        size: fichier.size,
        name: fichier.name,
      });

      const decisions = new Map(
        apercu.lignes
          .filter(
            (l) => l.statut === "doublon" && formData.get(`doublon-${l.numero}`) === "remplacer",
          )
          .map((l) => [l.numero, "remplacer" as const]),
      );

      const rapport = await executerImport(scope, apercu, decisions);
      redirect(
        `/caddies?crees=${rapport.crees}&remplaces=${rapport.remplaces}&ignores=${rapport.ignores}`,
      );
    } catch (e) {
      if (e instanceof AppError) {
        redirect("/caddies/import?erreur=" + encodeURIComponent(e.message));
      }
      throw e;
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/caddies" className="text-sm text-neutral-500">
        ← {t.caddies.titre}
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold text-neutral-900">{t.import.titre}</h1>

      {erreur && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {erreur}
        </p>
      )}
      {crees && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {t.import.bilan(crees, remplaces ?? "0", ignores ?? "0")}
        </p>
      )}

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-medium">{t.import.avertissementTitre}</p>
        <p className="mt-1">{t.import.avertissementDetail}</p>
        <p className="mt-2">{t.import.avertissementAge}</p>
      </div>

      <form
        action={importer}
        className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-800">{t.import.colonnesAttendues}</p>
          <ol className="list-inside list-decimal text-sm text-neutral-600">
            {/* Les index viennent du service, jamais recopies ici : quand le
                numero de caddie est passe en premiere case, cette liste avait
                garde les anciens et designait « age » et « anciennete » comme
                rejetees, alors qu'elles sont conservees. */}
            {COLONNES_SOURCE.map((c, i) => {
              const rejetee = (COLONNES_REJETEES as readonly number[]).includes(i);
              return (
                <li key={c} className={rejetee ? "text-amber-700" : ""}>
                  {c}
                  {rejetee && t.import.rejetee}
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-xs text-neutral-500">{t.import.detection}</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-neutral-800">
            {t.import.fichier}
          </span>
          <input
            type="file"
            name="fichier"
            accept=".csv,text/csv"
            required
            className="w-full text-sm"
          />
        </label>

        <button
          type="submit"
          className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white"
        >
          {t.import.bouton}
        </button>
      </form>
    </div>
  );
}
