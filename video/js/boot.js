/* Boot: wait for fonts, build every scene onto the one paused timeline, register it. */
(function () {
  window.CREDITS =
    "Music: “Deep Urban” by Eugenio Mininni (Mixkit) · Voice: Kokoro (am_michael) · Sounds: Kenney (CC0), Pixabay via HyperFrames · Data: Bitget, Yahoo Finance, Nasdaq";

  // Build synchronously so the runtime finds the timeline; fonts are local with font-display: block.
  for (const build of window.BUILD) build();
  const { tl, TOTAL } = window.H;
  // Pad the timeline to the film's full length.
  tl.set({}, {}, TOTAL);
  window.__sfxEvents = window.SFX;
})();
