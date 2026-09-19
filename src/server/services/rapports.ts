import type { Scope } from "../scope";
import { requireAdmin } from "../scope";
import {
  kpiParCaddie,
  comparerAuParcours,
  SEUIL_PERTINENCE,
  type Periode,
} from "../repositories/kpi";

/**
 * EXPORTS (spéc. 5).
 *
 * PRINCIPE I — un export ne contient JAMAIS de donnée personnelle : ni
 * année de naissance, ni adresse, ni taille d'habits. Les colonnes sont
 * énumérées explicitement, jamais dérivées d'un objet complet, pour qu'un
 * champ ajouté demain ne s'y glisse pas tout seul.
 */

const COLONNES = [
  "identifiant_interne",
  "prenom",
  "nom",
  "statut",
  "jours_travailles",
  "affectations_terminees",
  "evaluations",
  "taux_reponse",
  "moyenne_competences",
  "experience_generale",
  "score_final",
  "ecart_moyenne_parcours",
  "comparaison_significative",
] as const;

function nombre(v: number | null, decimales = 2): string {
  return v === null ? "" : v.toFixed(decimales);
}

function echapper(v: string): string {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function exporterKpiCsv(scope: Scope, p: Periode = {}): Promise<string> {
  requireAdmin(scope);

  const kpis = await kpiParCaddie(scope, p);
  const lignes: string[] = [COLONNES.join(";")];

  for (const k of kpis) {
    const c = await comparerAuParcours(scope, k.caddieId, p);
    lignes.push(
      [
        echapper(k.internalRef),
        echapper(k.firstName),
        echapper(k.lastName),
        k.status === "active" ? "actif" : "désactivé",
        String(k.joursTravailles),
        String(k.affectationsTerminees),
        String(k.evaluations),
        nombre(k.tauxReponse, 3),
        nombre(k.moyenneCompetences),
        nombre(k.experienceGenerale),
        nombre(k.scoreFinal),
        nombre(c.ecart),
        c.significative ? "oui" : "non",
      ].join(";"),
    );
  }

  return lignes.join("\n");
}

export { SEUIL_PERTINENCE };
