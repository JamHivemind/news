# Reels: Hamburg-Fakten als Hochformat-Video

Kurze Erklär-Videos (1080x1920, ca. 16 s, ohne Ton lesbar) im Stil „Frage → Vergleich → Auflösung“.

```
reels/specs/<name>.json   ein Video = eine Datei (Titel, Werte, Badges, Vergleich, Quelle, Caption)
reels/template.html       Layout und Animation (renderAt(t) ist deterministisch)
reels/render.mjs          rendert Bild für Bild mit Playwright und packt mit ffmpeg zu MP4
reels/out/                Ergebnis: <name>.mp4 und Cover <name>.jpg (nicht im Repo)
```

## Rendern

```
node reels/render.mjs bruecken
```

Voraussetzungen: Node 18 oder neuer, Playwright mit Chromium, ffmpeg. Der News-Build braucht das alles nicht.

## Neues Video

`specs/bruecken.json` kopieren und anpassen. Pflicht ist eine Quelle im Feld `source`: Jede Zahl im Video muss belegbar sein.
2 bis 4 Einträge in `items` passen nebeneinander. `compare` (zweite Szene) ist optional.
