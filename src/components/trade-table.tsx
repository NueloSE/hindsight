"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReviewPayload, TradeRow } from "@/lib/api/payload";
import { dateTime, hours, pct, retTone, SESSION_NAME, tone, usd } from "@/lib/format";

type Finding = ReviewPayload["findings"][number];
type SortKey = "no" | "pnl" | "ret" | "cost" | "holdHours";

export function TradeTable({ trades, findings, initialHabit }: { trades: TradeRow[]; findings: Finding[]; initialHabit?: string | null }) {
  const [habit, setHabit] = useState<string>(initialHabit ?? "all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "no", dir: -1 });
  const titles = Object.fromEntries(findings.map((f) => [f.id, f.title]));
  const detected = findings.filter((f) => f.status === "detected");

  const rows = useMemo(() => {
    const filtered = habit === "all" ? trades : trades.filter((t) => t.habits.includes(habit as TradeRow["habits"][number]));
    return [...filtered].sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir);
  }, [trades, habit, sort]);

  const header = (key: SortKey, label: string, align = "text-right") => (
    <th scope="col" className={`px-2 py-2 font-normal ${align}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="text-muted transition-colors duration-150 hover:text-ink"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div id="trades">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="habit-filter" className="text-sm text-muted">
          Show
        </label>
        <select
          id="habit-filter"
          value={habit}
          onChange={(e) => setHabit(e.target.value)}
          className="rounded-sm border border-rule bg-sheet px-2 py-1 text-sm"
        >
          <option value="all">All {trades.length} trades</option>
          {detected.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title} ({trades.filter((t) => t.habits.includes(f.id)).length})
            </option>
          ))}
        </select>
        <span className="num ml-auto text-sm text-muted">
          {rows.length} shown · <span className={tone(rows.reduce((s, t) => s + t.pnl, 0))}>{usd(rows.reduce((s, t) => s + t.pnl, 0), { sign: true })}</span>
        </span>
      </div>

      <div className="mt-3 overflow-x-auto border-y border-rule">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b border-rule text-xs">
            <tr>
              {header("no", "#", "text-left")}
              <th scope="col" className="px-2 py-2 text-left font-normal text-muted">
                Opened
              </th>
              <th scope="col" className="px-2 py-2 text-left font-normal text-muted">
                Stock
              </th>
              <th scope="col" className="px-2 py-2 text-left font-normal text-muted">
                Market at entry
              </th>
              {header("holdHours", "Held")}
              {header("cost", "Size")}
              {header("pnl", "P&L")}
              {header("ret", "Return")}
              <th scope="col" className="px-2 py-2 text-left font-normal text-muted">
                Habits
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.map((t) => (
              <tr key={t.id} className="transition-colors duration-100 hover:bg-sheet">
                <td className="num px-2 py-2">
                  <Link href={`/review/trades/${t.no}`} className="text-accent underline-offset-2 hover:underline">
                    {t.no}
                  </Link>
                </td>
                <td className="num px-2 py-2 whitespace-nowrap">{dateTime(t.entryT)}</td>
                <td className="px-2 py-2">r{t.ticker}</td>
                <td className="px-2 py-2 whitespace-nowrap text-muted">
                  {SESSION_NAME[t.entrySession]}
                  {t.entryClosed && t.entryMove != null && <span className="num"> · {pct(t.entryMove, { sign: true })}</span>}
                </td>
                <td className="num px-2 py-2 text-right">{hours(t.holdHours)}</td>
                <td className="num px-2 py-2 text-right">{usd(t.cost)}</td>
                <td className={`num px-2 py-2 text-right ${tone(t.pnl)}`}>{usd(t.pnl, { sign: true })}</td>
                <td className={`num px-2 py-2 text-right ${retTone(t.ret)}`}>{pct(t.ret, { sign: true })}</td>
                <td className="px-2 py-2 text-xs text-muted">{t.habits.map((h) => titles[h]?.split(",")[0]).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
