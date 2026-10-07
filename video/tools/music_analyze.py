"""
Tempo, drop and section energy for candidate tracks (guide §7).

Tempo comes from the kick band only (< 150 Hz) to avoid hi-hats doubling the estimate: low-band onset
strength, autocorrelated, refined over long lags. The drop is the biggest bar-to-bar jump in low-band energy.
  .venv/bin/python tools/music_analyze.py .work/music/*.wav
"""
import sys

import numpy as np
import soundfile as sf

HOP = 256


def band_energy(x: np.ndarray, sr: int, lo: float, hi: float, n_fft: int = 2048) -> np.ndarray:
    frames = 1 + (len(x) - n_fft) // HOP
    idx = np.arange(n_fft)[None, :] + HOP * np.arange(frames)[:, None]
    spec = np.abs(np.fft.rfft(x[idx] * np.hanning(n_fft), axis=1))
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    return spec[:, (freqs >= lo) & (freqs < hi)].sum(axis=1)


def tempo(onset: np.ndarray, sr: int) -> float:
    fps = sr / HOP
    o = onset - onset.mean()
    ac = np.correlate(o, o, mode="full")[len(o) - 1 :]
    lags = np.arange(len(ac)) / fps
    ok = (lags > 60 / 180) & (lags < 60 / 70)
    beat = lags[ok][np.argmax(ac[ok])]
    # Refine over long lags: the lag of N beats is N * beat; pick the precise peak near 64 beats.
    best, best_v = beat, -np.inf
    for cand in np.linspace(beat * 0.98, beat * 1.02, 400):
        lag = int(round(64 * cand * fps))
        if lag < len(ac) and ac[lag] > best_v:
            best, best_v = cand, ac[lag]
    return 60 / best


def main() -> None:
    for path in sys.argv[1:]:
        x, sr = sf.read(path, dtype="float32")
        if x.ndim > 1:
            x = x.mean(axis=1)
        low = band_energy(x, sr, 30, 150)
        full = band_energy(x, sr, 30, 8000)
        onset = np.maximum(0, np.diff(low, prepend=low[0]))
        bpm = tempo(onset, sr)
        bar = 4 * 60 / bpm
        fps = sr / HOP
        nb = int(len(low) / fps / bar)
        bars_low = np.array([low[int(i * bar * fps) : int((i + 1) * bar * fps)].mean() for i in range(nb)])
        bars_full = np.array([full[int(i * bar * fps) : int((i + 1) * bar * fps)].mean() for i in range(nb)])
        bl = bars_low / (bars_low.max() + 1e-9)
        bf = bars_full / (bars_full.max() + 1e-9)
        jumps = np.diff(bl)
        drop_bar = int(np.argmax(jumps[: int(nb * 0.6)])) + 1
        print(f"\n{path}: {len(x) / sr:.1f}s  {bpm:.2f} BPM  bar {bar:.3f}s  drop ≈ bar {drop_bar} at {drop_bar * bar:.2f}s")
        print("  low-band energy per bar (0-9):  " + "".join(str(min(9, int(v * 10))) for v in bl))
        print("  full-band energy per bar (0-9): " + "".join(str(min(9, int(v * 10))) for v in bf))


if __name__ == "__main__":
    main()
