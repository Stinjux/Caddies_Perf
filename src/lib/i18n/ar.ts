import type { Messages } from "./fr";

/**
 * استمارة اللاعب — العربية. صادق عليها صاحب المنتج.
 *
 * Questionnaire du joueur — ARABE.
 *
 * L'arabe s'écrit de droite à gauche : la direction du document est posée par
 * la mise en page racine (dir="rtl"), et la rangée d'étoiles se met en miroir
 * d'elle-même, parce qu'elle est disposée en `row-reverse` — laquelle suit la
 * direction d'écriture au lieu de la contredire.
 */
export const ar: Messages = {
  choisirLangue: "اختر لغتك",
  moinsDe30Secondes: "أقل من 30 ثانية",
  choisissezCaddie: "أي كادي رافقك اليوم؟",
  choisirDansLaListe: "اختر من القائمة",
  commencer: "ابدأ التقييم",
  caddieNonChoisi: "يرجى اختيار الكادي من القائمة.",

  titreCriteres: "كيف تقيّم الكادي في النقاط التالية؟",
  criteres: {
    accueil: "الاستقبال والسلوك",
    regles_etiquette: "معرفة القواعد وآداب اللعبة",
    connaissance_parcours: "معرفة الملعب",
    lecture_verts: "قراءة الغرين",
    communication: "القدرة على التواصل معك بوضوح",
    experience_generale: "التجربة العامة",
  },
  etoiles: {
    1: "غير مُرضٍ إطلاقاً",
    2: "غير مُرضٍ",
    3: "مُرضٍ",
    4: "جيد جداً",
    5: "ممتاز",
  },
  nonApplicable: "لا ينطبق",

  titreParcours: "بشكل عام، كيف تقيّم تجربتك في ملعبنا اليوم؟",
  titrePrixNiveau: (prix: number) => `كيف ترى سعر ${prix} درهم مقابل خدمة الكادي؟`,
  prix: {
    beaucoup_trop_bas: "منخفض جداً",
    plutot_bas: "منخفض نوعاً ما",
    juste_et_raisonnable: "عادل ومعقول",
    plutot_eleve: "مرتفع نوعاً ما",
    beaucoup_trop_eleve: "مرتفع جداً",
  },

  titreCommentaire: "هل ترغب في إضافة تعليق؟",
  commentaireFacultatif: "اختياري",

  envoyer: "أرسل تقييمي",
  questionSur: (n: number, total: number) => `السؤال ${n} من ${total}`,
  echelleBasse: "غير مُرضٍ إطلاقاً",
  echelleHaute: "ممتاز",
  reponsesManquantes: "يرجى الإجابة عن جميع الأسئلة. إجاباتك السابقة محفوظة.",
  questionOubliee: "بدون إجابة",

  merci: "شكراً على تقييمك!",
  merciDetail: "رأيك يساعدنا على تحسين تجربة لاعبينا وجودة خدمتنا.",
  partagerGoogle: "هل ترغب أيضاً في مشاركة تجربتك على Google؟",
  boutonGoogle: "اترك رأياً على Google",
  terminer: "إنهاء",
  termine: "إلى اللقاء في ملعبنا.",

  echecs: {
    jeton_inconnu: "هذا الرمز لا يطابق أي ملعب. تحقق عند نقطة الانطلاق.",
    aucun_caddie: "لا يوجد كادي متاح للتقييم في الوقت الحالي. أبلغ عند نقطة الانطلاق.",
  },
  dejaEvalue: "لقد قيّمت هذا الكادي اليوم. شكراً لك!",
};
