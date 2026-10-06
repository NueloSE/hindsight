import type { TraderProfile } from "./generate";

/**
 * Tolu: the demo trader. Trades NVDA, TSLA and the crypto-linked names, often at night and on
 * weekends. Four habits are planted; closed-market panic selling is deliberately absent so the
 * demo also shows Hindsight clearing a habit it doesn't find.
 */
export const TOLU: TraderProfile = {
  name: "Tolu",
  seed: 20260401,
  from: Date.UTC(2026, 3, 1), // 2026-04-01
  to: Date.UTC(2026, 8, 30, 23), // 2026-09-30
  tickers: [
    { ticker: "NVDA", weight: 0.3 },
    { ticker: "TSLA", weight: 0.25 },
    { ticker: "COIN", weight: 0.15 },
    { ticker: "MSTR", weight: 0.1 },
    { ticker: "AAPL", weight: 0.1 },
    { ticker: "QQQ", weight: 0.1 },
  ],
  tradesPerWeek: 4,
  baseSize: 1200,
  sizeSigma: 0.25,
  holdMedianHours: 30,
  holdSigma: 0.9,
  sessionBias: { regular: 1, pre: 0.6, post: 0.8, overnight: 1, weekend: 1.2, holiday: 1 },
  maxOpen: 3,
  feeRate: 0.001,
  habits: {
    "closed-chasing": 0.8,
    "earnings-roulette": 0.7,
    "cutting-winners": 0.8,
    revenge: 0.7,
  },
};
