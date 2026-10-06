import { readFileSync } from "node:fs";
import { join } from "node:path";
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, tool, toUIMessageStream, type UIMessage } from "ai";
import { z } from "zod";
import { COACH_VOICE } from "@/lib/ai/coach";
import { aiConfigured, coachModel } from "@/lib/ai/models";
import { badRequest, parseDataset } from "@/lib/api/dataset";
import { toPayload, type TradeRow } from "@/lib/api/payload";
import { isSupported } from "@/lib/market/universe";
import { analyze } from "@/lib/review/analyze";
import { checkIdea } from "@/lib/review/check";
import { contextAt } from "@/lib/review/live";
import { HABITS } from "@/lib/sim/generate";

export const maxDuration = 60;

const INSTRUCTIONS = `${COACH_VOICE}

You are answering questions about this trader's own trade history. Always call tools to get facts before
answering; never answer about their trades from memory. Cite trades by number like #12 so the trader can
open them. Keep answers short: 2–6 sentences or a short list. If the data can't answer the question, say so.`;

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

export async function POST(req: Request) {
  if (!aiConfigured()) return badRequest("The AI coach isn't configured on this deployment yet.", 503);
  const body = await req.json().catch(() => null);
  if (!body?.messages) return badRequest("Expected { messages, dataset }.");
  const messages = body.messages as UIMessage[];
  const analysis = analyze(parseDataset(body.dataset));
  const payload = toPayload(analysis);

  const result = streamText({
    model: coachModel(),
    instructions: INSTRUCTIONS,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(6),
    tools: {
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
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, originalMessages: messages }),
  });
}
