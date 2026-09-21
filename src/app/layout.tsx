import type { Metadata } from "next";
import { headers } from "next/headers";
import { langueAdmin } from "@/lib/i18n/admin";
import { resoudreLangue, direction } from "@/lib/i18n";
import { ENTETE_CHEMIN } from "@/lib/entetes";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaddiePerf",
  description: "Gestion et évaluation des caddies de golf",
};

/**
 * LANGUE ET DIRECTION DU DOCUMENT.
 *
 * Deux publics, deux sources : le parcours client (/e/<jeton>) tient sa
 * langue de l'URL — le joueur la choisit sur l'écran d'accueil — tandis que
 * l'administration tient la sienne du témoin de préférence, puis du
 * navigateur.
 *
 * La balise <html> n'existe qu'ici. Une page imbriquée ne peut pas la
 * corriger : sans ce calcul, un questionnaire en arabe s'annoncerait comme
 * français et de gauche à droite, et les lecteurs d'écran le liraient ainsi.
 */
async function langueDuDocument(): Promise<{ lang: string; dir: "ltr" | "rtl" }> {
  const chemin = (await headers()).get(ENTETE_CHEMIN) ?? "";

  if (chemin.startsWith("/e/")) {
    const demandee = new URLSearchParams(chemin.split("?")[1] ?? "").get("lang") ?? undefined;
    const langue = resoudreLangue(demandee);
    return { lang: langue, dir: direction(langue) };
  }

  return { lang: await langueAdmin(), dir: "ltr" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dir } = await langueDuDocument();

  return (
    <html lang={lang} dir={dir}>
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
