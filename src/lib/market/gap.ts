import { HOUR, isUnderlyingClosed, lastRegularClose, nyParts, sessionAt, type Session } from "./sessions";
import { priceAt } from "./series";
import type { Candle } from "./types";

export interface PriceContext {
  t: number;
  session: Session;
  /** rToken price at t (Bitget spot). */
  rTokenPrice: number | null;
  /** Underlying reference: live price when the stock trades, otherwise the last regular close. */
  referencePrice: number | null;
  referenceKind: "live" | "last-close";
  /** rToken vs reference, as a fraction (0.01 = rToken 1% above the stock). */
  premium: number | null;
  /** Underlying's last regular-session close at or before t. */
  lastClose: number | null;
  /** rToken move since that close, as a fraction. Large values while closed = "moving while the market sleeps". */
  moveSinceClose: number | null;
}

/** Joins an rToken series with its underlying so any moment can be priced and compared. */
export class GapCalculator {
  private readonly dailyClose: Map<string, number>;

  constructor(
    private readonly rToken: Candle[],
    private readonly stockHourly: Candle[],
    stockDaily: Candle[],
  ) {
    this.dailyClose = new Map(stockDaily.map((c) => [nyParts(c.t).date, c.c]));
  }

  lastCloseAt(ms: number): number | null {
    return this.dailyClose.get(nyParts(lastRegularClose(ms)).date) ?? null;
  }

  at(ms: number): PriceContext {
    const session = sessionAt(ms);
    const rTokenPrice = priceAt(this.rToken, ms, HOUR, 6 * HOUR);
    const lastClose = this.lastCloseAt(ms);

    const live = !isUnderlyingClosed(session);
    const referencePrice = live ? (priceAt(this.stockHourly, ms, HOUR, 2 * HOUR) ?? lastClose) : lastClose;

    return {
      t: ms,
      session,
      rTokenPrice,
      referencePrice,
      referenceKind: live ? "live" : "last-close",
      premium: rTokenPrice != null && referencePrice ? rTokenPrice / referencePrice - 1 : null,
      lastClose,
      moveSinceClose: rTokenPrice != null && lastClose ? rTokenPrice / lastClose - 1 : null,
    };
  }
}
