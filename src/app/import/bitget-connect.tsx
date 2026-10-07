"use client";

import { useState } from "react";
import type { Fill } from "@/lib/trades/types";

interface Props {
  onFills: (fills: Fill[], label: string, notes: string[]) => void;
}

/** Read-only API key import. Keys live only in this form and are cleared after each attempt. */
export function BitgetConnect({ onFills }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/bitget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, secret, passphrase }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't connect.");
      const notes = [`Connected to a ${body.accountType} Bitget account; read the last 90 days of spot trades.`];
      if (body.skipped) notes.push(`Skipped ${body.skipped} fill(s) in pairs that aren't supported rTokens.`);
      if (body.unpricedFees) notes.push(`${body.unpricedFees} fee(s) were paid in a coin like BGB and were left out.`);
      onFills(body.fills as Fill[], "Bitget API · last 90 days", notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect.");
    } finally {
      setSecret("");
      setPassphrase("");
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm";
  return (
    <form onSubmit={connect} className="space-y-3" autoComplete="off">
      <div>
        <label htmlFor="bg-key" className="text-sm text-muted">
          API key
        </label>
        <input id="bg-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={field} spellCheck={false} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="bg-secret" className="text-sm text-muted">
            Secret key
          </label>
          <input id="bg-secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className={field} autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="bg-pass" className="text-sm text-muted">
            Passphrase
          </label>
          <input id="bg-pass" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className={field} autoComplete="new-password" />
        </div>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      <button
        type="submit"
        disabled={busy || !apiKey || !secret || !passphrase}
        className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Reading your trades…" : "Fetch my trades"}
      </button>
      <p className="text-xs leading-relaxed text-muted">
        Use a key with <span className="text-ink">read-only</span> permission: it can&apos;t trade or withdraw. Your key is sent once to fetch
        your trades and is never stored. Bitget only shares the last 90 days this way; for older trades, use the CSV export below.
      </p>
    </form>
  );
}
