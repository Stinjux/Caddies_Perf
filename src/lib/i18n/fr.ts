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
  bonCaddie: (prenom: string) => `Évaluez-vous bien ${prenom} ?`,
  oui: "Oui",
  nonPasMonCaddie: "Non, ce n'est pas mon caddie",

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
    jeton_inconnu: "Ce code ne correspond à aucune voiturette. Vérifiez auprès du départ.",
    aucune_affectation:
      "Aucune partie n'est associée à cette voiturette pour le moment. Si vous venez de terminer votre parcours, signalez-le au départ.",
    plusieurs_affectations:
      "Plusieurs parties sont associées à cette voiturette. Merci de vous adresser au départ pour évaluer votre caddie.",
    reservation_annulee: "Cette partie a été annulée. Aucune évaluation n'est possible.",
    partie_trop_ancienne:
      "Le délai pour évaluer cette partie est dépassé. Merci de votre compréhension.",
  },
  dejaEvalue: "Cette partie a déjà reçu le nombre maximal d'évaluations. Merci !",
  mauvaisCaddieMerci:
    "Merci de nous l'avoir signalé. Adressez-vous au départ pour évaluer le bon caddie.",
} as const;

export type Messages = typeof fr;

/** Tant qu'une langue n'est pas approuvée, elle retombe sur le français. */
export function messages(_langue: Langue): Messages {
  return fr;
}
