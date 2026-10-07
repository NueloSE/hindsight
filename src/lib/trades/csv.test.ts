import { describe, expect, it } from "vitest";
import { importCsv, parseCsv, parseTime, rTokenTicker } from "./csv";
import { matchFills } from "./match";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and a BOM", () => {
    const rows = parseCsv('﻿a,b\r\n"1,000","say ""hi"""\r\n\r\nx,y');
    expect(rows).toEqual([
      ["a", "b"],
      ["1,000", 'say "hi"'],
      ["x", "y"],
    ]);
  });
});

describe("parseTime", () => {
  it("reads naive times with an offset, ISO with zones, and epochs", () => {
    expect(parseTime("2026-09-05 20:00:00", 8 * 60)).toBe(Date.UTC(2026, 8, 5, 12));
    expect(parseTime("2026-09-05T12:00:00Z", 480)).toBe(Date.UTC(2026, 8, 5, 12));
    expect(parseTime("2026-09-05T08:00:00-04:00", 0)).toBe(Date.UTC(2026, 8, 5, 12));
    expect(parseTime("1788609600", 0)).toBe(1788609600000);
  });
});

describe("rTokenTicker", () => {
  it("normalises symbol spellings and rejects non-rTokens", () => {
    expect(rTokenTicker("rNVDA/USDT")).toBe("NVDA");
    expect(rTokenTicker("RTSLA_USDT")).toBe("TSLA");
    expect(rTokenTicker("RSPYUSDT")).toBe("SPY");
    expect(rTokenTicker("BTCUSDT")).toBeNull();
    expect(rTokenTicker("NVDAUSDT")).toBeNull(); // perp, not rToken
  });
});

describe("importCsv", () => {
  it("imports the Hindsight template", () => {
    const csv = [
      "time_utc,symbol,side,price,quantity,fee_usdt",
      "2026-09-05T12:00:00Z,RNVDAUSDT,buy,180,5,0.9",
      "2026-09-06T12:00:00Z,RNVDAUSDT,sell,190,5,0.95",
    ].join("\n");
    const r = importCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.fills).toHaveLength(2);
    const { trades } = matchFills(r.fills);
    expect(trades[0].pnl).toBeCloseTo(50 - 1.85);
  });

  it("imports a Bitget-style export with UTC+8 times, units, rToken-denominated fees and crypto rows", () => {
    const csv = [
      "Date(UTC+8),Trading pair,Direction,Price,Amount,Total,Fee,Fee coin,Order ID",
      '2026-09-05 20:00:00,rNVDA/USDT,Buy,180.00,5 rNVDA,"900.00 USDT",0.005,rNVDA,111',
      "2026-09-05 21:00:00,BTC/USDT,Buy,60000,0.01,600,0.6,USDT,112",
      '2026-09-06 20:00:00,rNVDA/USDT,Sell,190.00,4.995 rNVDA,"949.05 USDT",0.95,USDT,113',
    ].join("\n");
    const r = importCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.unsupported).toEqual({ "BTC/USDT": 1 });
    expect(r.fills[0].t).toBe(Date.UTC(2026, 8, 5, 12));
    expect(r.fills[0].fee).toBeCloseTo(0.9); // 0.005 rNVDA × 180
    expect(r.fills[1].qty).toBeCloseTo(4.995);
  });

  it("derives price from total when the price column is missing", () => {
    const r = importCsv("time,symbol,side,amount,total\n2026-09-05T12:00:00Z,RTSLAUSDT,BUY,2,700");
    expect(r.fills[0].price).toBe(350);
    expect(r.warnings.some((w) => w.includes("timezone"))).toBe(false); // every time carries its own zone
  });

  it("warns when it has to assume a timezone", () => {
    const r = importCsv("time,symbol,side,price,quantity\n2026-09-05 12:00:00,RTSLAUSDT,buy,350,2", { defaultOffsetMinutes: 60 });
    expect(r.fills[0].t).toBe(Date.UTC(2026, 8, 5, 11));
    expect(r.warnings).toContain("1 time(s) had no timezone and were read as UTC+1.");
  });

  it("explains missing columns", () => {
    const r = importCsv("foo,bar\n1,2");
    expect(r.fills).toEqual([]);
    expect(r.errors[0].message).toMatch(/Missing column/);
  });

  it("reports unreadable rows by line number", () => {
    const r = importCsv("time_utc,symbol,side,price,quantity\n2026-09-05T12:00:00Z,RNVDAUSDT,hold,1,1\nnot a date,RNVDAUSDT,buy,1,1");
    expect(r.errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it("reads Bitget's website export headers (as documented by the daybook and dtax parsers)", () => {
    const csv = [
      "Order ID,Trading Pair,Side,Filled Price,Filled Amount,Total,Fee,Fee Currency,Order Time,Order Type",
      "1001,RNVDAUSDT_SPBL,buy,180.00,5,900.00,0.005,RNVDA,2026-09-05 12:00:00,market",
      "1002,RNVDAUSDT_SPBL,sell,190.00,5,950.00,0.95,USDT,2026-09-06 12:00:00,limit",
      "1003,BTCUSDT_SPBL,buy,60000,0.01,600,0.6,USDT,2026-09-06 13:00:00,market",
    ].join("\n");
    const r = importCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.fills).toHaveLength(2);
    expect(r.fills[0]).toMatchObject({ ticker: "NVDA", side: "buy", qty: 5, price: 180, t: Date.UTC(2026, 8, 5, 12) });
    expect(r.fills[0].fee).toBeCloseTo(0.9);
    expect(r.unsupported).toEqual({ BTCUSDT_SPBL: 1 });
    expect(r.naiveTimes).toBe(2);
    expect(matchFills(r.fills).trades[0].pnl).toBeCloseTo(50 - 1.85);
  });

  it("reads the API-style export with millisecond timestamps and negative fees", () => {
    const csv = ["orderId,symbol,side,priceAvg,size,baseVolume,quoteVolume,fee,feeCurrency,cTime", "1,RTSLAUSDT,sell,350,2,2,700,-0.7,USDT,1788609600000"].join("\n");
    const r = importCsv(csv);
    expect(r.fills).toEqual([{ id: "1-2", t: 1788609600000, ticker: "TSLA", side: "sell", qty: 2, price: 350, fee: 0.7 }]);
    expect(r.naiveTimes).toBe(0);
  });

  it("reads Chinese headers and side words", () => {
    const csv = ["订单号,交易对,方向,成交价,成交量,总额,手续费,手续费币种,下单时间", "7,RAAPLUSDT,买入,200,1,200,0.2,USDT,2026-09-05 12:00:00"].join("\n");
    const r = importCsv(csv);
    expect(r.fills[0]).toMatchObject({ ticker: "AAPL", side: "buy", price: 200, qty: 1 });
  });
});
