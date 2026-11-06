# News-Dashboards

Tägliche News-Dashboards, jeden Morgen kurz auf Deutsch zusammengefasst:
Immobilien Hamburg, Wirtschaft & Zinsen, Hamburg, Startups & Deep Tech.
Die KI-News liegen seit 06.11.2026 ebenfalls hier (Ordner `ki/`); die alte Adresse jamhivemind.github.io/ki-news/ leitet weiter.

**Lesen:** https://jamhivemind.github.io/news/

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
