import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Explanation } from "./coach";

/**
 * Pre-generated coaching for the sample trader, so the demo is instant and doesn't depend on a model
 * being reachable. Each entry stores a fingerprint of the facts it was written from and is only served
 * while those facts are unchanged. Written by `pnpm coach-cache`.
 */
const PATH = join(process.cwd(), "data", "coaching", "sample.json");

interface Entry {
  fingerprint: string;
  explanation: Explanation;
}
type CacheFile = Record<string, Entry>;

export const fingerprint = (facts: unknown) => createHash("sha256").update(JSON.stringify(facts)).digest("hex").slice(0, 16);

let loaded: CacheFile | null = null;

function file(): CacheFile {
  loaded ??= existsSync(PATH) ? (JSON.parse(readFileSync(PATH, "utf8")) as CacheFile) : {};
  return loaded;
}

export function cachedExplanation(key: string, facts: unknown): Explanation | null {
  const e = file()[key];
  return e && e.fingerprint === fingerprint(facts) ? e.explanation : null;
}

export function writeCache(entries: Record<string, { facts: unknown; explanation: Explanation }>) {
  const out: CacheFile = {};
  for (const [k, v] of Object.entries(entries)) out[k] = { fingerprint: fingerprint(v.facts), explanation: v.explanation };
  mkdirSync(dirname(PATH), { recursive: true });
  writeFileSync(PATH, JSON.stringify(out, null, 1));
  loaded = out;
}

export const habitKey = (habit: string) => `habit:${habit}`;
export const checkKey = (ticker: string, side: string, usd: number | null, at: number) => `check:${ticker}:${side}:${usd ?? ""}:${at}`;
