"""Short narrator samples so the person can pick a voice (guide §3)."""
import sys
from pathlib import Path
import soundfile as sf
from kokoro_onnx import Kokoro

CACHE = Path.home() / ".cache/hyperframes/tts"
kokoro = Kokoro(str(CACHE / "models/kokoro-v1.0.onnx"), str(CACHE / "voices/voices-v1.0.bin"))
TEXT = (
    "The ones who traded most earned eleven point four percent a year. The market earned seventeen point nine. "
    "It wasn't bad luck. It was habits. This is Hindsight. Your trades, reviewed."
)
out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
for voice in sys.argv[2:]:
    samples, sr = kokoro.create(TEXT, voice=voice, speed=1.0, lang="en-us")
    path = out / f"{voice}.wav"
    sf.write(path, samples, sr)
    print(f"{voice}: {len(samples) / sr:.1f}s -> {path}")
