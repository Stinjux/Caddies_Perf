import { Fragment } from "react";
import { redirect } from "next/navigation";
import { resoudreJeton } from "@/server/services/qr-resolution";
import {
  soumettreEvaluation,
  signalerMauvaisCaddie,
  enregistrerClicGoogle,
  compterEvaluations,
  MAX_REPONSES_PAR_AFFECTATION,
  CRITERES,
} from "@/server/services/evaluation";
import {
  lireFormulaire,
  encoder,
  decoder,
  champsManquants,
  prixManquant,
  premierEcranIncomplet,
  versSoumission,
  CHAMPS_NOTES,
  type Reponses,
  type ChampNote,
} from "@/server/services/reponses";
import { resoudreLangue, direction, NOMS_LANGUES, LANGUES_DISPONIBLES } from "@/lib/i18n";
import { messages } from "@/lib/i18n/fr";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * PARCOURS CLIENT (spéc. 4).
 *
 * Aucun compte, aucune application, moins de 30 secondes.
 *
 * SANS JAVASCRIPT CLIENT. Au 18e trou, sur un réseau faible, une page qui
 * s'affiche vaut mieux qu'une page qui attend un paquet.
 *  - Les étoiles se remplissent en CSS : radios en ordre DOM inversé et
 *    `:checked ~ label`. Le miroir arabe est automatique.
 *  - Les cinq écrans sont révélés en CSS par des radios HORS du formulaire,
 *    donc jamais envoyés. Zéro attente réseau entre les écrans.
 *
 * TOUTES LES NOTES SONT OBLIGATOIRES, le commentaire jamais. L'obligation
 * vit côté serveur : un `required` sur un champ masqué bloquerait l'envoi en
 * silence. En cas d'oubli, les réponses déjà données sont préservées et
 * l'écran incomplet est rouvert.
 *
 * ANONYME : aucune donnée identifiante n'est demandée ni enregistrée.
 */

type Etape = "accueil" | "questions" | "merci" | "termine" | "mauvais";

const ECRANS: ChampNote[][] = [
  [CHAMPS_NOTES[0], CHAMPS_NOTES[1]],
  [CHAMPS_NOTES[2], CHAMPS_NOTES[3]],
  [CHAMPS_NOTES[4], CHAMPS_NOTES[5]],
  [CHAMPS_NOTES[6], CHAMPS_NOTES[7]],
];
const ROMAINS = ["I", "II", "III", "IV", "V"];

