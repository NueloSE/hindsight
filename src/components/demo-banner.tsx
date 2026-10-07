"use client";

import Link from "next/link";
import { useDataset } from "./dataset";

/** Shown inside the app while the demo trader is loaded, so nobody mistakes Tolu's trades for their own. */
export function DemoBanner() {
  const { dataset, ready } = useDataset();
  if (!ready || dataset.kind !== "sample") return null;
  return (
    <div className="border-b border-rule bg-sheet">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <span>
          You&apos;re viewing <span className="font-medium">Tolu</span>, a demo trader:{" "}
          <span className="text-muted">simulated trades on real 2026 Bitget rToken prices.</span>
        </span>
        <Link href="/import" className="text-accent underline-offset-2 hover:underline">
          Review your own trades →
        </Link>
      </p>
    </div>
  );
}
