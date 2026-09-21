import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import { getActiveCourse } from "@/server/repositories/golf-course";
import { qrDataUrl, urlEvaluation } from "@/lib/qr";
import { tAdmin } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/**
 * L'AFFICHE DU DÉPART — un seul QR code pour tout le parcours.
 *
 * Il remplace les étiquettes par voiturette. Le client le scanne au 18e trou,
 * puis choisit son caddie dans une liste : il n'y a donc plus rien à coller,
 * rien à associer, rien à réimprimer quand une voiturette part en entretien.
 *
 * Le jeton est PERMANENT : la même affiche vaut d'une saison à l'autre.
 *
 * L'affiche vit DEHORS. Le QR est produit en correction d'erreur élevée (voir
 * src/lib/qr.ts) : il reste lisible partiellement effacé ou mouillé.
 */
export default async function QrPage() {
  const { scope } = await requireScope();
  if (scope.role !== "admin") redirect("/");

  const { t } = await tAdmin();
  const parcours = await getActiveCourse(scope);
  if (!parcours) redirect("/parcours");

  /**
   * Aucune valeur par défaut en production : une affiche pointant vers
   * localhost s'imprime, se pose au départ, et ne révèle son inutilité qu'au
   * premier client qui la scanne.
   */
  const base =
    process.env.PUBLIC_BASE_URL ??
    (process.env.NODE_ENV === "production" ? null : "http://localhost:3200");

  const image = base ? await qrDataUrl(base, parcours.qrToken) : null;
  const adresse = base ? urlEvaluation(base, parcours.qrToken) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <style>{`
        @media print {
          header, nav, .sans-impression { display: none !important; }
          body { background: #fff !important; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      <div className="sans-impression mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">{t.qr.titre}</h1>
        <p className="mt-2 text-sm text-neutral-600">{t.qr.explication}</p>

        {!base && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {t.qr.manqueUrl}
          </p>
        )}
      </div>

      {image && (
        <div className="rounded-xl border border-neutral-300 bg-white p-10 text-center">
          <p className="text-sm tracking-widest text-neutral-500 uppercase">{parcours.name}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="mx-auto my-8 w-full max-w-[360px]" />
          <p className="text-2xl font-semibold text-neutral-900">{t.qr.evaluez}</p>
          <p className="mt-2 text-base text-neutral-600">{t.qr.scannez}</p>
          <p className="sans-impression mt-6 font-mono text-xs break-all text-neutral-400">
            {adresse}
          </p>
        </div>
      )}
    </div>
  );
}
