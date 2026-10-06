"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useHydrated, useStored } from "@/lib/local-store";
import type { ReviewPayload } from "@/lib/api/payload";
import type { Fill } from "@/lib/trades/types";

/**
 * Which trade history the app is showing. Uploaded fills stay in this browser (localStorage) and are
 * sent with each request; the server keeps nothing.
 */
export type ClientDataset = { kind: "sample" } | { kind: "fills"; fills: Fill[]; fileName: string };

const STORAGE_KEY = "hindsight.dataset.v1";

interface DatasetState {
  dataset: ClientDataset;
  ready: boolean;
  selectSample: () => void;
  selectFills: (fills: Fill[], fileName: string) => void;
  /** What to send to the API. */
  wire: { kind: "sample" } | { kind: "fills"; fills: Fill[] };
}

const Ctx = createContext<DatasetState | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useStored(STORAGE_KEY);
  const ready = useHydrated();

  const dataset = useMemo<ClientDataset>(() => {
    if (!raw) return { kind: "sample" };
    try {
      const parsed = JSON.parse(raw) as ClientDataset;
      return parsed.kind === "fills" && Array.isArray(parsed.fills) ? parsed : { kind: "sample" };
    } catch {
      return { kind: "sample" };
    }
  }, [raw]);

  const selectSample = useCallback(() => setRaw(null), [setRaw]);
  const selectFills = useCallback(
    (fills: Fill[], fileName: string) => setRaw(JSON.stringify({ kind: "fills", fills, fileName } satisfies ClientDataset)),
    [setRaw],
  );

  const wire = useMemo(() => (dataset.kind === "sample" ? { kind: "sample" as const } : { kind: "fills" as const, fills: dataset.fills }), [dataset]);

  return <Ctx.Provider value={{ dataset, ready, selectSample, selectFills, wire }}>{children}</Ctx.Provider>;
}

export function useDataset(): DatasetState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDataset must be used inside DatasetProvider");
  return v;
}

const reviewCache = new Map<string, ReviewPayload>();
const keyOf = (d: ClientDataset) => (d.kind === "sample" ? "sample" : `fills:${d.fileName}:${d.fills.length}:${d.fills[0]?.t ?? 0}`);

/** The analysed review for the current dataset. */
export function useReview(): { data: ReviewPayload | null; error: string | null; loading: boolean } {
  const { dataset, ready, wire } = useDataset();
  const key = keyOf(dataset);
  const [state, setState] = useState<{ key: string; data: ReviewPayload | null; error: string | null }>({
    key: "",
    data: null,
    error: null,
  });

  const cached = reviewCache.get(key) ?? null;

  useEffect(() => {
    if (!ready || reviewCache.has(key)) return;
    let cancelled = false;
    fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataset: wire }) })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Could not load the review.");
        return body as ReviewPayload;
      })
      .then((data) => {
        reviewCache.set(key, data);
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ key, data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [key, ready, wire]);

  if (cached) return { data: cached, error: null, loading: false };
  const current = state.key === key;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !current || (!state.data && !state.error) };
}
