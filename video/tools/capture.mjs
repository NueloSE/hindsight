/**
 * Captures the real app for the film (guide §4): full-page screenshots of each state plus the page-space
 * boxes of everything the camera or cursor visits. Writes captures/<state>.png and captures/shots.json.
 *
 *   node tools/capture.mjs [baseUrl]
 *
 * Uses the installed Google Chrome (Playwright's Chromium doesn't support macOS 13).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://hindsight-puce.vercel.app";
const OUT = new URL("../captures/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce" });
const page = await context.newPage();
const shots = {};

async function box(locator) {
  await locator.first().waitFor({ state: "visible", timeout: 30_000 });
  const b = await locator.first().boundingBox();
  const scrollY = await page.evaluate(() => window.scrollY);
  return [Math.round(b.x), Math.round(b.y + scrollY), Math.round(b.width), Math.round(b.height)];
}

async function shot(name, url, boxes) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const measured = {};
  for (const [key, loc] of Object.entries(boxes)) measured[key] = await box(loc);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
  shots[name] = { url, height, boxes: measured };
  console.log(`✓ ${name.padEnd(16)} ${height}px  ${Object.keys(measured).length} boxes`);
}

async function go(path, ready) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (ready) await ready.first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(800);
}

// 1 · Landing
await go("/", page.getByRole("heading", { level: 1 }));
await shot("landing", "/", {
  title: page.getByRole("heading", { level: 1 }),
  finding: page.locator("figure").first(),
  stats: page.locator("section").nth(1),
  cta: page.getByRole("link", { name: "Try the live demo" }),
});

// 2 · Review, chasing open (default)
await go("/review", page.getByRole("tab").first());
await page.waitForSelector("text=Written by the AI coach", { timeout: 60_000 }).catch(() => {});
await shot("review", "/review", {
  summary: page.locator("header dl").first(),
  fees: page.getByText("Before fees, these trades made"),
  curve: page.locator("figure svg").first(),
  tiles: page.getByRole("tablist"),
  tileChase: page.getByRole("tab", { name: /Chasing/ }),
  tileCut: page.getByRole("tab", { name: /Cutting winners/ }),
  tileEarn: page.getByRole("tab", { name: /Holding through earnings/ }),
  tilePanic: page.getByRole("tab", { name: /Panic/ }),
  panel: page.locator("#habit-panel"),
  coachNote: page.locator("#habit-panel p.leading-relaxed").first(),
  evidence: page.locator("#habit-panel ul").first(),
  rule: page.locator("#habit-panel div.rounded-md.p-4").first(),
  table: page.locator("#trades table"),
  pager: page.getByRole("navigation", { name: "Trade pages" }),
});

// 2b · Review, earnings habit open (its evidence includes trade #81)
await page.getByRole("tab", { name: /Holding through earnings/ }).click();
await page.waitForTimeout(1500);
await shot("review-earn", "/review#earnings-roulette", {
  tileEarn: page.getByRole("tab", { name: /Holding through earnings/ }),
  panel: page.locator("#habit-panel"),
  evidence: page.locator("#habit-panel ul").first(),
  chip81: page.locator("#habit-panel").getByRole("link", { name: "#81", exact: true }),
});

// 3 · Review, cutting winners open (the stop-loss rule)
await page.getByRole("tab", { name: /Cutting winners/ }).click();
await page.waitForTimeout(1500);
await shot("review-cut", "/review#cutting-winners", {
  tileCut: page.getByRole("tab", { name: /Cutting winners/ }),
  rule: page.locator("#habit-panel div.rounded-md.p-4").first(),
  pnlRow: page.locator("#habit-panel dl > div").nth(0),
  worstRow: page.locator("#habit-panel dl > div").nth(1),
  drawdownRow: page.locator("#habit-panel dl > div").nth(2),
  addRule: page.getByRole("button", { name: "Add to my rules" }),
});
await page.getByRole("button", { name: "Add to my rules" }).click();
await page.waitForTimeout(500);
await shot("review-cut-added", "/review#cutting-winners", {
  rule: page.locator("#habit-panel div.rounded-md.p-4").first(),
  added: page.getByRole("button", { name: "Accepted" }),
});

// 4 · Trade #81 (Saturday buy held through earnings)
await go("/review/trades/81", page.locator("figure svg").first());
await page.waitForTimeout(1500);
await shot("trade81", "/review/trades/81", {
  header: page.getByRole("heading", { level: 1 }),
  pnl: page.getByText(/after fees/),
  chart: page.locator("figure svg").first(),
  opened: page.locator("dl > div").filter({ hasText: "Opened" }),
  earnings: page.locator("dl > div").filter({ hasText: "Earnings during the trade" }),
});

// 5 · Check a trade
await go("/check", page.getByRole("heading", { name: "Check a trade" }));
await shot("check-empty", "/check", {
  input: page.locator("#idea"),
  button: page.getByRole("button", { name: "Check it" }),
  scenario: page.getByRole("button", { name: /Early Sunday/ }),
});
await page.locator("#idea").fill("buy $1,500 of rMSTR");
await shot("check-typed", "/check", { input: page.locator("#idea"), scenario: page.getByRole("button", { name: /Early Sunday/ }) });
await page.getByRole("button", { name: /Early Sunday/ }).click();
await page.getByText("This matches").waitFor({ timeout: 60_000 });
await page.waitForTimeout(800);
await shot("check-result", "/check", {
  card: page.locator("article"),
  verdict: page.getByText("This matches"),
  context: page.locator("article header p").last(),
  explanation: page.locator("article > div p").first(),
  rule: page.locator("article").getByText("Your rule").locator(".."),
  history: page.getByText(/Last 25 times/),
  similar: page.getByText("Your most similar past trades").locator(".."),
  smaller: page.getByRole("button", { name: "Take it smaller" }),
});
await page.getByRole("button", { name: "Take it smaller" }).click();
await page.waitForTimeout(600);
await shot("check-logged", "/check", { logged: page.getByText(/Logged:/), log: page.getByText("Your decision log").locator("..") });

// 6 · Ask the coach (a real answer from the live model)
await go("/coach", page.getByRole("heading", { name: "Ask the coach" }));
await shot("coach-empty", "/coach", { q: page.getByRole("button", { name: /biggest revenge trade/ }), input: page.locator("#q") });
await page.getByRole("button", { name: /biggest revenge trade/ }).click();
await page.getByText(/numbers checked|Couldn't verify/).waitFor({ timeout: 90_000 });
await page.waitForTimeout(800);
await shot("coach-answer", "/coach", {
  question: page.locator("p", { hasText: "What happened on my biggest revenge trade?" }),
  tools: page.locator("ul").filter({ hasText: /Searched your trades|Opened a trade/ }),
  answer: page.locator(".space-y-3").last(),
  verified: page.getByText(/numbers checked|Couldn't verify/),
});

// 7 · Accuracy
await go("/accuracy", page.getByRole("heading", { name: "How we know it works" }));
await shot("accuracy", "/accuracy", {
  stats: page.locator("dl").first(),
  found: page.locator("dl > div").nth(0),
  falseAlarm: page.locator("dl > div").nth(1),
  accused: page.locator("dl > div").nth(3),
  table: page.locator("table"),
});

// 8 · Import (read-only Bitget key)
await go("/import", page.getByRole("heading", { name: "Review your trades" }));
await shot("import", "/import", {
  connect: page.getByRole("heading", { name: "Connect your Bitget account" }).locator(".."),
  fetch: page.getByRole("button", { name: "Fetch my trades" }),
});

writeFileSync(`${OUT}shots.json`, JSON.stringify({ base: BASE, viewport: [1440, 900], dpr: 2, shots }, null, 1));
await browser.close();
console.log(`wrote ${Object.keys(shots).length} states to captures/`);
