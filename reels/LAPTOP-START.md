# Start-Prompt für den Laptop-Chat (Hamburg-Fakten-Reels)

In Claude Code am Laptop einfügen:

---

Wir machen Hamburg-Fakten-Reels (Hochformat, 20–25 s, Stil: Frage → visueller Vergleich → Auflösung). Vorarbeit liegt im Repo `jamhivemind/news`, Branch `claude/useful-video-content-qtiz31`, Ordner `reels/`:
- `skripte/rathaus.md`: erstes Video (Sprechertext, Szenen, Quellen, Caption)
- `THEMEN.md`: Themenliste mit Prüfstatus
- `render.mjs` + `template.html`: einfacher Renderer ohne Bezahl-Dienste (Playwright + ffmpeg)

Geh in dieser Reihenfolge vor und warte nach jedem Schritt auf mein OK:

1. **Bestand aufnehmen.** Such meine vorhandene Video-Infrastruktur auf diesem Rechner (ElevenLabs, fal.ai, Pexels/Pixabay, Skripte, frühere Kanäle) und den schon erstellten Upload-Plan (2–3 Videos pro Woche). Zeig mir kurz, was es gibt und was davon taugt. Nichts neu bauen, was schon existiert. API-Schlüssel nur aus Umgebungsvariablen, nie in Dateien.
2. **Kostenlose Vorschau.** Bau das Rathaus-Video erst als Entwurf ohne Bezahl-Dienste: Standbilder der 6 Szenen bzw. ein grobes Video mit `reels/render.mjs` (Vorlage um Maßlinien und „STIMMT NICHT“-Badge erweitern), Platzhalter statt Stimme und Stock-Material. Ich will sehen, wie es aussehen wird, bevor Credits verbraucht werden.
3. **Optionen zeigen.** Was ist möglich und was kostet es (Credits/Euro)? Stimmen bei ElevenLabs (2–3 deutsche zur Auswahl, kurze Hörproben), echtes Rathaus-Material von Pexels/Pixabay vs. KI-Bilder über fal.ai, Musik, Untertitel, Übergänge. Gib eine Empfehlung, keine gleichwertige Liste.
4. **Finales Video.** Nach meiner Auswahl richtig schick rendern: Stimme, Material, Musik, Untertitel, Cover-Bild, Caption. Fakten nur aus dem Skript, Quellenzeile bleibt drin. Ergebnis ist upload-fertig.
5. **Upload-Plan festmachen.** 2–3 Uploads pro Woche: die nächsten 4 Wochen konkret mit Themen aus `THEMEN.md` belegen (Fakten vorher prüfen), Termine in meinen Kalender, und im HiveMind ein Projekt „Hamburg-Fakten-Reels“ anlegen (Pipeline, Konten, Plan, offene Punkte), damit das in keinem Chat mehr verloren geht.
6. **Für die Cloud vorbereiten.** Die Pipeline in ein Repo pushen, damit ich Videos künftig auch vom Handy anstoßen kann. Schlüssel kommen dort als Umgebungsvariablen (`ELEVENLABS_API_KEY`, `FAL_KEY`, `PEXELS_API_KEY`) in die Cloud-Umgebung, nicht ins Repo.

---
