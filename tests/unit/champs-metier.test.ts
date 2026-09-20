import { describe, it, expect } from "vitest";
import { champsMetier } from "../helpers/champs-metier";

/**
 * L'OUTIL QUI A MIS FIN A UNE INTERMITTENCE DE PLUSIEURS SEMAINES.
 *
 * Ces tests valent dans les DEUX sens, et c'est tout l'enjeu : ecarter les
 * identifiants ne doit pas revenir a rendre le garde-fou aveugle. Un filtre
 * trop large ferait passer les cinq tests de confidentialite qui en dependent
 * au vert quoi qu'il arrive — exactement le contraire de ce qu'on attend
 * d'eux.
 */

/** Identifiant de forme reelle qui contient « 1988 » en hexadecimal. */
const UUID_PIEGE = "01a0bbe3-1988-7836-abe8-9371fd871367";

describe("ce qui doit etre ecarte : le bruit technique", () => {
  it("ecarte un identifiant, meme s'il contient la chaine cherchee", () => {
    const journal = [{ id: UUID_PIEGE, action: "pii.write", targetType: "caddie" }];

    // L'ancienne facon de faire echouait ici, sans que rien n'ait fuite.
    expect(JSON.stringify(journal)).toContain("1988");
    expect(champsMetier(journal)).not.toContain("1988");
  });

  it("ecarte les horodatages", () => {
    const lignes = [{ occurredAt: new Date("1988-03-04T00:00:00Z"), action: "pii.read" }];
    expect(champsMetier(lignes)).not.toContain("1988");
  });

  it("ecarte les identifiants quel que soit le nom de la colonne", () => {
    // Le filtrage porte sur la VALEUR : une colonne ajoutee demain qui
    // porterait un identifiant serait ecartee sans qu'on y pense.
    const lignes = [{ colonneInventee: UUID_PIEGE }];
    expect(champsMetier(lignes)).not.toContain("1988");
  });
});

describe("ce qui doit RESTER : les valeurs metier", () => {
  it("laisse passer une annee de naissance en clair", () => {
    const lignes = [{ id: "01a0bbe3-3b23-75d8-84e4-94ebd6d7a57a", birthYear: 1988 }];
    expect(champsMetier(lignes)).toContain("1988");
  });

  it("laisse passer une annee glissee dans un champ de texte", () => {
    const lignes = [{ id: UUID_PIEGE, comment: "ne sur 1988, disait-il" }];
    expect(champsMetier(lignes)).toContain("1988");
  });

  it("laisse passer une chaine qui ressemble a un identifiant sans en etre un", () => {
    const lignes = [{ note: "reference 1988-03-04 du dossier" }];
    expect(champsMetier(lignes)).toContain("1988");
  });

  it("conserve les autres colonnes de la ligne", () => {
    const lignes = [{ id: UUID_PIEGE, action: "pii.write", targetType: "caddie" }];
    const rendu = champsMetier(lignes);
    expect(rendu).toContain("pii.write");
    expect(rendu).toContain("caddie");
  });
});
