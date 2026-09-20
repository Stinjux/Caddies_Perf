import Link from "next/link";
import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import { listCarts } from "@/server/services/cart";
import { getActiveCourse } from "@/server/repositories/golf-course";
import { qrDataUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

/**
 * PLANCHE D'ÉTIQUETTES À COLLER SUR LES VOITURETTES.
 *
 * Distincte de l'écran de gestion, et pour une raison précise : celui-ci
 * affiche les QR codes pour les CONSULTER, celle-ci les produit pour les
 * IMPRIMER. Une grille d'écran imprimée emporte le menu, l'en-tête, et coupe
 * les codes en deux au changement de page.
 *
 * Contraintes venues du terrain, pas de l'écran :
 *  - l'étiquette vit DEHORS, sur une voiturette, exposée au soleil et à la
 *    poussière. Le QR est produit en correction d'erreur élevée (voir
 *    src/lib/qr.ts) : il reste lisible même partiellement effacé ;
 *  - le NUMÉRO doit être lisible de loin, sans scanner : c'est par lui que le
 *    Starter associe la voiturette à une réservation ;
 *  - une étiquette perdue se réimprime à l'identique. Le jeton est PERMANENT :
 *    il survit à un entretien, à un changement de statut, à une réimpression.
 *
 * Les voiturettes réformées sont exclues d'office : imprimer une étiquette
 * pour une voiturette hors service gaspille une planche et sème le doute.
 */

export default async function EtiquettesPage({
  searchParams,
}: {
  searchParams: Promise<{ toutes?: string }>;
}) {
  const { scope } = await requireScope();
  if (scope.role !== "admin") redirect("/depart");

  const { toutes } = await searchParams;
  const terrain = await getActiveCourse(scope);
  const parc = await listCarts(scope);
  const voiturettes = toutes ? parc : parc.filter((v) => v.status !== "inactive");

  /**
   * Aucune valeur par défaut en production : une planche entière de QR codes
   * pointant vers localhost s'imprime, se colle, et ne révèle son inutilité
   * qu'au 18e trou, devant un client.
   */
  const base =
    process.env.PUBLIC_BASE_URL ??
    (process.env.NODE_ENV === "production" ? null : "http://localhost:3200");

  const codes = base
    ? new Map(
        await Promise.all(
          voiturettes.map(async (v) => [v.id, await qrDataUrl(base, v.qrToken)] as const),
        ),
      )
    : new Map<string, string>();

  return (
    <div>
      <style>{`
        /* L'écran garde le menu et les consignes ; le papier n'emporte que
           les étiquettes. Sans cela on imprime la navigation du site. */
        @media print {
          header, nav, .sans-impression { display: none !important; }
          body { background: #fff !important; }
          .etiquette {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px dashed #999 !important;
          }
        }
        @page { size: A4; margin: 10mm; }
      `}</style>

      <div className="sans-impression mb-6">
        <Link href="/voiturettes" className="text-sm text-neutral-500 underline">
          ← Retour aux voiturettes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Planche d&apos;étiquettes</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Imprimez cette page, découpez suivant les pointillés, collez une étiquette par voiturette.
          Le QR code est <strong>permanent</strong> : il survit à un entretien, à un changement de
          statut et à une réimpression. Une étiquette abîmée se remplace à l&apos;identique.
        </p>

        {!base && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Impression impossible : l&apos;adresse publique du site (<code>PUBLIC_BASE_URL</code>)
            n&apos;est pas configurée. Sans elle, les étiquettes ne mèneraient nulle part.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={toutes ? "/voiturettes/etiquettes" : "/voiturettes/etiquettes?toutes=1"}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700"
          >
            {toutes ? "Masquer les voiturettes réformées" : "Inclure les voiturettes réformées"}
          </Link>
          <span className="text-sm text-neutral-500">
            {voiturettes.length} étiquette{voiturettes.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {voiturettes.length === 0 ? (
        <p className="sans-impression rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">
          Aucune voiturette à étiqueter.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {voiturettes.map((v) => (
            <div
              key={v.id}
              className="etiquette flex flex-col items-center justify-center rounded-lg border border-neutral-300 bg-white p-4 text-center"
            >
              {base && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={codes.get(v.id)} alt="" className="w-full max-w-[150px]" />
              )}
              {/* Lisible de loin, sans scanner : c'est par ce numéro que le
                  Starter associe la voiturette à une réservation. */}
              <p className="mt-2 text-3xl font-bold tracking-tight text-black">{v.visibleNumber}</p>
              <p className="mt-1 text-[10px] leading-tight text-neutral-600">
                Scannez pour évaluer votre caddie
              </p>
              {terrain && <p className="mt-0.5 text-[9px] text-neutral-400">{terrain.name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
