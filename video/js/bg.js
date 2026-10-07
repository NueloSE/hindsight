/* The replay tape: real rNVDA hourly prices with US-closed bands, drawn only from timeline state (seek-safe). */
(function () {
  const { tl, TOTAL } = window.H;
  const canvas = document.getElementById("bg");
  const g = canvas.getContext("2d");
  const W = 1920, H = 1080;
  const PTS = window.DATA.nvda; // [t, close, closed]
  const TRADES = window.DATA.trades;
  const lo = Math.min(...PTS.map((p) => p[1])), hi = Math.max(...PTS.map((p) => p[1]));
  const WINDOW = 360; // hours visible across the frame

  const C = { paper: "#F6F3EE", ink: "#1F1C17", band: "rgba(228, 221, 209, 0.6)", marker: "rgba(243, 211, 107, 0.95)", accent: "#B4531E" };

  // Scene-driven events (plain data, like the guide's shader uniforms).
  const BG = { bursts: [], rewinds: [] };
  window.BG = BG;

  const s = { t: 0, pos: 0.12, echo: 0, dots: 0, quiet: 0.92, line: 1, playhead: 0 };
  function draw() {
    const t = s.t;
    g.fillStyle = C.paper;
    g.fillRect(0, 0, W, H);

    // Rewind events push the tape backwards with ghost echoes.
    let pos = s.pos, echo = s.echo;
    for (const r of BG.rewinds) {
      if (t < r.t0) continue;
      const k = Math.min(1, (t - r.t0) / (r.t1 - r.t0));
      const e = k < 1 ? 1 - Math.pow(1 - k, 3) : 1;
      pos -= r.amount * e;
      echo = Math.max(echo, k < 1 ? Math.sin(k * Math.PI) : 0);
    }
    pos = Math.max(0, Math.min(1, pos));
    const startIdx = pos * (PTS.length - WINDOW);
    const x = (i) => ((i - startIdx) / WINDOW) * W;
    const y = (v) => H * 0.78 - ((v - lo) / (hi - lo)) * H * 0.56;
    const i0 = Math.max(0, Math.floor(startIdx) - 2), i1 = Math.min(PTS.length - 1, Math.ceil(startIdx + WINDOW) + 2);

    // Closed-market bands.
    g.fillStyle = C.band;
    const bw = W / WINDOW + 0.5;
    for (let i = i0; i <= i1; i++) if (PTS[i][2]) g.fillRect(x(i), 0, bw, H);

    // Echoes, then the trace.
    if (s.line > 0) {
      for (let k = 5; k >= 0; k--) {
        if (k > 0 && echo < 0.01) continue;
        g.globalAlpha = k ? 0.1 * echo * (6 - k) / 5 : s.line;
        g.strokeStyle = C.ink;
        g.lineWidth = k ? 1.2 : 2.2;
        g.beginPath();
        for (let i = i0; i <= i1; i++) {
          const xx = x(i) + k * 34 * echo, yy = y(PTS[i][1]);
          i === i0 ? g.moveTo(xx, yy) : g.lineTo(xx, yy);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // Tolu's trades as a strip of dots along the bottom: filled = bought while the US market was closed.
    if (s.dots > 0.001) {
      const t0 = PTS[Math.floor(startIdx)]?.[0] ?? PTS[0][0];
      const msPerPx = (WINDOW * 3_600_000) / W;
      for (let n = 0; n < TRADES.length; n++) {
        const tr = TRADES[n];
        const xx = (tr.t - t0) / msPerPx;
        if (xx < -20 || xx > W + 20) continue;
        const appear = Math.min(1, Math.max(0, s.dots * TRADES.length - n * 0.6));
        if (appear <= 0) continue;
        g.globalAlpha = appear;
        g.beginPath();
        g.arc(xx, H * 0.9, 7, 0, Math.PI * 2);
        if (tr.closed) {
          g.fillStyle = C.marker;
          g.fill();
        }
        g.strokeStyle = C.ink;
        g.lineWidth = 1.4;
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // Playhead.
    if (s.playhead > 0.001) {
      g.globalAlpha = s.playhead;
      g.strokeStyle = C.accent;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(W * 0.5, 0);
      g.lineTo(W * 0.5, H);
      g.stroke();
      g.globalAlpha = 1;
    }

    // Bursts: a ring expanding from a point (title drop).
    for (const b of BG.bursts) {
      const k = (t - b.t) / b.dur;
      if (k < 0 || k > 1) continue;
      g.globalAlpha = (1 - k) * 0.55;
      g.strokeStyle = C.ink;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(b.x, b.y, 80 + k * 1100, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    // Keep the centre quiet for the story.
    const v = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 1150);
    v.addColorStop(0, `rgba(246,243,238,${0.55 + 0.43 * s.quiet})`);
    v.addColorStop(0.6, `rgba(246,243,238,${0.35 + 0.5 * s.quiet})`);
    v.addColorStop(1, `rgba(246,243,238,${0.1 * s.quiet})`);
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }

  // Every state property redraws when set, so seeking to any frame reproduces it exactly.
  const state = {};
  for (const key of Object.keys(s)) {
    Object.defineProperty(state, key, {
      get: () => s[key],
      set: (v) => {
        s[key] = v;
        draw();
      },
    });
  }
  window.BGSTATE = state;

  window.BUILD.push(() => {
    tl.to(state, { t: TOTAL, duration: TOTAL, ease: "none" }, 0);
    // Slow forward drift of the tape through the whole film.
    tl.to(state, { pos: 0.95, duration: TOTAL, ease: "none" }, 0);
    draw();
  });
})();
