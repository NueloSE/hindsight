/**
 * Grounding check: every number the model writes must come from data the code computed.
 * The model sees facts as JSON; we collect every number in that JSON (plus the ways a number is
 * normally written: as a percentage, rounded, without sign) and reject text containing any other number.
 */

export interface GroundingResult {
  ok: boolean;
  /** Numbers in the text that no computed fact supports. */
  unsupported: string[];
  checked: number;
}

/** Collect all finite numbers in a JSON-like value, including dates derived from epoch timestamps. */
export function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) {
    out.push(value);
    // Epoch ms timestamps: allow the calendar parts a sentence might mention.
    if (value > 1e12 && value < 1e13) {
      const d = new Date(value);
      out.push(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours());
    }
  } else if (typeof value === "string") {
    for (const m of value.matchAll(/-?\d+(?:\.\d+)?/g)) out.push(Number(m[0]));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectNumbers(v, out));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectNumbers(v, out));
  }
  return out;
}

interface Mention {
  raw: string;
  value: number;
  decimals: number;
  percent: boolean;
}

/** Numbers as written in prose: "$1,409", "−3.6%", "2.0×", "48h". */
export function extractNumbers(text: string): Mention[] {
  const out: Mention[] = [];
  const re = /(?<![A-Za-z0-9])[-−–]?\$?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(%|×|x\b)?/g;
  for (const m of text.matchAll(re)) {
    const whole = m[1].replace(/,/g, "");
    const frac = m[2] ?? "";
    out.push({
      raw: m[0].trim(),
      value: Number(whole + frac),
      decimals: frac ? frac.length - 1 : 0,
      percent: m[3] === "%",
    });
  }
  return out;
}

const roundTo = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** Small integers are allowed freely: counts like "one of two", list ordinals, "24 hours" phrasing. */
const FREE_INTEGERS = new Set([0, 1, 2, 3, 12, 24, 100]);

function supported(m: Mention, allowed: number[]): boolean {
  if (m.decimals === 0 && FREE_INTEGERS.has(m.value)) return true;
  for (const a of allowed) {
    const candidates = [a, Math.abs(a), a * 100, Math.abs(a * 100)];
    for (const c of candidates) {
      // Match at the precision the text used, allowing either rounding direction at the last digit.
      const step = 10 ** -m.decimals;
      if (Math.abs(roundTo(c, m.decimals) - m.value) < step / 2 + 1e-9) return true;
      if (m.decimals === 0 && Math.abs(c - m.value) < 1 + 1e-9 && Math.abs(c) >= 10) return true;
    }
  }
  return false;
}

export function checkGrounding(text: string, facts: unknown): GroundingResult {
  const allowed = collectNumbers(facts);
  const mentions = extractNumbers(text);
  const unsupported = mentions.filter((m) => !supported(m, allowed)).map((m) => m.raw);
  return { ok: unsupported.length === 0, unsupported, checked: mentions.length };
}
