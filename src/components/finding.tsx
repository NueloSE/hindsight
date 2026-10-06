"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStored } from "@/lib/local-store";
import type { ReviewPayload } from "@/lib/api/payload";
import { pct, tone, usd } from "@/lib/format";
import { useDataset } from "./dataset";

type Finding = ReviewPayload["findings"][number];
type Rule = ReviewPayload["rules"][number];

const RULE_STATE_KEY = "hindsight.rules.v1";

export function VerdictBadge({ f }: { f: Pick<Finding, "status" | "confidence" | "watching"> }) {
  const label =
    f.status === "detected"
      ? f.confidence === "strong"
        ? "Found · strong evidence"
        : "Found · clear evidence"
      : f.status === "insufficient-data"
        ? "Not enough data yet"
        : f.watching
          ? "Watching · not conclusive"
          : "Not found";
  const dot = f.status === "detected" ? "bg-accent" : f.watching ? "bg-marker" : "bg-rule";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Accept / dismiss choices per dataset and rule, kept in this browser. */
export function useRuleState(datasetKey: string, ruleId: string) {
  const [raw, setRaw] = useStored(RULE_STATE_KEY);
  const key = `${datasetKey}:${ruleId}`;
  const all = useMemo<Record<string, "accepted" | "dismissed">>(() => {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [raw]);
  const save = (v: "accepted" | "dismissed" | null) => {
    const next = { ...all };
    if (v) next[key] = v;
    else delete next[key];
    setRaw(JSON.stringify(next));
  };
  return [all[key] ?? null, save] as const;
}

export function RuleCard({ rule, datasetKey }: { rule: Rule; datasetKey: string }) {
  const [state, setState] = useRuleState(datasetKey, rule.id);
  const w = rule.whatIf;
  const r = w.risk;
  const drawdownCut = r.maxDrawdownBefore - r.maxDrawdownAfter;

  return (
    <div className={`rounded-md border p-4 transition-colors duration-150 ${state === "accepted" ? "border-accent" : "border-rule"} ${state === "dismissed" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted">Proposed rule</p>
        {state && <p className="text-xs text-muted">{state === "accepted" ? "In your rulebook" : "Dismissed"}</p>}
      </div>
      <p className="mt-1 font-medium">{rule.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{rule.text}</p>

      <dl className="mt-4 divide-y divide-rule border-y border-rule text-sm">
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-muted">P&amp;L if followed</dt>
          <dd className={`num ${tone(w.usd)}`}>{usd(w.usd, { sign: true })}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-muted">Worst trade</dt>
          <dd className="num whitespace-nowrap">
            <span className="text-muted">{pct(r.worstTradeBefore)} → </span>
            <span className={r.worstTradeAfter > r.worstTradeBefore ? "text-gain" : ""}>{pct(r.worstTradeAfter)}</span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-muted">Deepest drawdown</dt>
          <dd className="num whitespace-nowrap">
            <span className="text-muted">{usd(r.maxDrawdownBefore)} → </span>
            <span className={drawdownCut > 0 ? "text-gain" : ""}>{usd(r.maxDrawdownAfter)}</span>
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Replayed on {w.tradesAffected} of your trades. {w.method}
        {w.usd < 0 && drawdownCut > 0 && " It costs some return but lowers your risk; that trade-off is yours to make."}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setState(state === "accepted" ? null : "accepted")}
          className={`rounded-sm px-3 py-1.5 text-sm transition-colors duration-150 ${state === "accepted" ? "bg-accent text-accent-ink" : "border border-rule hover:border-ink"}`}
        >
          {state === "accepted" ? "Accepted" : "Add to my rules"}
        </button>
        <button
          type="button"
          onClick={() => setState(state === "dismissed" ? null : "dismissed")}
          className="rounded-sm px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-ink"
        >
          {state === "dismissed" ? "Undo" : "Not for me"}
        </button>
      </div>
    </div>
  );
}

interface Explanation {
  text: string;
  source: "ai" | "computed";
}

function CoachNote({ habit, fallback }: { habit: string; fallback: string }) {
  const { wire } = useDataset();
  const [exp, setExp] = useState<Explanation | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataset: wire, habit }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((e) => !cancelled && setExp(e ?? { text: fallback, source: "computed" }))
      .catch(() => !cancelled && setExp({ text: fallback, source: "computed" }));
    return () => {
      cancelled = true;
    };
  }, [habit, wire, fallback]);

  if (!exp) return <p className="h-12 animate-pulse rounded-sm bg-rule/50" aria-label="Loading the coach's note" />;
  return (
    <div>
      <p className="leading-relaxed">{exp.text}</p>
      <p className="mt-1.5 text-xs text-muted">
        {exp.source === "ai" ? "Written by the AI coach · every number checked against the computed facts" : "Computed summary"}
      </p>
    </div>
  );
}

export function FindingNote({ f }: { f: Finding }) {
  return (
    <div>
      <VerdictBadge f={f} />
      <h3 className="mt-1.5 font-serif text-xl font-medium text-muted">{f.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.summary}</p>
    </div>
  );
}

export function FindingSection({ f, rule, datasetKey }: { f: Finding; rule?: Rule; datasetKey: string }) {
  const detected = f.status === "detected";
  const shown = f.evidenceNos.slice(0, 12);
  return (
    <section id={f.id} className="grid grid-cols-1 gap-6 border-t border-rule py-8 md:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <VerdictBadge f={f} />
        <h3 className={`mt-2 font-serif text-2xl font-medium tracking-tight ${detected ? "" : "text-muted"}`}>{f.title}</h3>
        <div className="mt-3 max-w-2xl">{detected ? <CoachNote habit={f.id} fallback={f.summary} /> : <p className="leading-relaxed text-muted">{f.summary}</p>}</div>

        {detected && f.cost && (
          <p className="mt-4 text-sm text-muted">
            These <span className="num">{f.cost.trades}</span> trades returned <span className={`num ${tone(f.cost.avgReturn)}`}>{pct(f.cost.avgReturn, { sign: true, digits: 2 })}</span>{" "}
            on average (your other trades: <span className={`num ${tone(f.cost.otherAvgReturn)}`}>{pct(f.cost.otherAvgReturn, { sign: true, digits: 2 })}</span>) and{" "}
            {f.cost.pnl < 0 ? "lost" : "made"} <span className={`num ${tone(f.cost.pnl)}`}>{usd(Math.abs(f.cost.pnl))}</span> in total.
          </p>
        )}

        {detected && shown.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted">Evidence: the trades behind this</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {shown.map((no) => (
                <li key={no}>
                  <Link href={`/review/trades/${no}`} className="mark num rounded-sm px-1.5 py-0.5 text-sm transition-opacity duration-150 hover:opacity-70">
                    #{no}
                  </Link>
                </li>
              ))}
              {f.evidenceNos.length > shown.length && (
                <li>
                  <Link href={`/review?habit=${f.id}#trades`} className="text-sm text-accent underline-offset-2 hover:underline">
                    +{f.evidenceNos.length - shown.length} more
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {rule && <RuleCard rule={rule} datasetKey={datasetKey} />}
    </section>
  );
}
