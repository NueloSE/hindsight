"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { ReviewPayload, TradeRow } from "@/lib/api/payload";
import { dateTime, hours, pct, retTone, SESSION_NAME, tone, usd } from "@/lib/format";

type Finding = ReviewPayload["findings"][number];
type SortKey = "no" | "pnl" | "ret" | "cost" | "holdHours";

const PAGE_SIZE = 20;

/** Short labels for habit tags in table rows. */
export const HABIT_SHORT: Record<string, string> = {
  "closed-chasing": "Chasing",
  "closed-panic": "Panic sell",
  "earnings-roulette": "Earnings",
  "cutting-winners": "Cut winners",
  revenge: "Revenge",
};

/** Page numbers to show: first, last, current ±1, with gaps marked as null. */
function pageList(current: number, total: number): (number | null)[] {
  const keep = new Set([0, total - 1, current - 1, current, current + 1].filter((p) => p >= 0 && p < total));
  const out: (number | null)[] = [];
  [...keep]
    .sort((a, b) => a - b)
    .forEach((p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) out.push(null);
      out.push(p);
    });
  return out;
}

export function TradeTable({ trades, findings, initialHabit }: { trades: TradeRow[]; findings: Finding[]; initialHabit?: string | null }) {
  const [habit, setHabit] = useState<string>(initialHabit ?? "all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "no", dir: -1 });
  const [page, setPage] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const detected = findings.filter((f) => f.status === "detected");

  const rows = useMemo(() => {
    const filtered = habit === "all" ? trades : trades.filter((t) => t.habits.includes(habit as TradeRow["habits"][number]));
    return [...filtered].sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir);
  }, [trades, habit, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const totalPnl = rows.reduce((s, t) => s + t.pnl, 0);

  const goTo = (p: number) => {
    setPage(p);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const header = (key: SortKey, label: string, align = "text-right") => (
    <th scope="col" className={`px-3 py-2.5 font-normal ${align}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={`transition-colors duration-150 hover:text-ink ${sort.key === key ? "text-ink" : "text-muted"}`}
        onClick={() => {
          setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }));
          setPage(0);
        }}
      >
        {label}
        <span aria-hidden className="ml-0.5 inline-block w-2">
          {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );

  return (
    <div id="trades" ref={top} className="scroll-mt-20">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter trades by habit">
          {[{ id: "all", label: `All ${trades.length}` }, ...detected.map((f) => ({ id: f.id, label: `${HABIT_SHORT[f.id]} ${trades.filter((t) => t.habits.includes(f.id)).length}` }))].map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={habit === o.id}
              onClick={() => {
                setHabit(o.id);
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-sm transition-colors duration-150 ${habit === o.id ? "border-ink bg-ink text-paper" : "border-rule text-muted hover:border-ink hover:text-ink"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="num ml-auto text-sm text-muted">
          {rows.length} trades · <span className={tone(totalPnl)}>{usd(totalPnl, { sign: true })}</span>
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-rule bg-sheet">
        <table className="w-full min-w-3xl text-sm">
          <thead className="border-b border-rule text-xs">
            <tr>
              {header("no", "#", "text-left")}
              <th scope="col" className="px-3 py-2.5 text-left font-normal text-muted">
                Opened
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-normal text-muted">
                rToken
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-normal text-muted">
                Market at entry
              </th>
              {header("holdHours", "Held")}
              {header("cost", "Size")}
              {header("pnl", "P&L")}
              {header("ret", "Return")}
              <th scope="col" className="px-3 py-2.5 text-left font-normal text-muted">
                Habits
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {visible.map((t) => (
              <tr key={t.id} className="group transition-colors duration-100 hover:bg-paper">
                <td className="num px-3 py-2.5">
                  <Link href={`/review/trades/${t.no}`} className="text-accent underline-offset-2 group-hover:underline">
                    {t.no}
                  </Link>
                </td>
                <td className="num whitespace-nowrap px-3 py-2.5">{dateTime(t.entryT)}</td>
                <td className="px-3 py-2.5 font-medium">r{t.ticker}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                  {SESSION_NAME[t.entrySession]}
                  {t.entryClosed && t.entryMove != null && <span className="num"> · {pct(t.entryMove, { sign: true })}</span>}
                </td>
                <td className="num px-3 py-2.5 text-right">{hours(t.holdHours)}</td>
                <td className="num px-3 py-2.5 text-right">{usd(t.cost)}</td>
                <td className={`num px-3 py-2.5 text-right ${tone(t.pnl)}`}>{usd(t.pnl, { sign: true })}</td>
                <td className={`num px-3 py-2.5 text-right ${retTone(t.ret)}`}>{pct(t.ret, { sign: true })}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {t.habits.map((h) => (
                      <span key={h} className="whitespace-nowrap rounded-sm bg-marker/30 px-1.5 py-0.5 text-xs">
                        {HABIT_SHORT[h]}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Trade pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="num text-muted">
            {current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} of {rows.length}
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => goTo(current - 1)}
              className="rounded-sm px-2.5 py-1.5 text-muted transition-colors duration-150 hover:text-ink disabled:opacity-40"
            >
              ← Prev
            </button>
            {pageList(current, pages).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="px-1 text-muted">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-current={p === current ? "page" : undefined}
                  onClick={() => goTo(p)}
                  className={`num min-w-8 rounded-sm px-2 py-1.5 transition-colors duration-150 ${p === current ? "bg-ink text-paper" : "text-muted hover:bg-sheet hover:text-ink"}`}
                >
                  {p + 1}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={current === pages - 1}
              onClick={() => goTo(current + 1)}
              className="rounded-sm px-2.5 py-1.5 text-muted transition-colors duration-150 hover:text-ink disabled:opacity-40"
            >
              Next →
            </button>
          </span>
        </nav>
      )}
    </div>
  );
}
