# Entwurf: Zeitleiste und Rundgänge

Stand: Entwurf zur Diskussion. Nichts davon ist im Viewer freigeschaltet.

## 1. Rundgänge

Daten: `config/tours.luebeck.json`. Jede Station verweist auf ein Gebäude über seine Wikidata-ID.
Im Viewer würde ein Rundgang so ablaufen:

1. Auswahl im Orte-Menü (☷) unter „Rundgänge“.
2. Die Karte fährt von Station zu Station (wie die bestehende Tour), das Gebäude wird türkis markiert
   und das Info-Panel öffnet sich mit Foto und Wikipedia-Text.
3. Zwischen den Stationen: Richtung und Luftlinie zur nächsten Station, z. B. „≈ 430 m nach Nordosten“.
   Diese Angaben sind aus OSM-Koordinaten **berechnet**, nicht geschrieben.
4. Optional: der Weg auf der Karte als gestrichelte Linie entlang des Straßengraphs (`walkable.json`)
   statt Luftlinie.

Texte: Die Stationstexte sind die Wikipedia-Einleitungen (mit Quellenangabe). Eigene Texte gibt es nur als
Rundgang-Einleitung ohne Faktenbehauptungen. Wer eigene inhaltliche Texte schreiben will, kann sie pro
Station ergänzen (Feld `text`) – dann mit eigener Quelle.

### Die Türme der Altstadt (5 Stationen, ≈ 1.6 km Luftlinie)

Ein Rundgang entlang der Kirchtürme, die Lübecks Silhouette prägen – von Süden nach Norden.

Lübecker Dom → Aegidienkirche → Petrikirche → Marienkirche → Jakobikirche

### Hanse, Handel und Salz (6 Stationen, ≈ 2.8 km Luftlinie)

Vom westlichen Stadttor über Speicher und Kaufmannshäuser zum Rathaus und zum Hafen.

Holstentor → Salzspeicher → Kornspeicher Die Eiche → Haus der Kaufmannschaft → Lübecker Rathaus → Schuppen 10/11

### Bürgerhäuser und Nobelpreisträger (5 Stationen, ≈ 1.0 km Luftlinie)

Wohn- und Geschäftshäuser der Kaufmannsfamilien – und zwei Häuser, die heute an Nobelpreisträger erinnern.

Buddenbrookhaus → Schabbelhaus → Löwen-Apotheke → Willy-Brandt-Haus Lübeck → Behnhaus

### Klöster, Stifte und Herbergen (4 Stationen, ≈ 1.1 km Luftlinie)

Orte der Fürsorge und des geistlichen Lebens, verteilt über die Altstadt.

Kranen-Konvent → Katharinenkirche → St.-Johannis-Kloster → Gertrudenherberge

**Offen:**
- Die Auswahl ist ein Vorschlag nach Bekanntheit und Datenlage (alle Stationen haben Foto und Text).
- Das Heiligen-Geist-Hospital, die Schiffergesellschaft und das Günter-Grass-Haus fehlen, weil sie im
  Kartenpaket keinen Wikidata-Eintrag tragen. Sie ließen sich in OSM bzw. im Paket nachtragen.
- Reihenfolge: nach Lage optimiert, nicht nach Geschichte.

## 2. Zeitleiste

### Was die Daten hergeben

- **Gebäudealter flächendeckend: nein.** Nur 26 von 5.618 Gebäuden haben in OSM oder Wikidata ein Baujahr
  (3 % der Bildfläche). Eine „Altersfärbung“ aller Häuser wäre fast leer.
- **Wahrzeichen: ja.** 21 Gebäude mit Infos haben ein Datum auf Wikidata:

| Datum | Gebäude | Wikidata |
|---|---|---|
| 1173 | Lübecker Dom | `Q3916007` |
| 1227 | Aegidienkirche (Lübeck) | `Q316973` |
| 1227 | Jakobikirche (Lübeck) | `Q375042` |
| 1283 | Kranen-Konvent | `Q1786466` |
| 14. Jh. | Katharinenkirche (Lübeck) | `Q317388` |
| 14. Jh. | Marienkirche (Lübeck) | `Q695065` |
| 1444 | Burgtor (Lübeck) | `Q538276` |
| 1749 | An der Mauer 154 | `Q482579` |
| 1758 | Buddenbrookhaus | `Q315187` |
| 1783 | Behnhaus | `Q814533` |
| 1812 | Löwen-Apotheke (Lübeck) | `Q1879877` |
| 1824 | Progymnasium Dr. Bussenius | `Q18629959` |
| 1880 | Synagoge Lübeck | `Q1494883` |
| 1891 | Propsteikirche Herz Jesu | `Q880381` |
| 1908 | Theater Lübeck | `Q2415873` |
| 1913 | Falkenplatz 10 | `Q140571655` |
| 1940 | Bunker An der Obertrave | `Q51247046` |
| 1973 | Friedenskirche | `Q99735520` |
| 1994 | Musik- und Kongresshalle Lübeck | `Q1954986` |
| 1998 | Landesamt für Arbeitsschutz, Soziales und Gesundheit | `Q1802073` |
| 2007 | Willy-Brandt-Haus Lübeck | `Q2581800` |

  Lücken: Für Rathaus, Holstentor, Petrikirche und Salzspeicher fehlt das Datum auf Wikidata, obwohl es in
  den Wikipedia-Texten steht. Diese Daten müssten einmal von Hand mit Quelle nachgetragen werden
  (am besten direkt auf Wikidata, dann profitieren alle).
- **Denkmalschutz: ja.** 195 Gebäude tragen in OSM eine Denkmal-Angabe, 65 von 77 Wahrzeichen auf Wikidata.

### Vorschlag

**A – Ereignis-Zeitleiste (empfohlen für den Anfang).** Ein Regler am unteren Rand von 1143 bis heute.
Darüber kleine Marken für Ereignisse. Wird ein Zeitpunkt gewählt,
- werden Gebäude, die es zu diesem Zeitpunkt schon gab, normal gezeigt und alle anderen Wahrzeichen
  ausgegraut (nur bei Gebäuden mit bekanntem Datum),
- erscheint eine kurze Ereigniskarte mit Datum, einem Satz und Quellenlink.

Ereignisse kommen aus belegten Quellen (Wikipedia-Artikel „Geschichte der Hansestadt Lübeck“, Wikidata).
Ich würde sie als eigene Datei `config/timeline.luebeck.json` pflegen, jedes Ereignis mit Quelle. Die
Liste stelle ich bewusst nicht aus dem Gedächtnis zusammen, sondern aus den Artikeln mit Zitat-Link.

**B – Historische Karte als Überblendung (später).** Wikimedia Commons hat gemeinfreie Stadtpläne Lübecks.
Ein Plan würde georeferenziert und mit dem Regler über die Pixelkarte geblendet („damals / heute“). Das
erfordert Handarbeit beim Ausrichten, wirkt aber stark.

**C – Denkmal-Ebene (schnell).** Statt Alter: alle denkmalgeschützten Gebäude hervorheben, mit Plakette im
Panel. Die Daten liegen vor (195 Gebäude).

## 3. Reihenfolge

1. Rundgänge im Viewer freischalten (Daten liegen vor) – etwa eine Stunde.
2. Denkmal-Ebene (C) – gering.
3. Ereignis-Zeitleiste (A) mit belegter Ereignisliste – die Recherche ist der größere Teil.
4. Historische Karte (B), wenn gewünscht.
