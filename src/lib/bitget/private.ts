import { createHmac } from "node:crypto";
import { rTokenTicker } from "../trades/csv";
import type { Fill } from "../trades/types";

/**
 * Read-only import of a trader's spot fills with their own Bitget API key.
 * Keys are used for the duration of one request and never stored or logged.
 *
 * Bitget has two account types with different APIs:
 *  - Unified (UTA) accounts: GET /api/v3/trade/fills, 30-day windows, cursor paging, last 90 days.
 *  - Classic accounts: GET /api/v2/spot/trade/fills, ≤90-day window, paged by tradeId, last 90 days.
 * We try v3 first and fall back to v2 when Bitget answers 40084 ("Classic Account mode").
 */

export interface BitgetCredentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

export class BitgetAuthError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "BitgetAuthError";
  }
}

const BASE = "https://api.bitget.com";
const DAY = 86_400_000;
const CLASSIC_MODE = "40084";

/** Bitget signature: base64(HMAC-SHA256(secret, timestamp + METHOD + path[?query] + body)). */
export function sign(secret: string, timestamp: string, method: string, endpoint: string, body = ""): string {
  return createHmac("sha256", secret).update(`${timestamp}${method.toUpperCase()}${endpoint}${body}`).digest("base64");
}

interface Envelope<T> {
  code: string;
  msg: string;
  data: T;
}

async function signedGet<T>(creds: BitgetCredentials, path: string, query: Record<string, string>): Promise<Envelope<T>> {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== "")).toString();
  const endpoint = qs ? `${path}?${qs}` : path;
  const ts = Date.now().toString();
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: {
      "ACCESS-KEY": creds.apiKey,
      "ACCESS-SIGN": sign(creds.secret, ts, "GET", endpoint),
      "ACCESS-PASSPHRASE": creds.passphrase,
      "ACCESS-TIMESTAMP": ts,
      "Content-Type": "application/json",
      locale: "en-US",
    },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!body) throw new Error(`Bitget returned HTTP ${res.status} with no readable body.`);
  return body;
}

/** Plain-English messages for the errors people actually hit when connecting a key. */
function explain(code: string, msg: string): string {
  const known: Record<string, string> = {
    "40006": "Bitget didn't recognise this API key. Check you copied the whole key.",
    "40009": "The signature was rejected. Check the secret key: it's shown only once when you create the key.",
    "40012": "Wrong passphrase. It's the one you typed when creating the key, not your login password.",
    "40014": "This key doesn't have read permission for spot trading.",
    "40018": "This key only works from whitelisted IP addresses. Create a key without an IP whitelist for Hindsight.",
    "40037": "This API key doesn't exist or was deleted.",
  };
  return known[code] ?? `Bitget said: ${msg} (code ${code}).`;
}

function check<T>(env: Envelope<T>): T {
  if (env.code !== "00000") throw new BitgetAuthError(explain(env.code, env.msg), env.code);
  return env.data;
}

export interface V2Fill {
  symbol: string;
  orderId: string;
  tradeId: string;
  side: string;
  priceAvg: string;
  size: string;
  amount: string;
  feeDetail?: { feeCoin?: string; totalFee?: string } | null;
  cTime: string;
}

export interface V3Fill {
  execId: string;
  orderId: string;
  symbol: string;
  side: string;
  execPrice: string;
  execQty: string;
  execValue?: string;
  feeDetail?: { feeCoin?: string; fee?: string }[] | null;
  createdTime: string;
}

export interface FillMapping {
  fills: Fill[];
  /** Fills in non-rToken pairs (crypto etc.), skipped. */
  skipped: number;
  /** Fees paid in a coin we can't price (e.g. BGB), left out of P&L. */
  unpricedFees: number;
}

/** Fee in USDT: USDT fees as-is; fees in the traded rToken converted at the fill price; others unpriced. */
function feeInUsdt(coin: string | undefined, amount: number, ticker: string, price: number): number | null {
  const fee = Math.abs(amount) || 0;
  if (!fee) return 0;
  const c = (coin ?? "USDT").toUpperCase();
  if (c === "USDT") return fee;
  if (c === `R${ticker}`) return fee * price;
  return null;
}

