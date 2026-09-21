import type { Messages } from "./fr";

/** Cuestionario del jugador — español. Aprobado por el propietario del producto. */
export const es: Messages = {
  choisirLangue: "Elija su idioma",
  moinsDe30Secondes: "Menos de 30 segundos",
  choisissezCaddie: "¿Qué caddie le acompañó?",
  choisirDansLaListe: "Elija de la lista",
  commencer: "Comenzar la evaluación",
  caddieNonChoisi: "Por favor, elija su caddie en la lista.",

  titreCriteres: "¿Cómo valora a su caddie en los siguientes aspectos?",
  criteres: {
    accueil: "Acogida y trato",
    regles_etiquette: "Conocimiento de las reglas y la etiqueta",
    connaissance_parcours: "Conocimiento del campo",
    lecture_verts: "Lectura de los greens",
    communication: "Capacidad de comunicarse con claridad",
    experience_generale: "Experiencia general",
  },
  etoiles: {
    1: "Muy insatisfactorio",
    2: "Insatisfactorio",
    3: "Satisfactorio",
    4: "Muy bueno",
    5: "Excelente",
  },
  nonApplicable: "No procede",

  titreParcours: "En conjunto, ¿cómo valora su jornada en nuestro campo hoy?",
  titrePrixNiveau: (prix: number) =>
    `¿Cómo le parece el precio de ${prix} MAD por este servicio de caddie?`,
  prix: {
    beaucoup_trop_bas: "Demasiado bajo",
    plutot_bas: "Más bien bajo",
    juste_et_raisonnable: "Justo y razonable",
    plutot_eleve: "Más bien alto",
    beaucoup_trop_eleve: "Demasiado alto",
  },

  titreCommentaire: "¿Desea añadir un comentario?",
  commentaireFacultatif: "Opcional",

  envoyer: "Enviar mi evaluación",
  questionSur: (n: number, total: number) => `Pregunta ${n} de ${total}`,
  echelleBasse: "Muy insatisfactorio",
  echelleHaute: "Excelente",
  reponsesManquantes:
    "Por favor, responda a todas las preguntas. Se conservan las respuestas ya dadas.",
  questionOubliee: "Sin respuesta",

  merci: "¡Gracias por su evaluación!",
  merciDetail:
    "Su opinión nos ayuda a mejorar la experiencia de nuestros jugadores y la calidad de nuestro servicio.",
  partagerGoogle: "¿Desea compartir también su experiencia en Google?",
  boutonGoogle: "Dejar una reseña en Google",
  terminer: "Finalizar",
  termine: "Hasta pronto en nuestro campo.",

  echecs: {
    jeton_inconnu: "Este código no corresponde a ningún campo. Consulte en la salida.",
    aucun_caddie: "Ningún caddie está disponible para evaluación ahora. Avise en la salida.",
  },
  dejaEvalue: "Ya ha evaluado a este caddie hoy. ¡Gracias!",
};
