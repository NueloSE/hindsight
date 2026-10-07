import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { matchFills } from "../trades/match";
import { mapV2Fills, mapV3Fills, sign, type V2Fill, type V3Fill } from "./private";

describe("sign", () => {
  it("signs timestamp + method + path?query + body, base64", () => {
    const expected = createHmac("sha256", "secret").update("1700000000000GET/api/v2/spot/trade/fills?limit=100").digest("base64");
    expect(sign("secret", "1700000000000", "get", "/api/v2/spot/trade/fills?limit=100")).toBe(expected);
  });
});

// Shapes follow Bitget's documented responses (as parsed by ccxt).
const v2 = (o: Partial<V2Fill>): V2Fill => ({
  symbol: "RNVDAUSDT",
  orderId: "1",
  tradeId: "100",
  side: "buy",
  priceAvg: "180",
  size: "5",
  amount: "900",
  feeDetail: { feeCoin: "USDT", totalFee: "-0.9" },
  cTime: "1788609600000",
  ...o,
});

describe("mapV2Fills (classic accounts)", () => {
  it("maps rToken fills, converts rToken-denominated fees, skips crypto", () => {
    const r = mapV2Fills([
      v2({ tradeId: "100", feeDetail: { feeCoin: "RNVDA", totalFee: "-0.005" } }),
      v2({ tradeId: "101", side: "sell", priceAvg: "190", size: "5", amount: "950", cTime: "1788696000000" }),
      v2({ tradeId: "102", symbol: "BTCUSDT" }),
      v2({ tradeId: "103", feeDetail: { feeCoin: "BGB", totalFee: "-0.01" }, cTime: "1788700000000" }),
    ]);
    expect(r.skipped).toBe(1);
    expect(r.unpricedFees).toBe(1);
    expect(r.fills[0]).toMatchObject({ id: "bg-100", ticker: "NVDA", side: "buy", qty: 5, price: 180 });
    expect(r.fills[0].fee).toBeCloseTo(0.9);
    expect(r.fills[1]).toMatchObject({ side: "sell", fee: 0.9 });
    const { trades } = matchFills(r.fills.slice(0, 2));
    expect(trades[0].pnl).toBeCloseTo(50 - 1.8);
  });
});

describe("mapV3Fills (unified accounts)", () => {
  it("maps execPrice/execQty and sums fee lists", () => {
    const row: V3Fill = {
      execId: "9",
      orderId: "8",
      symbol: "RTSLAUSDT",
      side: "sell",
      execPrice: "350",
      execQty: "2",
      execValue: "700",
      feeDetail: [{ feeCoin: "USDT", fee: "0.7" }],
      createdTime: "1788609600000",
    };
    const r = mapV3Fills([row, { ...row, execId: "10", symbol: "ETHUSDT" }]);
    expect(r.fills).toEqual([{ id: "bg-9", t: 1788609600000, ticker: "TSLA", side: "sell", qty: 2, price: 350, fee: 0.7 }]);
    expect(r.skipped).toBe(1);
  });
});
