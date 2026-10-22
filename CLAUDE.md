# Projekt: stratpool-ki-umfrage

> Ergänzt die globale `~/.claude/CLAUDE.md`. Was hier steht, **überschreibt** die globalen Defaults.
> **Vor dem ersten Code: `BRIEFING.md` vollständig lesen.** Dort stehen Auftrag, Anforderungen und getroffene Entscheidungen.

## Über dieses Projekt

**Name:** KI-Umfrage (Reifegrad- und Erwartungsbefragung vor KI-Strategie-Sprints)
**Zweck:** Passwortgeschützte Online-Umfrage für Workshop-Teilnehmer + Admin-Auswertung, die sich als Präsentation im Workshop zeigen lässt.
**Erster Einsatz:** HumanTech Spine GmbH (ERA-Mandat, Phase 1 „Vorbereitung“, Baustein „Online-Befragung“)
**Repo:** `thomasbrunner-spec/stratpool-ki-umfrage` (noch anzulegen)
**Subdomain:** `umfrage.stratpool.pro` (Vorschlag – vor DNS-Anlage mit Thomas bestätigen)
**Status:** In Konzeption → Fragebogen-Freigabe ausstehend

## Was bei diesem Projekt anders ist

1. **UI im ERA-CI, nicht im StratPool-CI.** Bewusste Ausnahme zu ADR-001/ADR-002: Die Umfrage ist ein *kundenseitiger Output*
   (Teilnehmer sind Mitarbeitende des ERA-Kunden). Teilnehmer- **und** Admin-/Präsentationsansicht im ERA-Design.
   Als ADR-013 in `DECISIONS.md` dokumentieren.
2. **Schlanker Stack wie `zeiterfassung`** (bewusst abweichend vom Standard, Vorbild: `thomasbrunner-spec/zeiterfassung`):
   Node.js + Express, SQLite (better-sqlite3, WAL) im Volume `/app/data`, React + Vite, JWT im httpOnly-Cookie + bcrypt,
   **ein** Dockerfile, Deploy via Coolify. Kein Supabase – Datenmenge klein (≈ 20 Personen), Daten bleiben in einer Datei.
   Falls du starke Gründe für den Standard-Stack siehst: Thomas mit Option A/B fragen, nicht stillschweigend wechseln.
   TypeScript ist erwünscht (strict).
3. **Repo ist öffentlich!** Keine Kundendaten committen: Teilnehmerliste, Kontextdokumente und Antworten
   (`docs/kontext/`, `data/`, `.env`) stehen in `.gitignore`. Teilnehmer werden im Admin-Bereich per CSV-Upload oder
   Formular angelegt, nie im Code geseedet.
4. **Mandantenfähig light:** Eine Umfrage-Instanz = ein „Projekt“ (Kunde, Gesellschaften, Fragebogen-Version).
   HumanTech ist Projekt Nr. 1; die App soll für künftige Sprints wiederverwendbar sein. Fragebogen als JSON-Definition,
   nicht hart in Komponenten.
5. **LLM:** Anthropic SDK (Node) für die KI-Zusammenfassung der Freitexte, `ANTHROPIC_API_KEY` als Coolify-Env-Var.

## ERA-CI (aus dem `era-html-presentation`-Skill)

| Token | Hex | Einsatz |
|---|---|---|
| `--navy` | `#00356A` | Hintergrund |
| `--navy-deep` | `#00244A` | Verläufe |
| `--panel` | `#0B2E55` | Karten |
| `--line` | `#1B4677` | Rahmen |
| `--orange` | `#FD9A00` | Akzent, Hervorhebung, Highlight-Wert |
| `--ink` / `--ink-2` / `--ink-3` | `#FFFFFF` / `#C6D6E6` / `#8FA9C4` | Text-Hierarchie |
| `--good` / `--warn` / `--bad` | `#1BAF7A` / `#EDA100` / `#E66767` | Status |
| `--series-2` | `#6DA7EC` | zweite Datenreihe |

Schriften: **Varela Round** (Überschriften, große Zahlen) + **Open Sans** (Text). Keine anderen Schriften.
Logo: `~/Desktop/Claude-Code/stratpool-angebote-app/backend/assets/era_logo.png`.
Referenz-CSS: `docs/kontext/era-ci/deck.css` (Präsentations-Shell des Skills).
Gestaltungsvorbild für Interaktion und Visualisierungen: Video `docs/kontext/vorbild-umfrage.mp4`
(eine Frage pro Screen, große Typo, Live-Visualisierung) – **Anmutung übernehmen, Farben ERA**.

## Wichtige Pfade (Zielstruktur)

```
server/            # Express: auth, survey, admin, ai-summary, db (SQLite)
src/               # React: participant flow, admin dashboard, presentation mode
survey/            # Fragebogen-Definitionen (JSON), z. B. humantech-2026.json
docs/              # BRIEFING-Ergänzungen, FRAGEBOGEN-ENTWURF.md
docs/kontext/      # Kundenunterlagen (gitignored!)
Dockerfile
```

## Häufige Aufgaben

- Lokal: `npm install && npm run dev` (Achtung Port 3000 ist lokal durch Docker belegt → anderen Port nehmen, siehe zeiterfassung/STATUS.md Gotcha 3)
- Tests: `npm test` (Vitest) – mindestens für Auswertungslogik (Aggregation, Punkteverteilung, Reifegrad-Mittelwerte)
- Deploy: `git push origin main` → Coolify

## Anmerkungen für Claude Code

- Fortschritt in `STATUS.md` pflegen (Wiedereinstiegspunkt, wie bei zeiterfassung).
- Fragetexte nur nach Freigabe durch Thomas ändern – Quelle der Wahrheit ist `docs/FRAGEBOGEN-ENTWURF.md` bzw. danach `survey/*.json`.
- Mobile first: Teilnehmer füllen evtl. am Handy aus.
