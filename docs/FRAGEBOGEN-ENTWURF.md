# Fragebogen v0.4 – HumanTech Spine (Stand 22.10.2026)

> **Status: freigegeben von Thomas (22.10.2026), umgesetzt in `survey/humantech-2026.json`.** Ältere Stände: `FRAGEBOGEN-ENTWURF-v0.1.md`, `-v0.3.md`.
> **Noch zu prüfen:** Erläuterungen je AI-Native-Stufe (Feld `hint`, von Claude formuliert) – siehe JSON.
> Leitidee: Jede Frage zahlt auf eine Workshop-Entscheidung ein oder erzeugt ein „Aha“. Was nur beschreibt, fliegt raus.
> Ziel-Dauer: ca. 12 Min. · 25 Screens (davon 7 Reifegrad-Screens à ~20 Sek.) · 🆕 = neu, ✏️ = geändert

## Die drei Fragen, die der Workshop beantworten muss

| Workshop-Frage | Wird beantwortet durch | Leitvisual |
|---|---|---|
| **Wo stehen wir – und wo ist die Lücke?** | Reifegrad Ist/Ziel je Dimension (Koerting) | Cobweb Ist vs. Ziel, Lücken-Ranking, Führung vs. Team |
| **Was packen wir zuerst an?** | 10 Punkte, Use-Case-Steckbrief (Zeit + Datenart), Zeitpotenzial | Use-Case-Landkarte (Quick Wins), FTE-Hochrechnung |
| **Unter welchen Regeln und mit wem?** | KI-Ampel, Hürden, Pilot-Bereitschaft | Ampel-Heatmap, Piloten-Landkarte |

## Fragen

### A – Einstieg
1. **A1** Ein Wort: Was verbinden Sie mit KI bei der Arbeit? → Wortwolke

### B – Nutzung heute
2. **B2** Welche KI-Werkzeuge nutzen Sie beruflich? (wie v0.3)
3. 🆕 **B2a** *(nur wenn Copilot gewählt)* **Wie hilfreich ist Microsoft Copilot in Ihrem Arbeitsalltag?** Slider 0–10 (gar nicht … unverzichtbar) → „Copilot-Score“ als Gauge. *Deckt den Auftragspunkt „Sichtung Copilot-Einsatz“ ab, den v0.3 nur über die Tool-Liste streift.*
4. **B3** Private KI-Zugänge (Schatten-KI) (wie v0.3) → Hero-Zahl
- ✂️ **B1 Häufigkeit entfällt** – die Nutzungstiefe (C2) sagt mehr.

### C – Kenntnisse & Haltung (wie v0.3)
5. **C1** Selbsteinschätzung (Slider)
6. **C2** Was davon schon selbst gemacht? (Nutzungstiefe)
7. **C3** Chance für den eigenen Bereich (Slider)

### D – Reifegrad Ist & Ziel (Koerting, ausgebaut) ✏️
8. Intro: „Jetzt geht es um HumanTech als Ganzes. Für sieben Bereiche: Wo stehen wir heute – und wo sollten wir in drei Jahren stehen? Bauchgefühl genügt.“
9.–15. **Ein Screen je Dimension.** Oben ein konkreter Anker für HumanTech, darunter die fünf Original-Stufentexte als Karten. Zwei Auswahlen: **Heute** (blau) und **In 3 Jahren** (orange), dazu „kann ich nicht beurteilen“.

| Dimension | 🆕 Anker-Hinweis (Text-Vorschlag) |
|---|---|
| Geschäftsmodell & Strategie | Gibt es Ziele und Budget für KI? Ist KI Teil der Unternehmensstrategie? |
| Organisation & Prozesse | Gibt es Verantwortliche und einen Ablauf, um neue KI-Anwendungen zu prüfen und freizugeben? |
| Menschen & Kultur | Schulungen, AI-Literacy-Nachweise nach EU AI Act, Offenheit im Team |
| Technologie & Daten | Copilot/M365, Zugriff auf QM-Dokumente und Daten, Schnittstellen zu ERP und Ablagen |
| Prozesse & Kunden | KI in kundennahen Abläufen: Angebote, Anfragen von Kliniken und Chirurgen, Reklamationen |
| Recht & Ethik | KI-Richtlinie, Verantwortung für KI-Ergebnisse, Kennzeichnung |
| Datenschutz & Compliance | DSGVO, Validierung von KI-Software im QMS (ISO 13485, 4.1.6), MDR-Anforderungen |

### E – Zielbild ✏️
16. **E2** **Welches Betriebsmodell ist für HumanTech in drei Jahren das richtige?** AI-Native-Stufen 0–6 mit Erläuterung je Stufe.
- ✂️ **E1 „Wo steht HumanTech heute?“ entfällt** – den Ist-Stand misst das Cobweb besser (Begründung im Chat/STATUS).

### F – Was zuerst?
17. **F1** Wo sollte KI als Erstes ansetzen? 10 Punkte (wie v0.3, inkl. Produktion)
18. 🆕 **F2 Use-Case-Steckbrief** (ein Screen):
    - **Welche Aufgabe in Ihrem Arbeitsalltag kostet Sie am meisten Zeit und könnte durch KI unterstützt werden?** (Pflicht, 2 Zeilen)
    - **Wie viel Zeit kostet Sie diese Aufgabe pro Woche?** Slider 0–20 Std.
    - **Mit welchen Daten arbeiten Sie dabei?** (die sensibelste zählt): öffentlich zugänglich (Literatur, Normen) · interne Dokumente (SOPs, Präsentationen) · vertrauliche Geschäftsdaten (Preise, Verträge, Entwicklungsdaten) · personenbezogene Daten · Patienten- oder klinische Daten · weiß nicht
