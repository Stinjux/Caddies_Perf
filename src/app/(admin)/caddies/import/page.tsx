import Link from "next/link";
import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import { construireApercu, executerImport, COLONNES_SOURCE } from "@/server/services/caddie-import";
import { AppError } from "@/server/errors";

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
  if (scope.role !== "admin") redirect("/depart");

  const { erreur, crees, remplaces, ignores } = await searchParams;

  async function importer(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    const fichier = formData.get("fichier");
    if (!(fichier instanceof File) || fichier.size === 0) {
      redirect("/caddies/import?erreur=" + encodeURIComponent("Aucun fichier sélectionné."));
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
        ← Caddies
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold text-neutral-900">Importer des caddies</h1>

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
          {crees} caddie(s) créé(s), {remplaces} remplacé(s), {ignores} ignoré(s).
        </p>
      )}

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-medium">Trois colonnes ne seront jamais conservées</p>
        <p className="mt-1">
          La <strong>taille d&apos;habits</strong>, la <strong>force</strong> et l&apos;
          <strong>adresse du domicile</strong> sont lues puis rejetées. Elles ne peuvent pas être
          stockées : la base n&apos;a aucune colonne pour les recevoir.
        </p>
        <p className="mt-2">
          L&apos;<strong>âge</strong> est converti en année de naissance et rangé dans un espace
          séparé, accessible aux seuls administrateurs.
        </p>
      </div>

      <form
        action={importer}
        className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-800">
            Colonnes attendues, dans cet ordre
          </p>
          <ol className="list-inside list-decimal text-sm text-neutral-600">
            {COLONNES_SOURCE.map((c, i) => (
              <li key={c} className={[3, 5, 6].includes(i) ? "text-amber-700" : ""}>
                {c}
                {[3, 5, 6].includes(i) && " — rejetée"}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-neutral-500">
            L&apos;encodage et le séparateur sont détectés automatiquement. La ligne d&apos;en-tête
            est reconnue si elle est présente.
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-neutral-800">Fichier CSV</span>
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
          Importer
        </button>
      </form>
    </div>
  );
}
