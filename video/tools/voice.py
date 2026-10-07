"""
Voice every narration line from SCRIPT.md (guide §3).

  .venv/bin/python tools/voice.py            # all lines
  .venv/bin/python tools/voice.py l07 l21    # re-voice selected lines

Writes assets/vo/<id>.wav (one file per line) and prints durations and words per minute.
Names are fixed at the phoneme level, then synthesised with is_phonemes=True.
"""
import re
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path.home() / ".cache/hyperframes/tts"
VOICE = "am_michael"
SPEED = 1.0

# Phoneme fixes: what espeak produces -> what we want.
PHONEME_FIXES = {
    "tˈɑːluː": "tˈoʊluː",  # Tolu: "TAH-loo" -> "TOH-loo"
    "bˈɪtɡɪt": "bˈɪtɡɛt",  # Bitget: "BIT-git" -> "BIT-get"
}


def script_lines() -> dict[str, str]:
    """Parse `| lNN | text | source |` rows from SCRIPT.md."""
    lines = {}
    for row in (ROOT / "SCRIPT.md").read_text().splitlines():
        m = re.match(r"^\|\s*(l\d\d)\s*\|\s*(.+?)\s*\|", row)
        if m:
            lines[m.group(1)] = m.group(2)
    return lines


def main() -> None:
    kokoro = Kokoro(str(CACHE / "models/kokoro-v1.0.onnx"), str(CACHE / "voices/voices-v1.0.bin"))
    lines = script_lines()
    wanted = sys.argv[1:] or list(lines)
    out = ROOT / "assets/vo"
    out.mkdir(parents=True, exist_ok=True)
    total_words = total_secs = 0.0
    for lid in wanted:
        text = lines[lid]
        phonemes = kokoro.tokenizer.phonemize(text, "en-us")
        for wrong, right in PHONEME_FIXES.items():
            phonemes = phonemes.replace(wrong, right)
        samples, sr = kokoro.create(phonemes, voice=VOICE, speed=SPEED, is_phonemes=True)
        sf.write(out / f"{lid}.wav", samples, sr)
        secs = len(samples) / sr
        words = len(text.split())
        total_words += words
        total_secs += secs
        print(f"{lid}  {secs:5.2f}s  {words:3d} words  {words / secs * 60:4.0f} wpm  {text[:60]}")
    print(f"\n{len(wanted)} lines · {total_secs:.1f}s of speech · {total_words / total_secs * 60:.0f} wpm overall")


if __name__ == "__main__":
    main()
