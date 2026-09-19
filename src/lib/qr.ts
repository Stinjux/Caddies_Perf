import QRCode from "qrcode";

/**
 * Rendu des QR codes.
 *
 * Le QR encode UNIQUEMENT une adresse de la forme https://…/e/<jeton>.
 * Le jeton est opaque : ni nom de client, ni nom de caddie, ni numéro de
 * réservation, ni aucune donnée personnelle (FR-031).
 */

/** Correction d'erreur élevée : l'étiquette vit dehors, sur une voiturette. */
const OPTIONS = { errorCorrectionLevel: "H" as const, margin: 1, width: 512 };

export function urlEvaluation(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/e/${token}`;
}

export async function qrDataUrl(baseUrl: string, token: string): Promise<string> {
  return QRCode.toDataURL(urlEvaluation(baseUrl, token), OPTIONS);
}

export async function qrSvg(baseUrl: string, token: string): Promise<string> {
  return QRCode.toString(urlEvaluation(baseUrl, token), { ...OPTIONS, type: "svg" });
}
