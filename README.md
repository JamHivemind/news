# News-Dashboards

Tägliche News-Dashboards, jeden Morgen kurz auf Deutsch zusammengefasst:
Immobilien Hamburg, Wirtschaft & Zinsen, Hamburg, Startups & Deep Tech.
Seit 06.11.2026 gibt es auch den Welt-Monitor (Ordner `welt/`: Globus, Brennpunkte, Hamburg-Bezug, Quellen von links bis rechts). Die KI-News liegen seit 06.11.2026 ebenfalls hier (Ordner `ki/`); die alte Adresse jamhivemind.github.io/ki-news/ leitet weiter.

Seit 12.11.2026 gibt es außerdem **Autos & Klassiker** (Ordner `autos/`, mit dem Vergleich „Modelle im Blick“) und
**Recht & Verbraucher** (Ordner `recht/`).

**Lesen:** https://jamhivemind.github.io/news/

## Modelle im Blick (Autos)

`autos/config.json` → `modelle`: Vergleichstabelle und eine Karte je Modell.

- **Marktdaten:** `scripts/markt.mjs` wertet einmal pro Woche öffentliche Inserate auf AutoScout24 aus und speichert nur
  Kennzahlen (Anzahl, Median, mittlere Hälfte, typische Laufleistung) in `autos/data/markt.json`. Je Modell legen
  `as24.path`, `mit`, `ohne` und `variante` fest, welche Inserate zählen. Abschalten: `modelle.abruf` auf `false`.
  Erzwingen: `node scripts/markt.mjs --force`.
- **In Hamburg angeboten:** Händlerangebote (nie Privatverkäufer) mit PLZ 20–22 oder 253/254 aus denselben
  AutoScout24-Daten, dazu die Elferspot-Seiten der Händler in `modelle.haendler` (nur Fahrzeuge, deren Adresse zu
  `lokal.elferspot` passt). `lokal.mit`/`lokal.ohne` erlauben einen weiteren Filter (z. B. beim 993 Turbo S alle 993 Turbo
  zum Vergleich), `lokal.titel` die Überschrift. Doppelte (gleicher Preis, Jahr, km) erscheinen nur einmal.
- **Preisband:** von Hand gepflegt (`preisband`, neuester Eintrag zuletzt, mit `stand`, `von`, `bis`, `trend`, `quelle`).
- **News:** `news` ist ein Suchmuster; passende Meldungen der Ausgabe erscheinen auf der Karte.

## Aufbau

```
<dashboard>/config.json   Titel, Rubriken, Quellen, Namen fürs Zählen, Kennzahlen
<dashboard>/content.json  Tagesausgabe (schreibt die Claude-Code-Routine)
<dashboard>/data/         Kennzahlen (schreibt scripts/metrics.mjs)
<dashboard>/archive/      alle Ausgaben
scripts/build.mjs         baut alle Dashboards und die Startseite
scripts/metrics.mjs       holt Börsenkurse (Yahoo Finance) und Zinsen (EZB)
```

Ablauf: Die Routine schreibt morgens je Dashboard `content.json` und pusht. Die GitHub Action holt die
Kennzahlen, baut alle Seiten und GitHub Pages zeigt sie an.

Neues Dashboard: Ordner mit `config.json` anlegen (wie die vorhandenen), fertig. Die Routine und die
Startseite finden es von selbst.

## Lokal bauen

```
node scripts/metrics.mjs
node scripts/build.mjs
```

Keine Abhängigkeiten, Node 18 oder neuer.

## Herkunft

Aufbau nach [junjzhang/daily-brief](https://github.com/junjzhang/daily-brief) (MIT-Lizenz), erweitert auf
mehrere Dashboards mit Kennzahlen.

## Feedback
`site.json` → `feedback`: Link zum Google-Formular. Leer = kein Feedback-Kasten. Steht im Link das Wort `DASHBOARD`
(vorausgefüllter Link aus Google Forms), wird es durch den Namen des Dashboards ersetzt.
