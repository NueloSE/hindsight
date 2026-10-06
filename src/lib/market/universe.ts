/** The stocks Hindsight supports in S2. Bitget rToken spot symbol = "R" + ticker + "USDT". */
export interface Instrument {
  ticker: string;
  name: string;
  /** Bitget rToken spot symbol (24/7). */
  rToken: string;
  /** Bitget USDT perpetual symbol. */
  perp: string;
  /** Yahoo Finance symbol for the underlying. */
  yahoo: string;
  kind: "stock" | "etf";
}

const make = (ticker: string, name: string, kind: Instrument["kind"] = "stock"): Instrument => ({
  ticker,
  name,
  rToken: `R${ticker}USDT`,
  perp: `${ticker}USDT`,
  yahoo: ticker,
  kind,
});

export const UNIVERSE: Instrument[] = [
  make("NVDA", "NVIDIA"),
  make("TSLA", "Tesla"),
  make("AAPL", "Apple"),
  make("MSFT", "Microsoft"),
  make("META", "Meta Platforms"),
  make("AMZN", "Amazon"),
  make("COIN", "Coinbase"),
  make("MSTR", "Strategy"),
  make("PLTR", "Palantir"),
  make("SPY", "SPDR S&P 500 ETF", "etf"),
  make("QQQ", "Invesco QQQ (Nasdaq-100)", "etf"),
];

/** Look up by ticker (NVDA), rToken symbol (RNVDAUSDT), rToken coin (rNVDA) or perp symbol (NVDAUSDT). */
const LOOKUP = new Map<string, Instrument>(
  UNIVERSE.flatMap((i) => [
    [i.ticker, i],
    [i.rToken, i],
    [`R${i.ticker}`, i],
    [i.perp, i],
  ]),
);

export function instrument(symbol: string): Instrument {
  const i = LOOKUP.get(symbol.trim().toUpperCase());
  if (!i) throw new Error(`Unsupported symbol: ${symbol}`);
  return i;
}

export function isSupported(ticker: string): boolean {
  try {
    instrument(ticker);
    return true;
  } catch {
    return false;
  }
}
