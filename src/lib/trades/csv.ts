import { isSupported, instrument } from "../market/universe";
import type { Fill } from "./types";

/**
 * Imports spot trade history from CSV. Accepts Bitget's spot trade-history export and the Hindsight
 * template. Column names vary between export versions and languages, so headers are matched against
 * aliases. Non-rToken rows (e.g. BTC/USDT) are skipped and counted.
 */

export const TEMPLATE_HEADER = "time_utc,symbol,side,price,quantity,fee_usdt";

export interface CsvImport {
  fills: Fill[];
  warnings: string[];
  /** Rows skipped because the symbol isn't a supported rToken, by symbol. */
  unsupported: Record<string, number>;
  /** Rows that could not be parsed, with 1-based line numbers. */
  errors: { line: number; message: string }[];
}

type Field = "time" | "symbol" | "side" | "price" | "qty" | "total" | "fee" | "feeCoin" | "id";

const ALIASES: Record<Field, string[]> = {
  time: ["time_utc", "time", "date", "datetime", "created time", "order time", "trade time", "filled time", "ctime", "date(utc)"],
  symbol: ["symbol", "trading pair", "pair", "coin pair", "market", "instrument"],
  side: ["side", "direction", "type", "buy/sell", "trade side"],
  price: ["price", "avg. price", "average price", "filled price", "price avg", "priceavg", "deal price", "execution price"],
  qty: ["quantity", "qty", "amount", "filled", "filled amount", "size", "executed", "filled quantity", "base volume"],
  total: ["total", "turnover", "filled total", "quote volume", "volume", "value"],
  fee: ["fee_usdt", "fee", "fees", "trading fee", "transaction fee"],
  feeCoin: ["fee coin", "fee currency", "fee asset", "feecoin"],
  id: ["trade id", "order id", "id", "tradeid", "orderid", "fill id"],
};

/** RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().replace(/\s*\(utc[^)]*\)\s*/g, "").replace(/\s+/g, " ").trim();

/** "(UTC+8)" in a header → offset in minutes. */
function headerOffsetMinutes(header: string): number | null {
  const m = header.match(/\(utc\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?\)/i);
  if (!m) return /\(utc\)/i.test(header) ? 0 : null;
  const mins = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -mins : mins;
}

/** "1,234.5 RNVDA" → 1234.5 */
function num(raw: string | undefined): number {
  if (raw == null) return NaN;
  const cleaned = raw.replace(/,/g, "").match(/-?\d+(\.\d+)?(e[+-]?\d+)?/i);
  return cleaned ? Number(cleaned[0]) : NaN;
}

/** Parses an ISO date, "YYYY-MM-DD HH:mm:ss", or epoch seconds/ms. Naive times use `offsetMinutes`. */
export function parseTime(raw: string, offsetMinutes: number): number {
  const v = raw.trim();
  if (/^\d{10}$/.test(v)) return Number(v) * 1000;
  if (/^\d{13}$/.test(v)) return Number(v);
  const m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (!m) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? NaN : t;
  }
  const [, y, mo, d, h, mi, sec = "0", frac = "0", tz] = m;
  const base = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec, Math.round(Number(`0.${frac}`) * 1000));
  if (!tz) return base - offsetMinutes * 60_000;
  if (tz.toUpperCase() === "Z") return base;
  const sign = tz[0] === "-" ? -1 : 1;
  const digits = tz.slice(1).replace(":", "");
  return base - sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60_000;
}

/** "rNVDA/USDT", "RNVDA_USDT", "RNVDAUSDT" → "NVDA"; null if not a supported rToken. */
export function rTokenTicker(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/[\s/_-]/g, "");
  if (!s.endsWith("USDT") || !s.startsWith("R")) return null;
  return isSupported(s) ? instrument(s).ticker : null;
}

