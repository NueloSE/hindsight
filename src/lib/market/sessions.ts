/**
 * US equity market sessions in New York time, using the NYSE calendar.
 *
 * - regular:   09:30–16:00 on trading days (13:00 close on early-close days)
 * - pre:       04:00–09:30 on trading days
 * - post:      16:00 (or early close)–20:00 on trading days
 * - overnight: 20:00–04:00 between two consecutive trading days
 * - weekend:   from the last trading day's 20:00 until the next trading day's 04:00
 *              when that span crosses a Saturday or Sunday
 * - holiday:   the same, when the span crosses an exchange holiday but no weekend
 *
 * rTokens trade in every session; the underlying stock only trades in pre/regular/post.
 */

export type Session = "regular" | "pre" | "post" | "overnight" | "weekend" | "holiday";

/** Full-day NYSE closures. */
const HOLIDAYS = new Set([
  // 2025
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26",
  "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

/** 13:00 ET early closes. */
const EARLY_CLOSES = new Set(["2025-07-03", "2025-11-28", "2025-12-24", "2026-11-27", "2026-12-24", "2027-11-26"]);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

export interface NyParts {
  date: string; // YYYY-MM-DD
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function nyParts(ms: number): NyParts {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const year = Number(p.year), month = Number(p.month), day = Number(p.day);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    year,
    month,
    day,
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS[p.weekday],
  };
}

/** Epoch ms for a wall-clock time in New York (handles DST). */
export function nyToUtc(date: string, hour: number, minute = 0): number {
  const [y, m, d] = date.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, hour + 5, minute); // EST first guess
  for (let i = 0; i < 2; i++) {
    const p = nyParts(guess);
    const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += Date.UTC(y, m - 1, d, hour, minute) - wallAsUtc;
  }
  return guess;
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isTradingDay(date: string): boolean {
  const wd = weekdayOf(date);
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(date);
}

/** Regular-session close hour (fractional) for a trading day. */
function closeHour(date: string): number {
  return EARLY_CLOSES.has(date) ? 13 : 16;
}

function prevTradingDay(date: string): string {
  let d = addDays(date, -1);
  while (!isTradingDay(d)) d = addDays(d, -1);
  return d;
}

function nextTradingDay(date: string): string {
  let d = addDays(date, 1);
  while (!isTradingDay(d)) d = addDays(d, 1);
  return d;
}

/** Classify the closed span between two trading days (exclusive) as overnight / weekend / holiday. */
function closedSpanKind(fromTradingDay: string, toTradingDay: string): Session {
  let sawWeekend = false;
  let sawHoliday = false;
  for (let d = addDays(fromTradingDay, 1); d < toTradingDay; d = addDays(d, 1)) {
    const wd = weekdayOf(d);
    if (wd === 0 || wd === 6) sawWeekend = true;
    else if (HOLIDAYS.has(d)) sawHoliday = true;
  }
  if (sawWeekend) return "weekend";
  if (sawHoliday) return "holiday";
  return "overnight";
}

export function sessionAt(ms: number): Session {
  const p = nyParts(ms);
  const hm = p.hour + p.minute / 60;

  if (isTradingDay(p.date)) {
    const close = closeHour(p.date);
    if (hm >= 9.5 && hm < close) return "regular";
    if (hm >= 4 && hm < 9.5) return "pre";
    if (hm >= close && hm < 20) return "post";
    if (hm < 4) return closedSpanKind(prevTradingDay(p.date), p.date);
    return closedSpanKind(p.date, nextTradingDay(p.date)); // after 20:00
  }
  // Non-trading day: we are inside a closed span.
  return closedSpanKind(prevTradingDay(p.date), nextTradingDay(p.date));
}

/** True when the underlying stock has no live price (rTokens are the only venue). */
export function isUnderlyingClosed(session: Session): boolean {
  return session === "overnight" || session === "weekend" || session === "holiday";
}

/** Next regular-session open strictly after `ms`. */
export function nextRegularOpen(ms: number): number {
  const p = nyParts(ms);
  let d = p.date;
  if (!isTradingDay(d) || p.hour + p.minute / 60 >= 9.5) d = nextTradingDay(d);
  return nyToUtc(d, 9, 30);
}

/** Most recent regular-session close at or before `ms`. */
export function lastRegularClose(ms: number): number {
  const p = nyParts(ms);
  let d = p.date;
  if (!isTradingDay(d) || p.hour + p.minute / 60 < closeHour(d)) d = prevTradingDay(d);
  const close = closeHour(d);
  return nyToUtc(d, Math.floor(close), Math.round((close % 1) * 60));
}

export const SESSION_LABEL: Record<Session, string> = {
  regular: "US market hours",
  pre: "Pre-market",
  post: "After-hours",
  overnight: "Overnight",
  weekend: "Weekend",
  holiday: "Market holiday",
};

export { DAY, HOUR };
