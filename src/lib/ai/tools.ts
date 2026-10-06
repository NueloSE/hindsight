import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tool } from "ai";
import { z } from "zod";
import type { ReviewPayload, TradeRow } from "../api/payload";
import { isSupported } from "../market/universe";
import type { Analysis } from "../review/analyze";
import { checkIdea } from "../review/check";
import { contextAt } from "../review/live";
import { HABITS } from "../sim/generate";
import { COACH_VOICE } from "./coach";

export const INSTRUCTIONS = `${COACH_VOICE}

You are answering questions about this trader's own trade history. Always call tools to get facts before
answering; never answer about their trades from memory. Cite trades by number like #12 so the trader can
open them. Keep answers short: 2–6 sentences or a short list. If the data can't answer the question, say so.
Format money like $1,084 or $158.13 and percentages with one decimal, copying values from tool results.`;

/** Compact trade view for the model: fewer fields, fractions kept as fractions. */
function brief(t: TradeRow) {
  return {
    no: t.no,
    ticker: t.ticker,
    entry: new Date(t.entryT).toISOString().slice(0, 16),
    exit: new Date(t.exitT).toISOString().slice(0, 16),
    holdHours: Math.round(t.holdHours),
    pnlUsd: Math.round(t.pnl * 100) / 100,
    returnPct: Math.round(t.ret * 10000) / 100,
    sizeUsd: Math.round(t.cost),
    entrySession: t.entrySession,
    exitSession: t.exitSession,
    moveSinceCloseAtEntryPct: t.entryMove == null ? null : Math.round(t.entryMove * 10000) / 100,
    heldThroughEarnings: t.earningsDate,
    habits: t.habits,
  };
}

/** Round every number so the model never sees (or repeats) float noise: money to cents, fractions to 4 dp. */
export function roundDeep<T>(v: T): T {
  if (typeof v === "number") return (Number.isFinite(v) && !Number.isInteger(v) ? Math.round(v * (Math.abs(v) >= 1 ? 100 : 10_000)) / (Math.abs(v) >= 1 ? 100 : 10_000) : v) as T;
  if (Array.isArray(v)) return v.map(roundDeep) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, roundDeep(x)])) as T;
  return v;
}

/** Read-only tools over one trader's analysis. Shared by the chat route and the eval script. */
export function coachTools(analysis: Analysis, payload: ReviewPayload) {
  const tools = {
    get_overview: tool({
      description: "Totals for the trader's history and the status of every habit Hindsight checks.",
      inputSchema: z.object({}),
      execute: async () => ({
        trader: payload.traderName,
        ...payload.summary,
        habits: payload.findings.map((f) => ({ id: f.id, title: f.title, status: f.status, confidence: f.confidence, watching: f.watching, summary: f.summary })),
        rules: payload.rules.map((r) => ({ id: r.id, title: r.title })),
      }),
    }),
    get_habit: tool({
      description: "Full evidence for one habit: metrics, cost, evidence trade numbers, and the rule with its what-if.",
      inputSchema: z.object({ habit: z.enum(HABITS) }),
      execute: async ({ habit }) => {
        const f = payload.findings.find((x) => x.id === habit)!;
        return { ...f, evidence: undefined, evidenceTrades: f.evidenceNos.slice(0, 15), rule: payload.rules.find((r) => r.id === habit) ?? null };
      },
    }),
    list_trades: tool({
      description: "List the trader's trades, optionally filtered, sorted and limited (max 20).",
      inputSchema: z.object({
        ticker: z.string().optional(),
        habit: z.enum(HABITS).optional(),
        marketClosedAtEntry: z.boolean().optional(),
        outcome: z.enum(["win", "loss"]).optional(),
        sort: z.enum(["recent", "best", "worst", "largest"]).default("recent"),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async (q) => {
        let rows = payload.trades;
        if (q.ticker) rows = rows.filter((t) => t.ticker === q.ticker!.toUpperCase().replace(/^R(?=[A-Z])/, ""));
        if (q.habit) rows = rows.filter((t) => t.habits.includes(q.habit!));
        if (q.marketClosedAtEntry !== undefined) rows = rows.filter((t) => t.entryClosed === q.marketClosedAtEntry);
        if (q.outcome) rows = rows.filter((t) => (q.outcome === "win" ? t.pnl > 0 : t.pnl <= 0));
        const sorters: Record<typeof q.sort, (a: TradeRow, b: TradeRow) => number> = {
          recent: (a, b) => b.entryT - a.entryT,
          best: (a, b) => b.pnl - a.pnl,
          worst: (a, b) => a.pnl - b.pnl,
          largest: (a, b) => b.cost - a.cost,
        };
        const matched = rows.length;
        return { matched, totalPnlUsd: Math.round(rows.reduce((s, t) => s + t.pnl, 0) * 100) / 100, trades: [...rows].sort(sorters[q.sort]).slice(0, q.limit).map(brief) };
      },
    }),
    get_trade: tool({
      description: "Everything Hindsight computed about one trade, by its number.",
      inputSchema: z.object({ no: z.number().int().min(1) }),
      execute: async ({ no }) => payload.trades.find((t) => t.no === no) ?? { error: `No trade #${no}.` },
    }),
    get_accuracy: tool({
      description: "Results of Hindsight's blind accuracy test (how reliably it finds habits and avoids false alarms).",
      inputSchema: z.object({}),
      execute: async () => {
        const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "blind-test", "results.json"), "utf8"));
        return { traders: raw.traders, trades: raw.trades, overall: raw.overall, perHabit: raw.perHabit, byStrength: raw.byStrength, cleanTraders: raw.cleanTraders };
      },
    }),
    check_trade_idea: tool({
      description: "Check a trade idea right now against the trader's rules and similar past trades. The trader decides.",
      inputSchema: z.object({ ticker: z.string(), side: z.enum(["buy", "sell"]), usd: z.number().positive().nullable() }),
      execute: async ({ ticker, side, usd }) => {
        const tk = ticker.toUpperCase().replace(/^R(?=[A-Z]{2,5}$)/, "");
        if (!isSupported(tk)) return { error: `${ticker} isn't supported.` };
        const at = Date.now();
        const ctx = await contextAt(tk, at);
        const r = checkIdea({ ticker: tk, side, usd, at }, ctx, analysis.rules, analysis.facts);
        return {
          verdict: r.verdict,
          marketClosed: ctx.marketClosed,
          moveSinceClose: ctx.moveSinceClose,
          hits: r.hits.map((h) => ({ rule: h.rule.title, kind: h.kind, reason: h.reason, history: h.history })),
          similarTrades: r.similarStats,
          sizeVsNormal: r.sizeVsNormal,
        };
      },
    }),
    
  };
  // Every tool's output is rounded before the model sees it.
  for (const t of Object.values(tools) as unknown as { execute: (...a: unknown[]) => Promise<unknown> }[]) {
    const run = t.execute;
    t.execute = async (...a: unknown[]) => roundDeep(await run(...a));
  }
  return tools;
}