export function importCsv(text: string, opts: { defaultOffsetMinutes?: number } = {}): CsvImport {
  const result: CsvImport = { fills: [], warnings: [], unsupported: {}, errors: [] };
  const rows = parseCsv(text);
  if (rows.length < 2) {
    result.errors.push({ line: 1, message: "The file has no data rows." });
    return result;
  }

  const header = rows[0];
  const col: Partial<Record<Field, number>> = {};
  header.forEach((h, i) => {
    const n = normalizeHeader(h);
    for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
      if (col[field] === undefined && aliases.includes(n)) col[field] = i;
    }
  });

  const missing = (["time", "symbol", "side"] as Field[]).filter((f) => col[f] === undefined);
  if (col.qty === undefined && col.total === undefined) missing.push("qty");
  if (col.price === undefined && (col.qty === undefined || col.total === undefined)) missing.push("price");
  if (missing.length) {
    result.errors.push({
      line: 1,
      message: `Missing column(s): ${missing.join(", ")}. Expected a Bitget spot trade-history export or the template: ${TEMPLATE_HEADER}`,
    });
    return result;
  }

  const headerOffset = headerOffsetMinutes(header[col.time!]);
  const offset = headerOffset ?? opts.defaultOffsetMinutes ?? 0;
  let naiveTimes = 0;

  let unconvertedFees = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    const get = (f: Field) => (col[f] === undefined ? undefined : row[col[f]!]);

    const symbolRaw = get("symbol") ?? "";
    const ticker = rTokenTicker(symbolRaw);
    if (!ticker) {
      const key = symbolRaw.trim() || "(blank)";
      result.unsupported[key] = (result.unsupported[key] ?? 0) + 1;
      continue;
    }

    const sideRaw = (get("side") ?? "").trim().toLowerCase();
    const side = /buy|买/.test(sideRaw) ? "buy" : /sell|卖/.test(sideRaw) ? "sell" : null;
    if (!side) {
      result.errors.push({ line, message: `Unrecognised side "${get("side")}".` });
      continue;
    }

    const timeRaw = (get("time") ?? "").trim();
    if (headerOffset === null && !/(Z|[+-]\d{2}:?\d{2})$/i.test(timeRaw) && !/^\d{10}(\d{3})?$/.test(timeRaw)) naiveTimes++;
    const t = parseTime(timeRaw, offset);
    let qty = num(get("qty"));
    let price = num(get("price"));
    const total = num(get("total"));
    if (Number.isNaN(price) && qty > 0 && total > 0) price = total / qty;
    if (Number.isNaN(qty) && price > 0 && total > 0) qty = total / price;
    if (Number.isNaN(t) || !(qty > 0) || !(price > 0)) {
      result.errors.push({ line, message: "Could not read time, quantity or price." });
      continue;
    }

    // Fees may be charged in USDT, in the rToken itself, or in BGB.
    let fee = Math.abs(num(get("fee")));
    if (Number.isNaN(fee)) fee = 0;
    const feeCoin = (get("feeCoin") ?? get("fee")?.replace(/[\d.,\s-]/g, "") ?? "").trim().toUpperCase();
    if (feeCoin && feeCoin !== "USDT") {
      if (feeCoin.startsWith("R") && rTokenTicker(`${feeCoin}USDT`) === ticker) fee *= price;
      else {
        unconvertedFees++;
        fee = 0;
      }
    }

    const id = get("id")?.trim();
    result.fills.push({ id: id ? `${id}-${line}` : `csv-${line}`, t, ticker, side, qty, price, fee });
  }

  if (naiveTimes) {
    const zone = offset === 0 ? "UTC" : `UTC${offset >= 0 ? "+" : ""}${offset / 60}`;
    result.warnings.push(`${naiveTimes} time(s) had no timezone and were read as ${zone}.`);
  }
  if (unconvertedFees) result.warnings.push(`${unconvertedFees} fee(s) were paid in a coin other than USDT or the rToken and were left out.`);
  const skipped = Object.values(result.unsupported).reduce((a, b) => a + b, 0);
  if (skipped) result.warnings.push(`${skipped} row(s) for unsupported symbols were skipped.`);
  return result;
}
