"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataset } from "@/components/dataset";
import { longDateTime, pct, price, retTone, SESSION_NAME, times, tone, usd } from "@/lib/format";
import { useStored } from "@/lib/local-store";

interface Hit {
  rule: { id: string; title: string; text: string };
  kind: "violation" | "reminder";
  reason: string;
  evidenceNos: number[];
  history: { trades: number; winRate: number; avgReturn: number; pnl: number } | null;
}

interface CheckResponse {
  error?: string;
  note?: string;
  explanation: { text: string; source: "ai" | "computed" };
  result: {
    idea: { ticker: string; side: "buy" | "sell"; usd: number | null; at: number };
    verdict: "clear" | "caution" | "matches-habit";
    context: { session: string; marketClosed: boolean; price: number | null; lastClose: number | null; moveSinceClose: number | null; source: "snapshot" | "live" };
    hits: Hit[];
    sizeVsNormal: number | null;
    normalSize: number;
    similar: { no?: number; ticker: string; ret: number; pnl: number }[];
    similarStats: { trades: number; winRate: number; avgReturn: number } | null;
  };
}

interface Decision {
  at: number;
  decidedAt: number;
  idea: string;
  verdict: string;
  choice: "skipped" | "smaller" | "took";
}

const SCENARIOS = [
  { label: "Sunday night, rMSTR is up 2.4% since Friday", text: "buy $1,500 of rMSTR", at: Date.parse("2026-10-04T04:00:00Z") },
  { label: "Two days before NVIDIA earnings", text: "buy $1,200 of rNVDA", at: Date.parse("2026-08-25T15:00:00Z") },
  { label: "A quiet Wednesday afternoon in rTSLA", text: "buy $1,000 of rTSLA", at: Date.parse("2026-09-09T17:00:00Z") },
];

const DECISIONS_KEY = "hindsight.decisions.v1";

