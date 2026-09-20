/**
 * SÉRIALISE DES LIGNES EN ÉCARTANT IDENTIFIANTS ET HORODATAGES.
 *
 * Pourquoi cet outil existe. Plusieurs tests vérifiaient qu'une valeur
 * sensible — une année de naissance, un âge — n'apparaît nulle part, en
 * cherchant la chaîne dans `JSON.stringify(lignes)`. Or ces lignes portent des
 * UUID, écrits en hexadécimal minuscule : « 1988 », « 1990 », « 1975 » et
 * « 38 » sont tous des suites hexadécimales parfaitement licites. Un
 * identifiant tiré au hasard finissait donc, de loin en loin, par contenir la
 * chaîne cherchée, et le test échouait sans que rien n'ait fuité.
 *
 * Mesuré : 0,016 % des UUID contiennent « 1988 ». Multiplié par la vingtaine
 * d'identifiants d'un journal et par plusieurs motifs, cela donnait une
 * intermittence de l'ordre du pourcent — assez rare pour rester inexpliquée
 * pendant des semaines, assez fréquente pour user la confiance. C'était la
 * cinquième occurrence d'un motif trop large dans ce projet ; un garde-fou qui
 * crie à tort finit par être ignoré.
 *
 * Le filtrage porte sur les VALEURS, non sur les noms de colonnes : une
 * colonne ajoutée demain qui porterait une année serait toujours détectée.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function champsMetier(lignes: readonly Record<string, unknown>[]): string {
  return JSON.stringify(
    lignes.map((ligne) =>
      Object.fromEntries(
        Object.entries(ligne).filter(
          ([, valeur]) =>
            !(typeof valeur === "string" && UUID.test(valeur)) && !(valeur instanceof Date),
        ),
      ),
    ),
  );
}
