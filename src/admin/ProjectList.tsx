import { useEffect, useState } from 'react';
import { api, errorText } from '../api';
import { navigate } from '../router';
import { fmtDate, type ProjectListItem } from './types';
import { ProjectForm, emptyProject, type ProjectFormValue } from './ProjectForm';

export function ProjectList() {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [surveys, setSurveys] = useState<{ id: string; title: string; version: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<ProjectListItem[]>('/api/admin/projects').then(setProjects).catch((e: unknown) => setError(errorText(e)));
    api.get<{ id: string; title: string; version: string }[]>('/api/admin/surveys').then(setSurveys).catch(() => undefined);
  }, []);

  const create = async (v: ProjectFormValue) => {
    const p = await api.post<{ id: string }>('/api/admin/projects', v);
    navigate(`/admin/p/${p.id}`);
  };

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ fontSize: 28 }}>Projekte</h1>
        <span className="spacer" />
        {!creating && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            Neues Projekt
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {creating && (
        <div className="card">
          <h3>Neues Projekt</h3>
          <ProjectForm
            initial={{ ...emptyProject, surveyId: surveys[0]?.id ?? '' }}
            surveys={surveys}
            isNew
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}
      {projects && projects.length === 0 && !creating && <p className="empty">Noch keine Projekte. Legen Sie das erste an.</p>}
      {projects && projects.length > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Kunde</th>
              <th>Workshop</th>
              <th>Stichtag</th>
              <th>Teilnahme</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/p/${p.id}`)}>
                <td>
                  <b>{p.name}</b>
                  <div className="small muted">{p.slug}</div>
                </td>
                <td>{p.client}</td>
                <td>{fmtDate(p.workshopDate)}</td>
                <td>{fmtDate(p.deadline)}</td>
                <td>
                  {p.counts.completed ?? 0} / {p.counts.invited} abgeschlossen
                  <div className="small muted">{p.counts.started ?? 0} begonnen</div>
                </td>
                <td>{p.closed ? <span className="pill">geschlossen</span> : <span className="pill completed">offen</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
