/**
 * Les instants sont stockes en timestamptz (UTC). La date LOCALE d'un terrain
 * en est derivee a la lecture, jamais stockee — sauf assignment.local_date,
 * figee a la creation car elle sert de cle au decompte des jours travailles.
 */

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("fr", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Date locale du terrain au format AAAA-MM-JJ (FR-005, FR-044). */
export function localDateFor(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Affichage d'un instant dans le fuseau du terrain, jamais celui du navigateur. */
export function formatInCourseTimezone(
  instant: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: timezone }).format(instant);
}
