# Aufgaben

Offene Punkte für Pixel Map, die Lübeck-Karte und die Spiele. Stand: 22.11.2026.

## Gerade in Arbeit

- [ ] **Dritter Kachelring** malen (80 von 108 Kacheln), prüfen, als neue Kartenversion nach R2 laden und veröffentlichen
- [ ] **Seitenleiste** (zum Ausprobieren: `?seite=1`), danach als Standard
  - [x] Thema, Rundgänge, Orte, Ansicht, Hilfe und Quellen links in einer Leiste; auf dem Handy als Schublade
  - [x] Gebäude-Infos als größeres Popup neben dem angeklickten Gebäude (folgt beim Verschieben, Pfeil zum Gebäude); auf dem Handy als Blatt von unten
  - [x] Laufender Rundgang bleibt oben in der Leiste; auf dem Handy kleine Leiste mit ‹ › ✕ über der Karte
  - [x] **Tabs** oben in der Leiste: Entdecken · Rundgänge · Ansicht · Info (gewählter Tab bleibt gespeichert)
  - [x] **Orte nach Kategorien**: 28 Wahrzeichen plus alle 66 weiteren Gebäude mit Wikipedia-Eintrag in 6 aufklappbaren Kategorien (automatisch eingeordnet, Ausnahmen in `config/luebeck.json` → `category_overrides`)
  - [x] **Suche** nach Gebäudenamen und Adressen (16.000 Gebäude), Taste `/`

## Website / UX

- [x] **Rundgänge überarbeitet**: 4 neue Rundgänge mit rotem Faden (Hanse · Hauptkirchen · Kaufmannshäuser/Thomas Mann/Willy Brandt · Klöster und Herbergen), Reihenfolge nach echten Fußwegen; Weg als Linie entlang der Straßen mit nummerierten Stationen; Übersicht vor dem Start mit Länge und Gehzeit; Fortsetzen bei der letzten Station; Abschluss mit Vorschlag für den nächsten
- [ ] Rundgänge: eigene Überleitungstexte zwischen den Stationen (bisher erster Satz der Wikipedia-Einleitung im Popup); weitere Themen (z. B. Gänge und Höfe, Stadtmauer und Wälle)
- [x] **Tiefeneffekt**: doppelt so stark, schwenkt von selbst wenn die Maus ruht (und auf dem Handy), Umrisse/Hervorhebung währenddessen aus, Hinweis beim Einschalten
- [ ] Tiefeneffekt: Schlieren hinter hohen Türmen (dort ist nichts gemalt); evtl. Hintergrund aus Nachbarpixeln auffüllen
- [ ] **Karte drehen**: vier feste Blickrichtungen (N/O/S/W), je eine eigene gemalte Karte, Umschalten in der Ansicht. Erst Pilot: 1024er-Ausschnitt um die Marienkirche aus Süden neben der heutigen Ansicht (startet nach dem dritten Ring, die GPU ist bis dahin belegt)
- [ ] **Thema „Geschichte“** fertigstellen: Zeitleiste (Daten in `config/timeline.luebeck.json`), „Was war hier?“ aus der OSM-Versionsgeschichte, historische Fotos von Commons
- [ ] Auf echtem Handy und Tablet testen (bisher nur Desktop-Browser-Engines), auch WebGL
- [ ] Chrome: feine helle Haarlinien an Kachelgrenzen bei Zwischen-Zoomstufen prüfen
- [ ] Favicon für die Karte ergänzen (vermeidet eine 404 in Chrome)

## Karte Lübeck

- [ ] **Uferkacheln neu malen**: der Renderer glättet jetzt Infrarot-Ufer und setzt keine Bäume mehr ins Wasser (isometric-cities `6cfff3f`, `c1840c1`); die schon gemalten Kacheln mit Wasser-Sprenkeln (Wakenitz, Wallanlagen) und dunklen „Bäumen“ an Brücken neu malen
- [ ] **Bahnhofsgebäude:** die knallblaue Fassade stammt aus einer OSM-Farbangabe; prüfen und gedämpft korrigieren
- [ ] Marienkirche: Hauptdach blass graugrün statt Kupfer
- [ ] „Geistergleise“: verblasste Gleise am Übergang östlich vom Bahnhof
- [ ] **Theater Lübeck**: die Front im Pixelbild entspricht nicht dem Wikipedia-Foto; als Wahrzeichen mit Fotoreferenz nachmalen (wie Rathaus)
- [ ] **Dom**: linker Turmschaft im Bild neben der Geometrie gemalt (Hervorhebung erfasst ihn nicht) – als Wahrzeichen neu malen
- [ ] Weitere Wahrzeichen aus mehreren OSM-Gebäuden prüfen und in `config/luebeck.json` → `groups` zusammenfassen (Rathaus erledigt)
- [ ] Backup `luebeck-v3` (dritter Ring) im Repo `pixel-map-luebeck`

## Spiele (`pixel-map-game`)

- [ ] Feedback zu Krimi, Hanse-Kaufmann und Quiz einarbeiten
- [ ] Figuren an den Orten zeigen; Musik/Geräusche
- [ ] Auf dem Handy testen (Steuerung, Lesbarkeit)
- [ ] Optional: Zeitreise-Spiel (nutzt die Zeitleisten-Daten)

## Infrastruktur

- [ ] Entscheidung: monatliche automatische Aktualisierung der Wikipedia-Daten als Pull Request (braucht ausdrückliche Freigabe)
- [ ] GitHub zeigt für `pixel-map` noch 848 MB; falls das nach einigen Tagen nicht sinkt, GitHub-Support um Bereinigung bitten

## Geschichte einzelner Häuser (Ideen)

- [ ] „Was war hier?“: Läden und Betriebe aus der OSM-Versionsgeschichte
- [ ] Wikipedia-Artikel zu einzelnen Häusern über die Adresse finden
- [ ] Historische Fotos und Postkarten von Commons
- [ ] Optional, aufwendig: historische Lübecker Adressbücher (ca. 1800–1950)

## Erledigt (zuletzt)

- [x] Hervorhebung der Gebäude geschlossen: Lücken bis 10 px (Wände, Boden zwischen Strebepfeilern) in der Klick-Karte gefüllt; Rathaus aus 6 OSM-Teilen als ein Gebäude

- [x] Zentrale Startseite: Karte, Rundgänge, Gedenken und Spiele an einer Stelle; Direktlinks `?tour=…` und `?theme=…`; ⌂ in der Karte
- [x] Cloudflare R2: Kacheln liegen in R2, Website und Spiele laden sie von dort
- [x] Repo verkleinert: Git-Verlauf von 848 MB auf 32 MB (Sicherung unter `~/MyStuff/backups/`)
- [x] Spiele: gemeinsame Basis, Krimi „Die Marzipan-Krone“, Hanse-Kaufmann (1400), Lübeck-Quiz; online unter hanse-dev.github.io/pixel-map-game
- [x] Karten-Durchsicht auf Artefakte; Renderer-Korrektur für Ufer und Wasser
- [x] WebGL-Kartenebene standardmäßig an (`?gl=0` als Rückfall); keine schwarzen Flecken beim Zoomen
- [x] Zweiter Ring mit Bahnhofsgleisen und Kleingärten veröffentlicht; Backup `luebeck-v2`
