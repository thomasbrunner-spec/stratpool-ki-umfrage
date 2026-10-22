import { useState } from 'react';
import { api, errorText } from '../api';
import { navigate } from '../router';
import { useResults } from './Dashboard';
import type { SlideSetting } from './types';

export function SlidesAdmin({ projectId }: { projectId: string }) {
  const { data, error, setData } = useResults(projectId, {});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Wird geladen …</p>;

  const settingFor = (id: string): SlideSetting => data.slides[id] ?? { hidden: false, note: '', showNames: null };
  const save = async (id: string, s: SlideSetting) => {
    setData({ ...data, slides: { ...data.slides, [id]: s } });
    setSaving(id);
    try {
      await api.put(`/api/admin/projects/${projectId}/slides/${id}`, s);
      setMsg('');
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setSaving(null);
    }
  };
  const hasTexts = (id: string) =>
    data.survey.deck
      .find((s) => s.id === id)
      ?.widgets.some((w) => w.kind === 'ai' || (w.kind === 'question' && data.survey.questions.find((q) => q.id === w.q)?.type === 'short_text'));

  return (
    <div className="stack">
      <div className="row">
        <p className="muted" style={{ margin: 0 }}>
          Folien ein- und ausblenden, Moderatoren-Kommentar ergänzen (erscheint als Hinweisbox auf der Folie). Namen bei Zitaten: global in den
          Einstellungen ({data.project.showNames ? 'an' : 'aus'}), hier je Folie überschreibbar.
        </p>
        <span className="spacer" />
        <button className="btn primary" onClick={() => navigate(`/admin/p/${projectId}/praesentation`)}>
          Präsentation starten
        </button>
      </div>
      {msg && <p className="error">{msg}</p>}
      <table className="tbl">
        <thead>
          <tr>
            <th>#</th>
            <th>Folie</th>
            <th>Anzeigen</th>
            <th>Namen bei Zitaten</th>
            <th style={{ width: '40%' }}>Moderatoren-Kommentar</th>
          </tr>
        </thead>
        <tbody>
          {data.survey.deck.map((s, i) => {
            const st = settingFor(s.id);
            return (
              <tr key={s.id} style={st.hidden ? { opacity: 0.5 } : undefined}>
                <td>{i + 1}</td>
                <td>
                  <div className="small muted">{s.eyebrow}</div>
                  {s.title}
                </td>
                <td>
                  <label className="check">
                    <input type="checkbox" checked={!st.hidden} onChange={(e) => void save(s.id, { ...st, hidden: !e.target.checked })} />
                    {st.hidden ? 'ausgeblendet' : 'sichtbar'}
                  </label>
                </td>
                <td>
                  {hasTexts(s.id) ? (
                    <select
                      className="input"
                      style={{ minHeight: 36, padding: '4px 8px' }}
                      value={st.showNames === null ? '' : String(st.showNames)}
                      onChange={(e) => void save(s.id, { ...st, showNames: e.target.value === '' ? null : e.target.value === 'true' })}
                    >
                      <option value="">wie global</option>
                      <option value="false">ohne Namen</option>
                      <option value="true">mit Namen</option>
                    </select>
                  ) : (
                    <span className="muted small">–</span>
                  )}
                </td>
                <td>
                  <textarea
                    className="input"
                    rows={2}
                    style={{ minHeight: 56 }}
                    defaultValue={st.note}
                    placeholder="optional"
                    onBlur={(e) => e.target.value !== st.note && void save(s.id, { ...st, note: e.target.value })}
                  />
                  {saving === s.id && <span className="small muted">Speichert …</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small muted">
        Tastatur in der Präsentation: ← → blättern · O Übersicht · F Vollbild · Esc schließen · Drucken (⌘P) erzeugt ein PDF mit einer Folie pro
        Seite.
      </p>
    </div>
  );
}
