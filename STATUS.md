# Projektstatus – stratpool-ki-umfrage

> Wiedereinstiegspunkt für die nächste Session. Stand: **2026-10-22**
> Repo: https://github.com/thomasbrunner-spec/stratpool-ki-umfrage (öffentlich – keine Kundendaten!)

## Nächste Session – hier weitermachen
1. Thomas prüft die neu deployte **v0.5** (Coolify Auto-Deploy, letzter Code-Commit `1fa4467`): Teilnehmer-Durchlauf am Handy, Präsentation (22 Folien, neu: „Befähigung & Schulungsbedarf“, „neu“-Kennzeichen bei KI-Clustern)
2. Testpersonen in Produktion über „Antworten löschen“ zurücksetzen (alte v0.3/v0.4-Antworten, C4/C5 fehlen sonst)
3. KI-Zusammenfassung live testen: Admin → KI-Zusammenfassung → alle auswählen → „Ausgewählte erzeugen“ (braucht `ANTHROPIC_API_KEY` in Coolify); dabei prüfen, ob das „neu“-Kennzeichen (außerhalb Angebotshypothesen) plausibel gesetzt wird
4. Ergebnis der externen Klärung abwarten (Datenschutz/Betriebsrat/Teilnehmerkreis, siehe unten) → danach entscheiden, ob der **Anonym-Modus** gebaut wird (Reminder unten; Thomas muss grobe Kategorien festlegen)
5. Feedback von Thomas zu Präsentation, AI-Native-Stufentexten und Matrix-Labels einarbeiten
6. Danach: offene Entscheidungen klären → echte Teilnehmer importieren → Einladung

Qualitätseinschätzung (2026-10-22): 8/10 unter der Bedingung, dass Datenschutz geklärt ist; Hebel: Teilnehmerkreis erweitern (+0,5), Live-/Smoke-Test bestanden.

Letzter Arbeitsstand (2026-10-22): v0.5 vollständig umgesetzt (inkl. AI Literacy C4/C5, am Handy geprüft), Abgleich mit Vertrag/Angebot erledigt (siehe unten), 54 Tests grün, alle 22 Folien headless geprüft. Anonym-Modus nur als Reminder notiert, nicht gebaut. Keine uncommitteten Änderungen.

## Stand
- [x] Briefing, Projekt-CLAUDE.md, Fragebogen-Entwurf v0.1 (aus Claude-Session übergeben)
- [x] Fragebogen v0.2 mit Thomas abgestimmt (18 Screens, Quiz durch Nutzungstiefe-Frage ersetzt)
- [x] v0.3 nach erstem Test: Zeitgewinn bis 20 Std., Produktion als Bereich und Ansatzpunkt
- [x] **v0.4 (Neukonzeption, freigegeben):** Koerting-Reifegrad als Kerninstrument mit Ist/Ziel je Dimension (7 Screens mit HumanTech-Ankern), AI-Native nur noch als Zielbild, Use-Case-Steckbrief (Aufgabe + Std. + Datenart), KI-Ampel, Copilot-Score (bedingt), Pilot-Bereitschaft, persönliches KI-Profil nach dem Absenden; 25 Fragen, ca. 12 Min.
- [x] Präsentation v0.4: 21 Folien – Hero-Zahlen, Cobweb mit Aufbau Ist → Ziel, Lücken-Ranking, Führung vs. Team, blinde Flecken, Use-Case-Landkarte (Quick Wins), Zeitpotenzial in Vollzeitstellen, KI-Ampel, Piloten
- [x] **v0.5:** AI Literacy ergänzt (C4 Weiterbildung bisher, C5 was hilft, max. 2) + Folie „Befähigung & Schulungsbedarf“ (22 Folien); KI-Cluster markieren Themen außerhalb der Angebotshypothesen als „neu“; Zeitpotenzial und Quick Wins vorsichtiger formuliert
- [x] Admin: KI-Zusammenfassungen gesammelt erzeugen (Auswahl), Zitate immer ohne Namen, „Antworten löschen“ je Person
- [x] Repo angelegt + Gerüst (Express 5/SQLite/React 19/Vite, TS strict, Dockerfile, CI)
- [x] Teilnehmer-Flow (Einladungslink + Passwort/Selbstregistrierung, Profil, 1 Frage/Screen, Autosave, Zusammenfassung, Abschluss, Stichtag-Sperre)
- [x] Admin: Projekte, Teilnehmende (CSV-Import, Links, Status, Einladungs-/Erinnerungstexte), Dashboard mit Filtern, Einzelansicht, Export XLSX/CSV/JSON, Löschen
- [x] Präsentationsmodus (ERA-CI, 21 Folien, Tastatur, Übersicht, Vollbild, PDF-Druck, Folien ein/aus, Kommentar, Namen je Folie, Mindestgruppe)
- [x] KI-Zusammenfassung Freitexte (Claude Opus 5.5, Namen vorher entfernt, editierbar) – **nur mit Mock getestet**, Live-Test steht aus
- [x] Test mit Fake-Daten (`npm run seed:fake`), 54 Vitest-Tests grün, Docker-Image lokal gebaut und gestartet
- [ ] Review der Präsentation mit Thomas
- [x] Deploy auf Coolify (2026-10-22), Health-Check ok – siehe DEPLOYMENT.md
- [ ] Smoke-Test in Produktion: Admin-Login, Testprojekt, Teilnehmer-Durchlauf am Handy, KI-Zusammenfassung, Testprojekt löschen
- [ ] Live-Test KI-Zusammenfassung mit echtem `ANTHROPIC_API_KEY` (Demo-Projekt)
- [ ] Echte Teilnehmer importiert, Einladung verschickt

