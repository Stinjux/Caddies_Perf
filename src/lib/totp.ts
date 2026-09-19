import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * SECOND FACTEUR — MOT DE PASSE A USAGE UNIQUE FONDE SUR LE TEMPS (RFC 6238).
 *
 * Ecrit a la main sur node:crypto, comme le hachage scrypt : l'algorithme
 * tient en quarante lignes, et une dependance de plus serait une surface
 * d'attaque de plus pour un gain nul.
 *
 * POURQUOI LE TOTP ET NON LE SMS : aucun operateur, aucun cout par message,
 * fonctionne sans reseau — et surtout AUCUN NUMERO DE TELEPHONE A STOCKER,
 * ce qui respecte le principe I. Le SMS est par ailleurs le second facteur le
 * plus contourne, par echange de carte SIM.
 */

const PAS_SECONDES = 30;
const CHIFFRES = 6;

/** Une etape avant et une apres : couvre un telephone mal synchronise. */
const TOLERANCE_PAS = 1;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encoderBase32(octets: Buffer): string {
  let bits = 0;
  let valeur = 0;
  let sortie = "";
  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];
  return sortie;
}

export function decoderBase32(texte: string): Buffer {
  const propre = texte.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let valeur = 0;
  const octets: number[] = [];
  for (const caractere of propre) {
    const index = ALPHABET.indexOf(caractere);
    if (index < 0) continue;
    valeur = (valeur << 5) | index;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

/** 160 bits, la taille recommandee par la RFC 4226 pour HMAC-SHA1. */
export function genererSecret(): string {
  return encoderBase32(randomBytes(20));
}

function codePourPas(secret: string, pas: number): string {
  const compteur = Buffer.alloc(8);
  compteur.writeUInt32BE(Math.floor(pas / 2 ** 32), 0);
  compteur.writeUInt32BE(pas >>> 0, 4);

  const empreinte = createHmac("sha1", decoderBase32(secret)).update(compteur).digest();

  // Troncature dynamique (RFC 4226 §5.3) : les quatre bits de poids faible du
  // dernier octet designent ou lire les quatre octets du code.
  const decalage = empreinte[empreinte.length - 1]! & 0x0f;
  const binaire =
    ((empreinte[decalage]! & 0x7f) << 24) |
    (empreinte[decalage + 1]! << 16) |
    (empreinte[decalage + 2]! << 8) |
    empreinte[decalage + 3]!;

  return (binaire % 10 ** CHIFFRES).toString().padStart(CHIFFRES, "0");
}

export function codeActuel(secret: string, maintenant: Date = new Date()): string {
  return codePourPas(secret, Math.floor(maintenant.getTime() / 1000 / PAS_SECONDES));
}

/**
 * Compare en TEMPS CONSTANT. Une comparaison naive revelerait, par sa duree,
 * combien de chiffres de tete sont justes — de quoi retrouver un code a six
 * chiffres bien plus vite que par force brute.
 */
export function codeValide(secret: string, saisi: string, maintenant: Date = new Date()): boolean {
  const propre = saisi.replace(/\D/g, "");
  if (propre.length !== CHIFFRES) return false;

  const pasCourant = Math.floor(maintenant.getTime() / 1000 / PAS_SECONDES);
  const attendu = Buffer.from(propre);

  let valide = false;
  for (let d = -TOLERANCE_PAS; d <= TOLERANCE_PAS; d++) {
    const candidat = Buffer.from(codePourPas(secret, pasCourant + d));
    // Toutes les etapes sont parcourues, sans court-circuit : sortir des la
    // premiere reussite revelerait par le temps quelle etape a correspondu.
    if (candidat.length === attendu.length && timingSafeEqual(candidat, attendu)) valide = true;
  }
  return valide;
}

/**
 * Adresse otpauth:// lue par les applications d'authentification.
 * Elle contient le SECRET : elle ne doit apparaitre qu'une fois, a
 * l'inscription, et ne jamais etre journalisee.
 */
export function uriOtpauth(secret: string, email: string, emetteur = "CaddiePerf"): string {
  const etiquette = encodeURIComponent(`${emetteur}:${email}`);
  const parametres = new URLSearchParams({
    secret,
    issuer: emetteur,
    algorithm: "SHA1",
    digits: String(CHIFFRES),
    period: String(PAS_SECONDES),
  });
  return `otpauth://totp/${etiquette}?${parametres.toString()}`;
}

/** Codes de secours : huit groupes lisibles, a noter sur papier. */
export function genererCodesDeSecours(nombre = 8): string[] {
  return Array.from({ length: nombre }, () => {
    const brut = randomBytes(5).toString("hex").toUpperCase();
    return `${brut.slice(0, 5)}-${brut.slice(5, 10)}`;
  });
}
