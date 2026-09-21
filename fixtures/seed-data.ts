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

export const accounts = [
  {
    key: "admin_cedres",
    email: "admin.cedres@example.invalid",
    firstName: "Amina",
    lastName: "Exemple",
    password: "MotDePasseFictif1!",
    links: [{ course: "cedres", role: "admin" }],
  },
    {
    key: "admin_atlas",
    email: "admin.atlas@example.invalid",
    firstName: "Sofia",
    lastName: "Exemple",
    password: "MotDePasseFictif3!",
    links: [{ course: "atlas", role: "admin" }],
  },
  {
    key: "admin_deux",
    email: "admin.deux@example.invalid",
    firstName: "Youssef",
    lastName: "Exemple",
    password: "MotDePasseFictif4!",
    links: [
      { course: "cedres", role: "admin" },
      { course: "atlas", role: "admin" },
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
