"""
The final mix (guide §7): voice + music bed (ducked under every word) + sound effects, then a two-pass
loudnorm to -14 LUFS / -1 dBTP. Sound cue times come from the composition itself (assets/events.json,
written by tools/events.mjs), so sound and picture can't drift.

  .venv/bin/python tools/mix.py
"""
import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 48_000

# Music: "Deep Urban" by Eugenio Mininni (Mixkit). Tempo measured from the kick band.
MUSIC = ROOT / ".work/music/623.mp3"
BPM = 124.04
BAR = 4 * 60 / BPM
DROP_TRACK = 8 * BAR  # first drop: kick and bass enter at bar 8
OUTRO_TRACK = 121 * BAR  # the track's own outro begins at bar 121
BED_DB = -21.0  # music RMS after the drop, before ducking

# Sound palette: file, gain offset (dB), how to place, max length (s).
SOUNDS = {
    "click": ("kenney_click_002.wav", 0, "peak", None),
    "tick": ("kenney_tick_002.wav", 0, "peak", None),
    "confirm": ("kenney_confirmation_002.wav", 0, "peak", None),
    "pop": ("pop.mp3", 0, "peak", None),
    "whoosh": ("whoosh.mp3", 0, "peak", None),
    "typing": ("typing.mp3", 0, "start", 0.9),
    "impact": ("impact-bass-1.mp3", 0, "peak", None),
    "error": ("error.mp3", 0, "peak", 0.6),
    "sparkle": ("sparkle.mp3", 0, "start", 1.4),
    "riser": ("riser.mp3", 0, "peak", None),
}


def decode(path: Path) -> np.ndarray:
    """Any audio file -> float32 stereo at 48 kHz."""
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def db(x: float) -> float:
    return 10 ** (x / 20)


def rms_db(x: np.ndarray) -> float:
    return 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12)


def peak_offset(x: np.ndarray) -> float:
    """Time of the sound's main peak: the loudest moment of a 10 ms envelope within the first 60% of the file,
    so a stray spike in a long tail (e.g. a sub-bass impact) can't pull the placement late."""
    env = np.abs(x).mean(axis=1)
    k = int(0.01 * SR)
    smooth = np.convolve(env, np.ones(k) / k, mode="same")
    head = smooth[: max(k, int(len(smooth) * 0.6))]
    return int(np.argmax(head)) / SR


def place(dst: np.ndarray, src: np.ndarray, start: float) -> None:
    s = int(round(start * SR))
    if s < 0:
        src, s = src[-s:], 0
    n = min(len(src), len(dst) - s)
    if n > 0:
        dst[s : s + n] += src[:n]


