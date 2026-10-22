import { useState } from 'react';
import { api, errorText } from '../api';
import { navigate } from '../router';
import { ProjectForm } from './ProjectForm';
import type { ProjectDetail } from './types';

export function Settings({ data, reload }: { data: ProjectDetail; reload: () => void }) {
  const { project } = data;
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const base = `/api/admin/projects/${project.id}`;

  const remove = async () => {
    try {
      await api.del(base, { confirm });
      navigate('/admin', true);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
      <div className="card">
        <h3>Projekteinstellungen</h3>
        <ProjectForm
          key={project.id}
          initial={{ ...project }}
          hasSharedPassword={project.hasSharedPassword}
          onSubmit={async (v) => {
            await api.put(base, v);
            reload();
          }}
        />
      </div>
      <div className="stack">
        <div className="card stack">
          <h3>Export</h3>
          <p className="small muted">Alle Antworten je Person, eine Spalte je Frage bzw. Reifegrad-Bereich und Punkte-Option.</p>
          <div className="row">
            <a className="btn" href={`${base}/export.xlsx`}>
              Excel (.xlsx)
            </a>
            <a className="btn" href={`${base}/export.csv`}>
              CSV
            </a>
            <a className="btn" href={`${base}/export.json`}>
              JSON-Backup
            </a>
          </div>
        </div>
        <div className="card stack" style={{ borderColor: 'rgba(230,103,103,.5)' }}>
          <h3 style={{ color: 'var(--bad)' }}>Projekt und alle Daten löschen</h3>
          <p className="small muted">
            Löscht das Projekt mit allen Teilnehmenden, Antworten, KI-Zusammenfassungen und Folien-Einstellungen endgültig (Löschung nach
            Projektende). Vorher ggf. das JSON-Backup sichern. Zur Bestätigung den Kurznamen <b>{project.slug}</b> eingeben.
          </p>
          <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={project.slug} aria-label="Kurzname zur Bestätigung" />
          {error && <p className="error">{error}</p>}
          <button className="btn danger" disabled={confirm !== project.slug} onClick={() => void remove()}>
            Endgültig löschen
          </button>
        </div>
      </div>
    </div>
  );
}
