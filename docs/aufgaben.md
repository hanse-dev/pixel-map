# Aufgaben

Offene Punkte für Pixel Map und die Lübeck-Karte. Erledigtes nach unten verschieben oder löschen.

## Website / UX

- [ ] **Rundgänge UX überarbeiten**
  - Einstieg: Rundgänge sind im Orte-Menü versteckt; eigener Einstieg, z. B. Karte mit Rundgang-Kacheln beim ersten Besuch oder im Thema „Entdecken“
  - Übersicht vor dem Start: Einleitung, Stationen als Liste, Länge, Weg auf der Karte
  - Weg zwischen den Stationen als Linie entlang der Straßen (`walkable.json`) statt nur Luftlinie und Richtung
  - Steuerung während des Rundgangs: deutliche Weiter/Zurück-Knöpfe im Panel, nicht nur ‹ › unten; Station x von y sichtbar am Panel
  - Info-Panel und Rundgang-Leiste überlagern sich nicht; auf dem Handy Panel als unteres Blatt
  - Ende des Rundgangs: Abschluss mit Zusammenfassung, Vorschlag für den nächsten Rundgang
  - Fortschritt merken (zuletzt besuchte Station)
- [ ] **Thema „Geschichte“** fertigstellen: Zeitleiste (Daten in `config/timeline.luebeck.json`), „Was war hier?“ aus der OSM-Versionsgeschichte, historische Fotos von Commons
- [ ] Auf echtem Handy und Tablet testen (bisher nur Desktop-Browser-Engines)
- [ ] Favicon ergänzen (vermeidet eine 404 in Chrome)

## Karte Lübeck

- [ ] **Bahnhof:** Gleise im westlichen Teil des zweiten Rings nachmalen (der Gleis-Nachmalgang lief nur im ersten Ring; harte Kante am alten Kartenrand)
- [ ] **Bahnhofsgebäude:** die knallblaue Fassade stammt aus einer OSM-Farbangabe; prüfen und gedämpft korrigieren
- [ ] **Kleingärten:** Renderer erkennt sie jetzt als Grün (isometric-cities `e99c936`); betroffene Kacheln neu malen (unten Mitte: orange Sandfläche bzw. unbemalte graue Fläche)
- [ ] Marienkirche: Hauptdach blass graugrün statt Kupfer
- [ ] Zweiten Ring durchsehen, veröffentlichen, danach `scripts/update_city.sh luebeck`
- [ ] Backup `luebeck-v2` (Kartenpaket + Kachelspeicher) im Repo `pixel-map-luebeck`

## Infrastruktur

- [ ] **Cloudflare R2** einrichten (Anleitung: `docs/cloudflare-r2-einrichten.md`), dann Kacheln dorthin und aus dem Git-Verlauf entfernen
- [ ] Entscheidung: monatliche automatische Aktualisierung der Wikipedia-Daten als Pull Request (braucht ausdrückliche Freigabe)

## Spiel (`pixel-map-game`)

- [ ] Gemeinsame Basis: Kartenpaket laden, Figur auf `walkable.json`, Gebäude-Klick, Dialoge
- [ ] Prototyp Hanse-Wirtschaftssimulation
- [ ] Prototyp Krimi
- [ ] Prototyp Zeitreise (nutzt die Zeitleisten-Daten)

## Geschichte einzelner Häuser (Ideen)

- [ ] „Was war hier?“: Läden und Betriebe aus der OSM-Versionsgeschichte
- [ ] Wikipedia-Artikel zu einzelnen Häusern über die Adresse finden
- [ ] Historische Fotos und Postkarten von Commons
- [ ] Optional, aufwendig: historische Lübecker Adressbücher (ca. 1800–1950)
