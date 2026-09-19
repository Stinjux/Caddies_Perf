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
  premierChampManquant,
  versSoumission,
  CHAMPS_NOTES,
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
 * s'affiche vaut mieux qu'une page qui attend un paquet. Les étoiles se
 * remplissent en CSS : radios en ordre DOM inversé et `:checked ~ label`.
 * Le miroir arabe est automatique.
 *
 * UNE SEULE PAGE DÉFILANTE. Les neuf questions se suivent, un seul envoi.
 * Rien n'étant masqué, l'attribut `required` du navigateur redevient
 * utilisable : il désigne la question oubliée sans aller-retour réseau.
 * Attention — une radio masquée que le navigateur ne peut pas focaliser
 * bloquerait l'envoi SANS AUCUN MESSAGE ; c'est pourquoi les radios des
 * étoiles sont ancrées sous leur rangée (voir `.etoiles input` dans le CSS).
 *
 * Le serveur reste l'autorité : il revérifie tout, et en cas d'oubli il
 * renvoie la page positionnée sur la question manquante, réponses conservées.
 * Le commentaire n'est jamais obligatoire.
 *
 * ANONYME : aucune donnée identifiante n'est demandée ni enregistrée.
 */

type Etape = "accueil" | "questions" | "merci" | "termine" | "mauvais";

/** Huit notes étoilées, puis la perception du prix. Le commentaire est libre. */
const TOTAL_QUESTIONS = CHAMPS_NOTES.length + 1;

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

  /**
   * L'accueil reste un écran à part : le client doit pouvoir dire « ce n'est
   * pas mon caddie » AVANT d'avoir répondu à neuf questions pour rien.
   */
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

  // --- Questionnaire : une seule page défilante ---
  const precedentes = decoder(sp.v);

  /**
   * Les oublis se déduisent des réponses conservées — inutile de les répéter
   * dans l'adresse. Le marquage n'a lieu qu'au retour d'un envoi incomplet :
   * un formulaire vierge n'est pas un formulaire fautif.
   */
  const oublis = new Set<string>(
    sp.erreur === "1"
      ? [
          ...champsManquants(precedentes),
          ...(prixManquant(precedentes) ? ["perceptionPrix"] : []),
        ]
      : [],
  );

  async function envoyer(formData: FormData) {
    "use server";
    if (!r.ok) return;

    const reponses = lireFormulaire(formData);

    if (champsManquants(reponses).length > 0 || prixManquant(reponses)) {
      const ancre = premierChampManquant(reponses);
      redirect(
        `/e/${token}?etape=questions&lang=${langue}&erreur=1&v=${encodeURIComponent(encoder(reponses))}` +
          (ancre ? `#${ancre}` : ""),
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
    <div className="page" dir={dir} style={{ "--accent": accent } as React.CSSProperties}>
      <p className="sur-titre">{r.courseName}</p>
      <hr className="filet filet--court" />

      {sp.erreur && (
        <p role="alert" className="erreur">
          {sp.erreur === "1" ? t.reponsesManquantes : sp.erreur}
        </p>
      )}

      <form action={envoyer} autoComplete="off">
        {CHAMPS_NOTES.map((champ, i) => (
          <Etoiles
            key={champ}
            nom={champ}
            numero={i + 1}
            libelle={libelle(champ, t, r.priceMad)}
            t={t}
            valeur={precedentes.notes[champ]}
            oublie={oublis.has(champ)}
          />
        ))}

        <fieldset
          id="perceptionPrix"
          className={`question${oublis.has("perceptionPrix") ? " question--oublie" : ""}`}
        >
          <legend>
            <Numero n={TOTAL_QUESTIONS} t={t} oublie={oublis.has("perceptionPrix")} />
            {t.titrePrixNiveau(r.priceMad)}
          </legend>
          <div className="choix">
            {(Object.keys(t.prix) as (keyof typeof t.prix)[]).map((k) => (
              <label key={k}>
                <input
                  type="radio"
                  name="perceptionPrix"
                  value={k}
                  required
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

        <div className="actions">
          <button
            type="submit"
            className="bouton"
            style={{ background: accent, borderColor: accent }}
          >
            {t.envoyer}
          </button>
        </div>
      </form>
    </div>
  );
}

function libelle(champ: ChampNote, t: ReturnType<typeof messages>, prix: number): string {
  if (champ === "noteParcours") return t.titreParcours;
  if (champ === "rapportQualitePrix") return t.titrePrixQualite(prix);
  return t.criteres[champ as (typeof CRITERES)[number]];
}

/** Repère de position : sur une page défilante, le client ne voit pas la fin. */
function Numero({
  n,
  t,
  oublie,
}: {
  n: number;
  t: ReturnType<typeof messages>;
  oublie?: boolean;
}) {
  return (
    <span className="numero">
      {t.questionSur(n, TOTAL_QUESTIONS)}
      {oublie && <span className="numero__oubli"> — {t.questionOubliee}</span>}
    </span>
  );
}

/**
 * Notation par étoiles. Les radios sont en ordre DOM INVERSÉ (5 → 1) et le
 * rendu est remis à l'endroit par `row-reverse`, qui suit la direction
 * d'écriture et se met donc en miroir tout seul en arabe.
 *
 * `required` porte sur tout le groupe : « non applicable » y répond aussi,
 * puisque c'est une réponse — celle que le critère ne s'applique pas.
 */
function Etoiles({
  nom,
  numero,
  libelle,
  t,
  valeur,
  oublie,
}: {
  nom: string;
  numero: number;
  libelle: string;
  t: ReturnType<typeof messages>;
  valeur?: number | "na";
  oublie?: boolean;
}) {
  return (
    <fieldset id={nom} className={`question${oublie ? " question--oublie" : ""}`}>
      <legend>
        <Numero n={numero} t={t} oublie={oublie} />
        {libelle}
      </legend>
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
              required
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
          <input type="radio" name={nom} value="na" required defaultChecked={valeur === "na"} />
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
