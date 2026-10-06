import type { Analysis } from "../review/analyze";
import type { HabitFinding } from "../review/patterns";
import type { TradeFacts } from "../review/replay";
import type { Rule } from "../review/rules";
import { mean, sum } from "../review/stats";
import type { HabitId } from "../sim/generate";

/** What the browser receives: compact, serialisable, and numbered so trades can be cited as #12. */
export interface TradeRow {
  no: number;
  id: string;
  ticker: string;
  entryT: number;
  exitT: number;
  entryPrice: number;
  exitPrice: number;
  cost: number;
  pnl: number;
  ret: number;
  holdHours: number;
  entrySession: string;
  exitSession: string;
  entryClosed: boolean;
  exitClosed: boolean;
  entryMove: number | null;
  exitMove: number | null;
  entryPremium: number | null;
  mfe: number;
  mae: number;
  capture: number | null;
  earningsDate: string | null;
  after24h: number | null;
  afterToOpen: number | null;
  relSize: number;
  prevLossHoursAgo: number | null;
  habits: HabitId[];
}

export interface ReviewPayload {
  dataset: Analysis["dataset"];
  traderName: string;
  summary: {
    trades: number;
    openPositions: number;
    rejectedFills: number;
    from: number;
    to: number;
    pnl: number;
    winRate: number;
    avgReturn: number;
    fees: number;
    tickers: string[];
  };
  trades: TradeRow[];
  findings: (HabitFinding & { evidenceNos: number[] })[];
  rules: Rule[];
}

export function toRow(f: TradeFacts, no: number, habits: HabitId[]): TradeRow {
  return {
    no,
    id: f.trade.id,
    ticker: f.trade.ticker,
    entryT: f.trade.entryT,
    exitT: f.trade.exitT,
    entryPrice: f.trade.entryPrice,
    exitPrice: f.trade.exitPrice,
    cost: f.trade.cost,
    pnl: f.trade.pnl,
    ret: f.trade.ret,
    holdHours: f.holdHours,
    entrySession: f.entrySession,
    exitSession: f.exitSession,
    entryClosed: f.entryClosed,
    exitClosed: f.exitClosed,
    entryMove: f.entryMove,
    exitMove: f.exitMove,
    entryPremium: f.entryPremium,
    mfe: f.mfe,
    mae: f.mae,
    capture: f.capture,
    earningsDate: f.earnings?.date ?? null,
    after24h: f.after24h,
    afterToOpen: f.afterToOpen,
    relSize: f.relSize,
    prevLossHoursAgo: f.prev && f.prev.pnl < 0 ? f.prev.hoursSinceExit : null,
    habits,
  };
}

export function toPayload(a: Analysis): ReviewPayload {
  const noById = new Map(a.facts.map((f, i) => [f.trade.id, i + 1]));
  const habitsById = new Map<string, HabitId[]>();
  for (const finding of a.review.findings) {
    if (finding.status !== "detected") continue;
    for (const id of finding.evidence) habitsById.set(id, [...(habitsById.get(id) ?? []), finding.id]);
  }
  const trades = a.facts.map((f, i) => toRow(f, i + 1, habitsById.get(f.trade.id) ?? []));

  return {
    dataset: a.dataset,
    traderName: a.traderName,
    summary: {
      trades: trades.length,
      openPositions: a.book.open.length,
      rejectedFills: a.book.rejected.length,
      from: a.review.from,
      to: a.review.to,
      pnl: sum(trades.map((t) => t.pnl)),
      winRate: trades.length ? trades.filter((t) => t.pnl > 0).length / trades.length : 0,
      avgReturn: mean(trades.map((t) => t.ret)),
      fees: sum(a.facts.map((f) => f.trade.fees)),
      tickers: [...new Set(trades.map((t) => t.ticker))],
    },
    trades,
    findings: a.review.findings.map((f) => ({ ...f, evidenceNos: f.evidence.map((id) => noById.get(id)!).filter(Boolean) })),
    rules: a.rules,
  };
}
