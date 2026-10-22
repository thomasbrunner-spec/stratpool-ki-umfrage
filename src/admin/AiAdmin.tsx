import { useState } from 'react';
import { api, errorText } from '../api';
import type { AiSummary, ClusterSummary, StoredSummary, SynthesisSummary } from '../../shared/ai-types';
import { SummaryView } from '../charts/AiViews';
import { useResults } from './Dashboard';
import { fmtDateTime } from './types';

export function AiAdmin({ projectId, aiConfigured }: { projectId: string; aiConfigured: boolean }) {
  const { data, error, setData } = useResults(projectId, {});
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Wird geladen …</p>;

  const store = (key: string, s: StoredSummary) => setData({ ...data, summaries: { ...data.summaries, [key]: s } });

  const generate = async (key: string) => {
    setBusy(key);
    setMsg('');
    try {
      store(key, await api.post<StoredSummary>(`/api/admin/projects/${projectId}/ai/${key}`));
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
      <p className="muted">
        Die Freitexte werden ohne Namen an die Anthropic API (Modell Claude Opus 5.5) geschickt und zu Themen verdichtet. Die Anzahl je Thema zählt die App
        selbst. Ergebnisse werden gespeichert und lassen sich bearbeiten. Die Synthese nutzt alle Kennzahlen und die vorhandenen Freitext-Zusammenfassungen,
        erzeugen Sie sie deshalb zuletzt.
      </p>
      {!aiConfigured && <div className="warn-box">ANTHROPIC_API_KEY ist auf dem Server nicht gesetzt – Zusammenfassungen können nicht erzeugt werden.</div>}
      {msg && <p className="error">{msg}</p>}
      {data.survey.aiTargets.map((t) => {
        const s = data.summaries[t.key];
        const textCount = t.questions.reduce((a, q) => a + (data.results.questions[q]?.n ?? 0), 0);
        return (
          <div className="viz-card" key={t.key}>
            <div className="row">
              <div>
                <h3>{t.label}</h3>
                <div className="sub">
                  {t.mode === 'synthesis' ? 'Synthese über alle Ergebnisse' : `Fragen ${t.questions.join(', ')} · ${textCount} Antworten`}
                  {s && ` · erstellt ${fmtDateTime(s.generatedAt)}${s.edited ? ' · bearbeitet' : ''}`}
                </div>
              </div>
              <span className="spacer" />
              {s && editing !== t.key && (
                <button className="btn small ghost" onClick={() => setEditing(t.key)}>
                  Bearbeiten
                </button>
              )}
              <button className="btn small primary" disabled={!aiConfigured || busy !== null} onClick={() => void generate(t.key)}>
                {busy === t.key ? 'Wird erstellt …' : s ? 'Neu erzeugen' : 'Erzeugen'}
              </button>
            </div>
            {s && s.edited && busy !== t.key && <div className="small muted">Hinweis: „Neu erzeugen“ überschreibt Ihre Bearbeitung.</div>}
            <div style={{ marginTop: 12 }}>
              {editing === t.key && s ? (
                <Editor
                  value={s.content}
                  onCancel={() => setEditing(null)}
                  onSave={async (content) => {
                    store(t.key, await api.put<StoredSummary>(`/api/admin/projects/${projectId}/ai/${t.key}`, { content }));
                    setEditing(null);
                  }}
                />
              ) : (
                <SummaryView stored={s} names={data.names} showNames />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const lines = (xs: string[]) => xs.join('\n');
const unlines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

function Editor({ value, onSave, onCancel }: { value: AiSummary; onSave: (v: AiSummary) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState<AiSummary>(structuredClone(value));
  const [error, setError] = useState('');
  const save = async () => {
    try {
      await onSave(v);
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <div className="stack">
      {v.mode === 'clusters' ? <ClusterEditor v={v} set={setV} /> : <SynthesisEditor v={v} set={setV} />}
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn primary small" onClick={() => void save()}>
          Speichern
        </button>
        <button className="btn ghost small" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function ClusterEditor({ v, set }: { v: ClusterSummary; set: (v: AiSummary) => void }) {
  const upd = (i: number, patch: Partial<ClusterSummary['themes'][number]>) =>
    set({ ...v, themes: v.themes.map((t, k) => (k === i ? { ...t, ...patch } : t)) });
  return (
    <>
      {v.themes.map((t, i) => (
        <div className="cluster stack" key={i}>
          <div className="row">
            <input className="input" style={{ flex: 1 }} value={t.title} onChange={(e) => upd(i, { title: e.target.value })} aria-label="Thema" />
            <input className="input" style={{ width: 90 }} type="number" min={0} value={t.count} onChange={(e) => upd(i, { count: Number(e.target.value) })} aria-label="Anzahl" />
            <button className="btn small danger" onClick={() => set({ ...v, themes: v.themes.filter((_, k) => k !== i) })}>
              Entfernen
            </button>
          </div>
          <textarea className="input" rows={2} value={t.description} onChange={(e) => upd(i, { description: e.target.value })} aria-label="Beschreibung" />
          {t.quotes.map((q, k) => (
            <div className="row" key={k}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={q.text}
                aria-label="Zitat"
                onChange={(e) => upd(i, { quotes: t.quotes.map((x, j) => (j === k ? { ...x, text: e.target.value } : x)) })}
              />
              <button className="btn small ghost" onClick={() => upd(i, { quotes: t.quotes.filter((_, j) => j !== k) })}>
                ✕
              </button>
            </div>
          ))}
        </div>
      ))}
      <label className="field">
        <span>Kernaussagen (eine pro Zeile)</span>
        <textarea className="input" rows={4} defaultValue={lines(v.keyStatements)} onBlur={(e) => set({ ...v, keyStatements: unlines(e.target.value) })} />
      </label>
    </>
  );
}

function SynthesisEditor({ v, set }: { v: SynthesisSummary; set: (v: AiSummary) => void }) {
  const pairs = (xs: { title: string; text: string }[]) => xs.map((x) => `${x.title}: ${x.text}`).join('\n');
  const unpairs = (s: string) =>
    unlines(s).map((l) => {
      const i = l.indexOf(':');
      return i > 0 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { title: l, text: '' };
    });
  return (
    <>
      <label className="field">
        <span>Kernbotschaft</span>
        <input className="input" value={v.headline} onChange={(e) => set({ ...v, headline: e.target.value })} />
      </label>
      <label className="field">
        <span>Befunde (eine Zeile je Befund, „Titel: Text“)</span>
        <textarea className="input" rows={5} defaultValue={pairs(v.findings)} onBlur={(e) => set({ ...v, findings: unpairs(e.target.value) })} />
      </label>
      <label className="field">
        <span>Implikationen (eine Zeile je Punkt, „Titel: Text“)</span>
        <textarea className="input" rows={5} defaultValue={pairs(v.implications)} onBlur={(e) => set({ ...v, implications: unpairs(e.target.value) })} />
      </label>
      <label className="field">
        <span>Offene Fragen (eine pro Zeile)</span>
        <textarea className="input" rows={3} defaultValue={lines(v.openQuestions)} onBlur={(e) => set({ ...v, openQuestions: unlines(e.target.value) })} />
      </label>
    </>
  );
}
