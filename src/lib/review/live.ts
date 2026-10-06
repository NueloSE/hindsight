import { spotCandles } from "../market/bitget";
import { marketData } from "../market/data";
import { GapCalculator } from "../market/gap";
import { HOUR, isUnderlyingClosed } from "../market/sessions";
import { instrument } from "../market/universe";
import { stockCandles } from "../market/yahoo";
import { snapshotContext, type IdeaContext } from "./check";

/**
 * Market context for a moment: stored snapshots when the moment is inside them, otherwise live
 * Bitget + Yahoo data. If the live sources fail, falls back to the latest snapshot and says so.
 */
export async function contextAt(ticker: string, at: number): Promise<IdeaContext & { note?: string }> {
  const m = marketData(ticker);
  const snapshotEnd = m.rToken1h.at(-1)!.t + HOUR;
  if (at <= snapshotEnd) return snapshotContext(ticker, at);

  const inst = instrument(ticker);
  try {
    const [r1h, s1h, s1d] = await Promise.all([
      spotCandles(inst.rToken, "1h", at - 4 * 24 * HOUR, at + HOUR),
      stockCandles(inst.yahoo, "1h", at - 4 * 24 * HOUR, at + HOUR),
      stockCandles(inst.yahoo, "1d", at - 14 * 24 * HOUR, at + HOUR),
    ]);
    const g = new GapCalculator(r1h.candles, s1h.candles, s1d.candles).at(at);
    const next = m.earnings.find((e) => e.reactionAt > at) ?? null;
    return {
      at,
      session: g.session,
      marketClosed: isUnderlyingClosed(g.session),
      price: g.rTokenPrice,
      lastClose: g.lastClose,
      moveSinceClose: g.moveSinceClose,
      premium: g.premium,
      nextEarnings: next,
      hoursToEarnings: next ? (next.reactionAt - at) / HOUR : null,
      source: "live",
    };
  } catch {
    return { ...snapshotContext(ticker, snapshotEnd - HOUR), at, note: "Live market data was unavailable; using the latest stored prices." };
  }
}
