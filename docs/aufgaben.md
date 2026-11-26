# Aufgaben

Offene Punkte für Pixel Map, die Lübeck-Karte und die Spiele. Stand: 22.11.2026.

## Reihenfolge (Stand 23.11.2026)

**Ohne GPU, nacheinander:**
1. [x] **Barrierefreiheit**: axe-core ohne Befunde (WCAG 2 A/AA), deutsche Screenreader-Texte, Tab-Reihenfolge Leiste → Karte, sichtbarer Fokus, Fokus springt ins Popup und zurück, Vorlesen für alle 94 Gebäude mit Wikipedia-Text (beide Stimmen). Offen: Test mit echtem Screenreader (VoiceOver)
2. [ ] **Statistik ohne Tracking** – eingebaut, wartet auf den GoatCounter-Code (`config/analytics.json`) (keine Cookies, keine personenbezogenen Daten): welche Gebäude, Rundgänge, Spiele genutzt werden
3. [x] **Neue Rundgänge**: „Gänge und Höfe“ (6 zugängliche Gänge/Höfe, Texte aus der Wikipedia-Liste), „Stadtmauer und Tore“ (4,1 km, auch verschwundene Tore), „Rätselrunde für Kinder“ (5 Rätsel mit Quellen; automatisch weiter erst nach gelöstem Rätsel)
4. [x] **Thema „Geschichte“**: Zeitleiste mit Schieberegler (24 Ereignisse, 26 Baujahre, „Damals schon gebaut“), Karte in Sepia, „Früher“-Galerie mit gemeinfreien Bildern aus Commons für 23 Gebäude. Offen: frühere Läden aus der OSM-Versionsgeschichte, mehr Baujahre auf Wikidata
5. [x] **Krimi**: Figuren stehen an ihren Orten (mit Hinweis, wenn es Neues gibt), alle Dialoge vorgelesen (männliche/weibliche Stimme je Person), 🔊 an/aus. Offen: Weg zum nächsten Ort als Linie wie bei den Rundgängen

**GPU, nacheinander:** dritter Ring → Gleise neu → Uferkacheln → Vorlese-Pilot (Chatterbox) → **Nachtfassung** (beleuchtete Fenster, als Ansicht umschaltbar) → **Drehen**: Pilot-Ausschnitt Marienkirche aus Süden, umschaltbar unter Ansicht → Blickrichtung

**Später:**
- [x] Teilen-Link für Gebäude (`#gebaeude=way-123`, Teilen-Knopf im Popup)
- [x] Rundgang offline mitnehmen: „⤓ Offline speichern“ in der Rundgang-Übersicht (Service Worker, Kacheln/Hitmap/Höhen entlang des Wegs, Audio)
- [x] „Wo bin ich?“ (Ansicht): GPS-Standort als Punkt, mit Genauigkeitskreis; Umrechnung im Browser, nichts wird gesendet
- [x] Schnitzeljagd vor Ort: „Vor Ort spielen“ in der Rätselrunde – Antworten erst innerhalb 40 m der Station (GPS, im Browser)
- [ ] Englische Fassung (Texte und Vorlesen)

## Gerade in Arbeit

- [ ] **Dritter Kachelring** malen (80 von 108 Kacheln), prüfen, als neue Kartenversion nach R2 laden und veröffentlichen
- [x] **Seitenleiste** ist Standard (`config/luebeck.json` → `"layout": "seitenleiste"` oder `"klassisch"`; `?seite=0/1` zum Vergleich); Aufklappen schließt die anderen Gruppen; Gedenken: Liste aller Stolpersteine nach Straßen mit Suche
  - [x] Thema, Rundgänge, Orte, Ansicht, Hilfe und Quellen links in einer Leiste; auf dem Handy als Schublade
  - [x] Gebäude-Infos als größeres Popup neben dem angeklickten Gebäude (folgt beim Verschieben, Pfeil zum Gebäude); auf dem Handy als Blatt von unten
  - [x] Laufender Rundgang bleibt oben in der Leiste; auf dem Handy kleine Leiste mit ‹ › ✕ über der Karte
  - [x] **Tabs** oben in der Leiste: Entdecken · Rundgänge · Ansicht · Info (gewählter Tab bleibt gespeichert)
  - [x] **Orte nach Kategorien**: 28 Wahrzeichen plus alle 66 weiteren Gebäude mit Wikipedia-Eintrag in 6 aufklappbaren Kategorien (automatisch eingeordnet, Ausnahmen in `config/luebeck.json` → `category_overrides`)
  - [x] **Suche** nach Gebäudenamen und Adressen (16.000 Gebäude), Taste `/`

