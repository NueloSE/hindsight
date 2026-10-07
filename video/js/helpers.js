/* Shared helpers for the Hindsight film. Everything is placed on one paused timeline at absolute times. */
(function () {
  const C = window.CUES;
  if (!C) throw new Error("cues.js not loaded");

  const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, "");

  /** Start time of `word` in line `lid` (n-th match, 1-based). Throws if missing: no silent fallbacks. */
  function at(lid, word, n = 1, edge = "start") {
    const words = C.words[lid];
    if (!words) throw new Error(`at(): no line ${lid}`);
    const target = norm(word);
    let seen = 0;
    for (const [w, s, e] of words) {
      if (norm(w) === target && ++seen === n) return edge === "end" ? e : s;
    }
    throw new Error(`at(): "${word}" (#${n}) not found in ${lid}: ${words.map((w) => w[0]).join(" ")}`);
  }
  const lineStart = (lid) => C.lines[lid][0];
  const lineEnd = (lid) => C.lines[lid][1];

  /** Sound cue, recorded as data; tools/mix.py mixes them. Times are when the sound's peak should land. */
  const SFX = [];
  function sfx(t, name, gain = 0, pan = 0) {
    if (!Number.isFinite(t)) throw new Error(`sfx(): bad time for ${name}`);
    SFX.push({ t: Math.round(t * 1000) / 1000, name, gain, pan });
  }

  const tl = gsap.timeline({ paused: true });
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /** Split an element's text into word spans for word-by-word entrances. */
  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w"><span class="wi">${w}</span></span>`).join(" ");
    return $$(".wi", el);
  }

  /** Word-by-word rise. */
  function riseWords(el, t, stagger = 0.06) {
    const ws = splitWords(el);
    gsap.set(ws, { y: 40, opacity: 0 });
    tl.to(ws, { y: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger }, t);
    return ws;
  }

  /** Slow push so nothing holds still for long. */
  function push(el, t0, t1, to = 1.035) {
    tl.to(el, { scale: to, duration: Math.max(0.1, t1 - t0), ease: "none" }, t0);
  }

  window.H = { C, at, lineStart, lineEnd, sfx, SFX, tl, $, $$, splitWords, riseWords, push, TOTAL: C.total };
  window.SFX = SFX;
  window.BUILD = [];
})();
