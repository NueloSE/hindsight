import type { Fill, OpenPosition, Trade, TradeBook } from "./types";

/** Positions smaller than this fraction of the episode's peak size count as flat (rounding dust). */
const DUST = 1e-6;

interface Episode {
  ticker: string;
  entryT: number;
  exitT: number;
  qty: number; // current position
  peak: number;
  bought: number;
  cost: number;
  sold: number;
  proceeds: number;
  fees: number;
  fillIds: string[];
}

function close(ep: Episode): Trade {
  const pnl = ep.proceeds - ep.cost - ep.fees;
  return {
    id: `${ep.ticker}-${ep.entryT}`,
    ticker: ep.ticker,
    entryT: ep.entryT,
    exitT: ep.exitT,
    entryPrice: ep.cost / ep.bought,
    exitPrice: ep.proceeds / ep.sold,
    qty: ep.bought,
    cost: ep.cost,
    proceeds: ep.proceeds,
    fees: ep.fees,
    pnl,
    ret: pnl / ep.cost,
    fillIds: ep.fillIds,
  };
}

/**
 * Groups fills into round-trip trades per ticker: a trade opens when the position leaves flat
 * and closes when it returns to flat. Sells with no open position (history that starts mid-position)
 * are rejected; a sell larger than the position closes it and rejects the excess.
 */
export function matchFills(fills: Fill[]): TradeBook {
  const sorted = [...fills].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  const episodes = new Map<string, Episode>();
  const trades: Trade[] = [];
  const rejected: TradeBook["rejected"] = [];

  for (const fill of sorted) {
    if (!(fill.qty > 0) || !(fill.price > 0) || !(fill.fee >= 0)) {
      rejected.push({ fill, reason: "quantity and price must be positive and the fee non-negative" });
      continue;
    }
    let ep = episodes.get(fill.ticker);

    if (fill.side === "buy") {
      if (!ep) {
        ep = { ticker: fill.ticker, entryT: fill.t, exitT: fill.t, qty: 0, peak: 0, bought: 0, cost: 0, sold: 0, proceeds: 0, fees: 0, fillIds: [] };
        episodes.set(fill.ticker, ep);
      }
      ep.qty += fill.qty;
      ep.peak = Math.max(ep.peak, ep.qty);
      ep.bought += fill.qty;
      ep.cost += fill.qty * fill.price;
      ep.fees += fill.fee;
      ep.fillIds.push(fill.id);
      continue;
    }

    if (!ep) {
      rejected.push({ fill, reason: "sell with no open position (history may start mid-position)" });
      continue;
    }

    let qty = fill.qty;
    let fee = fill.fee;
    if (qty > ep.qty * (1 + DUST)) {
      const excess = qty - ep.qty;
      rejected.push({ fill: { ...fill, qty: excess, fee: fee * (excess / qty) }, reason: "sell larger than the open position; excess ignored" });
      fee *= ep.qty / qty;
      qty = ep.qty;
    }

    ep.qty -= qty;
    ep.sold += qty;
    ep.proceeds += qty * fill.price;
    ep.fees += fee;
    ep.exitT = fill.t;
    ep.fillIds.push(fill.id);

    if (ep.qty <= ep.peak * DUST) {
      // Dust left from rounding is treated as sold at this fill's price.
      ep.sold = ep.bought;
      trades.push(close(ep));
      episodes.delete(fill.ticker);
    }
  }

  const open: OpenPosition[] = [...episodes.values()].map((ep) => ({
    ticker: ep.ticker,
    entryT: ep.entryT,
    qty: ep.qty,
    avgPrice: ep.cost / ep.bought,
    fillIds: ep.fillIds,
  }));

  trades.sort((a, b) => a.entryT - b.entryT);
  return { trades, open, rejected };
}