## Vor dem Versand außerhalb der App klären (Abgleich mit Vertrag/Angebot, 2026-10-22)
- **Datenschutz:** Vertragsanlage 2 ist die ERA-Vorlage für Kostenanalysen (Zweck „Kostenstrukturen“, Ziff. 2.3 „Kunde liefert pseudonymisiert“, 10 Jahre Aufbewahrung) – deckt eine namentliche Mitarbeiterbefragung mit Hosting bei Hostinger und Anthropic als Unterauftragnehmer nicht ab. Eigene Datenschutzinformation mit kurzer Löschfrist, AVV Hostinger/Anthropic, Rolle StratPool als Betreiber klären
- **Betriebsrat:** Gibt es einen? Namentliche Mitarbeiterbefragung ggf. mitbestimmungspflichtig
- **Teilnehmerkreis:** Angebot verspricht Befragung „der Belegschaft“/„unternehmensweit“; aktuell 17 Personen, davon 9 GF/AL. Entweder erweitern (Passwort-Link mit Selbstregistrierung) oder ehrlich als „Führungskreis und Schlüsselpersonen“ benennen
- Ergebnisse der laufenden internen Ist-Aufnahme bei HumanTech anfordern (Doppelbefragung vermeiden)
- Deutschkenntnisse der Person bei HT México klären (Fragebogen nur Deutsch)
- Einladung durch die GF; Hinweis, dass die GF keine Einzelantworten sieht (Ehrlichkeit bei Schatten-KI)
- Nach dem Workshop kurzes Ergebnis-PDF an alle Befragten (Rückkanal, Beteiligungsversprechen)

## Reminder: Option „anonyme Befragung“ (noch NICHT umsetzen, erst nach Freigabe Thomas)
Hintergrund: Nur das Namensfeld wegzulassen reicht nicht – Funktion + Gesellschaft identifiziert bei 17 Personen fast jeden eindeutig (bleibt personenbezogen). Echte Entlastung nur mit:
1. Neuer Zugangsmodus `anonymous` (gemeinsamer Link + Passwort, keine persönlichen Token, kein Name in der DB)
2. Registrierung fragt nur **grobe Kategorien** ab (z. B. Führung / Fachbereich; Gesellschaft grob oder gar nicht) – **Kategorien legt Thomas fest**
3. Wiedereinstieg nur auf demselben Gerät (Cookie); Hinweis im Willkommenstext
4. Pilot-Frage H0: optionales Namensfeld „Wenn Sie mitmachen möchten“ (freiwillig, ausdrücklich optional); Piloten-Folie zeigt nur diese freiwilligen Namen
5. Willkommens-/Datenschutztext anpassen („Keine anonyme Befragung“ → anonym, inkl. Mindestgruppengröße)
6. Admin: Rücklauf nur als Gesamtzahl, Teilnehmerliste/„Antworten löschen“ je Person/Erinnerung je Person entfallen in diesem Modus; Führung vs. Team über die grobe Kategorie
7. Tests + Seed anpassen; Aufwand ca. 1–2 Std.
Vorteil: Datenschutz/Betriebsrat deutlich einfacher, ehrlichere Angaben zu Schatten-KI. Nachteil: kein Rücklauf je Person, keine Löschung auf Einzelanfrage, Doppelteilnahme möglich.

## Fragebogen-Vorschläge, warten auf Freigabe
- Optional: bestehende KI-Projekte/Assistenten im eigenen Bereich

## Offene Entscheidungen (Thomas)
- Workshop-Termin und Stichtag (Feldzeit ≥ 10 Werktage + Erinnerung) → im Projekt eintragen, erscheinen in Begrüßung/Abschluss
- Zugang: persönliche Links (empfohlen) oder gemeinsames Passwort – in den Projekteinstellungen umschaltbar
- Subdomain final (`umfrage.stratpool.pro`?)
- Offizielle Namen der Gesellschaften (aktuell aus CSV abgeleitet; im Admin änderbar)
- Absender der Einladung (Kunde oder ERA) – Textentwürfe im Admin unter „Einladungs- & Erinnerungstexte“
- Erläuterungen je AI-Native-Stufe (Zielbild-Frage) sind von Claude formuliert (`hint` in `survey/humantech-2026.json`) – bitte prüfen
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
8. **Bedingte Fragen** (`showIf`, z. B. Copilot-Score): Antworten auf wieder ausgeblendete Fragen zählen in der Auswertung nicht.
9. **Führung vs. Team:** „Führung“ = Bereich Geschäftsführung oder internes Rollen-Kürzel beginnt mit GF/AL (CSV-Spalte `kuerzel_funktion`). Vergleich erst ab Mindestgruppengröße je Gruppe.
10. **Wechsel v0.3 → v0.4:** Antworten auf entfallene Fragen (B1, E1, D-Raster, G3, alte F2) bleiben in der DB, werden aber nirgends mehr ausgewertet. Testpersonen im Admin über „Antworten löschen“ zurücksetzen.
11. **Slider:** Antwort wird auch beim Tippen auf die Startposition gespeichert (`onPointerUp`) – nicht entfernen, sonst bleibt „Weiter“ gesperrt.

## Lokal starten
```bash
npm install && cp .env.example .env   # JWT_SECRET eintragen
npm run seed:fake                     # Demo-Projekt "demo", Passwort "demo"
npm run dev                           # http://localhost:5180 (Admin: /admin)
```
