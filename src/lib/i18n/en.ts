import type { Messages } from "./fr";

/** Player questionnaire — English. Approved by the product owner. */
export const en: Messages = {
  choisirLangue: "Choose your language",
  moinsDe30Secondes: "Under 30 seconds",
  choisissezCaddie: "Which caddie was with you?",
  choisirDansLaListe: "Pick from the list",
  commencer: "Start the evaluation",
  caddieNonChoisi: "Please pick your caddie from the list.",

  titreCriteres: "How would you rate your caddie on the following?",
  criteres: {
    accueil: "Welcome and manner",
    regles_etiquette: "Knowledge of the rules and etiquette",
    connaissance_parcours: "Knowledge of the course",
    lecture_verts: "Reading the greens",
    communication: "Ability to communicate clearly with you",
    experience_generale: "Overall experience",
  },
  etoiles: {
    1: "Very poor",
    2: "Poor",
    3: "Satisfactory",
    4: "Very good",
    5: "Excellent",
  },
  nonApplicable: "Not applicable",

  titreParcours: "Overall, how would you rate your day on our course?",
  titrePrixNiveau: (prix: number) =>
    `How do you find the price of ${prix} MAD for this caddie service?`,
  prix: {
    beaucoup_trop_bas: "Far too low",
    plutot_bas: "Rather low",
    juste_et_raisonnable: "Fair and reasonable",
    plutot_eleve: "Rather high",
    beaucoup_trop_eleve: "Far too high",
  },

  titreCommentaire: "Would you like to add a comment?",
  commentaireFacultatif: "Optional",

  envoyer: "Send my evaluation",
  questionSur: (n: number, total: number) => `Question ${n} of ${total}`,
  echelleBasse: "Very poor",
  echelleHaute: "Excellent",
  reponsesManquantes: "Please answer every question. The answers you have given are kept.",
  questionOubliee: "No answer",

  merci: "Thank you for your evaluation!",
  merciDetail:
    "Your feedback helps us improve our players' experience and the quality of our service.",
  partagerGoogle: "Would you also like to share your experience on Google?",
  boutonGoogle: "Leave a review on Google",
  terminer: "Finish",
  termine: "See you again on our course.",

  echecs: {
    jeton_inconnu: "This code does not match any course. Please check at the first tee.",
    aucun_caddie: "No caddie is available for evaluation right now. Please tell the starter.",
  },
  dejaEvalue: "You have already evaluated this caddie today. Thank you!",
};
