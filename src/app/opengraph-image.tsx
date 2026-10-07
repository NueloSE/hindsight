import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/logo-mark";
import { analyze } from "@/lib/review/analyze";

export const alt = "Hindsight: an AI post-trade coach for 24/7 Bitget rToken traders. Your trades, reviewed.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) => readFile(join(process.cwd(), "assets", "fonts", file));

const C = { paper: "#F6F3EE", sheet: "#FFFDF9", ink: "#1F1C17", muted: "#6E675C", rule: "#E4DDD1", marker: "rgba(243, 211, 107, 0.6)", accent: "#B4531E" };

export default async function Image() {
  const [serif, serifItalic, sans, mono] = await Promise.all([
    font("Newsreader-Medium.ttf"),
    font("Newsreader-MediumItalic.ttf"),
    font("Geist-Regular.ttf"),
    font("GeistMono-Regular.ttf"),
  ]);
  const blind = JSON.parse(await readFile(join(process.cwd(), "data", "blind-test", "results.json"), "utf8"));
  const chase = analyze({ kind: "sample" }).review.findings.find((f) => f.id === "closed-chasing")!;
  const p = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.paper, padding: "52px 64px 44px", fontFamily: "Geist", color: C.ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LogoMark size={52} />
          <span style={{ fontFamily: "Newsreader", fontSize: 38 }}>Hindsight</span>
          <span style={{ marginLeft: "auto", fontSize: 22, color: C.muted }}>For Bitget rToken traders</span>
        </div>

        <div style={{ display: "flex", flex: 1, marginTop: 36, marginBottom: 32, gap: 48, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Newsreader", fontSize: 92, lineHeight: 1.02, letterSpacing: -2 }}>
              <span>Your trades,</span>
              <span style={{ fontFamily: "Newsreader Italic" }}>reviewed.</span>
            </div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 27, lineHeight: 1.4, color: C.muted }}>
              An AI coach that finds the habits costing you money, proves them with your own trades, and checks your next one.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, background: C.sheet, border: `1px solid ${C.rule}`, borderRadius: 10, padding: 30 }}>
            <span style={{ fontSize: 18, color: C.muted }}>Example finding</span>
            <span style={{ fontFamily: "Newsreader", fontSize: 32, marginTop: 10, lineHeight: 1.15 }}>{chase.title}</span>
            <div style={{ display: "flex", marginTop: 20 }}>
              <span style={{ fontFamily: "GeistMono", fontSize: 60, lineHeight: 1, padding: "0 6px", backgroundImage: `linear-gradient(transparent 58%, ${C.marker} 58%)` }}>
                {p(chase.metrics.chaseRate)}
              </span>
            </div>
            <span style={{ fontSize: 22, color: C.muted, marginTop: 12 }}>
              of closed-market buys chased a move, vs {p(chase.metrics.chanceRate)} by chance
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 32, whiteSpace: "nowrap", borderTop: `1px solid ${C.rule}`, paddingTop: 22, fontSize: 21, color: C.muted }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "GeistMono", color: C.ink }}>{p(blind.overall.detectionRate)}</span>
            <span>hidden habits found</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "GeistMono", color: C.ink }}>{p(blind.overall.falseAlarmRate, 1)}</span>
            <span>false alarms in a blind test</span>
          </div>
          <span style={{ marginLeft: "auto", color: C.accent, whiteSpace: "nowrap" }}>Code calculates, the AI explains</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: serif, style: "normal", weight: 500 },
        { name: "Newsreader Italic", data: serifItalic, style: "italic", weight: 500 },
        { name: "Geist", data: sans, style: "normal", weight: 400 },
        { name: "GeistMono", data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}
