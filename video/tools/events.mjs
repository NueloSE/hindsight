/** Reads every sfx() cue from the composition (the single source of timing) into assets/events.json. */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--allow-file-access-from-files"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(new URL("../index.html", import.meta.url).href);
await page.waitForFunction(() => Array.isArray(window.__sfxEvents) && window.__sfxEvents.length > 0, null, { timeout: 30_000 });
const events = await page.evaluate(() => [...window.__sfxEvents].sort((a, b) => a.t - b.t));
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
writeFileSync(new URL("../assets/events.json", import.meta.url), JSON.stringify(events, null, 1));
const byName = events.reduce((m, e) => ((m[e.name] = (m[e.name] ?? 0) + 1), m), {});
console.log(`${events.length} sound events:`, JSON.stringify(byName));
