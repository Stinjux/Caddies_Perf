/**
 * Mutations des renseignements personnels.
 *
 * Re-exporte depuis le point d'entree unique : la separation en fichiers
 * n'ouvre AUCUNE seconde porte. Toute lecture et toute ecriture continue de
 * passer par src/server/pii/index.ts, donc par la journalisation
 * obligatoire (FR-030, FR-036).
 */
export { writeBirthYear, eraseBirthYear } from "./index";