def main() -> None:
    cues = json.loads((ROOT / "cues.js").read_text().split("window.CUES = ", 1)[1].rstrip().rstrip(";"))
    events = json.loads((ROOT / "assets/events.json").read_text())
    total = cues["total"]
    n = int(total * SR) + 1
    t = np.arange(n) / SR

    # ---- voice ----
    voice_mono, vsr = sf.read(ROOT / "assets/voice.wav", dtype="float32")
    assert vsr == SR
    voice = np.zeros((n, 2), dtype=np.float32)
    voice[: len(voice_mono), 0] = voice_mono[:n]
    voice[: len(voice_mono), 1] = voice_mono[:n]

    # ---- music: drop on the product name, outro spliced on the bar grid ----
    track = decode(MUSIC)
    t_name = next(w[1] for w in cues["words"]["l07"] if w[0].lower().startswith("hindsight"))
    drop_film = t_name - 0.02
    music_start = drop_film - DROP_TRACK  # film time where the track begins
    close_line = cues["lines"]["l34"][0]
    bars_to_splice = round((close_line - 1.0 - drop_film) / BAR)
    splice_film = drop_film + bars_to_splice * BAR
    music = np.zeros((n, 2), dtype=np.float32)
    a0, a1 = int(music_start * SR), int(splice_film * SR)
    seg_a = track[: a1 - a0]
    music[a0 : a0 + len(seg_a)] += seg_a
    o0 = int(OUTRO_TRACK * SR)
    seg_b = track[o0 : o0 + (n - a1)]
    xf = int(0.04 * SR)  # 40 ms crossfade at the splice
    fade = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
    music[a1 : a1 + xf] = music[a1 : a1 + xf] * (1 - fade)
    seg_b = seg_b.copy()
    seg_b[:xf] *= fade
    music[a1 : a1 + len(seg_b)] += seg_b
    # level: the bed sits at BED_DB RMS after the drop
    after = music[int(drop_film * SR) : int((drop_film + 30) * SR)]
    music *= db(BED_DB - rms_db(after))
    # fades: in over 1.5 s, out over 2.5 s
    gain = np.ones(n, dtype=np.float32)
    fi = (t >= music_start) & (t < music_start + 1.5)
    gain[fi] = (t[fi] - music_start) / 1.5
    fo = t > total - 2.5
    gain[fo] = np.clip((total - t[fo]) / 2.5, 0, 1)
    # ducking under every word: -6 dB before the drop, -9 dB after; 50 ms lead, 60 ms attack, 350 ms release
    duck_target = np.zeros(n, dtype=np.float32)
    for words in cues["words"].values():
        for _, ws, we in words:
            depth = 6.0 if ws < drop_film else 9.0
            s, e = int((ws - 0.05) * SR), int(we * SR)
            duck_target[max(0, s) : e] = np.maximum(duck_target[max(0, s) : e], depth)
    duck = np.zeros(n, dtype=np.float32)
    att, rel = 1 - np.exp(-1 / (0.06 * SR)), 1 - np.exp(-1 / (0.35 * SR))
    d = 0.0
    for i in range(0, n, 48):  # 1 ms control rate
        target = duck_target[i]
        d += (target - d) * (att if target > d else rel) * 48
        duck[i : i + 48] = d
    # the product demo sits another 5 dB lower so voice and UI lead (1.5 s ramps)
    d0, d1 = cues["lines"]["l12"][0] - 1.5, cues["lines"]["l33"][1]
    ramp = np.clip(np.minimum((t - d0) / 1.5, (d1 + 1.5 - t) / 1.5), 0, 1)
    demo = 5.0 * ramp.astype(np.float32)
    music *= (gain * 10 ** (-(duck + demo) / 20))[:, None].astype(np.float32)

    # ---- effects, placed by their peak ----
    fx = np.zeros((n, 2), dtype=np.float32)
    cache = {}
    for ev in events:
        name = ev["name"]
        if name not in SOUNDS:
            raise ValueError(f"unknown sound {name}")
        file, offset, how, maxlen = SOUNDS[name]
        if name not in cache:
            x = decode(ROOT / "assets/sfx" / file)
            if maxlen:
                x = x[: int(maxlen * SR)].copy()
                x[-int(0.05 * SR) :] *= np.linspace(1, 0, int(0.05 * SR))[:, None]
            x /= np.abs(x).max() + 1e-9
            cache[name] = (x, peak_offset(x) if how == "peak" else 0.0)
        x, pk = cache[name]
        pan = float(ev.get("pan", 0))
        lr = np.array([np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)], dtype=np.float32) * np.sqrt(2)
        place(fx, x * db(ev["gain"] + offset) * lr, ev["t"] - pk)

    mix = voice + music + fx
    pre = ROOT / ".work/mix-pre.wav"
    sf.write(pre, mix, SR, subtype="FLOAT")

    # ---- two-pass loudnorm to -14 LUFS, -1 dBTP ----
    target = "I=-14:TP=-1:LRA=11"
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(pre), "-af", f"loudnorm={target}:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = json.loads(probe[probe.rindex("{") : probe.rindex("}") + 1])
    af = (
        f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
        f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(pre), "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le", str(ROOT / "assets/mix.wav")], check=True)
    check = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(ROOT / "assets/mix.wav"), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    summary = check[check.rindex("Summary:") :]
    i_lufs = summary.split("I:")[1].split("LUFS")[0].strip()
    peak = summary.split("Peak:")[1].split("dBFS")[0].strip()
    print(f"music starts at {music_start:.2f}s, drop at {drop_film:.2f}s, outro splice at {splice_film:.2f}s ({bars_to_splice} bars after the drop)")
    print(f"{len(events)} sound events · mix: {i_lufs} LUFS integrated, true peak {peak} dBFS")


if __name__ == "__main__":
    main()
