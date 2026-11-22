#!/usr/bin/env python3
"""Read the walk stations aloud: one audio file per station from its Wikipedia introduction, spoken
locally with Piper (voice: Thorsten, CC0 dataset), then uploaded to R2 with the tiles.

  python3 scripts/narrate.py luebeck tiles      # writes tiles/audio/<city>/<hash>.mp3 and config/<city>.audio.json

Files are named by the hash of their text, so only changed stations are spoken again.
"""
import hashlib, json, re, subprocess, sys, tempfile, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOICE = Path.home() / 'MyStuff/models/piper/de_DE-thorsten-high.onnx'
city, out = sys.argv[1], Path(sys.argv[2])
walks = json.loads((ROOT / 'config' / f'{city}.walks.json').read_text())['tours']
info = json.loads((ROOT / 'info' / f'{city}.de.json').read_text())['items']
by_title = {v.get('title'): v for v in info.values()}


def speakable(text, limit=650):
    """The introduction as it should be spoken: no brackets, at most a few sentences."""
    text = re.sub(r'\s*\([^()]*\)', '', text)                  # pronunciations, alternative names
    text = re.sub(r'\s*\[[^\]]*\]', '', text).replace('„', '').replace('“', '')
    parts, n = [], 0
    for s in re.split(r'(?<!St)(?<!\d)(?<=[.!?])\s+(?=[A-ZÄÖÜ])', re.sub(r'\s+', ' ', text).strip()):
        if parts and n + len(s) > limit: break
        parts.append(s); n += len(s)
    return ' '.join(parts)


def script(t, k):
    st, nxt = t['stations'][k], t['stations'][k + 1] if k + 1 < len(t['stations']) else None
    intro = (by_title.get(st['source']['title']) or {}).get('intro', '') if st.get('source') else ''
    lines = [f"Station {k + 1}: {st['name']}.", speakable(intro or st.get('blurb', ''))]
    if nxt:
        m = nxt['leg']['minutes']
        words = {1: 'eine Minute', 2: 'zwei Minuten', 3: 'drei Minuten', 4: 'vier Minuten', 5: 'fünf Minuten', 6: 'sechs Minuten',
                 7: 'sieben Minuten', 8: 'acht Minuten', 9: 'neun Minuten', 10: 'zehn Minuten'}
        lines.append(f"Nächste Station: {nxt['name']}. Bis dorthin sind es etwa {words.get(m, f'{m} Minuten')} zu Fuß.")
    else:
        lines.append(f"Das war die letzte Station des Rundgangs {t['title']}. Danke fürs Mitgehen!")
    return ' '.join(l for l in lines if l)


from piper import PiperVoice
voice = PiperVoice.load(str(VOICE))
folder = out / 'audio' / city; folder.mkdir(parents=True, exist_ok=True)
index, made = {}, 0
for t in walks:
    for k, st in enumerate(t['stations']):
        text = script(t, k)
        h = hashlib.sha256(text.encode()).hexdigest()[:16]
        mp3 = folder / f'{h}.mp3'
        if not mp3.exists():
            with tempfile.TemporaryDirectory() as tmp:
                wav = Path(tmp) / 'a.wav'
                with wave.open(str(wav), 'wb') as w:
                    voice.synthesize_wav(text, w)
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-ac', '1', '-b:a', '56k', str(mp3)], check=True)
            made += 1
        secs = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(mp3)],
                                    capture_output=True, text=True, check=True).stdout)
        index[st['id']] = {'file': f'audio/{city}/{h}.mp3', 'seconds': round(secs, 1), 'text': text}
(ROOT / 'config' / f'{city}.audio.json').write_text(json.dumps({
    'voice': 'Piper, Stimme „Thorsten“ (Datensatz CC0, thorsten-voice.de); Texte nach Wikipedia (CC BY-SA 4.0)',
    'stations': index}, ensure_ascii=False, indent=1) + '\n')
print({'stations': len(index), 'spoken': made, 'minutes': round(sum(v['seconds'] for v in index.values()) / 60, 1)})
