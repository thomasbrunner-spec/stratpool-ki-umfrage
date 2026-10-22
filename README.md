# KI-Umfrage

Passwortgeschützte Online-Umfrage zu KI-Reifegrad, Nutzung, Potenzialen und Erwartungen vor KI-Strategie-Workshops.
Die Auswertung lässt sich als Präsentation im ERA-CI direkt im Workshop zeigen.

- **Teilnehmende:** persönlicher Einladungslink (`/t/<token>`) oder gemeinsames Passwort mit Selbstregistrierung (`/u/<kurzname>`),
  eine Frage pro Screen, Autosave, Fortsetzen jederzeit, mobil nutzbar.
- **Admin (`/admin`):** Projekte, Teilnehmende (CSV-Import, Links, Status, Einladungs- und Erinnerungstexte), Live-Dashboard mit Filtern,
  Einzelansicht je Person, KI-Zusammenfassung der Freitexte, Export (XLSX, CSV, JSON), Löschung nach Projektende.
- **Präsentation:** Folien aus `survey/*.json` (`deck`), Pfeiltasten, `O` Übersicht, `F` Vollbild, Druck → PDF (eine Folie pro Seite),
  Folien ein-/ausblendbar, Moderatoren-Kommentar, Namen bei Zitaten je Folie schaltbar, gefilterte Ansichten erst ab Mindestgruppengröße.

## Stack

Node 22 · Express 5 · SQLite (better-sqlite3, WAL) · React 19 + Vite · TypeScript strict · Anthropic SDK · ein Docker-Container.
Fragebogen als JSON-Definition in `survey/` (Fragetypen, Skalen, KI-Ziele, Foliengliederung).

```
server/   Express-API (auth, participant, admin, export, ai, db)
shared/   Typen, Validierung, Aggregation, CSV, Pseudonymisierung (Server + Client)
src/      React: Teilnehmer-Flow, Admin, Charts, Präsentation
survey/   Fragebogen-Definitionen
tests/    Vitest
```

## Lokal

```bash
cp .env.example .env          # JWT_SECRET setzen, ggf. ADMIN_PASSWORD und ANTHROPIC_API_KEY
npm install
npm run seed:fake             # optional: Demo-Projekt "demo" mit 17 fiktiven Personen (Passwort: demo)
npm run dev                   # API :3210, Web :5180 (Port 3000 ist lokal durch Docker belegt)
npm test                      # Vitest
```

Deployment: siehe [DEPLOYMENT.md](DEPLOYMENT.md).

**Keine Kundendaten committen** – Teilnehmerlisten, Antworten und Kontextunterlagen gehören nicht ins Repo (`.gitignore`).
