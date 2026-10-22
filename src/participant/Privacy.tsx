// Draft privacy notice – to be reviewed before the survey is sent out (see STATUS.md).
export function Privacy() {
  return (
    <div className="p-shell">
      <header className="p-top">
        <img src="/era-logo.png" alt="ERA Group" />
      </header>
      <main className="p-main stack">
        <h1 className="p-q">Datenschutzinformation zur KI-Umfrage</h1>

        <h3 className="orange">Verantwortlicher</h3>
        <p>
          Dennis Bernsee, ERA Group, Am Jakobsbrunnen 26, 70771 Leinfelden-Echterdingen,{' '}
          <a href="mailto:dbernsee@eragroup.com">dbernsee@eragroup.com</a>
        </p>

        <h3 className="orange">Zweck</h3>
        <p>
          Die Umfrage dient der Vorbereitung und Durchführung des KI-Strategie-Workshops, den die ERA Group im Auftrag Ihres
          Arbeitgebers durchführt. Ihre Antworten fließen in die Agenda und die Auswertung des Workshops ein.
        </p>

        <h3 className="orange">Welche Daten wir verarbeiten</h3>
        <p>
          Name, Gesellschaft, Funktion bzw. Bereich, bei einer persönlichen Einladung Ihre E-Mail-Adresse, Ihre Antworten
          sowie die Zeitpunkte der Bearbeitung.
        </p>

        <h3 className="orange">Keine anonyme Befragung</h3>
        <p>
          Ihre Antworten werden mit Ihrem Namen gespeichert und ausschließlich von den Moderatoren der ERA Group
          ausgewertet. Im Workshop zeigen wir zusammengefasste Ergebnisse. Zitate aus Freitexten erscheinen dort
          grundsätzlich ohne Namen.
        </p>

        <h3 className="orange">Speicherort</h3>
        <p>Die Daten liegen auf einem von der ERA Group betriebenen Server in der Europäischen Union.</p>

        <h3 className="orange">KI-gestützte Zusammenfassung</h3>
        <p>
          Zur Zusammenfassung der Freitext-Antworten nutzen wir das KI-Modell Claude des Anbieters Anthropic. Dabei
          werden nur die Antworttexte übermittelt; Namen werden vorher automatisch entfernt. Anthropic verwendet über die
          Schnittstelle übermittelte Daten nicht zum Training seiner Modelle.
        </p>

        <h3 className="orange">Cookies und Schriften</h3>
        <p>
          Wir verwenden nur ein technisch notwendiges Anmelde-Cookie. Es gibt kein Tracking. Schriftarten werden vom
          eigenen Server geladen.
        </p>

        <h3 className="orange">Löschung</h3>
        <p>Nach Abschluss des Projekts werden alle Umfragedaten vollständig gelöscht.</p>

        <h3 className="orange">Ihre Rechte</h3>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung, auf Widerspruch
          sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Wenden Sie sich dazu an den oben genannten
          Verantwortlichen.
        </p>

        <p>
          <button className="btn" onClick={() => history.back()}>
            Zurück
          </button>
        </p>
      </main>
    </div>
  );
}
