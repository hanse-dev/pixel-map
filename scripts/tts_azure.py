"""Azure AI Speech for other tools (the games): Azure(voice).mp3(text, path). Key and region in
~/.config/pixel-map/azure.env."""
import json, sys, urllib.request
from pathlib import Path
from xml.sax.saxutils import escape


class Azure:
    def __init__(self, voice_id):
        env = dict(l.split('=', 1) for l in (Path.home() / '.config/pixel-map/azure.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
        self.key, self.region, self.voice = env['AZURE_SPEECH_KEY'].strip(), env['AZURE_SPEECH_REGION'].strip(), voice_id
        if self.key.startswith('HIER_'): sys.exit('~/.config/pixel-map/azure.env: Schlüssel fehlt noch')

    def mp3(self, text, path):
        ssml = f'<speak version="1.0" xml:lang="de-DE"><voice name="{self.voice}"><prosody rate="-4%">{escape(text)}</prosody></voice></speak>'.encode()
        r = urllib.request.Request(f'https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1', data=ssml, method='POST',
                                   headers={'Ocp-Apim-Subscription-Key': self.key, 'User-Agent': 'pixel-map', 'Content-Type': 'application/ssml+xml',
                                            'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3'})
        Path(path).write_bytes(urllib.request.urlopen(r, timeout=120).read())
