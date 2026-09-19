import { describe, it, expect } from "vitest";
import {
  encoder,
  decoder,
  champsManquants,
  prixManquant,
  premierChampManquant,
  versSoumission,
  CHAMPS_NOTES,
  type Reponses,
} from "@/server/services/reponses";

/**
 * PRÉSERVATION DES RÉPONSES (spéc. 4, FR-367 et suivantes).
 *
 * Le questionnaire tient sur une page défilante et le navigateur signale
 * lui-même les oublis. Le serveur reste l'autorité : il revérifie tout, et
 * les réponses déjà données doivent survivre au refus — sans quoi le client
 * les ressaisirait une à une.
 */

const vide: Reponses = { notes: {}, perceptionPrix: null, commentaire: "" };

const complet: Reponses = {
  notes: {
    accueil: 5,
    regles_etiquette: 4,
    connaissance_parcours: 3,
    lecture_verts: "na",
    communication: 4,
    experience_generale: 5,
    noteParcours: 4,
    rapportQualitePrix: 3,
  },
  perceptionPrix: "juste_et_raisonnable",
  commentaire: "Commentaire fictif",
};

describe("aller-retour dans l'adresse", () => {
  it("restitue exactement les notes", () => {
    const rendu = decoder(encoder(complet));
    expect(rendu.notes).toEqual(complet.notes);
  });

  it("restitue la perception du prix", () => {
    expect(decoder(encoder(complet)).perceptionPrix).toBe("juste_et_raisonnable");
  });

  it("conserve « non applicable » comme réponse à part entière", () => {
    expect(decoder(encoder(complet)).notes.lecture_verts).toBe("na");
  });

  it("reste court : moins de 40 caractères pour neuf réponses", () => {
    expect(encoder(complet).length).toBeLessThan(40);
  });

  it("ne transporte JAMAIS le commentaire", () => {
    // Un commentaire dans l'adresse finirait dans les journaux du serveur,
    // ce qui reviendrait à journaliser une donnée client (FR-031).
    expect(encoder(complet)).not.toContain("Commentaire");
    expect(decoder(encoder(complet)).commentaire).toBe("");
  });

  it("ignore une valeur d'adresse forgée ou corrompue", () => {
    expect(decoder("z9.a7.??.").notes.accueil).toBeUndefined();
    expect(decoder("").notes).toEqual({});
    expect(decoder(undefined).notes).toEqual({});
  });

  it("refuse une note hors de 1 à 5 venue de l'adresse", () => {
    expect(decoder("a9").notes.accueil).toBeUndefined();
    expect(decoder("a0").notes.accueil).toBeUndefined();
    expect(decoder("a3").notes.accueil).toBe(3);
  });
});

describe("obligation des notes", () => {
  it("signale les huit notes manquantes sur un formulaire vide", () => {
    expect(champsManquants(vide)).toEqual([...CHAMPS_NOTES]);
    expect(prixManquant(vide)).toBe(true);
  });

  it("ne signale rien sur un formulaire complet", () => {
    expect(champsManquants(complet)).toEqual([]);
    expect(prixManquant(complet)).toBe(false);
  });

  it("accepte « non applicable » comme réponse — ce n'est pas un oubli", () => {
    const naPartout: Reponses = {
      notes: Object.fromEntries(CHAMPS_NOTES.map((c) => [c, "na"])),
      perceptionPrix: "plutot_bas",
      commentaire: "",
    };
    expect(champsManquants(naPartout)).toEqual([]);
  });

  it("n'exige jamais le commentaire", () => {
    const sansCommentaire = { ...complet, commentaire: "" };
    expect(champsManquants(sansCommentaire)).toEqual([]);
  });
});

describe("ancre sur la première question sans réponse", () => {
  it("désigne la première question quand rien n'est rempli", () => {
    expect(premierChampManquant(vide)).toBe("accueil");
  });

  it("désigne la troisième quand les deux premières sont données", () => {
    const partiel: Reponses = {
      notes: { accueil: 4, regles_etiquette: 2 },
      perceptionPrix: null,
      commentaire: "",
    };
    expect(premierChampManquant(partiel)).toBe("connaissance_parcours");
  });

  it("désigne la note du parcours quand c'est la seule manquante", () => {
    const partiel: Reponses = {
      notes: { ...complet.notes, noteParcours: undefined },
      perceptionPrix: "plutot_bas",
      commentaire: "",
    };
    expect(premierChampManquant(partiel)).toBe("noteParcours");
  });

  it("désigne la perception du prix quand seule elle manque", () => {
    expect(premierChampManquant({ ...complet, perceptionPrix: null })).toBe("perceptionPrix");
  });

  it("ne désigne rien quand le formulaire est complet", () => {
    expect(premierChampManquant(complet)).toBeNull();
  });

  it("nomme un champ qui existe réellement comme ancre dans la page", () => {
    // Une ancre inventée renverrait le client en haut de page sans qu'aucun
    // test ne s'en aperçoive. Le nom doit être celui d'un champ du formulaire.
    const ancre = premierChampManquant(vide);
    expect([...CHAMPS_NOTES, "perceptionPrix"]).toContain(ancre);
  });
});

describe("conversion vers la soumission", () => {
  it("traduit « non applicable » en valeur nulle, jamais en zéro", () => {
    const s = versSoumission(complet);
    expect(s.notes.lecture_verts).toBeNull();
    expect(s.notes.accueil).toBe(5);
  });

  it("sépare la note du parcours et le rapport qualité-prix des critères", () => {
    const s = versSoumission(complet);
    expect(s.noteParcours).toBe(4);
    expect(s.rapportQualitePrix).toBe(3);
    expect(Object.keys(s.notes)).not.toContain("noteParcours");
    expect(Object.keys(s.notes)).not.toContain("rapportQualitePrix");
  });
});
