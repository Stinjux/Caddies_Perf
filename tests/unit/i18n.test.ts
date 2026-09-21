import { describe, it, expect } from "vitest";
import {
  LANGUES,
  LANGUES_DISPONIBLES,
  NOMS_LANGUES,
  messages,
  direction,
  resoudreLangue,
} from "@/lib/i18n";
import { fr } from "@/lib/i18n/fr";
import { LANGUES_ADMIN, textesAdmin, langueDepuisEntete } from "@/lib/i18n/admin/commun";
import { adminFr } from "@/lib/i18n/admin/fr";

/**
 * TRADUCTIONS.
 *
 * TypeScript garantit deja la FORME : une traduction a laquelle il manque une
 * cle ne compile pas. Ces tests portent sur ce que le compilateur ne peut pas
 * voir — qu'une chaine ne soit pas vide, qu'elle ne soit pas restee en
 * francais, et qu'un texte a trous place bien ses valeurs.
 */

type Noeud = Record<string, unknown>;

/** Chemins de toutes les feuilles, dans l'ordre. */
function chemins(objet: Noeud, prefixe = ""): string[] {
  return Object.entries(objet)
    .flatMap(([cle, valeur]) => {
      const chemin = prefixe ? `${prefixe}.${cle}` : cle;
      return valeur !== null && typeof valeur === "object"
        ? chemins(valeur as Noeud, chemin)
        : [chemin];
    })
    .sort();
}

/** Toutes les chaines d'un dictionnaire, fonctions appliquees. */
function textes(objet: Noeud): string[] {
  return Object.values(objet).flatMap((v) => {
    if (typeof v === "string") return [v];
    if (typeof v === "function") return [String((v as (...a: unknown[]) => string)(7, 9))];
    if (v !== null && typeof v === "object") return textes(v as Noeud);
    return [];
  });
}

describe("questionnaire du joueur — les cinq langues", () => {
  it("propose exactement les langues qui ont une traduction", () => {
    expect([...LANGUES_DISPONIBLES].sort()).toEqual([...LANGUES].sort());
    for (const l of LANGUES) expect(NOMS_LANGUES[l]).toBeTruthy();
  });

  for (const langue of LANGUES) {
    describe(langue, () => {
      const m = messages(langue) as unknown as Noeud;

      it("a exactement les mêmes clés que le français", () => {
        expect(chemins(m)).toEqual(chemins(fr as unknown as Noeud));
      });

      it("n'a aucun texte vide", () => {
        for (const texte of textes(m)) expect(texte.trim().length).toBeGreaterThan(0);
      });

      it("place le prix dans la question sur le tarif", () => {
        expect(messages(langue).titrePrixNiveau(350)).toContain("350");
      });

      it("place le rang et le total dans la numérotation des questions", () => {
        const numero = messages(langue).questionSur(2, 8);
        expect(numero).toContain("2");
        expect(numero).toContain("8");
      });

      if (langue !== "fr") {
        it("n'est pas restée en français", () => {
          // Une traduction oubliée se reconnaît à ce qu'elle recopie le moule.
          // On compare les textes VRAIMENT traduisibles : « Google » ou « MAD »
          // sont identiques partout, et c'est normal.
          const notres = textes(m);
          const leurs = textes(fr as unknown as Noeud);
          const identiques = notres.filter((t, i) => t === leurs[i]);
          expect(identiques.length).toBeLessThan(notres.length / 4);
        });
      }
    });
  }

  it("écrit l'arabe de droite à gauche, et les autres de gauche à droite", () => {
    expect(direction("ar")).toBe("rtl");
    for (const l of LANGUES.filter((x) => x !== "ar")) expect(direction(l)).toBe("ltr");
  });

  it("utilise bien l'alphabet arabe pour l'arabe", () => {
    // Sans cela, une traduction laissée en caractères latins passerait tous
    // les autres contrôles.
    const arabes = textes(messages("ar") as unknown as Noeud).filter((t) => /[؀-ۿ]/.test(t));
    expect(arabes.length).toBeGreaterThan(20);
  });

  it("retombe sur le français pour une langue inconnue ou absente", () => {
    expect(resoudreLangue(undefined)).toBe("fr");
    expect(resoudreLangue("zz")).toBe("fr");
    expect(resoudreLangue("ar")).toBe("ar");
  });
});

describe("interface d'administration — français et anglais", () => {
  for (const langue of LANGUES_ADMIN) {
    it(`${langue} : mêmes clés que le français, aucun texte vide`, () => {
      const d = textesAdmin(langue) as unknown as Noeud;
      expect(chemins(d)).toEqual(chemins(adminFr as unknown as Noeud));
      for (const texte of textes(d)) expect(texte.trim().length).toBeGreaterThan(0);
    });
  }

  it("traduit vraiment l'anglais", () => {
    const anglais = textes(textesAdmin("en") as unknown as Noeud);
    const francais = textes(adminFr as unknown as Noeud);
    const identiques = anglais.filter((t, i) => t === francais[i]);
    expect(identiques.length).toBeLessThan(anglais.length / 4);
  });

  it("nomme chaque langue dans sa propre langue", () => {
    expect(textesAdmin("fr").langue.fr).toBe("Français");
    expect(textesAdmin("en").langue.en).toBe("English");
  });
});

describe("langue déduite du navigateur", () => {
  it("retient la première langue connue, dans l'ordre de préférence déclaré", () => {
    expect(langueDepuisEntete("en-GB,en;q=0.9,fr;q=0.8")).toBe("en");
    expect(langueDepuisEntete("fr-CA,fr;q=0.9")).toBe("fr");
  });

  it("respecte les poids, même quand l'ordre d'écriture dit autre chose", () => {
    // « fr » est écrit en premier mais demandé moins fort : l'anglais gagne.
    expect(langueDepuisEntete("fr;q=0.3,en;q=0.9")).toBe("en");
  });

  it("ignore les langues sans traduction de l'interface", () => {
    // L'arabe existe pour le JOUEUR, pas pour l'administration.
    expect(langueDepuisEntete("ar,de;q=0.8")).toBeNull();
    expect(langueDepuisEntete("ar,en;q=0.5")).toBe("en");
  });

  it("ne décide rien sans en-tête", () => {
    expect(langueDepuisEntete(null)).toBeNull();
    expect(langueDepuisEntete("")).toBeNull();
  });
});
