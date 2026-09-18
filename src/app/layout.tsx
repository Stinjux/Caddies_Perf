import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaddiePerf",
  description: "Gestion et évaluation des caddies de golf",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
