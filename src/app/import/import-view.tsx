"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDataset } from "@/components/dataset";
import { UNIVERSE } from "@/lib/market/universe";
import { importCsv, TEMPLATE_HEADER, type CsvImport } from "@/lib/trades/csv";
import { matchFills } from "@/lib/trades/match";
import type { Fill } from "@/lib/trades/types";
import { BitgetConnect } from "./bitget-connect";

const MAX_BYTES = 5 * 1024 * 1024;

export function ImportView() {
  const router = useRouter();
  const { dataset, selectFills, selectSample } = useDataset();
  const [file, setFile] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const tzOffset = -new Date().getTimezoneOffset();

  async function read(f: File) {
    setProblem(null);
    setResult(null);
    if (f.size > MAX_BYTES) return setProblem("That file is over 5 MB. Export a shorter date range and try again.");
    const text = await f.text();
    setFile(f.name);
    setResult(importCsv(text, { defaultOffsetMinutes: tzOffset }));
  }

  function fromApi(fills: Fill[], label: string, notes: string[]) {
    setProblem(null);
    setFile(label);
    setResult({ fills, warnings: notes, unsupported: {}, errors: [] });
  }

  const book = result ? matchFills(result.fills) : null;
  const unsupported = result ? Object.entries(result.unsupported) : [];

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-10 pb-20 md:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <h1 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">Review your trades</h1>
        <p className="mt-3 max-w-xl text-muted">
          Connect a read-only Bitget API key, or upload your trade history as a CSV. Trades are sent to Hindsight only to be analysed, and
          nothing is stored on the server.
        </p>

        <section className="mt-8 rounded-md border border-rule bg-sheet p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">Connect your Bitget account</h2>
            <span className="text-xs text-muted">Read-only · last 90 days · beta</span>
          </div>
          <details className="mt-3 text-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="cursor-pointer text-accent">How to create a read-only API key</summary>
            <ol className="mt-3 space-y-2">
              {[
                <>On bitget.com, open your <span className="font-medium">profile → API Management</span>.</>,
                <>Choose <span className="font-medium">Create API → System-generated API key</span>.</>,
                <>Give it a name and make up a <span className="font-medium">passphrase</span> (you&apos;ll enter it here).</>,
                <>Permissions: tick <span className="font-medium">Read only</span>. Leave trade, withdraw and transfer off.</>,
                <>Leave the IP whitelist empty, confirm, and copy the <span className="font-medium">secret key</span>: Bitget shows it only once.</>,
              ].map((step, i) => (
                <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-2">
                  <span className="num text-muted">{i + 1}.</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </details>
          <div className="mt-4">
            <BitgetConnect onFills={fromApi} />
          </div>
        </section>

        <h2 className="mt-10 font-medium">Or upload a CSV <span className="font-normal text-muted">(up to 2 years of history)</span></h2>

        <details className="mt-3 rounded-md border border-rule p-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer font-medium">How to get this file from Bitget (about 2 minutes)</summary>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              <>Open <span className="font-medium">bitget.com</span> on a computer and log in. The export is only available on the website, not in the app.</>,
              <>Go to <span className="font-medium">Orders → Spot</span>, then open <span className="font-medium">Order history</span> (or <span className="font-medium">Transactions / fills</span> if you see it).</>,
              <>Click <span className="font-medium">Download</span>, choose the date range you want reviewed (up to 2 years), and pick <span className="font-medium">CSV</span>.</>,
              <>Click <span className="font-medium">Generate</span>. When it&apos;s ready, click <span className="font-medium">Download</span>. The link expires after 7 days.</>,
              <>Drop the file below. Only rToken pairs (like rNVDA/USDT) are reviewed; crypto pairs in the same file are skipped.</>,
            ].map((step, i) => (
              <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-2">
                <span className="num text-muted">{i + 1}.</span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </details>

        <label
          htmlFor="csv"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) read(f);
          }}
          className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-14 text-center transition-colors duration-150 ${dragging ? "border-accent bg-sheet" : "border-rule hover:border-ink"}`}
        >
          <span className="font-medium">{file ? file : "Drop a CSV here, or choose a file"}</span>
          <span className="mt-1 text-sm text-muted">Bitget spot trade history export, or the Hindsight template</span>
          <input id="csv" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        </label>
        {problem && <p className="mt-4 text-sm text-loss">{problem}</p>}

        {result && book && (
          <section aria-live="polite" className="mt-8 rounded-md border border-rule bg-sheet p-5">
            {result.errors.length > 0 && result.fills.length === 0 ? (
              <>
                <p className="font-medium">We couldn&apos;t read this file.</p>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {result.errors.slice(0, 5).map((e) => (
                    <li key={e.line}>
                      Line {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="font-serif text-2xl">
                  {result.fills.length === 0 ? (
                    "No rToken trades found."
                  ) : (
                    <>
                      <span className="num">{result.fills.length}</span> fills read, <span className="num">{book.trades.length}</span> complete trades.
                    </>
                  )}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {book.open.length > 0 && <li>{book.open.length} position(s) still open; they&apos;re shown but not judged.</li>}
                  {book.rejected.length > 0 && <li>{book.rejected.length} fill(s) couldn&apos;t be matched (often a history that starts mid-position).</li>}
                  {unsupported.length > 0 && (
                    <li>
                      Skipped {unsupported.reduce((s, [, n]) => s + n, 0)} row(s) for symbols Hindsight doesn&apos;t cover yet:{" "}
                      {unsupported
                        .slice(0, 6)
                        .map(([s, n]) => `${s} (${n})`)
                        .join(", ")}
                    </li>
                  )}
                  {result.errors.length > 0 && <li>{result.errors.length} row(s) couldn&apos;t be read (first: line {result.errors[0].line}, {result.errors[0].message})</li>}
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                {book.trades.length < 20 && book.trades.length > 0 && (
                  <p className="mt-3 text-sm">With fewer than 20 trades most habits will show as &quot;not enough data yet&quot;. Hindsight won&apos;t guess.</p>
                )}
                <button
                  type="button"
                  disabled={!book.trades.length}
                  onClick={() => {
                    selectFills(result.fills, file ?? "trades.csv");
                    router.push("/review");
                  }}
                  className="mt-5 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
                >
                  Review these trades
                </button>
              </>
            )}
          </section>
        )}

        {dataset.kind === "fills" && (
          <p className="mt-8 text-sm text-muted">
            Currently reviewing <span className="text-ink">{dataset.fileName}</span>.{" "}
            <button type="button" onClick={selectSample} className="text-accent underline-offset-2 hover:underline">
              Switch back to the demo trader and forget my file
            </button>
          </p>
        )}
      </div>

      <aside className="space-y-6 text-sm">
        <div>
          <h2 className="font-medium">Supported rTokens</h2>
          <p className="mt-1 text-muted">{UNIVERSE.map((i) => `r${i.ticker}`).join(", ")}. Other symbols are skipped.</p>
        </div>
        <div>
          <h2 className="font-medium">Template</h2>
          <p className="mt-1 text-muted">If your export won&apos;t read, put trades in this shape:</p>
          <pre className="num mt-2 overflow-x-auto rounded-sm border border-rule bg-sheet p-2 text-xs">{TEMPLATE_HEADER}</pre>
          <a href="/hindsight-template.csv" download className="mt-2 inline-block text-accent underline-offset-2 hover:underline">
            Download the template
          </a>
        </div>
        <div>
          <h2 className="font-medium">Just want to try it?</h2>
          <p className="mt-1 text-muted">Download an example Bitget-style export from a different simulated trader, then upload it here.</p>
          <a href="/example-bitget-export.csv" download className="mt-2 inline-block text-accent underline-offset-2 hover:underline">
            Download an example export
          </a>
        </div>
        <div>
          <h2 className="font-medium">Times</h2>
          <p className="mt-1 text-muted">
            Times with a timezone (or a header like &quot;Date(UTC+8)&quot;) are read as given. Times without one are read in your timezone.
          </p>
        </div>
        <p className="text-muted">
          No file yet?{" "}
          <Link href="/review" onClick={selectSample} className="text-accent underline-offset-2 hover:underline">
            Try the demo trader
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}
