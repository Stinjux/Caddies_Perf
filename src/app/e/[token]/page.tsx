import { Fragment } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resoudreJeton, type CaddieChoisissable } from "@/server/services/qr-resolution";
import { soumettreEvaluation, enregistrerClicGoogle, CRITERES } from "@/server/services/evaluation";
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
import { resoudreLangue, direction, messages, NOMS_LANGUES, LANGUES_DISPONIBLES } from "@/lib/i18n";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * PARCOURS CLIENT — UN QR POUR TOUT LE PARCOURS.
 *
 * Aucun compte, aucune application, moins de 30 secondes. Le client scanne
 * l'affiche du départ, choisit son caddie dans une liste, puis répond.
 *
 * SANS JAVASCRIPT CLIENT. Au 18e trou, sur un réseau faible, une page qui
 * s'affiche vaut mieux qu'une page qui attend un paquet. Les étoiles se
 * remplissent en CSS, et le questionnaire tient sur une page défilante.
 *
 * UNE SEULE BARRIÈRE CONTRE LES DOUBLONS, et elle est faible : un témoin
 * déposé dans le navigateur empêche de noter deux fois le même caddie le même
 * jour. Une navigation privée la contourne. C'est un choix assumé — sans
 * affectation, plus rien ne relie une réponse à une partie réelle. Le seuil
 * de cinq évaluations reste le vrai garde-fou statistique.
 *
 * ANONYME : le témoin ne porte qu'un identifiant de caddie et une date. Ni
 * nom, ni adresse, ni empreinte du navigateur.
 */

type Etape = "accueil" | "questions" | "merci" | "termine";

const TOTAL_QUESTIONS = CHAMPS_NOTES.length + 1;
const COOKIE_DEJA = "caddieperf_evalues";

/** « <idCaddie>:<AAAA-MM-JJ> », séparés par des virgules. */
function dejaEvalue(valeur: string | undefined, caddieId: string, jour: string): boolean {
  return (valeur ?? "").split(",").includes(`${caddieId}:${jour}`);
}

