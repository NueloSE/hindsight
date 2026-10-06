import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Candle, Interval, Series, Source } from "./types";

/**
 * Market data snapshots committed to the repo under data/snapshots/, so demo mode
 * and tests never depend on a live API. Candles are stored as compact tuples.
 */
export const SNAPSHOT_DIR = join(process.cwd(), "data", "snapshots");

type Tuple = [t: number, o: number, h: number, l: number, c: number, v: number];

interface StoredSeries {
  source: Source;
  symbol: string;
  interval: Interval;
  fetchedAt: number;
  candles: Tuple[];
}

export function snapshotPath(source: Source, symbol: string, interval: Interval): string {
  return join(SNAPSHOT_DIR, source, `${symbol}_${interval}.json`);
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function writeSeries(series: Series): string {
  const path = snapshotPath(series.source, series.symbol, series.interval);
  mkdirSync(dirname(path), { recursive: true });
  const stored: StoredSeries = {
    source: series.source,
    symbol: series.symbol,
    interval: series.interval,
    fetchedAt: series.fetchedAt,
    candles: series.candles.map((c) => [c.t, round(c.o), round(c.h), round(c.l), round(c.c), Math.round(c.v)]),
  };
  writeFileSync(path, JSON.stringify(stored));
  return path;
}

const cache = new Map<string, Series | null>();

export function readSeries(source: Source, symbol: string, interval: Interval): Series | null {
  const path = snapshotPath(source, symbol, interval);
  if (cache.has(path)) return cache.get(path)!;
  if (!existsSync(path)) {
    cache.set(path, null);
    return null;
  }
  const stored = JSON.parse(readFileSync(path, "utf8")) as StoredSeries;
  const series: Series = {
    source: stored.source,
    symbol: stored.symbol,
    interval: stored.interval,
    fetchedAt: stored.fetchedAt,
    candles: stored.candles.map(([t, o, h, l, c, v]): Candle => ({ t, o, h, l, c, v })),
  };
  cache.set(path, series);
  return series;
}

export function writeJson(relPath: string, data: unknown): void {
  const path = join(SNAPSHOT_DIR, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

export function readJson<T>(relPath: string): T | null {
  const path = join(SNAPSHOT_DIR, relPath);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null;
}
