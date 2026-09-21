import type { TextesAdmin } from "./fr";

/**
 * ADMINISTRATION INTERFACE — English.
 *
 * Typed against the French dictionary: a missing key, a superfluous one, or a
 * function taking the wrong arguments fails compilation. A translation cannot
 * silently fall out of step with the interface it serves.
 *
 * "Parcours" is rendered "course" — the golf sense, not a route or a class.
 */
export const adminEn: TextesAdmin = {
  langue: {
    label: "Language",
    fr: "Français",
    en: "English",
  },

  nav: {
    parcours: "Courses",
    caddies: "Caddies",
    qr: "QR poster",
    comptes: "Accounts",
    rapports: "Reports",
    journal: "Audit log",
    deconnexion: "Sign out",
    parcoursActif: "Active course",
    changer: "Switch",
  },

  commun: {
    administrateur: "Administrator",
    adminGeneral: "General administrator",
    starter: "Starter",
    actif: "Active",
    archive: "Archived",
    desactive: "Disabled",
    enregistrer: "Save",
    retour: "Back",
    filtrer: "Filter",
    tous: "All",
    toutes: "All",
    du: "From",
    au: "To",
    obligatoire: "Required.",
  },

  connexion: {
    sousTitre: "Sign in",
    courriel: "Email address",
    motDePasse: "Password",
    seConnecter: "Sign in",
    echec: "Unable to sign in.",
  },

  choisir: {
    titre: "Choose your course",
  },

  parcours: {
    titre: "Courses",
    ajouter: "Add a course",
    aucunRattache: "No course is linked to your account.",
    aucunDuTout: "No course exists yet. Create the first one.",
    reserveGeneral: "Only a general administrator can create a course.",
    tousLesParcours: "You are seeing every course on the platform.",
  },

  formParcours: {
    nouveau: "New course",
    nom: "Course name",
    adresse: "Address",
    fuseau: "Time zone",
    fuseauAide: "Every date for this course is shown in this zone, never the reader's.",
    couleurPrincipale: "Primary colour",
    couleurSecondaire: "Secondary colour",
    logo: "Logo",
    logoAide: (formats: string) => `Accepted formats: ${formats}. 512 KB maximum.`,
    lienGoogle: "Google Reviews link",
    lienGoogleAide: "An https address belonging to this course.",
  },

  comptes: {
    titre: "Course accounts",
    cree: "Account created.",
    creationImpossible: "Unable to create the account.",
    ajouter: "Add an account",
    prenom: "First name",
    nom: "Last name",
    courriel: "Email address",
    motDePasse: "Password (12 characters minimum)",
    creer: "Create account",
    niveaux: "Two levels of administration",
    niveauxDetail:
      "An administrator manages the course they are linked to. A general administrator manages every course, including those created later, and is the only one who can create a course.",
    sectionGeneraux: "General administrators",
    aucunGeneral: "No general administrator.",
    rosterDetail:
      "Across the whole platform. To grant or revoke this level, use the account list of the course the person is linked to.",
    cestVous: "(you)",
    promouvoir: "Promote to general administrator",
    retirer: "Revoke general level",
    promu: "General level granted.",
    retire: "General level revoked.",
  },

  caddies: {
    titre: "Caddies",
    importer: "Import a CSV file",
    aucun: "No caddie on file. Import a CSV file to begin.",
    anciennete: (n: number) => `${n} year${n > 1 ? "s" : ""} of service`,
    ancienneteInconnue: "Years of service not recorded",
    disponible: "Available",
    indisponible: "Unavailable",
    renseignements: "Personal details",
    depart: "Departure",
  },

  import: {
    titre: "Import caddies",
    bilan: (crees: string, remplaces: string, ignores: string) =>
      `${crees} caddie(s) created, ${remplaces} replaced, ${ignores} skipped.`,
    aucunFichier: "No file selected.",
    avertissementTitre: "Three columns are never kept",
    avertissementDetail:
      "Clothing size, strength and home address are read and then discarded. They cannot be stored: the database has no column to receive them.",
    avertissementAge:
      "Age is converted to a year of birth and kept in a separate space, open to administrators only.",
    colonnesAttendues: "Expected columns, in this order",
    rejetee: " — discarded",
    detection:
      "Encoding and separator are detected automatically. A header row is recognised if present.",
    fichier: "CSV file",
    bouton: "Import",
  },

  pii: {
    sousTitre:
      "Personal details · administrators only. Every viewing and every change is recorded in the audit log.",
    anneeNaissance: "Year of birth",
    aide: "The only age data kept. No full date, no clothing size, no address: the database schema cannot receive them.",
    enregistrerCorrection: "Save correction",
    corrigee: "Correction saved.",
    effacees: "Personal details erased.",
    correctionImpossible: "Unable to save the correction.",
    effacementDetail: "Erasure is permanent. Evaluations and course averages are left untouched.",
    effacer: "Erase personal details",
  },

  qr: {
    titre: "Starter's poster",
    explication:
      "Print this page and display it at the first tee. One code covers the whole course: the player then picks their caddie from a list. The code is permanent — the same poster holds good from one season to the next.",
    manqueUrl:
      "Cannot print: the site's public address (PUBLIC_BASE_URL) is not configured. Without it, the poster would lead nowhere.",
    evaluez: "Rate your caddie",
    scannez: "Scan this code — under 30 seconds, no app to install.",
  },

  rapports: {
    titre: "Reports",
    explication: (seuil: number) =>
      `Comparisons are drawn within the same course, the same period and the same criteria. Below ${seuil} evaluations, a gap is still shown but flagged as not significant.`,
    evalMin: "Minimum evaluations",
    statut: "Status",
    actifs: "Active",
    desactives: "Disabled",
    exporter: "Export as CSV",
    tuileEvaluations: "Evaluations",
    tuileNote: "Course rating",
    tuileClics: "Clicks to Google",
    caddies: "Caddies",
    aucunCaddie: "No caddie matches these criteria.",
    colCaddie: "Caddie",
    colEvals: "Evals",
    colCompetences: "Skills",
    colExperience: "Experience",
    colScore: "Score",
    colEcart: "Gap",
    nonSignificatif: "not significant",
    distribution: "Rating distribution",
    aucuneNote: "No rating in this period.",
    perceptionPrix: "Perceived price",
    jamaisDansScore: "Never counts towards a caddie's score.",
    aucuneReponse: "No answer in this period.",
    criteresMesures: (liste: string) =>
      `Criteria measured: ${liste}. No personal data appears in this report.`,
    criteres: {
      accueil: "Welcome",
      regles_etiquette: "Rules",
      connaissance_parcours: "Course",
      lecture_verts: "Greens",
      communication: "Communication",
      experience_generale: "Experience",
    },
    prix: {
      beaucoup_trop_bas: "Far too low",
      plutot_bas: "Rather low",
      juste_et_raisonnable: "Fair and reasonable",
      plutot_eleve: "Rather high",
      beaucoup_trop_eleve: "Far too high",
    },
  },

  journal: {
    titre: "Audit log",
    explication:
      "This log is write-only. No entry can be altered or deleted, and no personal data appears in it.",
    nature: "Kind",
    auteur: "Author",
    aucune: "No action matches these criteria.",
    par: "by",
    actions: {
      "course.create": "Course created",
      "course.update": "Course edited",
      "course.archive": "Course archived",
      "account.create": "Account created",
      "account.update": "Account edited",
      "account.disable": "Account disabled",
      "account.enable": "Account re-enabled",
      "account.attach": "Account linked",
      "account.detach": "Account unlinked",
      "account.password_reset": "Password reset",
      "account.grant_general": "General level granted",
      "account.revoke_general": "General level revoked",
      "caddie.create": "Caddie created",
      "caddie.update": "Caddie edited",
      "caddie.disable": "Caddie disabled",
      "pii.read": "Personal details viewed",
      "pii.write": "Personal details edited",
      "pii.erase": "Personal details erased",
      "retention.purge": "Scheduled purge",
      "caddie.list": "Caddie list viewed",
      "caddie.read": "Caddie record viewed",
      "account.list": "Account list viewed",
      "report.read": "Report viewed",
      "report.export": "Report exported",
      "audit.read": "Audit log viewed",
    },
  },

  erreur: {
    titre: "Action not possible",
    detail: "You do not have the necessary rights, or this page does not exist.",
    reessayer: "Try again",
    retourParcours: "Back to courses",
  },
};