export default async function EvaluationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    lang?: string;
    etape?: string;
    ev?: string;
    erreur?: string;
    v?: string;
    ecran?: string;
  }>;
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
      <Page dir={dir}>
        <p className="mention">{t.echecs[r.raison]}</p>
      </Page>
    );
  }

  const accent = r.brandColorPrimary ?? "#1b4d3e";

  if (etape === "mauvais") {
    return (
      <Page dir={dir} accent={accent} terrain={r.courseName}>
        <h1 className="titre">{t.mauvaisCaddieMerci}</h1>
      </Page>
    );
  }

  if (etape === "termine") {
    return (
      <Page dir={dir} accent={accent} terrain={r.courseName}>
        <h1 className="titre">{t.termine}</h1>
      </Page>
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
      <Page dir={dir} accent={accent} terrain={r.courseName}>
        <h1 className="titre titre--grand">{t.merci}</h1>
        <p className="mention" style={{ marginBlockStart: "1rem" }}>
          {t.merciDetail}
        </p>

        <hr className="filet" style={{ marginBlock: "2.5rem" }} />

        <h2 className="titre" style={{ fontSize: "1.25rem" }}>
          {t.partagerGoogle}
        </h2>

        <div className="actions">
          {r.googleReviewUrl && (
            <form action={clicGoogle}>
              <button type="submit" className="bouton">
                {t.boutonGoogle}
              </button>
            </form>
          )}
          <a className="bouton bouton--fantome" href={`/e/${token}?etape=termine&lang=${langue}`}>
            {t.terminer}
          </a>
        </div>
      </Page>
    );
  }

  const deja = await compterEvaluations(r.assignmentId);
  if (deja >= MAX_REPONSES_PAR_AFFECTATION) {
    return (
      <Page dir={dir} accent={accent} terrain={r.courseName}>
        <h1 className="titre">{t.dejaEvalue}</h1>
      </Page>
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
      <Page dir={dir} accent={accent} terrain={r.courseName}>
        <p className="mention">{t.moinsDe30Secondes}</p>
        <h1 className="titre titre--grand" style={{ marginBlockStart: "1.5rem" }}>
          {t.bonCaddie(r.caddieFirstName)}
        </h1>

        <hr className="filet" />

        <div className="actions">
          <a className="bouton" href={`/e/${token}?etape=questions&lang=${langue}`}>
            {t.oui}
          </a>
          <form action={pasMonCaddie}>
            <button type="submit" className="bouton bouton--fantome">
              {t.nonPasMonCaddie}
            </button>
          </form>
        </div>

        {LANGUES_DISPONIBLES.length > 1 && (
          <>
            <hr className="filet" style={{ marginBlockStart: "2.5rem" }} />
            <p className="sur-titre">
              {LANGUES_DISPONIBLES.map((l) => (
                <a key={l} href={`/e/${token}?lang=${l}`} style={{ color: "inherit" }}>
                  {NOMS_LANGUES[l]}{" "}
                </a>
              ))}
            </p>
          </>
        )}
      </Page>
    );
  }

  // --- Questionnaire : cinq écrans, révélés en CSS ---
  const precedentes = decoder(sp.v);
  const ecranOuvert = Number(sp.ecran ?? 1);

  async function envoyer(formData: FormData) {
    "use server";
    if (!r.ok) return;

    const reponses = lireFormulaire(formData);
    const manquants = champsManquants(reponses);

    if (manquants.length > 0 || prixManquant(reponses)) {
      const ecran = premierEcranIncomplet(reponses);
      redirect(
        `/e/${token}?etape=questions&lang=${langue}&erreur=1&ecran=${ecran}&v=${encodeURIComponent(encoder(reponses))}`,
      );
    }

    const s = versSoumission(reponses);
    let id: string;
    try {
      id = await soumettreEvaluation({
        assignmentId: r.assignmentId,
        langue,
        notes: s.notes,
        commentaire: reponses.commentaire,
        noteParcours: s.noteParcours,
        rapportQualitePrix: s.rapportQualitePrix,
        perceptionPrix: reponses.perceptionPrix,
      });
    } catch (e) {
      const m = e instanceof AppError ? e.message : "Envoi impossible.";
      redirect(`/e/${token}?etape=questions&lang=${langue}&erreur=${encodeURIComponent(m)}`);
    }

    redirect(`/e/${token}?etape=merci&lang=${langue}&ev=${id}`);
  }

  return (
    <>
      {/* Navigation par étapes : HORS du formulaire, donc jamais envoyée. */}
      {[1, 2, 3, 4, 5].map((n) => (
        <input
          key={n}
          className="nav-etape"
          type="radio"
          name="etape-ui"
          id={`e${n}`}
          defaultChecked={n === ecranOuvert}
        />
      ))}

      <div className="page" dir={dir} style={{ "--accent": accent } as React.CSSProperties}>
        <p className="sur-titre">{r.courseName}</p>
        <hr className="filet filet--court" />

        {sp.erreur && (
          <p role="alert" className="erreur">
            {sp.erreur === "1" ? t.reponsesManquantes : sp.erreur}
          </p>
        )}

        <form action={envoyer} autoComplete="off">
          {ECRANS.map((champs, i) => (
            <Ecran key={i} numero={i + 1} accent={accent} t={t} token={token} langue={langue}>
              {champs.map((champ) => (
                <Etoiles
                  key={champ}
                  nom={champ}
                  libelle={libelle(champ, t, r.priceMad)}
                  t={t}
                  valeur={precedentes.notes[champ]}
                />
              ))}
            </Ecran>
          ))}

          <Ecran numero={5} accent={accent} t={t} token={token} langue={langue} dernier>
            <fieldset className="question">
              <legend>{t.titrePrixNiveau(r.priceMad)}</legend>
              <div className="choix">
                {(Object.keys(t.prix) as (keyof typeof t.prix)[]).map((k) => (
                  <label key={k}>
                    <input
                      type="radio"
                      name="perceptionPrix"
                      value={k}
                      defaultChecked={precedentes.perceptionPrix === k}
                    />
                    {t.prix[k]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="question">
              <legend>{t.titreCommentaire}</legend>
              <p className="mention" style={{ marginBlockEnd: "0.75rem" }}>
                {t.commentaireFacultatif}
              </p>
              <textarea name="commentaire" rows={3} maxLength={2000} />
            </fieldset>
          </Ecran>
        </form>
      </div>
    </>
  );
}

function libelle(champ: ChampNote, t: ReturnType<typeof messages>, prix: number): string {
  if (champ === "noteParcours") return t.titreParcours;
  if (champ === "rapportQualitePrix") return t.titrePrixQualite(prix);
  return t.criteres[champ as (typeof CRITERES)[number]];
}

function Ecran({
  numero,
  accent,
  t,
  children,
  dernier,
}: {
  numero: number;
  accent: string;
  t: ReturnType<typeof messages>;
  token: string;
  langue: string;
  children: React.ReactNode;
  dernier?: boolean;
}) {
  return (
    <section className={`ecran ecran-${numero}`}>
      <div className="progression">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={n <= numero ? "actif" : ""}
            style={n <= numero ? { background: accent } : undefined}
          />
        ))}
      </div>
      <p className="compteur">{t.etapeSur(ROMAINS[numero - 1] ?? "", "V")}</p>

      {children}

      <div className="actions">
        {dernier ? (
          <button
            type="submit"
            className="bouton"
            style={{ background: accent, borderColor: accent }}
          >
            {t.envoyer}
          </button>
        ) : (
          <label
            className="bouton"
            htmlFor={`e${numero + 1}`}
            style={{ background: accent, borderColor: accent }}
          >
            {t.continuer}
          </label>
        )}
        {numero > 1 && (
          <label className="retour" htmlFor={`e${numero - 1}`}>
            ← {t.precedent}
          </label>
        )}
      </div>
    </section>
  );
}