## Piloten (24.11.2026, zur Entscheidung)

- Nachtfassung (outputs/night-pilot): sehr gut – ganze Karte ≈ 400 Fenster, mehrere Nächte
- Drehen, Blick von Süden (outputs/south-pilot): stimmig – pro Richtung eine ganze Karte
- Leere Straßen: ganze Karte fertig und online (26.11.)
- Nachtfassung ganze Karte: läuft seit 26.11. 07:13 (391 Fenster, ≈ 33 h), Basis ist die Karte mit leeren Straßen
- Hörprobe Chatterbox: ~Desktop/stimmen-vergleich (je ~5 Min. Rechenzeit pro 40 s Audio)

## Digitaler Zwilling

- [x] Pilot 3D (`app/3d.html`): amtliche LoD2-Gebäudemodelle (LVermGeo SH, CC BY 4.0) der Kachel Altstadt-Mitte, 1.642 Gebäude, drehbar, Sonnenstand mit Schatten
- [x] Innenstadt (Altstadtinsel, OSM-Stadtteilgrenze): 4.300 Gebäude, Gelände (DGM), Wasser, Gebäude anklickbar (3.720 mit Pixelkarten-Infos), Startseite verlinkt
- [x] Dachfarben aus dem Luftbild (DOP20)
- [ ] Wahrzeichen hervorheben, Rundgänge in 3D

## Website / UX

- [x] **Leben auf der Straße** (Ansicht): Autos auf Fahrstraßen, Menschen auf Wegen und Plätzen, verdeckt durch Gebäude; aus bei „Bewegung reduzieren“, im Gedenken und beim Tiefeneffekt
- [x] Gemalte Autos entfernen: alle Straßen auf der GPU neu gemalt (378 Fenster, fertig 26.11.), veröffentlicht als Kacheln 859bb2b36ae9-9a507a, Sicherung luebeck-v4. Außerhalb der Straßenmaske kein Pixel verändert. Rest: einzelne Autos am Straßenrand, auf Parkplätzen und Brücken, wo die Maske nicht hinreicht
- [ ] Später: Busse auf Buslinien, Züge auf Gleisen, Schiffe auf der Trave

- [x] **Rundgänge überarbeitet**: 4 neue Rundgänge mit rotem Faden (Hanse · Hauptkirchen · Kaufmannshäuser/Thomas Mann/Willy Brandt · Klöster und Herbergen), Reihenfolge nach echten Fußwegen; Weg als Linie entlang der Straßen mit nummerierten Stationen; Übersicht vor dem Start mit Länge und Gehzeit; Fortsetzen bei der letzten Station; Abschluss mit Vorschlag für den nächsten
- [x] Rundgang-Wege folgen Straßen statt Gängen; hinter Häusern verdeckte Stücke zart gestrichelt
- [x] **Vorlesen**: jede Station als Audio (Piper, Stimme Thorsten, lokal erzeugt, in R2); Player mit ⏮ ⏯ ⏭, Timer, Fortschritt, „Automatisch weiter“ mit Countdown; Taste K
- [ ] **Vorlesen mit Chatterbox Multilingual** (entschieden statt Speechify/Azure/Google): vorbereitet in `~/MyStuff/models/chatterbox` (Umgebung, `speak.py`, Referenzen Kerstin CC0 und Thorsten CC BY 4.0, siehe `refs/SOURCES.md`). Wenn die GPU frei ist: Hörprobe Holstentor, dann alle ~58.000 Zeichen in zwei Stimmen neu, Namensnennung „Thorsten-Voice“ ergänzen
- [x] Stimmenauswahl männlich/weiblich (`config/luebeck.json` → `voices`)
- [ ] Vorlesen: Aussprache prüfen (Namen, Jahreszahlen), ggf. eigene Texte statt Wikipedia-Einleitung
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
- [x] Bahnhof in 4-facher Vergrößerung neu gemalt (Gleisfeld, Bahnsteige, Brücke am Bahnhof)
- [ ] **Brücken über die Gleise** (Schienen in Straßenrichtung): erster Lauf verworfen, die Maske traf bewaldete Bahndämme; neue Maske aus OSM bridge=yes-Straßen statt Höhe
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
