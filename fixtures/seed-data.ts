/**
 * JEU DE DONNEES ENTIEREMENT FICTIF (principe II).
 * Aucun nom, aucune adresse, aucun identifiant reel.
 *
 * Deux terrains : avec un seul, aucun test de cloisonnement ne prouverait rien.
 */

export const courses = [
  {
    key: "cedres",
    name: "Golf des Cèdres",
    address: "Route Fictive 1, Ville-Exemple",
    timezone: "Africa/Casablanca",
    brandColorPrimary: "#1b4d3e",
    brandColorSecondary: "#d4af37",
    googleReviewUrl: "https://example.invalid/avis/cedres",
  },
  {
    key: "atlas",
    name: "Royal Atlas",
    address: "Avenue Fictive 2, Ville-Exemple",
    timezone: "Africa/Casablanca",
    brandColorPrimary: "#14304f",
    brandColorSecondary: "#c9a227",
    googleReviewUrl: "https://example.invalid/avis/atlas",
  },
] as const;

/**
 * SECOND FACTEUR DES COMPTES D'ESSAI.
 *
 * Secret TOTP FICTIF, identique pour tous les comptes d'amorcage : il ne
 * protege rien, il rend seulement la connexion a deux facteurs jouable en
 * developpement et dans les tests de bout en bout, qui calculent le code a
 * partir de lui. Un vrai secret est tire au hasard, une fois, a l'inscription.
 */
export const SECRET_TOTP_FICTIF = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

export const accounts = [
  {
    key: "admin_cedres",
    email: "admin.cedres@example.invalid",
    firstName: "Amina",
    lastName: "Exemple",
    password: "MotDePasseFictif1!",
    links: [{ course: "cedres", role: "admin" }],
    totpSecret: SECRET_TOTP_FICTIF,
  },
  {
    key: "starter_cedres",
    email: "starter.cedres@example.invalid",
    firstName: "Karim",
    lastName: "Exemple",
    password: "MotDePasseFictif2!",
    links: [{ course: "cedres", role: "starter" }],
  },
  {
    key: "admin_atlas",
    email: "admin.atlas@example.invalid",
    firstName: "Sofia",
    lastName: "Exemple",
    password: "MotDePasseFictif3!",
    links: [{ course: "atlas", role: "admin" }],
    totpSecret: SECRET_TOTP_FICTIF,
  },
  {
    key: "admin_deux",
    email: "admin.deux@example.invalid",
    firstName: "Youssef",
    lastName: "Exemple",
    password: "MotDePasseFictif4!",
    totpSecret: SECRET_TOTP_FICTIF,
    links: [
      { course: "cedres", role: "admin" },
      { course: "atlas", role: "starter" },
    ],
  },
] as const;

export const caddies = [
  {
    key: "c1",
    course: "cedres",
    internalRef: "CED-001",
    firstName: "Hassan",
    lastName: "Fictif",
    seniorityYears: 6,
    birthYear: 1988,
    status: "active",
  },
  {
    key: "c2",
    course: "cedres",
    internalRef: "CED-002",
    firstName: "Omar",
    lastName: "Fictif",
    seniorityYears: 2,
    birthYear: 1999,
    status: "active",
  },
  {
    key: "c3",
    course: "cedres",
    internalRef: "CED-003",
    firstName: "Rachid",
    lastName: "Fictif",
    seniorityYears: 11,
    birthYear: 1979,
    status: "disabled",
  },
  {
    key: "c4",
    course: "atlas",
    internalRef: "ATL-001",
    firstName: "Nabil",
    lastName: "Fictif",
    seniorityYears: 4,
    birthYear: 1993,
    status: "active",
  },
  {
    key: "c5",
    course: "atlas",
    internalRef: "ATL-002",
    firstName: "Said",
    lastName: "Fictif",
    seniorityYears: 1,
    birthYear: 2001,
    status: "active",
  },
  {
    key: "c6",
    course: "atlas",
    internalRef: "ATL-003",
    firstName: "Tarik",
    lastName: "Fictif",
    seniorityYears: 8,
    birthYear: 1985,
    status: "active",
  },
] as const;

export const carts = [
  { key: "v1", course: "cedres", visibleNumber: "12" },
  { key: "v2", course: "cedres", visibleNumber: "13" },
  { key: "v3", course: "atlas", visibleNumber: "01" },
  { key: "v4", course: "atlas", visibleNumber: "02" },
] as const;