function ajouterAuTemoin(valeur: string | undefined, caddieId: string, jour: string): string {
  const entrees = (valeur ?? "").split(",").filter(Boolean);
  entrees.push(`${caddieId}:${jour}`);
  // On ne garde que les cinquante dernières : un témoin sans limite finirait
  // par dépasser la taille acceptée et serait rejeté en silence.
  return entrees.slice(-50).join(",");
}

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
    caddie?: string;
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

  if (etape === "termine") {
    return (
      <Page dir={dir} accent={accent} parcours={r.courseName}>
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
      <Page dir={dir} accent={accent} parcours={r.courseName}>
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

  /**
   * ACCUEIL — le choix du caddie. Il précède tout le reste : répondre à neuf
   * questions avant de découvrir qu'on s'est trompé de personne serait
   * insupportable.
   */
  if (etape === "accueil") {
    return (
      <Page dir={dir} accent={accent} parcours={r.courseName}>
        <p className="mention">{t.moinsDe30Secondes}</p>
        <h1 className="titre titre--grand" style={{ marginBlockStart: "1.5rem" }}>
          {t.choisissezCaddie}
        </h1>

        <hr className="filet" />

        {sp.erreur && (
          <p role="alert" className="erreur">
            {t.caddieNonChoisi}
          </p>
        )}

        <form method="get" action={`/e/${token}`}>
          <input type="hidden" name="etape" value="questions" />
          <input type="hidden" name="lang" value={langue} />
          <select name="caddie" required defaultValue="" className="choix-caddie">
            <option value="" disabled>
              {t.choisirDansLaListe}
            </option>
            {r.caddies.map((c: CaddieChoisissable) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>

          <div className="actions">
            <button
              type="submit"
              className="bouton"
              style={{ background: accent, borderColor: accent }}
            >
              {t.commencer}
            </button>
          </div>
        </form>

        {LANGUES_DISPONIBLES.length > 1 && (
          <>
            <hr className="filet" style={{ marginBlockStart: "2.5rem" }} />
            <p className="sur-titre">{t.choisirLangue}</p>
            {/* Chaque langue est un LIEN, pas un menu : un seul geste, et rien
                à soumettre. Le joueur qui ne lit pas le français doit pouvoir
                changer de langue sans deviner à quoi sert un bouton. */}
            <p className="langues">
              {LANGUES_DISPONIBLES.map((l) => (
                <a
                  key={l}
                  href={`/e/${token}?lang=${l}`}
                  hrefLang={l}
                  lang={l}
                  dir={direction(l)}
                  aria-current={l === langue ? "true" : undefined}
                  className={l === langue ? "langues__choisie" : undefined}
                >
                  {NOMS_LANGUES[l]}
                </a>
              ))}
            </p>
          </>
        )}
      </Page>
    );
  }

  // --- Questionnaire : une seule page défilante ---
  const caddie = r.caddies.find((c) => c.id === sp.caddie);
  if (!caddie) redirect(`/e/${token}?lang=${langue}&erreur=1`);

  const jour = new Date().toISOString().slice(0, 10);
  const boite = await cookies();
  if (dejaEvalue(boite.get(COOKIE_DEJA)?.value, caddie.id, jour)) {
    return (
      <Page dir={dir} accent={accent} parcours={r.courseName}>
        <h1 className="titre">{t.dejaEvalue}</h1>
      </Page>
    );
  }

  const precedentes = decoder(sp.v);
  const oublis = new Set<string>(
    sp.erreur === "1"
      ? [...champsManquants(precedentes), ...(prixManquant(precedentes) ? ["perceptionPrix"] : [])]
      : [],
  );

  async function envoyer(formData: FormData) {
    "use server";
    if (!r.ok || !caddie) return;

    const reponses = lireFormulaire(formData);

    if (champsManquants(reponses).length > 0 || prixManquant(reponses)) {
      const ancre = premierChampManquant(reponses);
      redirect(
        `/e/${token}?etape=questions&lang=${langue}&caddie=${caddie.id}&erreur=1` +
          `&v=${encodeURIComponent(encoder(reponses))}` +
          (ancre ? `#${ancre}` : ""),
      );
    }

    const s = versSoumission(reponses);
    let id: string;
    try {
      id = await soumettreEvaluation({
        golfCourseId: r.golfCourseId,
        caddieId: caddie.id,
        langue,
        notes: s.notes,
        commentaire: reponses.commentaire,
        noteParcours: s.noteParcours,
        perceptionPrix: reponses.perceptionPrix,
      });
    } catch (e) {
      const m = e instanceof AppError ? e.message : "Envoi impossible.";
      redirect(
        `/e/${token}?etape=questions&lang=${langue}&caddie=${caddie.id}&erreur=${encodeURIComponent(m)}`,
      );
    }

    // Témoin déposé APRÈS l'enregistrement : marquer avant reviendrait à
    // bloquer un client dont la réponse n'est jamais arrivée.
    const store = await cookies();
    store.set(COOKIE_DEJA, ajouterAuTemoin(store.get(COOKIE_DEJA)?.value, caddie.id, jour), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/e",
      maxAge: 60 * 60 * 24 * 90,
    });

    redirect(`/e/${token}?etape=merci&lang=${langue}&ev=${id}`);
  }

  return (
    <div className="page" dir={dir} style={{ "--accent": accent } as React.CSSProperties}>
      <p className="sur-titre">{r.courseName}</p>
      <hr className="filet filet--court" />
      <p className="mention" style={{ marginBlockEnd: "1.5rem" }}>
        {caddie.libelle}
      </p>

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
  return t.criteres[champ as (typeof CRITERES)[number]];
}

/** Repère de position : sur une page défilante, le client ne voit pas la fin. */
function Numero({ n, t, oublie }: { n: number; t: ReturnType<typeof messages>; oublie?: boolean }) {
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
  parcours,
}: {
  children: React.ReactNode;
  dir: "rtl" | "ltr";
  accent?: string;
  parcours?: string;
}) {
  return (
    <div
      className="page"
      dir={dir}
      style={accent ? ({ "--accent": accent } as React.CSSProperties) : undefined}
    >
      {parcours && (
        <>
          <p className="sur-titre">{parcours}</p>
          <hr className="filet filet--court" />
        </>
      )}
      {children}
    </div>
  );
}
