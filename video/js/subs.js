/* Always-on subtitles from the word cues (guide §8). */
(function () {
  const { C, tl, $ } = window.H;

  // Per-line display text with the same number of tokens as the transcript. "~" folds a spoken word into the previous one.
  const OVERRIDES = {
    l01: "Between 1991 ~ ~ and '96, ~ researchers followed 66,000 ~ ~ households trading at a U.S. ~ broker.",
    l02: "The ones who traded most earned 11.4% ~ ~ ~ ~ a year. The market earned 17.9%. ~ ~",
    l03: "It wasn't bad luck. It was habits.",
    l05: "And on weekends, trading in them is over 1,000× ~ ~ thinner than during market hours.",
    l08: "Your trades, reviewed.",
    l09: "Meet Tolu. Tolu trades rTokens ~ on Bitget, often at night and on weekends.",
    l11: "Hindsight replays all 106 ~ ~ ~ of Tolu's trades, hour by hour, against the real rToken ~ and the real stock.",
    l12: "Five statistical tests ask one question: is this behaviour more than chance?",
    l13: "For Tolu: four habits found, and one ruled out.",
    l14: "37% ~ ~ ~ of Tolu's buys while Wall Street slept came after the rToken ~ had already jumped. Chance would give 9%.",
    l17: "Each habit becomes a personal rule, with an honest what-if. ~",
    l18: "A 3% ~ stop-loss ~ would have cost Tolu $543, ~ ~ ~ ~ ~",
    l19: "but cut the worst trade from −17.9% ~ ~ ~ ~ to −3.2%. ~ ~ ~",
    l20: "Hindsight shows the trade-off. ~ You decide.",
    l21: "Early Sunday morning. rMSTR ~ is up 2.4% ~ ~ ~ since Friday's close.",
    l23: "It matches the chasing habit. The last 25 ~ times, Tolu won 64%, ~ ~ for $45 ~ ~ in total.",
    l30: "It found 71% ~ ~ ~ of them, and 82% ~ ~ of the strong ones,",
    l31: "with a false-alarm ~ rate of 0.2%. ~ ~ ~ No habit-free ~ trader was ever accused.",
    l32: "10/10 ~ ~ ~ coach answers fully grounded. 48 automated tests.",
    l33: "Connect a read-only Bitget key, and review your own last 90 days.",
    l35: "Hindsight. Your trades, reviewed.",
  };
  const FIX = { BitGet: "Bitget", "BitGet,": "Bitget,", hindsight: "Hindsight", "hindsight.": "Hindsight." };

  function displayWords(lid) {
    const words = C.words[lid];
    let tokens = OVERRIDES[lid] ? OVERRIDES[lid].split(" ") : words.map((w) => FIX[w[0]] ?? w[0]);
    if (tokens.length !== words.length) throw new Error(`subs: ${lid} override has ${tokens.length} tokens, transcript has ${words.length}`);
    if (!OVERRIDES[lid]) tokens[0] = tokens[0][0].toUpperCase() + tokens[0].slice(1);
    const out = [];
    tokens.forEach((tok, i) => {
      const [, s, e] = words[i];
      if (tok === "~") {
        if (!out.length) throw new Error(`subs: ${lid} starts with ~`);
        out[out.length - 1].e = e;
      } else out.push({ w: tok, s, e });
    });
    return out;
  }

  function chunks(lid) {
    const ws = displayWords(lid);
    const out = [];
    let cur = [];
    const flush = () => cur.length && (out.push(cur), (cur = []));
    for (const w of ws) {
      const text = [...cur.map((c) => c.w), w.w].join(" ");
      if (cur.length >= 7 || text.length > 44) flush();
      cur.push(w);
      const last = w.w;
      if (/[.?!]$/.test(last)) flush();
      else if (/,$/.test(last) && cur.length >= 3) flush();
    }
    flush();
    return out;
  }

  window.BUILD.push(() => {
    const el = $("#sub-text");
    const all = [];
    for (const lid of Object.keys(C.lines)) for (const c of chunks(lid)) all.push({ lid, text: c.map((w) => w.w).join(" "), s: c[0].s, e: c.at(-1).e });
    all.forEach((c, i) => {
      const next = all[i + 1];
      const lineEnd = C.lines[c.lid][1];
      const show = c.s - 0.06;
      const hide = next && next.s - 0.04 < lineEnd + 0.45 ? next.s - 0.04 - 0.06 : Math.min(lineEnd + 0.45, next ? next.s - 0.1 : Infinity);
      tl.set(el, { textContent: c.text, opacity: 1 }, show);
      if (!next || next.s - 0.06 > hide + 0.01) tl.set(el, { opacity: 0 }, hide);
    });
    window.SUBTITLES = all;
  });
})();
