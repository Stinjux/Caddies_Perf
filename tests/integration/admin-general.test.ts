import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../helpers/raw-db";
import { account, auditLog } from "@/db/schema";
import { resetDb } from "../helpers/reset-db";
import { makeCourse, makeAccount, PASSWORD } from "../helpers/fixtures";
import { login, resolveSession, selectCourse } from "@/server/auth/current";
import { testScope } from "../helpers/scope";
import {
  listerAdminsGeneraux,
  accorderNiveauGeneral,
  retirerNiveauGeneral,
} from "@/server/services/admin-general";
import { createCourse } from "@/server/services/golf-course";
import { listLinksForAccount, roleOnCourse } from "@/server/repositories/account";

/**
 * DEUX NIVEAUX D'ADMINISTRATION.
 *
 * Ces tests portent sur la seule chose qui distingue les deux niveaux : la
 * portée. Un administrateur gère SON parcours ; un administrateur général
 * les gère TOUS, y compris ceux qui n'existaient pas quand on l'a nommé.
 */

let cedres: string;
let atlas: string;
let general: string;
let ordinaire: string;

const porteeGenerale = () =>
  testScope({ accountId: general, golfCourseId: cedres, role: "admin", generalAdmin: true });

const porteeOrdinaire = () =>
  testScope({ accountId: ordinaire, golfCourseId: cedres, role: "admin" });

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  general = await makeAccount({ generalAdmin: true, links: [{ courseId: cedres, role: "admin" }] });
  ordinaire = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });
});

describe("portée d'un administrateur général", () => {
  it("atteint tous les parcours sans y être rattaché", async () => {
    // Le compte n'a qu'UN rattachement, aux Cèdres. Il voit pourtant les deux.
    const sansRattachement = await makeAccount({ generalAdmin: true });
    const vus = await listLinksForAccount(sansRattachement);

    expect(vus.map((v) => v.golfCourseId).sort()).toEqual([cedres, atlas].sort());
    expect(vus.every((v) => v.role === "admin")).toBe(true);
  });

  it("atteint un parcours créé APRÈS sa nomination", async () => {
    const avant = await listLinksForAccount(general);
    const nouveau = await createCourse(general, {
      name: "Parcours de demain",
      timezone: "Africa/Casablanca",
    });
    const apres = await listLinksForAccount(general);

    expect(apres.length).toBe(avant.length + 1);
    expect(apres.map((a) => a.golfCourseId)).toContain(nouveau);
    // C'est l'apport propre du niveau général : aucune liste de rattachements
    // n'aurait pu contenir d'avance un parcours qui n'existait pas.
    expect(await roleOnCourse(general, nouveau)).toBe("admin");
  });

  it("ne déborde jamais du parcours ACTIF, malgré son niveau", async () => {
    // Le privilège porte sur le choix du parcours, jamais sur la simultanéité.
    const portee = porteeGenerale();
    expect(portee.golfCourseId).toBe(cedres);
    expect(portee.golfCourseId).not.toBe(atlas);
  });
});

describe("connexion et choix du parcours", () => {
  it("ouvre une session, puis laisse choisir un parcours auquel rien ne le rattache", async () => {
    // LE CHEMIN COMPLET, celui que suit un administrateur général au premier
    // écran : il voit plusieurs parcours, donc aucun n'est choisi d'office,
    // et il doit pouvoir en sélectionner un — sans rattachement.
    const sansLien = await makeAccount({ generalAdmin: true, password: PASSWORD });

    const { token } = await login(
      (await db
        .select({ email: account.email })
        .from(account)
        .where(eq(account.id, sansLien)))[0]!.email,
      PASSWORD,
    );

    const avant = await resolveSession(token);
    expect(avant?.generalAdmin).toBe(true);
    expect(avant?.scope).toBeNull();

    await selectCourse(token, atlas);

    const apres = await resolveSession(token);
    expect(apres?.scope?.golfCourseId).toBe(atlas);
    expect(apres?.scope?.role).toBe("admin");
    expect(apres?.scope?.generalAdmin).toBe(true);
  });

  it("refuse un parcours qui n'existe pas, même à lui", async () => {
    const sansLien = await makeAccount({ generalAdmin: true, password: PASSWORD });
    const courriel = (
      await db.select({ email: account.email }).from(account).where(eq(account.id, sansLien))
    )[0]!.email;
    const { token } = await login(courriel, PASSWORD);

    await expect(selectCourse(token, "00000000-0000-7000-8000-000000000000")).rejects.toThrow();
  });
});

describe("ce que le niveau général autorise, et lui seul", () => {
  it("laisse un administrateur général créer un parcours", async () => {
    await expect(
      createCourse(general, { name: "Nouveau", timezone: "Africa/Casablanca" }),
    ).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });

  it("REFUSE la création d'un parcours à un administrateur ordinaire", async () => {
    await expect(
      createCourse(ordinaire, { name: "Interdit", timezone: "Africa/Casablanca" }),
    ).rejects.toThrow(/droits/);
  });

  it("refuse AVANT de valider la saisie : un interdit n'apprend rien", async () => {
    // Une saisie invalide ET un appelant non autorisé : c'est le refus de
    // droit qui doit sortir. Autrement, un administrateur ordinaire pourrait
    // sonder les règles de validation d'une action qui lui est fermée.
    await expect(createCourse(ordinaire, { name: "  ", timezone: "" })).rejects.toThrow(/droits/);
  });

  it("refuse à un administrateur ordinaire d'accorder le niveau général", async () => {
    await expect(accorderNiveauGeneral(porteeOrdinaire(), ordinaire)).rejects.toThrow(/droits/);

    const [relu] = await db
      .select({ g: account.generalAdmin })
      .from(account)
      .where(eq(account.id, ordinaire));
    expect(relu?.g).toBe(false);
  });
});

