#!/usr/bin/env python3
"""Read the walk stations aloud: one audio file per station and voice (config "voices") from its
Wikipedia introduction, spoken locally with Piper, then uploaded to R2 with the tiles.

  python3 scripts/narrate.py luebeck tiles      # writes tiles/audio/<city>/<hash>.mp3 and config/<city>.audio.json

Files are named by the hash of their text, so only changed stations are spoken again.
"""
import hashlib, json, re, subprocess, sys, tempfile, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = Path.home() / 'MyStuff/models/piper'
city, out = sys.argv[1], Path(sys.argv[2])
voices = json.loads((ROOT / 'config' / f'{city}.json').read_text())['voices']
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
    intro = st['place']['text'] if st.get('place') else (by_title.get(st['source']['title']) or {}).get('intro', '') if st.get('source') else ''
    lines = [f"Station {k + 1}: {st['name']}.", speakable(intro or st.get('blurb', ''))]
    if st.get('quiz'):
        q = st['quiz']; abc = ['A', 'B', 'C', 'D']
        lines.append('Und jetzt ein Rätsel: ' + q['q'] + ' ' + ' '.join(f'{abc[i]}: {o}.' for i, o in enumerate(q['options'])) + ' Tippe deine Antwort an!')
    if nxt:
        m = nxt['leg']['minutes']
        words = {1: 'eine Minute', 2: 'zwei Minuten', 3: 'drei Minuten', 4: 'vier Minuten', 5: 'fünf Minuten', 6: 'sechs Minuten',
                 7: 'sieben Minuten', 8: 'acht Minuten', 9: 'neun Minuten', 10: 'zehn Minuten'}
        lines.append(f"Nächste Station: {nxt['name']}. Bis dorthin sind es etwa {words.get(m, f'{m} Minuten')} zu Fuß.")
    else:
        lines.append(f"Das war die letzte Station des Rundgangs {t['title']}. Danke fürs Mitgehen!")
    return ' '.join(l for l in lines if l)


class Speechify:
    """Speechify API (platform.speechify.ai): POST /v1/audio/speech with model simba-3.5, MP3 back as base64.
    The key stays in ~/.config/pixel-map/speechify.env."""
    def __init__(self, voice_id):
        import base64, urllib.request
        env = dict(l.split('=', 1) for l in (Path.home() / '.config/pixel-map/speechify.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
        self.key = env['SPEECHIFY_API_KEY'].strip()
        if self.key.startswith('HIER_'): sys.exit('~/.config/pixel-map/speechify.env: API-Schlüssel fehlt noch')
        self.voice, self.b64, self.req = voice_id, base64, urllib.request

    def mp3(self, text, path):
        body = json.dumps({'input': text, 'voice_id': self.voice, 'model': 'simba-3.5', 'language': 'de-DE', 'audio_format': 'mp3',
                           'options': {'loudness_normalization': True}}).encode()
        r = self.req.Request('https://eu.api.speechify.ai/v1/audio/speech', data=body, method='POST',
                             headers={'Authorization': f'Bearer {self.key}', 'Content-Type': 'application/json'})
        path.write_bytes(self.b64.b64decode(json.loads(self.req.urlopen(r, timeout=120).read())['audio_data']))


class Google:
    """Google Cloud Text-to-Speech (REST, API key in ~/.config/pixel-map/google.env): text:synthesize, MP3."""
    URL = 'https://texttospeech.googleapis.com/v1/'

    def __init__(self, voice_id=None):
        import base64, urllib.request
        env = dict(l.split('=', 1) for l in (Path.home() / '.config/pixel-map/google.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
        self.key = env['GOOGLE_TTS_API_KEY'].strip()
        if self.key.startswith('HIER_'): sys.exit('~/.config/pixel-map/google.env: API-Schlüssel fehlt noch')
        self.voice, self.b64, self.req = voice_id, base64, urllib.request

    def call(self, path, body=None):
        r = self.req.Request(self.URL + path + ('&' if '?' in path else '?') + 'key=' + self.key, data=json.dumps(body).encode() if body else None,
                             method='POST' if body else 'GET', headers={'Content-Type': 'application/json'})
        return json.loads(self.req.urlopen(r, timeout=120).read())

    def voices(self):
        return self.call('voices?languageCode=de-DE')['voices']

    def mp3(self, text, path):
        out = self.call('text:synthesize', {'input': {'text': text}, 'voice': {'languageCode': 'de-DE', 'name': self.voice},
                                            'audioConfig': {'audioEncoding': 'MP3', 'speakingRate': 0.97}})
        path.write_bytes(self.b64.b64decode(out['audioContent']))


def speak(v, voice, text, mp3):
    """One clip: Speechify voices (config "provider": "speechify") or Piper."""
    if v.get('provider') in ('speechify', 'google'):
        voice.mp3(text[:1990], mp3); return          # texts stay below the services' request limits
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'a.wav'
        with wave.open(str(wav), 'wb') as w:
            voice.synthesize_wav(text, w)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-ac', '1', '-b:a', '56k', str(mp3)], check=True)


from piper import PiperVoice
folder = out / 'audio' / city; folder.mkdir(parents=True, exist_ok=True)
index, buildings, made = {}, {}, 0
for v in voices:
    voice = Speechify(v['voice_id']) if v.get('provider') == 'speechify' else Google(v['voice_id']) if v.get('provider') == 'google' else PiperVoice.load(str(MODELS / f"{v['model']}.onnx"))
    for t in walks:
        for k, st in enumerate(t['stations']):
            text = script(t, k)
            h = hashlib.sha256(((v.get('model') or v.get('voice_id')) + text).encode()).hexdigest()[:16]
            mp3 = folder / f'{h}.mp3'
            if not mp3.exists():
                speak(v, voice, text, mp3)
                made += 1
            secs = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(mp3)],
                                        capture_output=True, text=True, check=True).stdout)
            index.setdefault(st['id'], {'text': text})[v['id']] = {'file': f'audio/{city}/{h}.mp3', 'seconds': round(secs, 1)}
    # every building with a Wikipedia entry: its name and introduction, for the popup's read-aloud button
    for q, item in info.items():
        if not item.get('intro'): continue
        text = f"{(item.get('title') or item.get('label') or '').replace(' (Lübeck)', '')}. {speakable(item['intro'], 900)}"
        h = hashlib.sha256(((v.get('model') or v.get('voice_id')) + text).encode()).hexdigest()[:16]
        mp3 = folder / f'{h}.mp3'
        if not mp3.exists():
            speak(v, voice, text, mp3)
            made += 1
        buildings.setdefault(q, {})[v['id']] = f'audio/{city}/{h}.mp3'
(ROOT / 'config' / f'{city}.audio.json').write_text(json.dumps({
    'voices': {v['id']: v['credit'] for v in voices}, 'texts': 'nach Wikipedia (CC BY-SA 4.0)',
    'stations': index, 'buildings': buildings}, ensure_ascii=False, indent=1) + '\n')
print({'stations': len(index), 'voices': len(voices), 'spoken': made})
