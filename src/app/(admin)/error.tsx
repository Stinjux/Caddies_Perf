"use client";

import Link from "next/link";
import { COOKIE_LANGUE, estLangueAdmin, textesAdmin } from "@/lib/i18n/admin/commun";

/**
 * Frontiere d'erreur de l'espace administrateur.
 *
 * FR-022 : un refus produit un message clair, SANS reveler l'existence ni le
 * contenu de la ressource visee. Aucune trace technique, aucun identifiant
 * interne, aucune donnee personnelle n'est affichee (FR-031).
 *
 * C'est un composant CLIENT : il ne peut pas interroger le serveur pour
 * connaitre la langue. Il lit donc le temoin de preference directement, ce
 * qui est possible parce que ce temoin n'est pas httpOnly — c'est une
 * preference d'affichage, pas un secret. A defaut, le francais.
 */
function langueDuNavigateur() {
  if (typeof document === "undefined") return "fr" as const;
  const trouve = document.cookie
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([nom]) => nom === COOKIE_LANGUE)?.[1];
  return estLangueAdmin(trouve) ? trouve : ("fr" as const);
}

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  const t = textesAdmin(langueDuNavigateur());

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">{t.erreur.titre}</h1>
      <p className="mt-2 text-neutral-600">{t.erreur.detail}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-700"
        >
          {t.erreur.reessayer}
        </button>
        <Link
          href="/parcours"
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white"
        >
          {t.erreur.retourParcours}
        </Link>
      </div>
    </div>
  );
}
