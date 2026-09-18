import next from "eslint-config-next";

// eslint-config-next apporte deja les regles TypeScript, React et accessibilite.
// Aucune surcharge ici : toute regle ajoutee devra declarer son propre plugin.
const config = [{ ignores: [".next/**", "node_modules/**", "src/db/migrations/**"] }, ...next];

export default config;
