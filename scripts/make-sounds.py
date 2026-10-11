"""Makes the workout sounds in assets/sounds/ (small 16-bit mono WAV files).

The same tones as the web version in src/lib/sound.ts. Run: python3 -I scripts/make-sounds.py
"""
import math
import os
import random
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sounds')


def tone(buf, f1, f2, dur, kind='sine', vol=0.3, delay=0.0):
    start = int(delay * RATE)
    n = int((dur + 0.05) * RATE)
    if len(buf) < start + n:
        buf.extend([0.0] * (start + n - len(buf)))
    phase = 0.0
    for i in range(n):
        t = i / RATE
        f = f1 * (f2 / f1) ** min(1, t / dur) if f2 else f1
        phase += 2 * math.pi * f / RATE
        x = phase / (2 * math.pi) % 1
        if kind == 'sine':
            s = math.sin(phase)
        elif kind == 'triangle':
            s = 4 * abs(x - 0.5) - 1
        elif kind == 'sawtooth':
            s = 2 * x - 1
        else:
            s = 1 if x < 0.5 else -1
        env = min(1, t / 0.01) * (0.001 / vol) ** min(1, max(0, t - 0.01) / dur) if t < dur else 0
        buf[start + i] += s * vol * env


def noise(buf, dur, vol, delay=0.0):
    start = int(delay * RATE)
    n = int(dur * RATE)
    if len(buf) < start + n:
        buf.extend([0.0] * (start + n - len(buf)))
    prev = 0.0
    for i in range(n):
        x = random.uniform(-1, 1)
        prev = x - prev * 0.6
        buf[start + i] += prev * vol * (0.001 / vol) ** (i / n)


def save(name, buf):
    peak = max(1e-6, max(abs(x) for x in buf))
    k = min(1.0, 0.9 / peak)
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x * k)) * 32767)) for x in buf))


def main():
    random.seed(7)
    os.makedirs(OUT, exist_ok=True)
    b = []
    tone(b, 880, 0, 0.25)
    tone(b, 1320, 0, 0.4, vol=0.22, delay=0.12)
    save('default', b)
    b = []
    tone(b, 1250, 0, 1.0, 'triangle', 0.3)
    tone(b, 1257, 0, 1.0, 'triangle', 0.2, 0.015)
    save('gymbell', b)
    b = []
    for f, v in ((233, 0.16), (294, 0.12), (349, 0.08)):
        tone(b, f, 0, 0.7, 'sawtooth', v)
    save('horn', b)
    # The voice sounds need speech, which phones can't make offline here: punchy stand-ins.
    b = []
    for i, f in enumerate((392, 523, 659, 784)):
        tone(b, f, 0, 0.22, 'triangle', 0.3, i * 0.09)
    tone(b, 1047, 0, 0.5, 'triangle', 0.3, 0.36)
    noise(b, 0.08, 0.25, 0.36)
    save('lightweight', b)
    b = []
    tone(b, 330, 494, 0.18, 'square', 0.18)
    tone(b, 494, 740, 0.35, 'square', 0.18, 0.2)
    noise(b, 0.06, 0.3, 0.2)
    save('yeahbuddy', b)


main()
