import { eq } from "drizzle-orm";
import { db } from "@/db";
import { withScope } from "@/db/scope-tx";
import { caddie, caddiePersonalData } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { readCsv, type CsvReadResult } from "@/lib/csv";
import { requireAdmin, type Scope } from "../scope";
import { writeAudit } from "../audit/write";
import { ValidationError } from "../errors";

/**
 * IMPORT CSV DES CADDIES (spéc. 2, FR-101 a FR-140).
 *
 * PRINCIPE I — le fichier source compte 7 colonnes, dont TROIS sont lues
 * puis REJETEES et ne franchissent jamais la frontiere de la base :
 * taille d'habits, adresse du domicile, force.
 *
 * Ordre des colonnes du fichier source :
 *   0 nom · 1 prenom · 2 age · 3 taille d'habits · 4 anciennete · 5 force
 *   6 adresse du domicile
 */

export const COLONNES_SOURCE = [
  "numéro de caddie",
  "nom",
  "prénom",
  "âge",
  "taille d'habits",
  "ancienneté",
  "force",
  "adresse du domicile",
] as const;

/** Index des colonnes LUES PUIS REJETEES. Jamais stockees (FR-028, FR-028b). */
// Le numero de caddie occupe desormais la premiere case : tous les index
// glissent d'un cran. Taille d'habits, force et adresse restent lues puis
// jetees — la base n'a aucune colonne pour les recevoir (FR-028).
export const COLONNES_REJETEES = [4, 6, 7] as const;

export type LigneStatut = "valide" | "invalide" | "doublon";

export interface LigneImport {
  numero: number;
  /** Le numero porte par le caddie, lu dans la PREMIERE case du fichier. */
  caddieRef: string;
  statut: LigneStatut;
  lastName: string;
  firstName: string;
  birthYear: number | null;
  seniorityYears: number | null;
  erreurs: string[];
  /** Identifiant du caddie existant, lorsqu'un doublon est detecte. */
  doublonDe?: string;
  doublonRef?: string;
}

export interface Apercu {
  encoding: CsvReadResult["encoding"];
  separator: CsvReadResult["separator"];
  hasHeader: boolean;
  headerCandidate: string[] | null;
  colonnesRejetees: string[];
  lignes: LigneImport[];
  resume: { total: number; valides: number; invalides: number; doublons: number };
}

const TAILLE_MAX = 2 * 1024 * 1024;

function anneeMax(): number {
  return new Date().getFullYear() - 15;
}

/** Convertit l'age du fichier source en ANNEE DE NAISSANCE (FR-029). */
function ageVersAnneeNaissance(brut: string): { valeur: number | null; erreur?: string } {
  if (!brut) return { valeur: null };
  const age = Number(brut);
  if (!Number.isInteger(age) || age < 15 || age > 85) {
    return { valeur: null, erreur: `Âge invalide : « ${brut} ».` };
  }
  return { valeur: new Date().getFullYear() - age };
}

function ancienneteValide(brut: string): { valeur: number | null; erreur?: string } {
  if (!brut) return { valeur: null };
  const n = Number(brut);
  if (!Number.isInteger(n) || n < 0 || n > 60) {
    return { valeur: null, erreur: `Ancienneté invalide : « ${brut} ».` };
  }
  return { valeur: n };
}

/**
 * Construit l'apercu SANS RIEN ECRIRE (FR-120). L'administrateur voit ce qui
 * sera importe, ce qui sera rejete et pourquoi, avant toute confirmation.
 */
