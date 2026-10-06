import { describe, expect, it } from "vitest";
import { lastRegularClose, nextRegularOpen, nyToUtc, sessionAt } from "./sessions";

const at = (date: string, h: number, m = 0) => nyToUtc(date, h, m);
const iso = (ms: number) => new Date(ms).toISOString();

describe("nyToUtc", () => {
  it("handles daylight saving time", () => {
    expect(iso(at("2026-10-05", 9, 30))).toBe("2026-10-05T13:30:00.000Z"); // EDT, UTC-4
    expect(iso(at("2026-01-05", 9, 30))).toBe("2026-01-05T14:30:00.000Z"); // EST, UTC-5
    expect(iso(at("2026-03-09", 9, 30))).toBe("2026-03-09T13:30:00.000Z"); // day after DST starts
  });
});

describe("sessionAt", () => {
  it("classifies a normal trading day", () => {
    expect(sessionAt(at("2026-10-05", 10))).toBe("regular");
    expect(sessionAt(at("2026-10-05", 9, 29))).toBe("pre");
    expect(sessionAt(at("2026-10-05", 4))).toBe("pre");
    expect(sessionAt(at("2026-10-05", 16))).toBe("post");
    expect(sessionAt(at("2026-10-05", 22))).toBe("overnight");
    expect(sessionAt(at("2026-10-06", 2))).toBe("overnight");
  });

  it("treats Friday night through Monday 04:00 as the weekend", () => {
    expect(sessionAt(at("2026-10-02", 21))).toBe("weekend"); // Friday 21:00
    expect(sessionAt(at("2026-10-03", 12))).toBe("weekend"); // Saturday
    expect(sessionAt(at("2026-10-04", 23))).toBe("weekend"); // Sunday
    expect(sessionAt(at("2026-10-05", 3))).toBe("weekend"); // Monday 03:00
  });

  it("treats a long weekend as weekend and a midweek closure as holiday", () => {
    expect(sessionAt(at("2026-09-07", 12))).toBe("weekend"); // Labor Day Monday
    expect(sessionAt(at("2026-11-26", 12))).toBe("holiday"); // Thanksgiving Thursday
    expect(sessionAt(at("2026-11-25", 21))).toBe("holiday"); // Wednesday night before it
  });

  it("respects early closes", () => {
    expect(sessionAt(at("2026-11-27", 12))).toBe("regular");
    expect(sessionAt(at("2026-11-27", 14))).toBe("post");
  });
});

describe("open and close helpers", () => {
  it("finds the next regular open", () => {
    expect(nextRegularOpen(at("2026-10-03", 12))).toBe(at("2026-10-05", 9, 30)); // Sat -> Mon
    expect(nextRegularOpen(at("2026-10-05", 8))).toBe(at("2026-10-05", 9, 30)); // pre -> same day
    expect(nextRegularOpen(at("2026-10-05", 10))).toBe(at("2026-10-06", 9, 30)); // during -> next day
    expect(nextRegularOpen(at("2026-11-25", 21))).toBe(at("2026-11-27", 9, 30)); // skips Thanksgiving
  });

  it("finds the last regular close", () => {
    expect(lastRegularClose(at("2026-10-03", 12))).toBe(at("2026-10-02", 16)); // Sat -> Fri close
    expect(lastRegularClose(at("2026-10-05", 10))).toBe(at("2026-10-02", 16)); // Mon morning -> Fri
    expect(lastRegularClose(at("2026-10-05", 17))).toBe(at("2026-10-05", 16));
    expect(lastRegularClose(at("2026-11-27", 15))).toBe(at("2026-11-27", 13)); // early close
  });
});
