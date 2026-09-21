/**
 * En-tetes internes, poses par le pre-filtre et lus par l'application.
 *
 * Cette constante vit dans lib/ et non dans le pre-filtre lui-meme : une mise
 * en page qui importerait le module du pre-filtre entrainerait avec elle tout
 * le necessaire du runtime de peripherie, sans aucun besoin.
 */
export const ENTETE_CHEMIN = "x-caddieperf-chemin";