export async function construireApercu(
  scope: Scope,
  fichier: { bytes: Uint8Array; size: number; name: string },
): Promise<Apercu> {
  requireAdmin(scope);

  if (fichier.size > TAILLE_MAX) {
    throw new ValidationError("fichier", "Fichier trop volumineux. Maximum : 2 Mo.");
  }
  if (!/\.csv$/i.test(fichier.name)) {
    throw new ValidationError("fichier", "Seuls les fichiers .csv sont acceptés.");
  }

  const lu = readCsv(fichier.bytes);
  if (lu.rows.length === 0) {
    throw new ValidationError("fichier", "Le fichier ne contient aucune ligne de données.");
  }

  const lignes: LigneImport[] = [];
  const vusDansLeFichier = new Map<string, number>();

  for (let i = 0; i < lu.rows.length; i++) {
    const cells = lu.rows[i]!;
    const erreurs: string[] = [];

    if (cells.length < 3) {
      erreurs.push("Ligne incomplète : le numéro, le nom et le prénom sont obligatoires.");
    }

    const caddieRef = (cells[0] ?? "").trim();
    const lastName = (cells[1] ?? "").trim();
    const firstName = (cells[2] ?? "").trim();
    if (!caddieRef) erreurs.push("Numéro de caddie manquant.");
    if (!lastName) erreurs.push("Nom manquant.");
    if (!firstName) erreurs.push("Prénom manquant.");

    const age = ageVersAnneeNaissance((cells[3] ?? "").trim());
    if (age.erreur) erreurs.push(age.erreur);

    const anc = ancienneteValide((cells[5] ?? "").trim());
    if (anc.erreur) erreurs.push(anc.erreur);

    // Doublon a l'interieur du fichier lui-meme.
    const cle = caddieRef.toLowerCase();
    const dejaVu = vusDansLeFichier.get(cle);
    if (dejaVu !== undefined) {
      erreurs.push(`Numéro déjà utilisé ligne ${dejaVu} du fichier.`);
    } else if (caddieRef) {
      vusDansLeFichier.set(cle, i + 1);
    }

    lignes.push({
      numero: i + 1,
      caddieRef,
      statut: erreurs.length > 0 ? "invalide" : "valide",
      lastName,
      firstName,
      birthYear: age.valeur,
      seniorityYears: anc.valeur,
      erreurs,
    });
  }

  // Doublons vis-a-vis des caddies DEJA enregistres sur ce terrain.
  const existants = await withScope(scope, (tx) =>
    tx
      .select({
        id: caddie.id,
        internalRef: caddie.internalRef,
        firstName: caddie.firstName,
        lastName: caddie.lastName,
      })
      .from(caddie)
      .where(eq(caddie.golfCourseId, scope.golfCourseId)),
  );

  // Le NUMERO fait l'identite : c'est lui que le caddie porte et que le
  // client choisit. Deux personnes homonymes sont deux caddies distincts ;
  // deux fois le meme numero serait une collision, pas un homonyme.
  const index = new Map(existants.map((e) => [e.internalRef.toLowerCase(), e]));

  for (const l of lignes) {
    if (l.statut !== "valide") continue;
    const trouve = index.get(l.caddieRef.toLowerCase());
    if (trouve) {
      l.statut = "doublon";
      l.doublonDe = trouve.id;
      l.doublonRef = trouve.internalRef;
      l.erreurs.push(`Le numéro ${trouve.internalRef} est déjà attribué.`);
    }
  }

  return {
    encoding: lu.encoding,
    separator: lu.separator,
    hasHeader: lu.hasHeader,
    headerCandidate: lu.headerCandidate,
    colonnesRejetees: COLONNES_REJETEES.map((i) => COLONNES_SOURCE[i]),
    lignes,
    resume: {
      total: lignes.length,
      valides: lignes.filter((l) => l.statut === "valide").length,
      invalides: lignes.filter((l) => l.statut === "invalide").length,
      doublons: lignes.filter((l) => l.statut === "doublon").length,
    },
  };
}

export type DecisionDoublon = "ignorer" | "remplacer";

export interface RapportImport {
  crees: number;
  remplaces: number;
  ignores: number;
  refs: string[];
}

/**
 * Execute l'import DANS UNE SEULE TRANSACTION (FR-130).
 *
 * Aucune importation partielle silencieuse : soit toutes les lignes retenues
 * sont ecrites, soit aucune. Une interruption laisse la base intacte.
 */
export async function executerImport(
  scope: Scope,
  apercu: Apercu,
  decisions: Map<number, DecisionDoublon>,
): Promise<RapportImport> {
  requireAdmin(scope);

  const aCreer = apercu.lignes.filter((l) => l.statut === "valide");
  const doublons = apercu.lignes.filter((l) => l.statut === "doublon");
  const aRemplacer = doublons.filter((l) => decisions.get(l.numero) === "remplacer");
  const ignores = doublons.length - aRemplacer.length;

  if (aCreer.length === 0 && aRemplacer.length === 0) {
    throw new ValidationError("import", "Aucune ligne à importer.");
  }

  const refs: string[] = [];

  await withScope(scope, async (tx) => {
    // Le numero n'est plus engendre : il vient du fichier, parce que c'est
    // celui que le caddie porte deja sur le terrain.
    const aujourdhui = new Date().toISOString().slice(0, 10);

    for (const l of aCreer) {
      const id = uuidv7();
      const ref = l.caddieRef;
      refs.push(ref);

      await tx.insert(caddie).values({
        id,
        golfCourseId: scope.golfCourseId,
        internalRef: ref,
        firstName: l.firstName,
        lastName: l.lastName,
        seniorityYears: l.seniorityYears,
        seniorityRecordedOn: l.seniorityYears !== null ? aujourdhui : null,
      });

      if (l.birthYear !== null) {
        await tx.insert(caddiePersonalData).values({ caddieId: id, birthYear: l.birthYear });
      }

      await writeAudit(tx, scope, { action: "caddie.create", targetType: "caddie", targetId: id });
    }

    for (const l of aRemplacer) {
      await tx
        .update(caddie)
        .set({
          firstName: l.firstName,
          lastName: l.lastName,
          seniorityYears: l.seniorityYears,
          seniorityRecordedOn: l.seniorityYears !== null ? aujourdhui : null,
          updatedAt: new Date(),
        })
        .where(eq(caddie.id, l.doublonDe!));

      if (l.birthYear !== null) {
        await tx
          .insert(caddiePersonalData)
          .values({ caddieId: l.doublonDe!, birthYear: l.birthYear })
          .onConflictDoUpdate({
            target: caddiePersonalData.caddieId,
            set: { birthYear: l.birthYear, updatedAt: new Date() },
          });
      }

      await writeAudit(tx, scope, {
        action: "caddie.update",
        targetType: "caddie",
        targetId: l.doublonDe!,
      });
    }
  });

  return { crees: aCreer.length, remplaces: aRemplacer.length, ignores, refs };
}

/** Liste des erreurs, telechargeable au format CSV (FR-135). */
export function rapportErreursCsv(apercu: Apercu): string {
  const entete = "ligne;statut;nom;prenom;erreurs";
  const corps = apercu.lignes
    .filter((l) => l.statut !== "valide")
    .map((l) => `${l.numero};${l.statut};${l.lastName};${l.firstName};"${l.erreurs.join(" ")}"`);
  return [entete, ...corps].join("\n");
}
