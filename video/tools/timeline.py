"""
Lay the voiced lines on the film's timeline (guide §3).

Short pauses inside a scene, long pauses where the picture changes. Writes:
  assets/voice.wav       all lines in place, 48 kHz mono
  assets/layout.json     {total, lines: {id: [start, end]}}
  .work/pad/<id>.wav     each line padded with 0.5 s of silence, for transcription
"""
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 48_000
LEAD_IN = 1.1
TAIL = 5.0
SHORT = 0.38
# Long pauses before lines that start a new scene.
LONG = {
    "l04": 1.0,  # into the 24/7 problem
    "l07": 1.7,  # into the title drop
    "l09": 1.5,  # into the cast
    "l11": 0.9,  # into the product
    "l12": 1.6,  # chapter 1
    "l17": 1.6,  # chapter 2
    "l21": 1.6,  # chapter 3
    "l25": 1.6,  # chapter 4
    "l28": 1.6,  # proof
    "l34": 1.5,  # close
}


def load(path: Path) -> np.ndarray:
    audio, sr = sf.read(path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != SR:  # linear resample is fine for speech at 24k -> 48k
        n = int(round(len(audio) * SR / sr))
        audio = np.interp(np.linspace(0, len(audio) - 1, n), np.arange(len(audio)), audio).astype("float32")
    return audio


def main() -> None:
    ids = sorted(p.stem for p in (ROOT / "assets/vo").glob("l*.wav"))
    ids = [i for i in ids if re.fullmatch(r"l\d\d", i)]
    clips = {i: load(ROOT / "assets/vo" / f"{i}.wav") for i in ids}

    t = LEAD_IN
    layout = {}
    for i, lid in enumerate(ids):
        if i > 0:
            t += LONG.get(lid, SHORT)
        dur = len(clips[lid]) / SR
        layout[lid] = [round(t, 3), round(t + dur, 3)]
        t += dur
    total = round(t + TAIL, 3)

    voice = np.zeros(int(total * SR) + 1, dtype="float32")
    for lid, (start, _) in layout.items():
        s = int(round(start * SR))
        voice[s : s + len(clips[lid])] += clips[lid]
    sf.write(ROOT / "assets/voice.wav", voice, SR)

    pad_dir = ROOT / ".work/pad"
    pad_dir.mkdir(parents=True, exist_ok=True)
    silence = np.zeros(int(0.5 * SR), dtype="float32")
    for lid, clip in clips.items():
        sf.write(pad_dir / f"{lid}.wav", np.concatenate([silence, clip, silence]), SR)

    (ROOT / "assets/layout.json").write_text(json.dumps({"total": total, "lines": layout}, indent=1))
    print(f"{len(ids)} lines laid out · film length {total:.1f}s ({int(total // 60)}:{total % 60:04.1f})")


if __name__ == "__main__":
    main()
