"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDataset } from "./dataset";

const NAV = [
  { href: "/review", label: "Review" },
  { href: "/check", label: "Check a trade" },
  { href: "/coach", label: "Ask the coach" },
  { href: "/accuracy", label: "Accuracy" },
];

export function SiteHeader() {
  const path = usePathname();
  const { dataset, ready } = useDataset();

  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          Hindsight
        </Link>
        <nav aria-label="Main" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm">
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
        <Link
          href="/import"
          className="hidden shrink-0 rounded-sm border border-rule px-2.5 py-1 text-sm text-muted transition-colors duration-150 hover:border-ink hover:text-ink sm:block"
        >
          {!ready ? "…" : dataset.kind === "sample" ? "Sample: Tolu" : `Your trades: ${dataset.fileName}`}
        </Link>
      </div>
    </header>
  );
}
