import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from '../api';
import { navigate } from '../router';
import type { ProjectDetail } from './types';
import { Participants } from './Participants';
import { Dashboard } from './Dashboard';
import { SlidesAdmin } from './SlidesAdmin';
import { AiAdmin } from './AiAdmin';
import { Settings } from './Settings';

const TABS = [
  ['participants', 'Teilnehmende'],
  ['dashboard', 'Auswertung'],
  ['ai', 'KI-Zusammenfassung'],
  ['slides', 'Präsentation'],
  ['settings', 'Einstellungen & Export'],
] as const;
type Tab = (typeof TABS)[number][0];

export function ProjectView({ id, aiConfigured }: { id: string; aiConfigured: boolean }) {
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(() => {
    const h = location.hash.slice(1);
    return TABS.some(([k]) => k === h) ? (h as Tab) : 'participants';
  });

  const reload = useCallback(() => {
    api
      .get<ProjectDetail>(`/api/admin/projects/${id}`)
      .then(setData)
      .catch((e: unknown) => setError(errorText(e)));
  }, [id]);
  useEffect(reload, [reload]);

  const select = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
  };

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Wird geladen …</p>;
  const { project } = data;

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <div className="small muted">{project.client}</div>
          <h1 style={{ fontSize: 28 }}>{project.name}</h1>
        </div>
        <span className="spacer" />
        {project.locked ? <span className="pill">geschlossen</span> : <span className="pill completed">läuft</span>}
        <button className="btn" onClick={() => navigate(`/admin/p/${id}/praesentation`)}>
          Präsentation starten
        </button>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => select(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'participants' && <Participants data={data} reload={reload} />}
      {tab === 'dashboard' && <Dashboard projectId={id} />}
      {tab === 'ai' && <AiAdmin projectId={id} aiConfigured={aiConfigured} />}
      {tab === 'slides' && <SlidesAdmin projectId={id} />}
      {tab === 'settings' && <Settings data={data} reload={reload} />}
    </div>
  );
}
