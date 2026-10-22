# Architecture Decisions – stratpool-ki-umfrage

## ADR-013: ERA-CI für die gesamte App-UI
**Status:** akzeptiert (2026-10-22, Thomas)
**Kontext:** Plattform-Standard (ADR-001/002) sieht StratPool-CI für App-UIs vor. Diese App wird jedoch von Mitarbeitenden eines ERA-Kunden benutzt und ihre Auswertung im Kundenworkshop präsentiert.
**Entscheidung:** Teilnehmer-, Admin- und Präsentationsansicht im ERA-Group-CI (Navy/Orange, Varela Round + Open Sans).
**Folge:** Kein `@stratpool/design-system`; eigene, kleine Token-Datei nach `era-html-presentation`-Skill.

## ADR-014: Schlanker Stack (Express + SQLite) statt Standard-Stack
**Status:** vorgeschlagen (2026-10-22)
**Kontext:** ~20 Teilnehmer je Projekt, wenige Wochen Laufzeit, personenbezogene Antworten sollen gekapselt auf dem VPS liegen.
**Entscheidung:** Wie `zeiterfassung`: ein Container, Node/Express, SQLite im Volume, React/Vite, JWT-Cookie.
**Folge:** Kein Supabase/Next.js; Backup = Volume bzw. JSON-Export.

## ADR-015: Keine Anonymität, aggregierte Präsentation
**Status:** akzeptiert (2026-10-22, Thomas)
**Entscheidung:** Antworten personenbezogen gespeichert; Präsentation zeigt standardmäßig Aggregate, Zitate ohne Namen (Admin-Schalter). Transparenzhinweis im Willkommensscreen.
