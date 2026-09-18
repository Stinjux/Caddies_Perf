"use client";

import Link from "next/link";

/**
 * Frontiere d'erreur de l'espace administrateur.
 *
 * FR-022 : un refus produit un message clair, SANS reveler l'existence ni le
 * contenu de la ressource visee. Aucune trace technique, aucun identifiant
 * interne, aucune donnee personnelle n'est affichee (FR-031).
 */
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">Action impossible</h1>
      <p className="mt-2 text-neutral-600">
        Vous n&apos;avez pas les droits nécessaires, ou cette page n&apos;existe pas.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-700"
        >
          Réessayer
        </button>
        <Link
          href="/terrains"
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white"
        >
          Retour aux terrains
        </Link>
      </div>
    </div>
  );
}
