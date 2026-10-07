/* Every scene, beat by beat. All times come from the narration's word cues. */
(function () {
  const { tl, at: A, lineStart: L, lineEnd: E, sfx, $, riseWords, push, TOTAL } = window.H;
  const F = window.F;
  const BG = window.BG;
  const S = window.BGSTATE;
  const overlay = $("#overlay");

  // ---------- small builders ----------
  function fadeIn(el, t, { y = 30, dur = 0.7 } = {}) {
    gsap.set(el, { opacity: 0, y });
    tl.to(el, { opacity: 1, y: 0, duration: dur, ease: "expo.out" }, t);
  }
  function fadeOut(el, t, { y = -20, dur = 0.4 } = {}) {
    tl.to(el, { opacity: 0, y, duration: dur, ease: "power3.in" }, t);
  }
  function sweep(el, t, dur = 0.8) {
    gsap.set(el, { backgroundSize: "0% 100%" });
    tl.to(el, { backgroundSize: "100% 100%", duration: dur, ease: "power3.inOut" }, t);
  }
  function scene(id, tIn, tOut) {
    const el = $(id);
    gsap.set(el, { opacity: 0 });
    tl.to(el, { opacity: 1, duration: 0.3, ease: "none" }, tIn);
    tl.to(el, { opacity: 0, duration: 0.35, ease: "power3.in" }, tOut);
    return el;
  }

  /** A callout card above the frame (never over what it explains). */
  function callout(t, tOut, { left, top, k, v }) {
    const el = document.createElement("div");
    el.className = "callout";
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
    overlay.appendChild(el);
    gsap.set(el, { opacity: 0, x: 70 });
    tl.to(el, { opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }, t);
    tl.to(el, { opacity: 0, x: 40, duration: 0.3, ease: "power3.in" }, tOut);
    sfx(t, "pop", -15, 0.3);
    return el;
  }

  /** Chapter card: a paper panel scrubbed in by the playhead line, then away (about 1.3 s). */
  function chapter(t, num, title) {
    const el = document.createElement("div");
    el.className = "chapter";
    el.innerHTML = `<div class="line"></div><div class="num">${num}</div><div class="ttl">${title}</div>`;
    overlay.appendChild(el);
    const line = el.querySelector(".line");
    gsap.set(el, { clipPath: "inset(0 0 0 100%)" });
    gsap.set(line, { left: 1920 });
    gsap.set(el.querySelectorAll(".num, .ttl"), { opacity: 0, x: 40 });
    tl.to(el, { clipPath: "inset(0 0 0 0%)", duration: 0.45, ease: "power3.inOut" }, t);
    tl.to(line, { left: 0, duration: 0.45, ease: "power3.inOut" }, t);
    tl.to(el.querySelectorAll(".num, .ttl"), { opacity: 1, x: 0, duration: 0.5, ease: "expo.out", stagger: 0.06 }, t + 0.2);
    tl.to(el, { clipPath: "inset(0 100% 0 0)", duration: 0.4, ease: "power3.in" }, t + 1.0);
    sfx(t + 0.25, "whoosh", -15, -0.2);
  }

  window.BUILD.push(() => {
    // ===================== 1 · Cold open =====================
    const s1Out = L("l04") - 0.45;
    scene("#s1", 0.3, s1Out);
    riseWords($("#s1-kicker"), L("l01") + 0.1, 0.03);
    fadeIn($("#s1-row-a"), A("l01", "researchers"));
    fadeIn($("#s1-row-b"), A("l01", "households"));
    gsap.set(["#s1-val-a", "#s1-val-b"], { opacity: 0 });
    tl.to("#s1-fill-a", { width: `${(11.4 / 17.9) * 100}%`, duration: 0.9, ease: "expo.out" }, A("l02", "eleven"));
    tl.to("#s1-val-a", { opacity: 1, duration: 0.3 }, A("l02", "eleven") + 0.3);
    sfx(A("l02", "eleven"), "pop", -15, -0.2);
    tl.to("#s1-fill-b", { width: "100%", duration: 0.9, ease: "expo.out" }, A("l02", "seventeen"));
    tl.to("#s1-val-b", { opacity: 1, duration: 0.3 }, A("l02", "seventeen") + 0.3);
    sfx(A("l02", "seventeen"), "pop", -15, 0.2);
    fadeIn($("#s1-unit"), A("l02", "year"), { y: 10 });
    fadeIn($("#s1-source"), A("l02", "market"), { y: 10 });
    riseWords($("#s1-luck"), L("l03"));
    fadeIn($("#s1-habits"), A("l03", "it", 2), { y: 40 });
    sweep($("#s1-habits-word"), A("l03", "habits"));
    sfx(A("l03", "habits"), "tick", -12, 0);
    push($("#s1"), L("l01"), s1Out);

    // ===================== 2 · The market never closes =====================
    const s2In = L("l04") - 0.3, s2Out = L("l07") - 0.55;
    scene("#s2", s2In, s2Out);
    // A 7-day × 24-hour dial: US market hours glow, nights and weekends stay dark.
    const dial = $("#s2-dial");
    let svg = "";
    for (let day = 0; day < 7; day++) {
      const r = 120 + day * 24;
      for (let h = 0; h < 24; h++) {
        const a0 = (h / 24) * Math.PI * 2 - Math.PI / 2, a1 = ((h + 0.82) / 24) * Math.PI * 2 - Math.PI / 2;
        const weekend = day >= 5, regular = !weekend && h >= 13.5 && h < 20, ext = !weekend && ((h >= 8 && h < 13.5) || h >= 20);
        const col = regular ? "rgba(243,211,107,0.95)" : ext ? "rgba(224,138,78,0.45)" : weekend ? "rgba(31,28,23,0.06)" : "rgba(31,28,23,0.13)";
        svg += `<path d="M${Math.cos(a0) * r} ${Math.sin(a0) * r} A${r} ${r} 0 0 1 ${Math.cos(a1) * r} ${Math.sin(a1) * r}" stroke="${col}" stroke-width="16" fill="none"/>`;
      }
    }
    dial.innerHTML = svg;
    gsap.set(dial, { opacity: 0, scale: 0.85, rotation: -20, transformOrigin: "50% 50%" });
    tl.to(dial, { opacity: 1, scale: 1, rotation: 0, duration: 1.1, ease: "expo.out" }, A("l04", "clock") - 0.4);
    // The dial keeps turning: the market never stops.
    tl.to(dial, { rotation: 90, duration: E("l05") - A("l04", "clock") + 0.6, ease: "none" }, A("l04", "clock") + 0.7);
    sfx(A("l04", "clock") - 0.1, "whoosh", -16, -0.3);
    riseWords($("#s2-title"), A("l04", "no"));
    fadeIn($("#s2-vol"), L("l05"));
    gsap.set("#s2-fill-a", { width: "100%" });
    gsap.set("#s2-fill-b", { width: "100%" });
    tl.to("#s2-fill-b", { width: "0.4%", duration: 1.4, ease: "power3.inOut" }, A("l05", "thousand") - 0.3);
    sfx(A("l05", "thousand"), "pop", -14, 0.2);
    fadeIn($("#s2-x"), A("l05", "thinner"));
    // Generic advice cards, then struck through.
    const adv = $("#s2-advice");
    gsap.set(adv, { opacity: 0 });
    fadeOut($("#s2-dial"), L("l06") - 0.35);
    fadeOut($("#s2-title"), L("l06") - 0.35);
    fadeOut($("#s2-vol"), L("l06") - 0.35);
    tl.to(adv, { opacity: 1, duration: 0.3 }, L("l06"));
    ["#s2-c1", "#s2-c2", "#s2-c3"].forEach((c, i) => {
      gsap.set(c, { opacity: 0, y: 40, "--strike": 0 });
      tl.to(c, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, L("l06") + 0.1 + i * 0.12);
      tl.to(c, { "--strike": 1, duration: 0.35, ease: "power3.out" }, A("l06", "help") + i * 0.12);
    });
    sfx(L("l06") + 0.15, "pop", -17, -0.3);
    sfx(A("l06", "help"), "error", -18, 0);
    fadeIn($("#s2-note"), A("l06", "doesn't"), { y: 20 });
    sfx(A("l07", "hindsight"), "riser", -16, 0); // riser peaks into the drop

    // ===================== 3 · Title =====================
    const tName = A("l07", "hindsight");
    const s3Out = L("l09") - 0.6;
    scene("#s3", L("l07") - 0.25, s3Out);
    BG.rewinds.push({ t0: L("l07") - 0.9, t1: tName, amount: 0.14 });
    gsap.set("#mark", { opacity: 0, scale: 0.6, transformOrigin: "50% 50%" });
    tl.to("#mark", { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.2)" }, L("l07") - 0.1);
    gsap.set("#mark-hl", { scaleX: 0, transformOrigin: "0% 50%" });
    tl.to("#mark-hl", { scaleX: 1, duration: 0.6, ease: "power3.out" }, tName - 0.2);
    gsap.set("#s3-name", { opacity: 0, y: 50 });
    tl.to("#s3-name", { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" }, tName - 0.02);
    BG.bursts.push({ t: tName, x: 960, y: 470, dur: 1.6 });
    sfx(tName, "impact", -7, 0);
    sweep($("#s3-tag"), A("l08", "your"), 0.9);
    sfx(A("l08", "your"), "sparkle", -17, 0);
    push($("#s3"), tName, s3Out, 1.03);

    // ===================== 4 · The cast =====================
    const s4Out = L("l11") - 0.1;
    scene("#s4", L("l09") - 0.3, s4Out);
    fadeIn($("#s4-card"), L("l09"), { y: 50 });
    sfx(L("l09") + 0.05, "pop", -15, -0.3);
    tl.to(S, { dots: 1, duration: E("l09") - L("l09"), ease: "none" }, L("l09") + 0.4);
    tl.to(S, { quiet: 0.25, duration: 1.2, ease: "power2.inOut" }, L("l09"));
    fadeIn($("#s4-tape"), A("l10", "price"), { y: 12 });
    fadeIn($("#s4-band"), A("l10", "price") + 0.25, { y: 12 });
    fadeIn($("#s4-dots"), A("l10", "price") + 0.5, { y: 12 });
    sfx(A("l10", "price"), "tick", -16, 0.3);
    push($("#s4-card"), L("l09") + 0.8, s4Out, 1.03);

    // ===================== 5 · The product =====================
    tl.to(S, { quiet: 0.85, dots: 0.35, duration: 1.0, ease: "power2.inOut" }, L("l11"));
    F.frameIn(L("l11") - 0.1);
    F.show(L("l11") - 0.1, "landing", { quiet: true });
    F.focus(L("l11") + 0.3, "landing", "finding", { maxZoom: 1.5, dur: 1.6 });
    F.show(A("l11", "against"), "review");
    F.reset(A("l11", "against"), 0.8);

    // ===================== Chapter 1 · Find the habits =====================
    chapter(L("l12") - 1.45, "01", "Find the habits");
    F.focus(A("l12", "five"), "review", "tiles", { maxZoom: 1.35 });
    F.highlight(A("l13", "four"), "review", "tileChase", 3.6);
    F.highlight(A("l13", "ruled"), "review", "tilePanic", 1.8);
    F.focus(L("l14") - 0.1, "review", "coachNote", { maxZoom: 1.45 });
    callout(A("l14", "thirty"), L("l15") - 0.05, { left: 1270, top: 120, k: "Closed-market buys that chased a move", v: `<span class="m">37%</span>` });
    callout(A("l14", "chance"), L("l15") - 0.05, { left: 1270, top: 300, k: "Expected by chance", v: "9%" });
    // Every claim links to its trades: open the earnings habit and its evidence, click #81.
    F.reset(L("l15") - 0.05, 0.6);
    F.cursorTo(L("l15"), "review", "tileEarn");
    F.click(A("l15", "claim"));
    F.swap(A("l15", "claim") + 0.05, "review-earn");
    F.reveal(A("l15", "claim") + 0.3, "review-earn", "evidence", 360);
    F.cursorTo(A("l15", "links") + 0.2, "review-earn", "chip81");
    F.highlight(A("l15", "trades"), "review-earn", "evidence", 1.2, 8);
    F.click(A("l15", "behind"));
    F.hideCursor(E("l15") + 0.1);
    F.show(E("l15") + 0.15, "trade81");
    F.focus(L("l16") - 0.05, "trade81", "chart", { maxZoom: 1.25 });
    sfx(A("l16", "closed"), "tick", -15, -0.2);
    F.reset(A("l16", "here") - 0.1, 0.6);
    F.scrollTo(A("l16", "here"), "trade81", 330);
    F.highlight(A("l16", "saturday"), "trade81", "opened", 2.2);
    F.highlight(A("l16", "earnings"), "trade81", "earnings", 1.8);

    // ===================== Chapter 2 · Honest rules =====================
    chapter(L("l17") - 1.45, "02", "Honest rules");
    F.show(L("l17") - 0.6, "review-cut", { quiet: true, scroll: 560 });
    F.focus(A("l17", "rule"), "review-cut", "rule", { maxZoom: 1.4 });
    F.highlight(A("l18", "cost"), "review-cut", "pnlRow", 3.0, 8);
    F.highlight(A("l19", "worst"), "review-cut", "worstRow", 2.6, 8);
    F.highlight(A("l19", "minus", 2) - 0.3, "review-cut", "drawdownRow", 2.0, 8);
    F.cursorTo(A("l20", "shows"), "review-cut", "addRule");
    F.click(A("l20", "decide"));
    F.swap(A("l20", "decide") + 0.05, "review-cut-added");
    sfx(A("l20", "decide") + 0.1, "confirm", -13, 0);
    F.hideCursor(E("l20") + 0.4);

    // ===================== Chapter 3 · Check before you trade =====================
    chapter(L("l21") - 1.45, "03", "Check before you trade");
    F.reset(L("l21") - 1.4, 0.01);
    F.show(L("l21") - 0.6, "check-empty", { quiet: true });
    F.highlight(A("l21", "sunday"), "check-empty", "scenario", 3.6, 8);
    // Typing into the real input.
    const r = F.rect("check-empty", "input");
    const typed = document.createElement("div");
    typed.className = "typed";
    // Covers the input's placeholder with the input's own background, then types over it.
    Object.assign(typed.style, { position: "absolute", left: `${r.x + 2}px`, top: `${r.y + 2}px`, width: `${r.w - 4}px`, height: `${r.h - 4}px`, paddingLeft: "11px", background: "#FFFDF9", display: "flex", alignItems: "center", font: '400 15.6px "Geist", sans-serif', color: "#1F1C17", whiteSpace: "pre" });
    $("#cam").appendChild(typed);
    const full = "buy $1,500 of rMSTR";
    const typer = { _n: 0 };
    Object.defineProperty(typer, "n", { get: () => typer._n, set: (v) => { typer._n = v; typed.textContent = full.slice(0, Math.round(v)); } });
    typer.n = 0;
    const tType = A("l22", "types");
    gsap.set(typed, { opacity: 0 });
    tl.set(typed, { opacity: 1 }, tType - 0.05);
    tl.to(typer, { n: full.length, duration: 0.9, ease: "none" }, tType);
    sfx(tType, "typing", -19, 0);
    F.swap(tType + 1.0, "check-typed");
    tl.set(typed, { opacity: 0 }, tType + 1.02);
    F.cursorTo(tType + 1.0, "check-typed", "scenario");
    F.click(A("l22", "checks"));
    F.swap(A("l22", "checks") + 0.3, "check-result");
    F.hideCursor(A("l22", "checks") + 0.4);
    F.scrollTo(A("l22", "checks") + 0.6, "check-result", 420);
    F.focus(L("l23") - 0.1, "check-result", "verdict", { maxZoom: 1.5 });
    F.focus(A("l23", "last") - 0.2, "check-result", "rule", { maxZoom: 1.35 });
    F.highlight(A("l23", "twenty"), "check-result", "history", 2.8, 8);
    F.reset(L("l24") - 0.25, 0.6);
    F.scrollTo(L("l24") - 0.25, "check-result", 700);
    F.cursorTo(L("l24"), "check-result", "smaller");
    F.click(A("l24", "smaller"));
    F.swap(A("l24", "smaller") + 0.05, "check-logged");
    sfx(A("l24", "logged"), "confirm", -13, 0.2);
    F.hideCursor(E("l24") + 0.3);

    // ===================== Chapter 4 · Ask the coach =====================
    chapter(L("l25") - 1.45, "04", "Ask the coach");
    F.show(L("l25") - 0.6, "coach-empty", { quiet: true });
    F.cursorTo(L("l25"), "coach-empty", "q");
    F.click(A("l25", "answers"));
    F.swap(A("l26", "coach"), "coach-answer");
    sfx(A("l26", "coach") + 0.1, "pop", -16, 0);
    F.hideCursor(A("l26", "coach") + 0.2);
    F.highlight(A("l26", "looks"), "coach-answer", "tools", 1.8, 8);
    F.focus(A("l26", "cites") - 0.2, "coach-answer", "answer", { maxZoom: 1.5 });
    F.highlight(A("l27", "checked"), "coach-answer", "verified", 2.6, 8);
    sfx(A("l27", "checked") + 0.2, "confirm", -15, 0);
    F.reset(A("l27", "thrown"), 0.8);

    // ===================== Proof =====================
    chapter(L("l28") - 1.45, "05", "How we know");
    F.show(L("l28") - 0.6, "accuracy", { quiet: true });
    F.focus(A("l29", "hid"), "accuracy", "stats", { maxZoom: 1.4 });
    F.highlight(A("l30", "seventy"), "accuracy", "found", 2.8, 8);
    F.highlight(A("l31", "zero"), "accuracy", "falseAlarm", 2.2, 8);
    F.highlight(A("l31", "accused") - 0.4, "accuracy", "accused", 1.8, 8);
    // Ten out of ten, forty-eight tests: cards above the frame.
    const proof = document.createElement("div");
    proof.className = "proof";
    proof.innerHTML = `<div class="card" id="pf1"><div class="v">10/10</div><div class="k">coach answers fully grounded</div></div><div class="card" id="pf2"><div class="v">48</div><div class="k">automated tests</div></div>`;
    overlay.appendChild(proof);
    gsap.set(["#pf1", "#pf2"], { opacity: 0, y: 40 });
    tl.to("#pf1", { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, A("l32", "ten"));
    tl.to("#pf2", { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, A("l32", "48"));
    sfx(A("l32", "ten"), "pop", -15, -0.2);
    sfx(A("l32", "48"), "pop", -15, 0.2);
    tl.to(["#pf1", "#pf2"], { opacity: 0, y: -20, duration: 0.35, ease: "power3.in" }, L("l33") - 0.3);
    F.reset(L("l32") - 0.1, 0.6);
    F.show(L("l33") - 0.2, "import");
    F.highlight(A("l33", "connect"), "import", "connect", 3.4, 8);
    F.cursorTo(A("l33", "review"), "import", "fetch");

    // ===================== Close =====================
    const tOut = E("l33") + 0.5;
    F.frameOut(tOut);
    tl.to(S, { quiet: 0.5, dots: 0, duration: 1.2, ease: "power2.inOut" }, tOut);
    BG.rewinds.push({ t0: tOut, t1: L("l34") + 0.4, amount: 0.12 });
    sfx(tOut + 0.2, "whoosh", -15, 0);
    gsap.set("#s9", { opacity: 0 });
    tl.to("#s9", { opacity: 1, duration: 0.3 }, L("l34") - 0.2);
    riseWords($("#s9-a"), L("l34"));
    riseWords($("#s9-b"), A("l34", "the"));
    fadeOut($("#s9-a"), L("l35") - 0.35);
    fadeOut($("#s9-b"), L("l35") - 0.35);
    gsap.set("#s9-title", { opacity: 0, y: 40 });
    tl.to("#s9-title", { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" }, A("l35", "hindsight") - 0.05);
    sfx(A("l35", "hindsight"), "impact", -10, 0);
    gsap.set("#s9-tag", { opacity: 0 });
    tl.to("#s9-tag", { opacity: 1, duration: 0.4 }, A("l35", "your") - 0.1);
    sweep($("#s9-tag .sweep"), A("l35", "your"), 0.8);
    fadeIn($("#s9-links"), E("l35") + 0.3, { y: 20 });
    $("#s9-credits").textContent = window.CREDITS || "";
    fadeIn($("#s9-credits"), E("l35") + 0.8, { y: 10 });
    push($("#s9"), E("l35"), TOTAL - 0.1, 1.025);
  });
})();
