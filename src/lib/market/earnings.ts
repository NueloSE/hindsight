import { fetchJson } from "./http";
import { nextRegularOpen, nyToUtc } from "./sessions";

/**
 * Earnings dates. Source: Nasdaq's public earnings calendar (one request per date).
 * Bitget's data MCP also has an earnings calendar (`equity_calendar`); we fall back to Nasdaq
 * because that backend has been unreliable.
 *
 * Every stock in the S2 universe reports after the US close, so the price reaction lands at the
 * next regular open. ETFs have no earnings.
 */
export const REPORTS_AFTER_CLOSE: Record<string, boolean> = {
  NVDA: true,
  TSLA: true,
  AAPL: true,
  MSFT: true,
  META: true,
  AMZN: true,
  COIN: true,
  MSTR: true,
  PLTR: true,
};

export interface EarningsEvent {
  ticker: string;
  /** Report date (YYYY-MM-DD, New York). */
  date: string;
  /** When the market can first react: the next regular open after the report. */
  reactionAt: number;
}

interface NasdaqResponse {
  data: { rows: { symbol: string }[] | null } | null;
}

export async function earningsOn(date: string): Promise<string[]> {
  const res = await fetchJson<NasdaqResponse>(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Hindsight research)", Accept: "application/json" },
  });
  return (res.data?.rows ?? []).map((r) => r.symbol);
}

export function toEvent(ticker: string, date: string): EarningsEvent {
  const afterClose = REPORTS_AFTER_CLOSE[ticker] ?? true;
  const reportMoment = afterClose ? nyToUtc(date, 16, 5) : nyToUtc(date, 8, 0);
  return { ticker, date, reactionAt: afterClose ? nextRegularOpen(reportMoment) : nyToUtc(date, 9, 30) };
}
