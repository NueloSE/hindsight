/** A single execution, as an exchange reports it. rTokens are spot: long-only. */
export interface Fill {
  id: string;
  /** Epoch ms, UTC. */
  t: number;
  /** Underlying ticker, e.g. NVDA. */
  ticker: string;
  side: "buy" | "sell";
  /** Units of the rToken. */
  qty: number;
  /** Price per unit in USDT. */
  price: number;
  /** Fee in USDT. */
  fee: number;
}

/**
 * A round trip: from flat, through any number of buys and sells, back to flat.
 * Scaling in and out stays inside one trade.
 */
export interface Trade {
  id: string;
  ticker: string;
  entryT: number;
  exitT: number;
  /** Volume-weighted average buy price. */
  entryPrice: number;
  /** Volume-weighted average sell price. */
  exitPrice: number;
  /** Total units bought (equals units sold). */
  qty: number;
  /** USDT spent on buys, excluding fees. */
  cost: number;
  /** USDT received from sells, excluding fees. */
  proceeds: number;
  fees: number;
  /** proceeds - cost - fees. */
  pnl: number;
  /** pnl / cost. */
  ret: number;
  fillIds: string[];
}

/** A position still open at the end of the history. Shown, but excluded from habit statistics. */
export interface OpenPosition {
  ticker: string;
  entryT: number;
  qty: number;
  avgPrice: number;
  fillIds: string[];
}

export interface TradeBook {
  trades: Trade[];
  open: OpenPosition[];
  /** Fills that could not be placed (e.g. a sell with no position), with the reason. */
  rejected: { fill: Fill; reason: string }[];
}
