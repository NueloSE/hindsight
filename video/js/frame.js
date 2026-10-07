/* Browser frame over the app captures: camera, scroll, page changes, cursor, highlight rings (guide §5). */
(function () {
  const { tl, sfx, $ } = window.H;
  const SHOTS = window.SHOTS;
  const FX = 260, FY = 64, FW = 1400, BAR = 40, VH = 830; // frame geometry on the 1920x1080 stage
  const K = FW / 1440; // page CSS px -> stage px
  const STAGE_CX = 960, STAGE_CY = 500;

  const cam = $("#cam");
  const view = $("#viewport");
  const url = $("#url");
  const cursor = $("#cursor");
  const imgs = {};
  const scrollOf = {}; // build-time memory of each shot's scroll

  for (const name of Object.keys(SHOTS)) {
    const img = document.createElement("img");
    img.src = `captures/${name}.png`;
    img.className = "shot";
    img.style.width = `${FW}px`;
    view.appendChild(img);
    imgs[name] = img;
    scrollOf[name] = 0;
  }
  gsap.set(Object.values(imgs), { opacity: 0, y: 0 });
  gsap.set(cam, { x: 0, y: 0, scale: 1, transformOrigin: "0 0" });
  gsap.set(cursor, { x: 1180, y: 760, opacity: 0, scale: 1 });

  let current = null;
  let camState = { x: 0, y: 0, s: 1 };
  // Build-time memory of where the cursor is; never written to the element outside the timeline.
  const cur = { x: 1180, y: 760 };

  /** Stage-space rectangle of a captured element, given that shot's scroll. */
  function rect(name, key) {
    const b = SHOTS[name].boxes[key];
    if (!b) throw new Error(`frame: no box "${key}" in shot "${name}"`);
    return { x: FX + b[0] * K, y: FY + BAR + (b[1] - scrollOf[name]) * K, w: b[2] * K, h: b[3] * K };
  }

  /** Show a captured page: it rises in, the URL rolls to its path. */
  function show(t, name, { quiet = false, scroll } = {}) {
    const img = imgs[name];
    if (!img) throw new Error(`frame: no shot ${name}`);
    if (scroll !== undefined) scrollOf[name] = Math.max(0, Math.min(SHOTS[name].height - VH / K, scroll));
    if (current && current !== name) tl.to(imgs[current], { opacity: 0, duration: 0.25, ease: "power3.in" }, t);
    tl.set(img, { y: -scrollOf[name] * K + 34 }, t);
    tl.to(img, { opacity: 1, y: -scrollOf[name] * K, duration: 0.45, ease: "expo.out" }, t);
    const path = SHOTS[name].url;
    tl.set(url, { textContent: `hindsight-puce.vercel.app${path === "/" ? "" : path}` }, t + 0.05);
    tl.fromTo(url, { y: 10, opacity: 0.2 }, { y: 0, opacity: 1, duration: 0.35, ease: "expo.out", immediateRender: false }, t);
    if (!quiet) sfx(t + 0.12, "whoosh", -17, 0);
    current = name;
  }

  /** Swap to a new state of the same page without the page-change motion (e.g. after a click). */
  function swap(t, name) {
    scrollOf[name] = scrollOf[current] ?? 0;
    if (current) tl.to(imgs[current], { opacity: 0, duration: 0.2, ease: "none" }, t);
    tl.set(imgs[name], { y: -scrollOf[name] * K }, t);
    tl.to(imgs[name], { opacity: 1, duration: 0.2, ease: "none" }, t);
    current = name;
  }

  /** Scroll the page so `pageY` sits at the top of the viewport. */
  function scrollTo(t, name, pageY, dur = 0.8) {
    const max = Math.max(0, SHOTS[name].height - VH / K);
    const y = Math.max(0, Math.min(max, pageY));
    scrollOf[name] = y;
    tl.to(imgs[name], { y: -y * K, duration: dur, ease: "power3.inOut" }, t);
  }

  /** Scroll so a box is comfortably in view. */
  function reveal(t, name, key, topPad = 120) {
    const b = SHOTS[name].boxes[key];
    scrollTo(t, name, b[1] - topPad);
  }

  /** Camera: frame a box (≤92% width, ≤88% height, max zoom), clamped so the frame edges never show. */
  function focus(t, name, key, { maxZoom = 1.6, dur = 0.9, cy = STAGE_CY } = {}) {
    const r = rect(name, key);
    let s = Math.min(maxZoom, (0.92 * 1920) / r.w, (0.88 * 1080) / r.h);
    s = Math.max(1, s);
    let x = STAGE_CX - s * (r.x + r.w / 2);
    let y = cy - s * (r.y + r.h / 2);
    if (s * FW > 1920) x = Math.min(-s * FX, Math.max(1920 - s * (FX + FW), x));
    else x = (1920 - s * FW) / 2 - s * FX;
    const frameTop = FY, frameBottom = FY + BAR + VH;
    if (s * (frameBottom - frameTop) > 1080) y = Math.min(-s * frameTop, Math.max(1080 - s * frameBottom, y));
    tl.to(cam, { x, y, scale: s, duration: dur, ease: "power3.inOut" }, t);
    camState = { x, y, s };
  }

  function reset(t, dur = 0.9) {
    tl.to(cam, { x: 0, y: 0, scale: 1, duration: dur, ease: "power3.inOut" }, t);
    camState = { x: 0, y: 0, s: 1 };
  }

  /** Cursor glides to the centre of a box. */
  function cursorTo(t, name, key, { dx = 0, dy = 0 } = {}) {
    const r = rect(name, key);
    const to = { x: r.x + r.w / 2 + dx, y: r.y + r.h / 2 + dy };
    tl.to(cursor, { opacity: 1, duration: 0.2 }, t);
    tl.fromTo(cursor, { x: cur.x, y: cur.y }, { x: to.x, y: to.y, duration: 0.5, ease: "power3.inOut", immediateRender: false }, t);
    cur.x = to.x;
    cur.y = to.y;
  }

  /** Click: squeeze, ripple, sound. */
  function click(t) {
    tl.to(cursor, { scale: 0.82, duration: 0.08, ease: "power2.in" }, t - 0.08);
    tl.to(cursor, { scale: 1, duration: 0.35, ease: "back.out(1.2)" }, t);
    const ring = document.createElement("div");
    ring.className = "ripple";
    $("#cam").appendChild(ring);
    gsap.set(ring, { opacity: 0, scale: 0.3 });
    // Position the ripple where the cursor will be at time t (cursor x/y are set at build time order).
    gsap.set(ring, { x: cur.x, y: cur.y });
    tl.to(ring, { opacity: 0.8, duration: 0.01 }, t);
    tl.to(ring, { scale: 2.4, opacity: 0, duration: 0.6, ease: "expo.out" }, t);
    sfx(t, "click", -10, 0.1);
  }

  function hideCursor(t) {
    tl.to(cursor, { opacity: 0, duration: 0.25 }, t);
  }

  /** Glowing ring around a box, with a soft tick. */
  function highlight(t, name, key, dur = 2.4, pad = 10) {
    const r = rect(name, key);
    const el = document.createElement("div");
    el.className = "hl";
    $("#cam").appendChild(el);
    gsap.set(el, { left: r.x - pad, top: r.y - pad, width: r.w + 2 * pad, height: r.h + 2 * pad, opacity: 0, scale: 1.04 });
    tl.to(el, { opacity: 1, scale: 1, duration: 0.4, ease: "expo.out" }, t);
    tl.to(el, { opacity: 0, duration: 0.3, ease: "power3.in" }, t + dur);
    sfx(t, "tick", -14, 0);
  }

  /** Show / hide the whole browser frame. */
  function frameIn(t) {
    tl.fromTo("#browser", { y: 60, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "expo.out", immediateRender: false }, t);
    sfx(t + 0.1, "whoosh", -15, 0);
  }
  function frameOut(t) {
    tl.to("#browser", { y: 40, opacity: 0, scale: 0.97, duration: 0.5, ease: "power3.in" }, t);
    tl.to(cursor, { opacity: 0, duration: 0.2 }, t);
  }

  window.F = {
    show, swap, scrollTo, reveal, focus, reset, click, highlight, hideCursor, frameIn, frameOut, rect, cursorTo,
    get camState() {
      return camState;
    },
  };
})();
