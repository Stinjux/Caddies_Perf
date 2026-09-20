import type { Langue } from "./index";

/**
 * Textes du parcours client, en FRANÇAIS — langue de référence.
 *
 * Les quatre autres langues suivront la même structure, une fois approuvées.
 * Le libellé exact vient de la spécification 4.
 */
export const fr = {
  // Écran d'accueil
  choisirLangue: "Choisissez votre langue",
  moinsDe30Secondes: "Moins de 30 secondes",
  choisissezCaddie: "Quel caddie vous a accompagné ?",
  choisirDansLaListe: "Choisissez dans la liste",
  commencer: "Commencer l'évaluation",
  caddieNonChoisi: "Merci de choisir votre caddie dans la liste.",

  // Critères
  titreCriteres: "Comment évaluez-vous votre caddie sur les aspects suivants ?",
  criteres: {
    accueil: "Accueil et attitude",
    regles_etiquette: "Connaissance des règles et de l'étiquette",
    connaissance_parcours: "Connaissance du parcours",
    lecture_verts: "Lecture des verts",
    communication: "Capacité à communiquer clairement avec vous",
    experience_generale: "Expérience générale",
  },
  etoiles: {
    1: "Très insatisfaisant",
    2: "Insatisfaisant",
    3: "Satisfaisant",
    4: "Très bien",
    5: "Excellent",
  },
  nonApplicable: "Non applicable",

  // Parcours et prix
  titreParcours:
    "Dans l'ensemble, comment évaluez-vous votre expérience sur notre terrain aujourd'hui ?",
  titrePrixQualite: (prix: number) =>
    `Compte tenu de la qualité du service reçu, comment évaluez-vous le rapport qualité-prix du service de caddie à ${prix} MAD ?`,
  titrePrixNiveau: (prix: number) =>
    `Comment considérez-vous le prix de ${prix} MAD pour ce service de caddie ?`,
  prix: {
    beaucoup_trop_bas: "Beaucoup trop bas",
    plutot_bas: "Plutôt bas",
    juste_et_raisonnable: "Juste et raisonnable",
    plutot_eleve: "Plutôt élevé",
    beaucoup_trop_eleve: "Beaucoup trop élevé",
  },

  // Commentaire
  titreCommentaire: "Souhaitez-vous ajouter un commentaire ?",
  commentaireFacultatif: "Facultatif",

  // Envoi et numérotation
  envoyer: "Envoyer mon évaluation",
  questionSur: (n: number, total: number) => `Question ${n} sur ${total}`,
  echelleBasse: "Très insatisfaisant",
  echelleHaute: "Excellent",
  reponsesManquantes:
    "Merci de répondre à toutes les questions. Vos réponses déjà données sont conservées.",
  questionOubliee: "Sans réponse",

  // Remerciement
  merci: "Merci pour votre évaluation !",
  merciDetail:
    "Votre avis nous aide à améliorer l'expérience de nos joueurs et la qualité de notre service.",
  partagerGoogle: "Souhaitez-vous également partager votre expérience sur Google ?",
  boutonGoogle: "Laisser un avis sur Google",
  terminer: "Terminer",
  termine: "À bientôt sur nos parcours.",

  // Situations particulières
  echecs: {
    jeton_inconnu: "Ce code ne correspond à aucun parcours. Vérifiez auprès du départ.",
    aucun_caddie:
      "Aucun caddie n'est disponible à l'évaluation pour le moment. Signalez-le au départ.",
  },
  dejaEvalue: "Vous avez déjà évalué ce caddie aujourd'hui. Merci !",
} as const;

export type Messages = typeof fr;

/** Tant qu'une langue n'est pas approuvée, elle retombe sur le français. */
export function messages(_langue: Langue): Messages {
  return fr;
}
