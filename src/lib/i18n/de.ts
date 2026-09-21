import type { Messages } from "./fr";

/** Spielerfragebogen — Deutsch. Vom Produktverantwortlichen freigegeben. */
export const de: Messages = {
  choisirLangue: "Wählen Sie Ihre Sprache",
  moinsDe30Secondes: "Weniger als 30 Sekunden",
  choisissezCaddie: "Welcher Caddie hat Sie begleitet?",
  choisirDansLaListe: "Aus der Liste wählen",
  commencer: "Bewertung beginnen",
  caddieNonChoisi: "Bitte wählen Sie Ihren Caddie aus der Liste.",

  titreCriteres: "Wie bewerten Sie Ihren Caddie in den folgenden Punkten?",
  criteres: {
    accueil: "Empfang und Auftreten",
    regles_etiquette: "Kenntnis der Regeln und der Etikette",
    connaissance_parcours: "Platzkenntnis",
    lecture_verts: "Lesen der Grüns",
    communication: "Fähigkeit, klar mit Ihnen zu kommunizieren",
    experience_generale: "Gesamteindruck",
  },
  etoiles: {
    1: "Sehr unbefriedigend",
    2: "Unbefriedigend",
    3: "Befriedigend",
    4: "Sehr gut",
    5: "Ausgezeichnet",
  },
  nonApplicable: "Nicht zutreffend",

  titreParcours: "Wie bewerten Sie insgesamt Ihren heutigen Tag auf unserem Platz?",
  titrePrixNiveau: (prix: number) =>
    `Wie finden Sie den Preis von ${prix} MAD für diesen Caddie-Service?`,
  prix: {
    beaucoup_trop_bas: "Viel zu niedrig",
    plutot_bas: "Eher niedrig",
    juste_et_raisonnable: "Angemessen",
    plutot_eleve: "Eher hoch",
    beaucoup_trop_eleve: "Viel zu hoch",
  },

  titreCommentaire: "Möchten Sie einen Kommentar hinzufügen?",
  commentaireFacultatif: "Freiwillig",

  envoyer: "Bewertung absenden",
  questionSur: (n: number, total: number) => `Frage ${n} von ${total}`,
  echelleBasse: "Sehr unbefriedigend",
  echelleHaute: "Ausgezeichnet",
  reponsesManquantes:
    "Bitte beantworten Sie alle Fragen. Ihre bereits gegebenen Antworten bleiben erhalten.",
  questionOubliee: "Ohne Antwort",

  merci: "Vielen Dank für Ihre Bewertung!",
  merciDetail:
    "Ihre Rückmeldung hilft uns, das Erlebnis unserer Spieler und die Qualität unseres Service zu verbessern.",
  partagerGoogle: "Möchten Sie Ihre Erfahrung auch auf Google teilen?",
  boutonGoogle: "Bewertung auf Google abgeben",
  terminer: "Beenden",
  termine: "Bis bald auf unserem Platz.",

  echecs: {
    jeton_inconnu: "Dieser Code gehört zu keinem Platz. Bitte am Abschlag nachfragen.",
    aucun_caddie: "Derzeit steht kein Caddie zur Bewertung bereit. Bitte am Abschlag melden.",
  },
  dejaEvalue: "Sie haben diesen Caddie heute bereits bewertet. Vielen Dank!",
};
