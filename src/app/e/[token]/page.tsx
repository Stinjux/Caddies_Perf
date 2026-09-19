import { redirect } from "next/navigation";
import { resoudreJeton } from "@/server/services/qr-resolution";
import {
  soumettreEvaluation,
  signalerMauvaisCaddie,
  enregistrerClicGoogle,
  compterEvaluations,
  MAX_REPONSES_PAR_AFFECTATION,
  CRITERES,
  type Critere,
  type PricePerception,
} from "@/server/services/evaluation";
import { resoudreLangue, direction, NOMS_LANGUES, LANGUES_DISPONIBLES } from "@/lib/i18n";
import { messages } from "@/lib/i18n/fr";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * PARCOURS CLIENT (spéc. 4) — du scan du QR à l'envoi.
 *
 * Aucun compte, aucune application à télécharger, moins de 30 secondes.
 *
 * Écrit SANS JavaScript client : des formulaires et des liens. Sur une
 * connexion mobile faible, au 18e trou, une page qui s'affiche vaut mieux
 * qu'une page qui attend un paquet.
 *
 * ANONYME : aucune donnée identifiante n'est demandée ni enregistrée.
 */

type Etape = "accueil" | "questions" | "merci" | "termine" | "mauvais";

export default async function EvaluationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string; etape?: string; ev?: string; erreur?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const langue = resoudreLangue(sp.lang);
  const t = messages(langue);
  const dir = direction(langue);
  const etape = (sp.etape ?? "accueil") as Etape;

  const r = await resoudreJeton(token);

  if (!r.ok) {
    return (
      <Cadre dir={dir}>
        <p className="text-lg text-neutral-800">{t.echecs[r.raison]}</p>
      </Cadre>
    );
  }

  const accent = r.brandColorPrimary ?? "#1b4d3e";

  if (etape === "mauvais") {
    return (
      <Cadre dir={dir} accent={accent} titre={r.courseName}>
        <p className="text-lg text-neutral-800">{t.mauvaisCaddieMerci}</p>
      </Cadre>
    );
  }

  if (etape === "termine") {
    return (
      <Cadre dir={dir} accent={accent} titre={r.courseName}>
        <p className="text-lg text-neutral-800">{t.termine}</p>
      </Cadre>
    );
  }

  if (etape === "merci") {
    async function clicGoogle() {
      "use server";
      if (!r.ok) return;
      await enregistrerClicGoogle(r.golfCourseId, sp.ev ?? null);
      redirect(r.googleReviewUrl ?? `/e/${token}?etape=termine&lang=${langue}`);
    }

    return (
      <Cadre dir={dir} accent={accent} titre={r.courseName}>
        <h2 className="text-2xl font-bold text-neutral-900">{t.merci}</h2>
        <p className="mt-2 text-base text-neutral-700">{t.merciDetail}</p>

        <p className="mt-8 text-lg font-medium text-neutral-900">{t.partagerGoogle}</p>
        <div className="mt-4 space-y-3">
          {r.googleReviewUrl && (
            <form action={clicGoogle}>
              <button
                type="submit"
                className="w-full rounded-xl px-5 py-4 text-lg font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {t.boutonGoogle}
              </button>
            </form>
          )}
          <a
            href={`/e/${token}?etape=termine&lang=${langue}`}
            className="block w-full rounded-xl border-2 border-neutral-400 px-5 py-4 text-center text-lg font-medium text-neutral-800"
          >
            {t.terminer}
          </a>
        </div>
      </Cadre>
    );
  }

  const deja = await compterEvaluations(r.assignmentId);
  if (deja >= MAX_REPONSES_PAR_AFFECTATION) {
    return (
      <Cadre dir={dir} accent={accent} titre={r.courseName}>
        <p className="text-lg text-neutral-800">{t.dejaEvalue}</p>
      </Cadre>
    );
  }

  if (etape === "accueil") {
    async function pasMonCaddie() {
      "use server";
      if (!r.ok) return;
      await signalerMauvaisCaddie(r.assignmentId);
      redirect(`/e/${token}?etape=mauvais&lang=${langue}`);
    }

    return (
      <Cadre dir={dir} accent={accent} titre={r.courseName}>
        {LANGUES_DISPONIBLES.length > 1 && (
          <div className="mb-6">
            <p className="mb-2 text-sm text-neutral-600">{t.choisirLangue}</p>
            <div className="flex flex-wrap gap-2">
              {LANGUES_DISPONIBLES.map((l) => (
                <a
                  key={l}
                  href={`/e/${token}?lang=${l}`}
                  className={`rounded-lg border-2 px-4 py-2 text-base ${
                    l === langue ? "border-neutral-900 font-bold" : "border-neutral-300"
                  }`}
                >
                  {NOMS_LANGUES[l]}
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-neutral-500">{t.moinsDe30Secondes}</p>
        <h2 className="mt-2 text-2xl font-bold text-neutral-900">
          {t.bonCaddie(r.caddieFirstName)}
        </h2>

        <div className="mt-8 space-y-3">
          <a
            href={`/e/${token}?etape=questions&lang=${langue}`}
            className="block w-full rounded-xl px-5 py-5 text-center text-xl font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {t.oui}
          </a>
          <form action={pasMonCaddie}>
            <button
              type="submit"
              className="w-full rounded-xl border-2 border-neutral-400 px-5 py-4 text-base font-medium text-neutral-800"
            >
              {t.nonPasMonCaddie}
            </button>
          </form>
        </div>
      </Cadre>
    );
  }

  // --- Questionnaire ---
  async function envoyer(formData: FormData) {
    "use server";
    if (!r.ok) return;

    const lire = (nom: string): number | null => {
      const v = String(formData.get(nom) ?? "");
      if (v === "" || v === "na") return null;
      const n = Number(v);
      return Number.isInteger(n) ? n : null;
    };

    const notes: Partial<Record<Critere, number | null>> = {};
    for (const c of CRITERES) notes[c] = lire(c);

    const prix = String(formData.get("perceptionPrix") ?? "");

    let id: string;
    try {
      id = await soumettreEvaluation({
        assignmentId: r.assignmentId,
        langue,
        notes,
        commentaire: String(formData.get("commentaire") ?? ""),
        noteParcours: lire("noteParcours"),
        rapportQualitePrix: lire("rapportQualitePrix"),
        perceptionPrix: prix ? (prix as PricePerception) : null,
      });
    } catch (e) {
      const m = e instanceof AppError ? e.message : "Envoi impossible.";
      redirect(`/e/${token}?etape=questions&lang=${langue}&erreur=${encodeURIComponent(m)}`);
    }

    redirect(`/e/${token}?etape=merci&lang=${langue}&ev=${id}`);
  }

  return (
    <Cadre dir={dir} accent={accent} titre={r.courseName}>
      {sp.erreur && (
        <p
          role="alert"
          className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-base text-red-900"
        >
          {sp.erreur}
        </p>
      )}

      <form
        action={envoyer}
        // Le navigateur restaure les valeurs d'un formulaire identique deja
        // rempli. Un client qui revient en arriere, ou qui rescanne la meme
        // voiturette, verrait ses anciennes reponses pre-cochees — et une
        // note pre-cochee biaise l'evaluation.
        autoComplete="off"
        className="space-y-8"
      >
        <section>
          <h2 className="mb-4 text-xl font-bold text-neutral-900">{t.titreCriteres}</h2>
          <div className="space-y-6">
            {CRITERES.map((c) => (
              <Etoiles key={c} nom={c} libelle={t.criteres[c]} t={t} accent={accent} />
            ))}
          </div>
        </section>

        <section className="border-t-2 border-neutral-200 pt-6">
          <Etoiles nom="noteParcours" libelle={t.titreParcours} t={t} accent={accent} />
        </section>

        <section className="border-t-2 border-neutral-200 pt-6 space-y-6">
          <Etoiles
            nom="rapportQualitePrix"
            libelle={t.titrePrixQualite(r.priceMad)}
            t={t}
            accent={accent}
          />
          <fieldset>
            <legend className="mb-2 text-base font-medium text-neutral-900">
              {t.titrePrixNiveau(r.priceMad)}
            </legend>
            <div className="space-y-2">
              {(Object.keys(t.prix) as (keyof typeof t.prix)[]).map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-3 rounded-lg border-2 border-neutral-300 px-4 py-3"
                >
                  <input type="radio" name="perceptionPrix" value={k} className="h-5 w-5" />
                  <span className="text-base">{t.prix[k]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="border-t-2 border-neutral-200 pt-6">
          <label className="block">
            <span className="block text-base font-medium text-neutral-900">
              {t.titreCommentaire}
            </span>
            <span className="mb-2 block text-sm text-neutral-500">{t.commentaireFacultatif}</span>
            <textarea
              name="commentaire"
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border-2 border-neutral-300 px-3 py-3 text-base"
            />
          </label>
        </section>

        <button
          type="submit"
          className="w-full rounded-xl px-5 py-5 text-xl font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          {t.envoyer}
        </button>
      </form>
    </Cadre>
  );
}

/** Une note de 1 à 5, plus « non applicable » — exclu des moyennes. */
function Etoiles({
  nom,
  libelle,
  t,
  accent,
}: {
  nom: string;
  libelle: string;
  t: ReturnType<typeof messages>;
  accent: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-base font-medium text-neutral-900">{libelle}</legend>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="flex min-w-14 flex-1 cursor-pointer flex-col items-center rounded-lg border-2 border-neutral-300 px-2 py-3 has-checked:border-neutral-900"
            title={t.etoiles[n as 1 | 2 | 3 | 4 | 5]}
          >
            <input type="radio" name={nom} value={n} className="sr-only" />
            <span className="text-2xl" style={{ color: accent }}>
              ★
            </span>
            <span className="text-xs text-neutral-600">{n}</span>
          </label>
        ))}
        <label className="flex cursor-pointer items-center rounded-lg border-2 border-neutral-300 px-3 py-3 has-checked:border-neutral-900">
          <input type="radio" name={nom} value="na" className="sr-only" />
          <span className="text-sm text-neutral-600">{t.nonApplicable}</span>
        </label>
      </div>
    </fieldset>
  );
}

function Cadre({
  children,
  dir,
  accent,
  titre,
}: {
  children: React.ReactNode;
  dir: "rtl" | "ltr";
  accent?: string;
  titre?: string;
}) {
  return (
    <div dir={dir} className="min-h-dvh bg-white">
      <div className="mx-auto max-w-lg px-5 py-8">
        {titre && (
          <p className="mb-6 text-sm font-medium" style={{ color: accent }}>
            {titre}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