describe("accorder et retirer le niveau général", () => {
  it("accorde le niveau et le journalise", async () => {
    await accorderNiveauGeneral(porteeGenerale(), ordinaire);

    const [relu] = await db
      .select({ g: account.generalAdmin })
      .from(account)
      .where(eq(account.id, ordinaire));
    expect(relu?.g).toBe(true);

    const entrees = await db
      .select({ action: auditLog.action, cible: auditLog.targetId })
      .from(auditLog)
      .where(eq(auditLog.action, "account.grant_general"));
    expect(entrees).toEqual([{ action: "account.grant_general", cible: ordinaire }]);
  });

  it("est sans effet s'il est déjà accordé, et n'écrit pas deux fois au journal", async () => {
    await accorderNiveauGeneral(porteeGenerale(), ordinaire);
    await accorderNiveauGeneral(porteeGenerale(), ordinaire);

    const entrees = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(eq(auditLog.action, "account.grant_general"));
    expect(entrees).toHaveLength(1);
  });

  it("retire le niveau à un autre administrateur général", async () => {
    await accorderNiveauGeneral(porteeGenerale(), ordinaire);
    await retirerNiveauGeneral(porteeGenerale(), ordinaire);

    const [relu] = await db
      .select({ g: account.generalAdmin })
      .from(account)
      .where(eq(account.id, ordinaire));
    expect(relu?.g).toBe(false);
  });

  it("REFUSE de se retirer son propre niveau", async () => {
    // Se fermer la porte au nez n'est jamais une intention ; c'est une erreur
    // de clic dont on ne revient pas.
    await expect(retirerNiveauGeneral(porteeGenerale(), general)).rejects.toThrow(/propre niveau/);
  });

  it("REFUSE de retirer le DERNIER niveau général", async () => {
    // Sans lui, plus personne ne peut créer un parcours ni réparer les droits :
    // l'application se fermerait à elle-même une porte qu'elle seule ouvre.
    // La portée est celle d'un TIERS pour contourner le refus d'auto-retrait,
    // et atteindre la garde suivante — celle qu'on veut éprouver ici.
    const tiers = testScope({
      accountId: ordinaire,
      golfCourseId: cedres,
      role: "admin",
      generalAdmin: true,
    });
    await expect(retirerNiveauGeneral(tiers, general)).rejects.toThrow(/dernier/);

    const restants = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.generalAdmin, true));
    expect(restants).toHaveLength(1);
  });

  /**
   * LA CONTRAINTE VENUE DE LA BASE, rendue explicite.
   *
   * Retirer le niveau à un compte non rattaché au parcours courant ferait
   * disparaître sa ligne de la seule politique de lecture qui la montrait ;
   * PostgreSQL refuse alors l'écriture (voir migration 0007). Le service
   * l'arrête avant, avec un message qui dit quoi faire — plutôt que de
   * laisser remonter une erreur de base illisible.
   */
  it("ne voit même pas un compte d'un autre parcours : rien à promouvoir", async () => {
    // Sous portée, ce compte n'est pas visible : il est indiscernable d'un
    // compte inexistant, ce qui est précisément la règle FR-025.
    const ailleurs = await makeAccount({ links: [{ courseId: atlas, role: "admin" }] });
    await expect(accorderNiveauGeneral(porteeGenerale(), ailleurs)).rejects.toThrow(/introuvable/);
  });

  it("REFUSE de retirer le niveau à un général d'un autre parcours", async () => {
    const autreGeneral = await makeAccount({
      generalAdmin: true,
      links: [{ courseId: atlas, role: "admin" }],
    });
    await expect(retirerNiveauGeneral(porteeGenerale(), autreGeneral)).rejects.toThrow(
      /rattaché au parcours courant/,
    );
  });

  it("les voit tous dans la liste, y compris ceux d'un autre parcours", async () => {
    // La liste est une information de PLATEFORME : savoir qui détient ce
    // niveau ne dépend pas du parcours où l'on se trouve. Seuls les BOUTONS
    // sont restreints au parcours de rattachement.
    const ailleurs = await makeAccount({
      generalAdmin: true,
      links: [{ courseId: atlas, role: "admin" }],
    });
    const vus = await listerAdminsGeneraux(porteeGenerale());
    expect(vus.map((v) => v.id).sort()).toEqual([general, ailleurs].sort());
  });

  it("liste les administrateurs généraux, et personne d'autre", async () => {
    const vus = await listerAdminsGeneraux(porteeGenerale());
    expect(vus.map((v) => v.id)).toEqual([general]);

    await accorderNiveauGeneral(porteeGenerale(), ordinaire);
    const apres = await listerAdminsGeneraux(porteeGenerale());
    expect(apres.map((v) => v.id).sort()).toEqual([general, ordinaire].sort());
  });

  it("refuse la liste à un administrateur ordinaire", async () => {
    await expect(listerAdminsGeneraux(porteeOrdinaire())).rejects.toThrow(/droits/);
  });
});

describe("le défaut est le moindre privilège", () => {
  it("une portée construite sans mention du niveau n'est PAS générale", async () => {
    // Un appelant qui oublie ce champ doit obtenir un administrateur
    // ordinaire. Une omission ne peut pas élever les droits.
    const portee = testScope({ accountId: ordinaire, golfCourseId: cedres, role: "admin" });
    expect(portee.generalAdmin).toBe(false);
  });

  it("un compte neuf n'est pas administrateur général", async () => {
    const neuf = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });
    const [relu] = await db
      .select({ g: account.generalAdmin })
      .from(account)
      .where(eq(account.id, neuf));
    expect(relu?.g).toBe(false);
  });
});
