import { redirect } from "next/navigation";
import { journaliserConsultation } from "@/server/audit/consultation";
import { requireScope } from "@/server/auth/context";
import {
  kpiParCaddie,
  kpiParcours,
  distributionNotes,
  comparerAuParcours,
  SEUIL_PERTINENCE,
} from "@/server/repositories/kpi";
import { tAdmin } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ du?: string; au?: string; min?: string; statut?: string }>;
}) {
  const { scope } = await requireScope();
  if (scope.role !== "admin") redirect("/");

  const { t } = await tAdmin();
  const LIBELLES_CRITERES: Record<string, string> = t.rapports.criteres;
  const LIBELLES_PRIX: Record<string, string> = t.rapports.prix;

  const sp = await searchParams;
  const periode = {
    du: sp.du ? new Date(sp.du) : undefined,
    au: sp.au ? new Date(sp.au) : undefined,
  };
  const minEvals = Number(sp.min ?? 0);

  // Une seule entree par affichage : la page appelle quatre calculs, mais
  // l'administrateur n'a consulte qu'un rapport.
  await journaliserConsultation(scope, "report.read", "report");

  const [kpis, parcours, distribution] = await Promise.all([
    kpiParCaddie(scope, periode),
    kpiParcours(scope, periode),
    distributionNotes(scope, periode),
  ]);

  const filtres = kpis
    .filter((k) => k.evaluations >= minEvals)
    .filter((k) => (sp.statut ? k.status === sp.statut : true))
    .sort((a, b) => (b.scoreFinal ?? -1) - (a.scoreFinal ?? -1));

  const comparaisons = new Map(
    await Promise.all(
      filtres.map(
        async (k) => [k.caddieId, await comparerAuParcours(scope, k.caddieId, periode)] as const,
      ),
    ),
  );

  const totalNotes = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">{t.rapports.titre}</h1>
      <p className="mb-6 text-sm text-neutral-500">{t.rapports.explication(SEUIL_PERTINENCE)}</p>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">{t.commun.du}</span>
          <input
            type="date"
            name="du"
            defaultValue={sp.du ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">{t.commun.au}</span>
          <input
            type="date"
            name="au"
            defaultValue={sp.au ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">{t.rapports.evalMin}</span>
          <input
            type="number"
            name="min"
            min={0}
            defaultValue={sp.min ?? "0"}
            className="w-32 rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-700">{t.rapports.statut}</span>
          <select
            name="statut"
            defaultValue={sp.statut ?? ""}
            className="rounded-lg border border-neutral-300 px-3 py-2"
          >
            <option value="">{t.commun.tous}</option>
            <option value="active">{t.rapports.actifs}</option>
            <option value="disabled">{t.rapports.desactives}</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          {t.commun.filtrer}
        </button>
        <a
          href={`/rapports/export?${new URLSearchParams(sp as Record<string, string>)}`}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700"
        >
          {t.rapports.exporter}
        </a>
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Tuile titre={t.rapports.tuileEvaluations} valeur={String(parcours.evaluations)} />
        <Tuile titre={t.rapports.tuileNote} valeur={parcours.noteParcours?.toFixed(2) ?? "—"} />
        <Tuile titre={t.rapports.tuileClics} valeur={String(parcours.clicsGoogle)} />
      </div>

      <h2 className="mb-3 text-lg font-medium text-neutral-900">{t.rapports.caddies}</h2>
      {filtres.length === 0 ? (
        <p className="mb-8 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">
          {t.rapports.aucunCaddie}
        </p>
      ) : (
        <div className="mb-8 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-neutral-600">
              <tr>
                <th className="px-4 py-3">{t.rapports.colCaddie}</th>
                <th className="px-4 py-3">{t.rapports.colEvals}</th>
                <th className="px-4 py-3">{t.rapports.colCompetences}</th>
                <th className="px-4 py-3">{t.rapports.colExperience}</th>
                <th className="px-4 py-3">{t.rapports.colScore}</th>
                <th className="px-4 py-3">{t.rapports.colEcart}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtres.map((k) => {
                const c = comparaisons.get(k.caddieId);
                return (
                  <tr key={k.caddieId}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-900">{k.internalRef}</span>{" "}
                      <span className="text-neutral-600">
                        {k.firstName} {k.lastName}
                      </span>
                      {k.status === "disabled" && (
                        <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                          {t.commun.desactive}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{k.evaluations}</td>
                    <td className="px-4 py-3">{k.moyenneCompetences?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3">{k.experienceGenerale?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{k.scoreFinal?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c?.ecart !== null && c?.ecart !== undefined ? (
                        <span className={c.ecart >= 0 ? "text-emerald-700" : "text-amber-700"}>
                          {c.ecart >= 0 ? "+" : ""}
                          {c.ecart.toFixed(2)}
                          {!c.significative && (
                            <span className="ml-1 text-xs text-neutral-500">
                              {t.rapports.nonSignificatif}
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-medium text-neutral-900">{t.rapports.distribution}</h2>
          {totalNotes === 0 ? (
            <p className="text-sm text-neutral-500">{t.rapports.aucuneNote}</p>
          ) : (
            <ul className="space-y-2">
              {([5, 4, 3, 2, 1] as const).map((n) => (
                <li key={n} className="flex items-center gap-3 text-sm">
                  <span className="w-8 text-neutral-700">{n} ★</span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <span
                      className="block h-full bg-[var(--color-brand)]"
                      style={{ width: `${(distribution[n] / totalNotes) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 text-right text-neutral-600">{distribution[n]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-1 font-medium text-neutral-900">{t.rapports.perceptionPrix}</h2>
          <p className="mb-3 text-xs text-neutral-500">{t.rapports.jamaisDansScore}</p>
          {Object.keys(parcours.perceptionPrix).length === 0 ? (
            <p className="text-sm text-neutral-500">{t.rapports.aucuneReponse}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {Object.entries(parcours.perceptionPrix).map(([k, n]) => (
                <li key={k} className="flex justify-between">
                  <span className="text-neutral-700">{LIBELLES_PRIX[k] ?? k}</span>
                  <span className="text-neutral-900">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-6 text-xs text-neutral-500">
        {t.rapports.criteresMesures(Object.values(LIBELLES_CRITERES).join(" · "))}
      </p>
    </div>
  );
}

function Tuile({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm text-neutral-600">{titre}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{valeur}</p>
    </div>
  );
}
