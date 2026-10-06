/** Display formatting. Minus signs are typographic (−), money is whole dollars unless small. */

const MINUS = "−";

export function usd(x: number, opts: { sign?: boolean; cents?: boolean } = {}): string {
  const abs = Math.abs(x);
  const digits = opts.cents || abs < 10 ? 2 : 0;
  const body = abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = x < 0 ? MINUS : opts.sign && x > 0 ? "+" : "";
  return `${sign}$${body}`;
}

/** Fraction → percent: 0.0342 → "3.4%". */
export function pct(x: number | null | undefined, opts: { sign?: boolean; digits?: number } = {}): string {
  if (x == null || !Number.isFinite(x)) return "–";
  const digits = opts.digits ?? 1;
  const body = (Math.abs(x) * 100).toFixed(digits);
  const sign = x < 0 && Number(body) !== 0 ? MINUS : opts.sign && x > 0 ? "+" : "";
  return `${sign}${body}%`;
}

export function times(x: number, digits = 1): string {
  return `${x.toFixed(digits)}×`;
}

export function hours(h: number): string {
  if (h < 48) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(h < 240 ? 1 : 0)}d`;
}

export function price(x: number | null | undefined): string {
  if (x == null) return "–";
  return x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export const day = (ms: number) => dateFmt.format(ms);
export const dateTime = (ms: number) => dateTimeFmt.format(ms);
export const longDateTime = (ms: number) => weekdayFmt.format(ms);

export const SESSION_NAME: Record<string, string> = {
  regular: "US market hours",
  pre: "Pre-market",
  post: "After-hours",
  overnight: "Overnight",
  weekend: "Weekend",
  holiday: "Market holiday",
};

/** Colour for a signed value. `eps` treats values that display as zero as neutral (e.g. 5e-4 for returns shown to 0.1%). */
export const tone = (x: number, eps = 0) => (x > eps ? "text-gain" : x < -eps ? "text-loss" : "text-muted");
export const retTone = (x: number) => tone(x, 5e-4);
