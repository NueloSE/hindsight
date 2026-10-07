"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDataset } from "./dataset";
import { LogoMark } from "./logo-mark";

const NAV = [
  { href: "/review", label: "Review" },
  { href: "/check", label: "Check a trade" },
  { href: "/coach", label: "Ask the coach" },
  { href: "/accuracy", label: "Accuracy" },
];

export function SiteHeader() {
  const path = usePathname();
  const { dataset, ready } = useDataset();
  // The dataset indicator only makes sense inside the app, not on the landing or method pages.
  const inApp = ["/review", "/check", "/coach"].some((p) => path === p || path.startsWith(`${p}/`));

  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sticky top-0 z-20">
      {/* Brand pinned to the left edge, navigation centred, account action pinned to the right edge. */}
      <div className="flex items-center gap-4 px-4 py-3 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 justify-self-start font-serif text-xl font-semibold tracking-tight">
          <LogoMark size={22} />
          Hindsight
        </Link>
        <nav aria-label="Main" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm md:flex-none md:justify-self-center">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-sm px-2 py-1 transition-colors duration-150 ${active ? "text-ink" : "text-muted hover:text-ink"}`}
              >
                <span className={active ? "mark" : undefined}>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        {inApp ? (
          <Link
            href="/import"
            title={dataset.kind === "sample" ? "Viewing the demo trader. Click to review your own trades." : "Viewing your uploaded trades. Click to change."}
            className="hidden shrink-0 justify-self-end rounded-sm border border-rule px-2.5 py-1 text-sm text-muted transition-colors duration-150 hover:border-ink hover:text-ink sm:block"
          >
            {!ready ? "…" : dataset.kind === "sample" ? "Demo: Tolu · use my trades" : `Your trades: ${dataset.fileName}`}
          </Link>
        ) : path === "/import" ? (
          <span className="hidden md:block" aria-hidden />
        ) : (
          <Link
            href="/import"
            className="hidden shrink-0 justify-self-end rounded-sm border border-rule px-2.5 py-1 text-sm text-muted transition-colors duration-150 hover:border-ink hover:text-ink sm:block"
          >
            Review my trades
          </Link>
        )}
      </div>
    </header>
  );
}
