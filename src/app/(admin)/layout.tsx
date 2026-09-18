import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/terrains" className="text-lg font-semibold text-[var(--color-brand)]">
            CaddiePerf
          </Link>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-600">
            Administration
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