19. **F3** *(optional)* Weitere Aufgaben oder eine konkrete Idee für einen KI-Anwendungsfall (2 Felder)
20. **F4** Wie viel Zeit könnten Sie insgesamt pro Woche gewinnen? Slider 0–20 Std. (wie v0.3)

### G – Regeln
21. **G1** Was hält Sie am meisten zurück? (max. 2) (wie v0.3)
22. 🆕 **G2 KI-Ampel** (ersetzt G3 „Was soll die Richtlinie regeln?“, bei der erfahrungsgemäß fast alle alles ankreuzen):
    **Wie weit darf KI bei diesen Aufgaben gehen?** Je Zeile: 🟢 selbstständig vorbereiten · 🟡 nur mit fachlicher Prüfung · 🔴 gar nicht · weiß nicht
    - E-Mails und Texte entwerfen
    - Gebrauchsanweisungen und Dokumente übersetzen
    - Literatur für die klinische Bewertung auswerten
    - CAPA- und Reklamationsanalysen vorbereiten
    - Technische Dokumentation (MDR) erstellen oder aktualisieren
    - Lieferanten- und Angebotsvergleiche
    - Bewerbungen vorsortieren

### H – Wer zieht mit? / Workshop
23. 🆕 **H0** **Würden Sie einen KI-Pilot in Ihrem Bereich mitgestalten?** ja, als Verantwortliche/r · ja, als Mitwirkende/r · eher nicht · weiß noch nicht
24. **H1** Was muss am Ende herauskommen? (wie v0.3, Variante für Nicht-Workshop)
25. **H2** *(optional)* Welche Frage sollen wir im Workshop unbedingt klären? → Fragenwand
26. **H3** *(optional)* Bedenken oder sonst etwas

### Abschluss ✏️
🆕 **„Ihr persönliches KI-Profil“**: Nach dem Absenden sehen Teilnehmende ihr eigenes Cobweb (Ist/Ziel), ihre Nutzungstiefe und ihren Quadranten (z. B. „Starter“). Das ist der Dank fürs Mitmachen und macht neugierig auf den Workshop. Gruppenwerte werden dort nicht gezeigt.

## Präsentation – Dramaturgie und Visuals (forscher)

| # | Folie | Visual |
|---|---|---|
| 1 | Titel + Teilnahme | großer Zähler (Count-up) |
| 2 | 🆕 **Hero:** „X % nutzen für ihre Arbeit private KI-Zugänge“ (Titel: „Schatten-KI: private Zugänge im Arbeitsalltag“) | Riesenzahl, eine Zeile Kontext |
| 3 | Stimmungsbild | Wortwolke + Chance-Gauge |
| 4 | 🆕 **Wo wir stehen: Reifegrad Ist** | Cobweb, nur Ist (blau) |
| 5 | 🆕 **…und wo wir hinwollen** | gleiches Cobweb, per Pfeiltaste baut sich Ziel (orange) auf; Fläche dazwischen = Lücke |
| 6 | 🆕 **Die größten Lücken** | Lücken-Ranking je Dimension (Hantel-Diagramm Ist → Ziel) |
| 7 | 🆕 **Führung und Team im Vergleich** | zwei Cobwebs übereinander (GF/AL vs. übrige), nur ab Mindestgruppe |
| 8 | 🆕 **Blinde Flecken** | Anteil „kann ich nicht beurteilen“ je Dimension |
| 9 | Nutzungstiefe & Copilot-Score | Treppe + Gauge |
| 10 | Selbstbild vs. Realität · Haltung | Scatter + Quadranten-Matrix |
| 11 | Wo zuerst ansetzen | 10-Punkte-Ranking |
| 12 | 🆕 **Use-Case-Landkarte** | Blasen: x = Datensensibilität (Umsetzbarkeit), y = Std./Woche, Größe = Nennungen; Quadrant „Quick Wins“ hervorgehoben (Cluster per KI) |
| 13 | 🆕 **Hero:** „X Std. pro Woche = Y Vollzeitstellen“ | Hochrechnung aus F4 (als Selbsteinschätzung gekennzeichnet) |
| 14 | 🆕 **KI-Ampel** | Heatmap Aufgabe × grün/gelb/rot → direkte Vorlage für die Richtlinie |
| 15 | Hürden | Balken |
| 16 | 🆕 **Wer zieht mit?** | Piloten nach Bereich (Namen nur, wenn eingeschaltet) |
| 17 | Zielbild AI-Native | Verteilung auf der Treppe, Klammern 1.0/2.0/3.0 |
| 18 | Erwartungen & offene Fragen | KI-Cluster + Fragenwand |
| 19 | Implikationen für heute | KI-Synthese |

Technisch neu dafür: Folien-„Builds“ (schrittweises Aufdecken), Hero-Folien, Bedingungslogik für Fragen (B2a), Grid mit zwei Werten je Zeile (Ist/Ziel), Ampel-Skala, Use-Case-Landkarte, Radar-Overlays nach Gruppe, persönliches Profil. Umgesetzt. Zitate in KI-Zusammenfassungen erscheinen grundsätzlich ohne Namen (Wunsch Thomas).
