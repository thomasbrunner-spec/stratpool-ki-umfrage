# Projektstatus – stratpool-ki-umfrage

> Wiedereinstiegspunkt für die nächste Session. Stand: **2026-10-22**
> Repo: https://github.com/thomasbrunner-spec/stratpool-ki-umfrage (öffentlich – keine Kundendaten!)

## Stand
- [x] Briefing, Projekt-CLAUDE.md, Fragebogen-Entwurf v0.1 (aus Claude-Session übergeben)
- [x] Fragebogen v0.2 mit Thomas abgestimmt (18 Screens, Quiz durch Nutzungstiefe-Frage ersetzt) → `survey/humantech-2026.json`
- [x] Repo angelegt + Gerüst (Express 5/SQLite/React 19/Vite, TS strict, Dockerfile, CI)
- [x] Teilnehmer-Flow (Einladungslink + Passwort/Selbstregistrierung, Profil, 1 Frage/Screen, Autosave, Zusammenfassung, Abschluss, Stichtag-Sperre)
- [x] Admin: Projekte, Teilnehmende (CSV-Import, Links, Status, Einladungs-/Erinnerungstexte), Dashboard mit Filtern, Einzelansicht, Export XLSX/CSV/JSON, Löschen
- [x] Präsentationsmodus (ERA-CI, 14 Folien, Tastatur, Übersicht, Vollbild, PDF-Druck, Folien ein/aus, Kommentar, Namen je Folie, Mindestgruppe)
- [x] KI-Zusammenfassung Freitexte (Claude Opus 5.5, Namen vorher entfernt, editierbar) – **nur mit Mock getestet**, Live-Test steht aus
- [x] Test mit Fake-Daten (`npm run seed:fake`), 42 Vitest-Tests grün, Docker-Image lokal gebaut und gestartet
- [ ] Review der Präsentation mit Thomas
- [ ] Deploy auf Coolify (`umfrage.stratpool.pro`) – siehe DEPLOYMENT.md
- [ ] Live-Test KI-Zusammenfassung mit echtem `ANTHROPIC_API_KEY` (Demo-Projekt)
- [ ] Echte Teilnehmer importiert, Einladung verschickt

## Offene Entscheidungen (Thomas)
- Workshop-Termin und Stichtag (Feldzeit ≥ 10 Werktage + Erinnerung) → im Projekt eintragen, erscheinen in Begrüßung/Abschluss
- Zugang: persönliche Links (empfohlen) oder gemeinsames Passwort – in den Projekteinstellungen umschaltbar
- Subdomain final (`umfrage.stratpool.pro`?)
- Offizielle Namen der Gesellschaften (aktuell aus CSV abgeleitet; im Admin änderbar)
- Absender der Einladung (Kunde oder ERA) – Textentwürfe im Admin unter „Einladungs- & Erinnerungstexte“
- Stufentexte AI-Native (Frage 8/9): wörtlich von Folie 9; optionale Erläuterung je Stufe über Feld `hint` in `survey/humantech-2026.json`
- Matrix-Quadranten heißen jetzt Beobachter · Starter · Kritische Kenner · Treiber (statt „Skeptiker“) – bitte bestätigen
- **Datenschutzinformation** (`src/participant/Privacy.tsx`) ist ein Entwurf – vor Versand prüfen (lassen), v. a. Aussagen zu Anthropic und Speicherdauer

## Wichtige Gotchas ⚠️
1. **`JWT_SECRET` ist Pflicht**, sonst Exit 1. Lokal in `.env`, in Coolify als Env-Var.
2. **Lokale Ports:** 3000 ist durch Docker belegt → API 3210, Vite 5180 (`API_PORT`/`WEB_PORT`).
3. **Passwort-Modus:** Wiedereinstieg auf neuem Gerät nur für *selbst registrierte* Personen (Name + Gesellschaft). Eingeladene Personen kommen nur über ihren Link an ihre Antworten – sonst könnte jeder mit dem gemeinsamen Passwort fremde Antworten öffnen. Folge: Wer eingeladen ist und trotzdem den Passwort-Weg nimmt, wird als neue Person angelegt („selbst registriert“ in der Liste).
4. **Schriften** kommen per `@fontsource` vom eigenen Server (kein Google-Fonts-Aufruf, DSGVO).
5. **Fragebogen-Änderungen** nur in `survey/*.json` und nur nach Freigabe; Fragen-IDs nicht umbenennen, solange Antworten existieren.
6. Stichtag gilt bis 23:59 Uhr Europe/Berlin (Container-TZ gesetzt).
7. `BRIEFING.md` und `docs/kontext/` sind gitignored (Namen, Vertragsdaten).

## Lokal starten
```bash
npm install && cp .env.example .env   # JWT_SECRET eintragen
npm run seed:fake                     # Demo-Projekt "demo", Passwort "demo"
npm run dev                           # http://localhost:5180 (Admin: /admin)
```