/**
 * Notation par étoiles. Les radios sont en ordre DOM INVERSÉ (5 → 1) et le
 * rendu est remis à l'endroit par `row-reverse`, qui suit la direction
 * d'écriture et se met donc en miroir tout seul en arabe.
 */
function Etoiles({
  nom,
  libelle,
  t,
  valeur,
}: {
  nom: string;
  libelle: string;
  t: ReturnType<typeof messages>;
  valeur?: number | "na";
}) {
  return (
    <fieldset className="question">
      <legend>{libelle}</legend>
      <div className="etoiles">
        {/* Fragment et non <span> : un element enveloppant briserait la
            fraternite entre input et label, dont depend `:checked ~ label`. */}
        {[5, 4, 3, 2, 1].map((n) => (
          <Fragment key={n}>
            <input
              type="radio"
              id={`${nom}-${n}`}
              name={nom}
              value={n}
              defaultChecked={valeur === n}
            />
            <label htmlFor={`${nom}-${n}`} title={t.etoiles[n as 1 | 2 | 3 | 4 | 5]}>
              ★
            </label>
          </Fragment>
        ))}
      </div>
      <div className="echelle">
        <span>{t.echelleBasse}</span>
        <span>{t.echelleHaute}</span>
      </div>
      <div className="na">
        <label>
          <input type="radio" name={nom} value="na" defaultChecked={valeur === "na"} />
          {t.nonApplicable}
        </label>
      </div>
    </fieldset>
  );
}

function Page({
  children,
  dir,
  accent,
  terrain,
}: {
  children: React.ReactNode;
  dir: "rtl" | "ltr";
  accent?: string;
  terrain?: string;
}) {
  return (
    <div
      className="page"
      dir={dir}
      style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}
    >
      {terrain && (
        <>
          <p className="sur-titre">{terrain}</p>
          <hr className="filet filet--court" />
        </>
      )}
      {children}
    </div>
  );
}
