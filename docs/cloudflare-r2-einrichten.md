# Cloudflare R2 für die Kartenkacheln einrichten

Ziel: Die Kartenkacheln liegen in Cloudflare R2. Die Website bleibt auf GitHub Pages und lädt die Kacheln von R2.
Der Bucket `pixel-map` existiert bereits. Seine S3-API-Adresse lautet:

```
https://0166a19ad0c33caf38a29c0ecf727e6c.r2.cloudflarestorage.com/pixel-map
```

Über diese Adresse wird nur **hochgeladen**. Sie verlangt immer Zugangsdaten und ist für Besucher der Website nicht nutzbar.

---

## 1. Öffentlichen Zugriff einschalten

Cloudflare-Dashboard → **R2** → Bucket **`pixel-map`** → **Settings** → **Public access**. Eine von zwei Varianten wählen:

- **R2.dev subdomain → Allow access.** Danach wird eine Adresse der Form `https://pub-xxxxxxxx.r2.dev` angezeigt.
  Cloudflare beschreibt sie als für Tests gedacht, mit Bandbreitenbegrenzung. Für den Anfang reicht sie.
- **Custom Domains → Connect Domain**, z. B. `tiles.meine-domain.de`. Das ist besser für den Dauerbetrieb
  (Cloudflare-Cache, kein Limit), setzt aber eine Domain voraus, die bei Cloudflare verwaltet wird.

➡️ **Die öffentliche Adresse notieren**, also `https://pub-….r2.dev` oder die eigene Domain.

## 2. CORS erlauben

Gleiche Seite → **CORS policy** → **Add CORS policy** bzw. Bearbeiten und Folgendes eintragen:

```json
[
  {
    "AllowedOrigins": ["https://hanse-dev.github.io", "http://127.0.0.1:8799", "http://localhost:8000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

Ohne diesen Eintrag blockiert der Browser den Tiefeneffekt und die Gebäude-Erkennung beim Klicken, weil die
Seite dafür Kacheln per Skript auslesen muss. Die beiden lokalen Adressen sind für Tests auf dem Mac gedacht.

## 3. API-Token für den Upload erstellen

**R2** → **Manage R2 API Tokens** (rechts oben auf der R2-Übersicht) → **Create API token**:

- **Permissions:** Object Read & Write
- **Specify bucket(s):** nur `pixel-map`
- **TTL:** nach Wunsch, z. B. „Forever“ oder ein Jahr
- **Create API Token**

Angezeigt werden eine **Access Key ID** und ein **Secret Access Key**. Der Secret wird nur einmal gezeigt.

## 4. Zugangsdaten sicher auf dem Mac speichern

Die Werte **nicht in den Chat schreiben** und nicht in ein Git-Repository legen. Stattdessen im Terminal
(oder in Claude Code mit vorangestelltem `!`) ausführen. Die Eingabe wird nicht angezeigt:

```sh
mkdir -p ~/.config/pixel-map && \
read -s "?Access Key ID: " A && echo && \
read -s "?Secret Access Key: " S && echo && \
printf 'R2_ACCESS_KEY_ID=%s\nR2_SECRET_ACCESS_KEY=%s\nR2_ENDPOINT=https://0166a19ad0c33caf38a29c0ecf727e6c.r2.cloudflarestorage.com\nR2_BUCKET=pixel-map\n' "$A" "$S" \
  > ~/.config/pixel-map/r2.env && chmod 600 ~/.config/pixel-map/r2.env && echo gespeichert
```

Die Datei `~/.config/pixel-map/r2.env` ist danach nur für deinen Benutzer lesbar.

## 5. Bescheid geben

Mir nur noch die **öffentliche Adresse aus Schritt 1** schicken. Dann:

1. baue ich ein Upload-Skript, das `_site/<stadt>/*_files` nach R2 überträgt, mit passenden Dateitypen und
   langer Cache-Dauer (Kacheln ändern sich nie unter derselben Versionsadresse),
2. stelle ich den Build so um, dass die Seite die Kacheln von der R2-Adresse lädt,
3. teste ich in Chrome, Safari und Firefox,
4. entferne ich die Kacheln erst danach aus dem Git der Website.

## Kosten (Stand der Cloudflare-Preisliste, bitte selbst prüfen)

Laut Cloudflare: 10 GB Speicher pro Monat kostenlos, Datenabruf (Egress) kostenlos, Lese- und Schreibanfragen
mit großzügigem Freikontingent. Eine Stadt belegt nach der WebP-Umstellung etwa 30–40 MB.
