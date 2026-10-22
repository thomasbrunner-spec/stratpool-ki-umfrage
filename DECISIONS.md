# Architecture Decisions – stratpool-ki-umfrage

## ADR-013: ERA-CI für die gesamte App-UI
**Status:** akzeptiert (2026-10-22, Thomas)
**Kontext:** Plattform-Standard (ADR-001/002) sieht StratPool-CI für App-UIs vor. Diese App wird jedoch von Mitarbeitenden eines ERA-Kunden benutzt und ihre Auswertung im Kundenworkshop präsentiert.
**Entscheidung:** Teilnehmer-, Admin- und Präsentationsansicht im ERA-Group-CI (Navy/Orange, Varela Round + Open Sans).
**Folge:** Kein `@stratpool/design-system`; eigene, kleine Token-Datei nach `era-html-presentation`-Skill.

## ADR-014: Schlanker Stack (Express + SQLite) statt Standard-Stack
**Status:** umgesetzt (2026-10-22) – Node 22, Express 5, React 19, TypeScript strict
**Kontext:** ~20 Teilnehmer je Projekt, wenige Wochen Laufzeit, personenbezogene Antworten sollen gekapselt auf dem VPS liegen.
**Entscheidung:** Wie `zeiterfassung`: ein Container, Node/Express, SQLite im Volume, React/Vite, JWT-Cookie.
**Folge:** Kein Supabase/Next.js; Backup = Volume bzw. JSON-Export.

## ADR-015: Keine Anonymität, aggregierte Präsentation
**Status:** akzeptiert (2026-10-22, Thomas)
**Entscheidung:** Antworten personenbezogen gespeichert; Präsentation zeigt standardmäßig Aggregate, Zitate ohne Namen (Admin-Schalter). Transparenzhinweis im Willkommensscreen.

## ADR-016: Datenschutz-Defaults der Umfrage
**Status:** umgesetzt (2026-10-22)
**Entscheidung:** Schriften selbst gehostet (@fontsource, kein Google Fonts); nur technisch notwendige httpOnly-Cookies; Freitexte werden vor dem
Senden an die Anthropic API pseudonymisiert (alle Teilnehmernamen → [Name]), Häufigkeiten je Thema zählt die App selbst; gefilterte Präsentationsansichten
erst ab Mindestgruppengröße (Default 3); Projektlöschung entfernt alle Daten inkl. VACUUM.
**Folge:** Keine Drittanbieter-Requests im Browser der Teilnehmenden.

## ADR-017: Zugang per Einladungslink und/oder gemeinsamem Passwort
**Status:** umgesetzt (2026-10-22)
**Entscheidung:** Beides pro Projekt umschaltbar. Beim Passwort-Weg werden nur selbst registrierte Personen über Name + Gesellschaft wiedererkannt,
nie eingeladene – sonst könnte das gemeinsame Passwort fremde Antworten öffnen.

## ADR-018: Koerting-Reifegrad (Ist/Ziel) als Messinstrument, AI-Native nur als Zielbild
**Status:** akzeptiert (2026-10-22, Thomas)
**Kontext:** Die AI-Native-Stufen schließen sich in der Praxis nicht aus (Copilot freigegeben, parallel Schatten-KI und KI-Inseln); eine Einzelwahl „heute“
erzwingt künstliche Einigkeit und liefert keinen Handlungsauftrag.
**Entscheidung:** Reifegrad je Koerting-Dimension heute und in drei Jahren (Cobweb, Lücken, Führung vs. Team, blinde Flecken). AI-Native nur als Frage
nach dem Zielbild des Betriebsmodells in drei Jahren.

## ADR-019: Keine Namen bei KI-Zitaten
**Status:** akzeptiert (2026-10-22, Thomas)
**Entscheidung:** Zitate aus KI-Zusammenfassungen erscheinen in Admin und Präsentation immer ohne Namen. Der Namens-Schalter wirkt nur noch auf die
Fragenwand und die Pilot-Bereitschaft.
