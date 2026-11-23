#!/usr/bin/env python3
"""Listening test: the same station text in every candidate voice, as MP3s side by side.

  python3 scripts/voice_sample.py OUT_DIR        # Piper voices always; Speechify voices when a key is set
"""
import json, sys
from pathlib import Path
sys.argv = [sys.argv[0], 'luebeck', '/tmp/unused'] + sys.argv[1:]
out = Path(sys.argv[3]); out.mkdir(parents=True, exist_ok=True)
import importlib.util
spec = importlib.util.spec_from_file_location('narrate_lib', Path(__file__).with_name('narrate.py'))
src = Path(__file__).with_name('narrate.py').read_text().split('from piper import PiperVoice\nfolder')[0]  # helpers only
ns = {'__file__': str(Path(__file__).with_name('narrate.py'))}; exec(compile(src, 'narrate.py', 'exec'), ns)
from piper import PiperVoice
walk = next(t for t in ns['walks'] if t['id'] == 'hanse'); text = ns['script'](walk, 0)
candidates = [{'id': 'piper-thorsten', 'model': 'de_DE-thorsten-high'}, {'id': 'piper-kerstin', 'model': 'de_DE-kerstin-low'}]
env = Path.home() / '.config/pixel-map/speechify.env'
if env.exists() and 'HIER_' not in env.read_text():
    candidates += [{'id': f'speechify-{v}', 'provider': 'speechify', 'voice_id': v} for v in ('henrik-agent', 'benedikt-agent', 'runa-agent')]
genv = Path.home() / '.config/pixel-map/google.env'
if genv.exists() and 'HIER_' not in genv.read_text():
    names = sorted(v['name'] for v in ns['Google']().voices())
    print('Google-Stimmen de-DE:', len(names))
    pick = [n for n in names if 'Chirp3-HD' in n][:6] + [n for n in names if 'Neural2' in n or 'Studio' in n]
    candidates += [{'id': f'google-{n}', 'provider': 'google', 'voice_id': n} for n in pick]
for c in candidates:
    voice = ns['Speechify'](c['voice_id']) if c.get('provider') == 'speechify' else ns['Google'](c['voice_id']) if c.get('provider') == 'google' else PiperVoice.load(str(ns['MODELS'] / f"{c['model']}.onnx"))
    ns['speak'](c, voice, text, out / f"{c['id']}.mp3"); print('ok', c['id'])
(out / 'text.txt').write_text(text + '\n')
