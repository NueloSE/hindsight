"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useReview } from "@/components/dataset";
import { TradeChart } from "@/components/trade-chart";
import { hours, longDateTime, pct, price, SESSION_NAME, times, tone, usd } from "@/lib/format";

type Bar = [number, number, number, number, number];
interface Candles {
  rToken: Bar[];
  stock: Bar[];
  earnings: { reactionAt: number; date: string }[];
}

const HOUR = 3_600_000;

export function TradeView({ no }: { no: number }) {
  const { data, loading, error } = useReview();
  const trade = data?.trades.find((t) => t.no === no);
  const [candles, setCandles] = useState<{ key: string; c: Candles | null }>({ key: "", c: null });
  const key = trade ? `${trade.ticker}:${trade.entryT}` : "";

  useEffect(() => {
    if (!trade) return;
    const span = trade.exitT - trade.entryT;
    const pad = Math.min(4 * 24 * HOUR, Math.max(36 * HOUR, span * 0.6));
    const from = trade.entryT - pad;
    const to = Math.min(trade.exitT + pad, from + 44 * 24 * HOUR);
    let cancelled = false;
    fetch(`/api/candles?ticker=${trade.ticker}&from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => !cancelled && setCandles({ key: `${trade.ticker}:${trade.entryT}`, c }))
      .catch(() => !cancelled && setCandles({ key: `${trade.ticker}:${trade.entryT}`, c: null }));
    return () => {
      cancelled = true;
    };
  }, [trade]);

  if (error) return <p className="mx-auto max-w-6xl px-4 py-16 text-muted">{error}</p>;
  if (loading || !data) return <div className="mx-auto h-96 max-w-6xl animate-pulse px-4 py-10" aria-busy="true" />;
  if (!trade) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="font-serif text-2xl">There is no trade #{no} in this history.</p>
        <Link href="/review" className="mt-4 inline-block text-accent underline-offset-2 hover:underline">
          Back to the review
        </Link>
      </div>
    );
  }

  const titles = Object.fromEntries(data.findings.map((f) => [f.id, f.title]));
  const prev = data.trades.find((t) => t.no === no - 1);
  const next = data.trades.find((t) => t.no === no + 1);
  const c = candles.key === key ? candles.c : null;

  const facts: [string, React.ReactNode][] = [
    ["Opened", <>{longDateTime(trade.entryT)} · {SESSION_NAME[trade.entrySession]}</>],
    ["Closed", <>{longDateTime(trade.exitT)} · {SESSION_NAME[trade.exitSession]}</>],
    ["Held", hours(trade.holdHours)],
    ["Size", <>{usd(trade.cost)} <span className="text-muted">({times(trade.relSize)} your usual)</span></>],
    ["Entry → exit", <>{price(trade.entryPrice)} → {price(trade.exitPrice)}</>],
    [
      "rToken move since the US close, at entry",
      trade.entryMove == null ? "–" : <span className={trade.entryClosed && trade.entryMove >= 0.015 ? "mark" : ""}>{pct(trade.entryMove, { sign: true })}</span>,
    ],
    ["rToken vs stock at entry", pct(trade.entryPremium, { sign: true, digits: 2 })],
    ["Best point during the trade", pct(trade.mfe, { sign: true })],
    ["Worst point during the trade", pct(trade.mae, { sign: true })],
    ["Share of the best move kept", trade.capture == null ? "–" : pct(trade.capture, { digits: 0 })],
    ["Earnings during the trade", trade.earningsDate ? <span className="mark">Yes, {new Date(`${trade.earningsDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} after the close</span> : "No"],
    ["rToken 24h after you sold", pct(trade.after24h, { sign: true })],
    ...(trade.afterToOpen != null ? ([["By the next US open after you sold", pct(trade.afterToOpen, { sign: true })]] as [string, React.ReactNode][]) : []),
    ...(trade.prevLossHoursAgo != null
      ? ([["Opened after a loss", <span key="p" className={trade.prevLossHoursAgo <= 12 ? "mark" : ""}>{hours(trade.prevLossHoursAgo)} after closing a losing trade</span>]] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <nav className="flex items-center justify-between py-6 text-sm">
        <Link href="/review#trades" className="text-muted transition-colors duration-150 hover:text-ink">
          ← All trades
        </Link>
        <span className="flex gap-4">
          {prev && (
            <Link href={`/review/trades/${prev.no}`} className="text-muted transition-colors duration-150 hover:text-ink">
              ← #{prev.no}
            </Link>
          )}
          {next && (
            <Link href={`/review/trades/${next.no}`} className="text-muted transition-colors duration-150 hover:text-ink">
              #{next.no} →
            </Link>
          )}
        </span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-ink pb-4">
        <div>
          <p className="num text-sm text-muted">Trade #{trade.no}</p>
          <h1 className="mt-1 font-serif text-4xl font-medium tracking-tight">r{trade.ticker}</h1>
          {trade.habits.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {trade.habits.map((h) => (
                <li key={h}>
                  <Link href={`/review#${h}`} className="mark text-sm">
                    {titles[h]}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-right">
          <p className={`num text-3xl ${tone(trade.pnl)}`}>{usd(trade.pnl, { sign: true, cents: true })}</p>
          <p className={`num text-sm ${tone(trade.ret)}`}>{pct(trade.ret, { sign: true, digits: 2 })} after fees</p>
        </div>
      </header>

      <div className="mt-8">
        {c ? (
          <TradeChart
            rToken={c.rToken}
            stock={c.stock}
            earnings={c.earnings}
            entryT={trade.entryT}
            exitT={trade.exitT}
            entryPrice={trade.entryPrice}
            exitPrice={trade.exitPrice}
            ticker={trade.ticker}
          />
        ) : (
          <div className="h-72 animate-pulse rounded-md bg-rule/50" aria-label="Loading chart" />
        )}
      </div>

      <p className="mt-10 text-xs text-muted">Times are shown in your timezone. Sessions are US market sessions (New York).</p>
      <dl className="mt-2 grid gap-x-12 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="num text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
