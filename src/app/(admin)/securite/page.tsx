import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireScope } from "@/server/auth/context";
import {
  preparerInscription,
  confirmerInscription,
  secondFacteurActif,
  codesDeSecoursRestants,
} from "@/server/auth/mfa";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * INSCRIPTION AU SECOND FACTEUR.
 *
 * Trois états, un seul écran :
 *  - déjà inscrit : nombre de codes de secours restants ;
 *  - inscription en cours : secret et QR code ;
 *  - confirmée à l'instant : les codes de secours, affichés UNE FOIS.
 *
 * LES CODES NE PASSENT PAS PAR L'ADRESSE. Une chaîne dans l'URL finit dans
 * les journaux du serveur, dans l'historique du navigateur et dans l'en-tête
 * Referer. Ils transitent donc par un cookie httpOnly, effacé dès l'affichage.
 *
 * Le secret, lui, est relu depuis la base à chaque rendu : ni adresse, ni
 * champ caché, où il serait modifiable.
 */

const COOKIE_CODES = "caddieperf_codes_secours";

export default async function SecuritePage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { ctx, scope } = await requireScope();
  if (scope.role !== "admin") redirect("/");

  const { erreur } = await searchParams;
  const store = await cookies();

  /**
   * Le cookie n'est PAS effacé ici : modifier un cookie pendant le rendu d'un
   * composant serveur est interdit par Next.js et fait échouer la page. Or
   * l'inscription, elle, a déjà réussi — l'utilisateur se retrouverait inscrit
   * sans avoir jamais vu ses codes de secours. Il les efface lui-même, en
   * confirmant qu'il les a notés ; à défaut, le cookie expire en dix minutes.
   */
  /** Efface les codes de l'ecran. Une action serveur PEUT toucher aux cookies. */
  async function oublierCodes() {
    "use server";
    // LE CHEMIN DOIT ETRE REPETE. Le cookie est pose sur « /securite » ;
    // delete(nom) vise celui de « / », qui n'existe pas — la suppression ne
    // ferait rien, et les codes resteraient affiches dix minutes durant.
    (await cookies()).delete({ name: COOKIE_CODES, path: "/securite" });
    redirect("/terrains");
  }

  const actif = await secondFacteurActif(ctx.accountId);

  /**
   * L'ETAT DU COMPTE PRIME SUR LE COOKIE. Un cookie resté d'un essai
   * précédent afficherait sinon des codes périmés — et, pire, masquerait
   * l'écran d'inscription à un administrateur qui n'est pas encore inscrit.
   */
  const codesFraichementRemis = actif ? store.get(COOKIE_CODES)?.value : undefined;
  if (codesFraichementRemis) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Second facteur en place</h1>
        <p className="mb-6 text-neutral-600">
          Notez ces huit codes de secours et rangez-les ailleurs que dans votre téléphone. Ils sont
          votre seule issue si vous le perdez. <strong>Ils ne seront plus jamais affichés.</strong>
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-white p-6 font-mono text-base">
          {codesFraichementRemis.split(",").map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <form action={oublierCodes}>
          <button type="submit" className="mt-6 text-sm text-neutral-600 underline">
            J&apos;ai noté mes codes — continuer
          </button>
        </form>
      </div>
    );
  }

  if (actif) {
    const restants = await codesDeSecoursRestants(ctx.accountId);
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Sécurité du compte</h1>
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-700">
          La vérification en deux étapes est active sur votre compte.
          <br />
          <span className="text-sm text-neutral-500">
            {restants} code{restants > 1 ? "s" : ""} de secours encore utilisable
            {restants > 1 ? "s" : ""}.
          </span>
        </p>
      </div>
    );
  }

  async function confirmer(formData: FormData) {
    "use server";
    const { ctx: courant } = await requireScope();

    let remis: string[];
    try {
      remis = await confirmerInscription(courant.accountId, String(formData.get("code") ?? ""));
    } catch (e) {
      const message = e instanceof AppError ? e.message : "Inscription impossible.";
      redirect(`/securite?erreur=${encodeURIComponent(message)}`);
    }

    const boite = await cookies();
    boite.set(COOKIE_CODES, remis.join(","), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/securite",
      maxAge: 600,
    });
    redirect("/securite");
  }

  const { secret, uri } = await preparerInscription(ctx.accountId);
  const image = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">Vérification en deux étapes</h1>
      <p className="mb-6 text-neutral-600">
        Obligatoire pour les administrateurs : votre compte donne accès aux noms des caddies et à
        leurs évaluations.
      </p>

      {erreur && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {erreur}
        </p>
      )}

      <div className="space-y-6 rounded-xl border border-neutral-200 bg-white p-6">
        <div>
          <p className="mb-3 text-sm font-medium text-neutral-800">
            1. Scannez ce code avec votre application d&apos;authentification
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Code à scanner" width={240} height={240} />
          <p className="mt-3 text-xs text-neutral-500">
            Impossible de scanner ? Saisissez cette clé à la main :
            <br />
            <span className="font-mono text-sm text-neutral-800">{secret}</span>
          </p>
        </div>

        <form action={confirmer} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-800">
              2. Saisissez le code affiché par l&apos;application
            </span>
            <input
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-center font-mono text-xl tracking-widest"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--color-brand)] px-4 py-3 text-base font-medium text-white"
          >
            Activer la vérification en deux étapes
          </button>
        </form>
      </div>
    </div>
  );
}
