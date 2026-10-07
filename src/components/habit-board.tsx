"use client";

import { useEffect, useState } from "react";
import type { ReviewPayload } from "@/lib/api/payload";
import { pct, tone, usd } from "@/lib/format";
import { FindingNote, FindingSection } from "./finding";

type Finding = ReviewPayload["findings"][number];

/** The one number that makes each habit's case, in a few words. */
function headline(f: Finding): string {
  const m = f.metrics;
  switch (f.id) {
    case "closed-chasing":
      return `${pct(m.chaseRate, { digits: 0 })} vs ${pct(m.chanceRate, { digits: 0 })} by chance`;
    case "closed-panic":
      return `${pct(m.panicRate, { digits: 0 })} vs ${pct(m.chanceRate, { digits: 0 })} by chance`;
    case "earnings-roulette":
      return `${m.tradesThroughEarnings} trades vs ${m.expectedByChance.toFixed(1)} expected`;
    case "cutting-winners":
      return `Losers held ${m.holdRatio.toFixed(1)}× longer`;
    case "revenge":
      return `${m.sizeRatio.toFixed(1)}× size after a loss`;
  }
}

const STATUS: Record<string, string> = { detected: "Found", "not-detected": "Not found", "insufficient-data": "Not enough data" };

/**
 * Every habit at a glance; the selected one opens below. Found habits first, then watching, then the rest;
 * within each group the habits unique to 24/7 rToken trading lead. Deep links like /review#revenge select a habit.
 */
const ORDER = ["closed-chasing", "closed-panic", "earnings-roulette", "cutting-winners", "revenge"];
export function HabitBoard({ findings, rules, datasetKey }: { findings: Finding[]; rules: ReviewPayload["rules"]; datasetKey: string }) {
  const rank = (f: Finding) => (f.status === "detected" ? 0 : f.watching ? 1 : 2);
  const ordered = [...findings].sort((a, b) => rank(a) - rank(b) || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const [selected, setSelected] = useState<string>(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return ordered.some((f) => f.id === hash) ? hash : ordered[0]?.id;
  });

  // Follow in-page links to #habit-id.
  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (findings.some((f) => f.id === id)) setSelected(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [findings]);

  const active = ordered.find((f) => f.id === selected) ?? ordered[0];
  if (!active) return null;

  return (
    <div>
      <div role="tablist" aria-label="Habits" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {ordered.map((f) => {
          const on = f.id === active.id;
          const found = f.status === "detected";
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="habit-panel"
              onClick={() => {
                setSelected(f.id);
                history.replaceState(null, "", `#${f.id}`);
              }}
              className={`group flex flex-col rounded-md border p-3.5 text-left transition-colors duration-150 ${
                on ? "border-ink bg-sheet" : "border-rule hover:border-muted hover:bg-sheet/60"
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span aria-hidden className={`size-1.5 rounded-full ${found ? "bg-accent" : f.watching ? "bg-marker" : "bg-rule"}`} />
                {f.watching && !found ? "Watching" : STATUS[f.status]}
              </span>
              <span className={`mt-1.5 font-serif text-[1.05rem] leading-snug ${found ? "" : "text-muted"}`}>{f.title}</span>
              <span className={`num mt-auto pt-3 text-xs ${found ? "text-ink" : "text-muted"}`}>{headline(f)}</span>
              {found && f.cost && (
                <span className="num mt-0.5 text-xs text-muted">
                  {f.cost.pnl < 0 ? "lost " : "made "}
                  <span className={tone(f.cost.pnl)}>{usd(Math.abs(f.cost.pnl))}</span> on {f.cost.trades} trades
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div id="habit-panel" role="tabpanel" className="mt-2">
        {active.status === "detected" ? (
          <FindingSection key={active.id} f={active} rule={rules.find((r) => r.id === active.id)} datasetKey={datasetKey} />
        ) : (
          <div className="border-t border-rule py-8">
            <FindingNote f={active} />
          </div>
        )}
      </div>
    </div>
  );
}