export function CheckView() {
  const { wire, dataset, ready } = useDataset();
  const params = useSearchParams();
  const [text, setText] = useState(() => params.get("idea") ?? "");
  const [at, setAt] = useState<number | null>(() => (params.get("at") ? Number(params.get("at")) : null));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<Decision["choice"] | null>(null);
  const [rawLog, setRawLog] = useStored(DECISIONS_KEY);
  const log = useMemo<Decision[]>(() => {
    try {
      return rawLog ? JSON.parse(rawLog) : [];
    } catch {
      return [];
    }
  }, [rawLog]);

  async function run(ideaText: string, moment: number | null) {
    setBusy(true);
    setError(null);
    setRes(null);
    setDecided(null);
    try {
      const r = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataset: wire, text: ideaText, ...(moment ? { at: moment } : {}) }),
      });
      const body = (await r.json()) as CheckResponse;
      if (!r.ok) throw new Error(body.error ?? "The check failed.");
      setRes(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The check failed.");
    } finally {
      setBusy(false);
    }
  }

  // A shared link (?idea=…&at=…) runs its check once the dataset is known.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!ready || autoRan.current || !params.get("idea")) return;
    autoRan.current = true;
    void Promise.resolve().then(() => run(params.get("idea")!, params.get("at") ? Number(params.get("at")) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function decide(choice: Decision["choice"]) {
    if (!res) return;
    setDecided(choice);
    const entry: Decision = { at: res.result.idea.at, decidedAt: Date.now(), idea: text, verdict: res.result.verdict, choice };
    setRawLog(JSON.stringify([entry, ...log].slice(0, 50)));
  }

  const r = res?.result;
  const violations = r?.hits.filter((h) => h.kind === "violation") ?? [];
  const reminders = r?.hits.filter((h) => h.kind === "reminder") ?? [];

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 pb-20 md:grid-cols-[1fr_20rem]">
      <div>
        <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Check a trade</h1>
        <p className="mt-3 max-w-xl text-muted">
          Describe the trade you&apos;re about to place. Hindsight checks it against your rules and your own similar trades. It never places
          orders: you decide.
        </p>

        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) run(text, at);
          }}
        >
          <label htmlFor="idea" className="text-sm text-muted">
            Your trade idea
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="idea"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setAt(null);
              }}
              placeholder="e.g. buy $1,500 of rMSTR"
              autoComplete="off"
              className="flex-1 rounded-sm border border-rule bg-sheet px-3 py-2.5 placeholder:text-muted/70"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Checking…" : "Check it"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">{at ? `Replaying the moment: ${longDateTime(at)}` : "Checked against the market right now."}</p>
        </form>

        {dataset.kind === "sample" && (
          <div className="mt-6">
            <p className="text-xs text-muted">Or replay a moment from Tolu&apos;s history</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <li key={s.label}>
                  <button
                    type="button"
                    onClick={() => {
                      setText(s.text);
                      setAt(s.at);
                      run(s.text, s.at);
                    }}
                    className="rounded-sm border border-rule px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:border-ink"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div aria-live="polite" className="mt-10">
          {error && <p className="rounded-md border border-loss/40 bg-sheet p-4 text-sm">{error}</p>}
          {busy && <div className="h-64 animate-pulse rounded-md bg-rule/50" aria-label="Checking" />}
          {r && res && (
            <article className="rounded-md border border-rule bg-sheet">
              <header className="border-b border-rule p-5">
                <p className="text-sm text-muted">
                  {r.idea.side === "buy" ? "Buy" : "Sell"} r{r.idea.ticker}
                  {r.idea.usd ? <span className="num"> · {usd(r.idea.usd)}</span> : ""} · {longDateTime(r.idea.at)}
                </p>
                <h2 className="mt-1 font-serif text-3xl font-medium tracking-tight">
                  {r.verdict === "matches-habit" ? (
                    <span className="mark">
                      This matches {violations.length === 1 ? "one of your habits" : `${violations.length} of your habits`}.
                    </span>
                  ) : r.verdict === "caution" ? (
                    "No rule broken, but this is a big trade."
                  ) : (
                    "Nothing in your history flags this."
                  )}
                </h2>
                <p className="num mt-3 text-sm text-muted">
                  {SESSION_NAME[r.context.session]}
                  {r.context.marketClosed ? " (US market closed)" : ""} · r{r.idea.ticker} {price(r.context.price)}
                  {r.context.moveSinceClose != null && <> · {pct(r.context.moveSinceClose, { sign: true })} since the last US close</>}
                  {r.sizeVsNormal != null && <> · {times(r.sizeVsNormal)} your usual size</>}
                  {r.context.source === "live" ? " · live prices" : " · stored prices"}
                </p>
                {res.note && <p className="mt-2 text-xs text-muted">{res.note}</p>}
              </header>

              <div className="space-y-5 p-5">
                <div>
                  <p className="leading-relaxed">{res.explanation.text}</p>
                  <p className="mt-1.5 text-xs text-muted">
                    {res.explanation.source === "ai" ? "Written by the AI coach · every number checked against the computed facts" : "Computed summary"}
                  </p>
                </div>

                {violations.map((h) => (
                  <div key={h.rule.id} className="border-t border-rule pt-4">
                    <p className="text-xs text-muted">Your rule</p>
                    <p className="font-medium">{h.rule.title}</p>
                    <p className="mt-1 text-sm">{h.reason}</p>
                    {h.history && (
                      <p className="mt-2 text-sm text-muted">
                        Last <span className="num">{h.history.trades}</span> times you did this: won{" "}
                        <span className="num">{pct(h.history.winRate, { digits: 0 })}</span>, averaged{" "}
                        <span className={`num ${tone(h.history.avgReturn)}`}>{pct(h.history.avgReturn, { sign: true, digits: 2 })}</span>, total{" "}
                        <span className={`num ${tone(h.history.pnl)}`}>{usd(h.history.pnl, { sign: true })}</span>.
                      </p>
                    )}
                    {h.evidenceNos.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {h.evidenceNos.slice(0, 10).map((no) => (
                          <li key={no}>
                            <Link href={`/review/trades/${no}`} className="mark num rounded-sm px-1.5 py-0.5 text-sm">
                              #{no}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                {r.similarStats && (
                  <div className="border-t border-rule pt-4 text-sm">
                    <p className="text-xs text-muted">Your most similar past trades</p>
                    <p className="mt-1">
                      <span className="num">{r.similarStats.trades}</span> similar trades: won <span className="num">{pct(r.similarStats.winRate, { digits: 0 })}</span>,
                      averaged <span className={`num ${tone(r.similarStats.avgReturn)}`}>{pct(r.similarStats.avgReturn, { sign: true, digits: 2 })}</span>.
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {r.similar.map((s) =>
                        s.no ? (
                          <li key={s.no}>
                            <Link href={`/review/trades/${s.no}`} className="num rounded-sm border border-rule px-1.5 py-0.5 text-sm hover:border-ink">
                              #{s.no} <span className={retTone(s.ret)}>{pct(s.ret, { sign: true })}</span>
                            </Link>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  </div>
                )}

                {reminders.map((h) => (
                  <p key={h.rule.id} className="border-t border-rule pt-4 text-sm text-muted">
                    <span className="text-ink">Reminder:</span> {h.reason}
                  </p>
                ))}
              </div>

              <footer className="border-t border-rule p-5">
                {decided ? (
                  <p className="text-sm">
                    Logged: you {decided === "skipped" ? "skipped it" : decided === "smaller" ? "took it at a smaller size" : "took it"}. Your call, on the record.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted">Your decision</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => decide("skipped")} className="rounded-sm border border-rule px-3 py-1.5 text-sm transition-colors duration-150 hover:border-ink">
                        Skip it
                      </button>
                      <button type="button" onClick={() => decide("smaller")} className="rounded-sm border border-rule px-3 py-1.5 text-sm transition-colors duration-150 hover:border-ink">
                        Take it smaller
                      </button>
                      <button type="button" onClick={() => decide("took")} className="rounded-sm px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-ink">
                        Take it as planned
                      </button>
                    </div>
                  </>
                )}
              </footer>
            </article>
          )}
        </div>
      </div>

      <aside>
        <h2 className="text-sm text-muted">Your decision log</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Decisions you log after a check appear here, so you can look back at them too.</p>
        ) : (
          <ol className="mt-2 divide-y divide-rule border-y border-rule">
            {log.slice(0, 12).map((d) => (
              <li key={d.decidedAt} className="py-2.5 text-sm">
                <p>{d.idea}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {d.verdict === "matches-habit" ? "Matched a habit" : d.verdict === "caution" ? "Caution" : "Clear"} · you{" "}
                  {d.choice === "skipped" ? "skipped it" : d.choice === "smaller" ? "went smaller" : "took it"}
                </p>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-6 text-xs leading-relaxed text-muted">Not financial advice. Hindsight shows what your own history says; the market can always do something new.</p>
      </aside>
    </div>
  );
}
