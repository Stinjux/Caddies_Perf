import { ValidationError } from "../errors";

/**
 * Validation du logo d'un parcours (FR-003).
 * Formats et taille limites : un fichier refuse doit l'etre explicitement,
 * jamais en silence.
 */

export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
export const MAX_LOGO_BYTES = 512 * 1024;

export function validateLogo(file: { type: string; size: number }): void {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    throw new ValidationError(
      "logo",
      `Format non pris en charge. Formats acceptés : PNG, JPEG, SVG, WebP.`,
    );
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new ValidationError(
      "logo",
      `Fichier trop volumineux (${Math.round(file.size / 1024)} Ko). Maximum : 512 Ko.`,
    );
  }
}
