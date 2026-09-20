import Link from "next/link";
import { redirect } from "next/navigation";
import { requireScope } from "@/server/auth/context";
import { listCarts, createCart } from "@/server/services/cart";
import { qrDataUrl } from "@/lib/qr";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

const LIBELLES = {
  available: "Disponible",
  assigned: "Affectée",
  maintenance: "Entretien",
  inactive: "Inactive",
} as const;

export default async function VoiturettesPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; imprimer?: string }>;
}) {
  const { scope } = await requireScope();
  if (scope.role !== "admin") redirect("/depart");

  const { erreur, imprimer } = await searchParams;
  const voiturettes = await listCarts(scope);
  /**
   * ADRESSE ENCODEE DANS LES QR CODES.
   *
   * En production, PAS DE VALEUR PAR DEFAUT. Se rabattre sur localhost
   * produirait des etiquettes muettes : elles s'impriment, se collent, et ne
   * revelent leur inutilite qu'au 18e trou, devant un client. Mieux vaut
   * refuser d'afficher un QR code que d'en imprimer cent faux.
   */
  const base =
    process.env.PUBLIC_BASE_URL ??
    (process.env.NODE_ENV === "production" ? null : "http://localhost:3200");

  // Les QR ne sont rendus qu'à la demande : 100 images ralentiraient la liste.
  const qrs =
    imprimer && base
      ? await Promise.all(
          voiturettes.map(async (v) => [v.id, await qrDataUrl(base, v.qrToken)] as const),
        )
      : [];
  const parId = new Map(qrs);

  async function ajouter(formData: FormData) {
    "use server";
    const { scope } = await requireScope();
    try {
      await createCart(scope, String(formData.get("visibleNumber") ?? ""));
    } catch (e) {
      const m = e instanceof AppError ? e.message : "Création impossible.";
      redirect("/voiturettes?erreur=" + encodeURIComponent(m));
    }
    redirect("/voiturettes");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Voiturettes</h1>
        <div className="flex flex-wrap gap-2">
          <a
            href={imprimer ? "/voiturettes" : "/voiturettes?imprimer=1"}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-700"
          >
            {imprimer ? "Masquer les QR codes" : "Afficher les QR codes"}
          </a>
          <Link
            href="/voiturettes/etiquettes"
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white"
          >
            Planche d&apos;étiquettes
          </Link>
        </div>
      </div>

      {erreur && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {erreur}
        </p>
      )}

      {imprimer && !base && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          Les QR codes ne peuvent pas être produits : l&apos;adresse publique du site (
          <code>PUBLIC_BASE_URL</code>) n&apos;est pas configurée. Les imprimer sans elle donnerait
          des étiquettes qui ne mènent nulle part.
        </p>
      )}

      {imprimer && base && (
        <p className="mb-4 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
          Chaque QR code est <strong>permanent</strong> : il reste valable après un entretien ou un
          changement de statut. Il ne contient qu&apos;un identifiant opaque — ni nom, ni numéro de
          réservation, ni donnée personnelle.
        </p>
      )}

      {voiturettes.length === 0 ? (
        <p className="mb-8 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">
          Aucune voiturette enregistrée.
        </p>
      ) : (
        <ul
          className={
            imprimer
              ? "mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3"
              : "mb-8 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white"
          }
        >
          {voiturettes.map((v) => (
            <li
              key={v.id}
              className={
                imprimer
                  ? "rounded-xl border border-neutral-200 bg-white p-4 text-center"
                  : "flex items-center justify-between px-5 py-4"
              }
            >
              {imprimer ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={parId.get(v.id)} alt="" className="mx-auto w-full max-w-[180px]" />
                  <p className="mt-2 text-lg font-bold text-neutral-900">N° {v.visibleNumber}</p>
                </>
              ) : (
                <>
                  <span className="font-medium text-neutral-900">N° {v.visibleNumber}</span>
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                    {LIBELLES[v.status]}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        action={ajouter}
        className="flex max-w-md items-end gap-3 rounded-xl border border-neutral-200 bg-white p-6"
      >
        <label className="flex-1">
          <span className="mb-1.5 block text-sm font-medium text-neutral-800">Numéro visible</span>
          <input
            name="visibleNumber"
            required
            placeholder="12"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white"
        >
          Ajouter
        </button>
      </form>
    </div>
  );
}
