import { randomUUID } from "node:crypto";

/**
 * Classes d'erreur du socle.
 *
 * PRINCIPE I — aucune donnee personnelle dans un message, une trace ou un
 * journal technique (FR-031). Les erreurs portent un identifiant de
 * correlation, jamais de valeur metier.
 */

export class AppError extends Error {
  readonly correlationId = randomUUID();
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Ressource absente OU appartenant a un autre terrain : indiscernable (FR-025). */
export class NotFoundError extends AppError {
  constructor() {
    super("Ressource introuvable.", "not_found");
  }
}

/** Ne revele ni le contenu ni l'existence de la ressource visee (FR-022). */
export class ForbiddenError extends AppError {
  constructor() {
    super("Vous n'avez pas les droits nécessaires pour cette action.", "forbidden");
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super("Session absente ou expirée.", "unauthenticated");
  }
}

export class ValidationError extends AppError {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message, "validation");
  }
}

/** FR-045 : refus d'ecrasement silencieux. */
export class ConflictError extends AppError {
  constructor() {
    super("Cette fiche a été modifiée entre-temps. Rechargez la page.", "conflict");
  }
}

/** FR-015 : un terrain conserve toujours au moins un administrateur actif. */
export class LastAdminError extends AppError {
  constructor() {
    super(
      "Opération refusée : ce terrain doit conserver au moins un administrateur actif.",
      "last_admin",
    );
  }
}
