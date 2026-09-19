/**
 * Lecture de fichiers CSV.
 *
 * Ecrit a la main plutot qu'importe : l'encodage et le separateur doivent
 * etre DETECTES et annonces a l'utilisateur, ce qu'aucune bibliotheque
 * generique ne fait de maniere transparente. Environ 80 lignes, zero
 * dependance (principe III).
 */

export type Encoding = "utf-8" | "windows-1252";
export type Separator = "," | ";" | "\t";

export interface CsvReadResult {
  rows: string[][];
  encoding: Encoding;
  separator: Separator;
  hasHeader: boolean;
  headerCandidate: string[] | null;
}

/**
 * Detecte l'encodage. UTF-8 d'abord : un fichier Windows-1252 contenant des
 * accents produit des sequences UTF-8 invalides, reperables au caractere de
 * remplacement. Un export Excel produit du Windows-1252 sans prevenir.
 */
export function detectEncoding(bytes: Uint8Array): Encoding {
  // Marque d'ordre des octets UTF-8.
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";

  try {
    const texte = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return texte.includes("�") ? "windows-1252" : "utf-8";
  } catch {
    return "windows-1252";
  }
}

/** Le separateur le plus frequent sur la premiere ligne non vide. */
export function detectSeparator(texte: string): Separator {
  const premiere = texte.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const candidats: Separator[] = [";", ",", "\t"];

  let meilleur: Separator = ",";
  let record = -1;
  for (const c of candidats) {
    const n = premiere.split(c).length - 1;
    if (n > record) {
      record = n;
      meilleur = c;
    }
  }
  return meilleur;
}

/** Analyse conforme a RFC 4180 : guillemets, guillemets doubles, sauts de ligne. */
export function parseCsv(texte: string, separator: Separator): string[][] {
  const lignes: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let entreGuillemets = false;

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!;

    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i++;
        } else {
          entreGuillemets = false;
        }
      } else {
        champ += c;
      }
      continue;
    }

    if (c === '"') {
      entreGuillemets = true;
    } else if (c === separator) {
      ligne.push(champ.trim());
      champ = "";
    } else if (c === "\n") {
      ligne.push(champ.trim());
      if (ligne.some((v) => v.length > 0)) lignes.push(ligne);
      ligne = [];
      champ = "";
    } else if (c !== "\r") {
      champ += c;
    }
  }

  ligne.push(champ.trim());
  if (ligne.some((v) => v.length > 0)) lignes.push(ligne);

  return lignes;
}

/**
 * Une premiere ligne est tenue pour un en-tete si aucune de ses cellules
 * n'est purement numerique ET qu'elle contient au moins un intitule attendu.
 * La detection est ANNONCEE et CORRIGEABLE dans l'apercu : on ne parie pas
 * en silence sur le contenu du fichier de l'utilisateur.
 */
const INTITULES = [
  "nom",
  "prenom",
  "prénom",
  "age",
  "âge",
  "anciennete",
  "ancienneté",
  "taille",
  "force",
  "adresse",
];

export function looksLikeHeader(premiere: string[]): boolean {
  const normalise = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const cellules = premiere.map(normalise);
  const aDuNumerique = cellules.some((v) => /^\d+$/.test(v));
  const aUnIntitule = cellules.some((v) => INTITULES.map(normalise).includes(v));
  return !aDuNumerique && aUnIntitule;
}

export function readCsv(bytes: Uint8Array): CsvReadResult {
  const encoding = detectEncoding(bytes);
  const texte = new TextDecoder(encoding).decode(bytes).replace(/^﻿/, "");
  const separator = detectSeparator(texte);
  const toutes = parseCsv(texte, separator);

  const premiere = toutes[0] ?? null;
  const hasHeader = premiere ? looksLikeHeader(premiere) : false;

  return {
    rows: hasHeader ? toutes.slice(1) : toutes,
    encoding,
    separator,
    hasHeader,
    headerCandidate: premiere,
  };
}
