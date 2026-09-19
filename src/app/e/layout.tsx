import "./client.css";

/**
 * Parcours client.
 *
 * Ce layout porte SA PROPRE feuille de style. La direction artistique du
 * questionnaire n'atteint jamais les écrans d'administration ni celui du
 * Starter, qui restent sobres et denses.
 *
 * Les polices sont servies depuis /public/fonts : aucune requête ne sort
 * vers un tiers, conformément au principe de souveraineté des données.
 */
export default function ParcoursClientLayout({ children }: { children: React.ReactNode }) {
  return children;
}