export function mapV2Fills(rows: V2Fill[]): FillMapping {
  const out: FillMapping = { fills: [], skipped: 0, unpricedFees: 0 };
  for (const r of rows) {
    const ticker = rTokenTicker(r.symbol);
    if (!ticker) {
      out.skipped++;
      continue;
    }
    const price = Number(r.priceAvg);
    const qty = Number(r.size);
    let fee = feeInUsdt(r.feeDetail?.feeCoin, Number(r.feeDetail?.totalFee ?? 0), ticker, price);
    if (fee === null) {
      out.unpricedFees++;
      fee = 0;
    }
    out.fills.push({ id: `bg-${r.tradeId}`, t: Number(r.cTime), ticker, side: r.side.toLowerCase() === "sell" ? "sell" : "buy", qty, price, fee });
  }
  return out;
}

export function mapV3Fills(rows: V3Fill[]): FillMapping {
  const out: FillMapping = { fills: [], skipped: 0, unpricedFees: 0 };
  for (const r of rows) {
    const ticker = rTokenTicker(r.symbol);
    if (!ticker) {
      out.skipped++;
      continue;
    }
    const price = Number(r.execPrice);
    let fee = 0;
    for (const f of r.feeDetail ?? []) {
      const usdt = feeInUsdt(f.feeCoin, Number(f.fee ?? 0), ticker, price);
      if (usdt === null) out.unpricedFees++;
      else fee += usdt;
    }
    out.fills.push({ id: `bg-${r.execId}`, t: Number(r.createdTime), ticker, side: r.side.toLowerCase() === "sell" ? "sell" : "buy", qty: Number(r.execQty), price, fee });
  }
  return out;
}

const MAX_PAGES = 100; // 10,000 fills is far beyond a retail trader's 90 days

async function fetchV3(creds: BitgetCredentials, now: number): Promise<V3Fill[]> {
  const rows: V3Fill[] = [];
  // Three 30-day windows cover Bitget's 90-day access window.
  for (let w = 0; w < 3; w++) {
    const end = now - w * 30 * DAY;
    const start = end - 30 * DAY + 1;
    let cursor = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = check(
        await signedGet<{ list: V3Fill[]; cursor?: string }>(creds, "/api/v3/trade/fills", {
          category: "SPOT",
          startTime: String(start),
          endTime: String(end),
          limit: "100",
          cursor,
        }),
      );
      rows.push(...(data.list ?? []));
      if (!data.cursor || !data.list?.length) break;
      cursor = data.cursor;
    }
  }
  return rows;
}

async function fetchV2(creds: BitgetCredentials, now: number): Promise<V2Fill[]> {
  const rows: V2Fill[] = [];
  let idLessThan = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = check(
      await signedGet<V2Fill[]>(creds, "/api/v2/spot/trade/fills", {
        startTime: String(now - 90 * DAY + 60_000),
        endTime: String(now),
        limit: "100",
        idLessThan,
      }),
    );
    rows.push(...data);
    if (data.length < 100) break;
    idLessThan = data.reduce((min, r) => (BigInt(r.tradeId) < BigInt(min) ? r.tradeId : min), data[0].tradeId);
  }
  return rows;
}

export interface BitgetImport extends FillMapping {
  accountType: "unified" | "classic";
  from: number;
  to: number;
}

export async function importFromBitget(creds: BitgetCredentials, now = Date.now()): Promise<BitgetImport> {
  const from = now - 90 * DAY;
  try {
    const rows = await fetchV3(creds, now);
    return { ...mapV3Fills(rows), accountType: "unified", from, to: now };
  } catch (err) {
    if (!(err instanceof BitgetAuthError && err.code === CLASSIC_MODE)) throw err;
  }
  const rows = await fetchV2(creds, now);
  return { ...mapV2Fills(rows), accountType: "classic", from, to: now };
}
