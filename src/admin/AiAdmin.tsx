import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '../api';
import type { AiSummary, ChatMessage, ChatReply, ClusterSummary, StoredSummary, SynthesisSummary, TermsSummary } from '../../shared/ai-types';
import { SummaryView } from '../charts/AiViews';
import { useResults } from './Dashboard';
import { fmtDateTime } from './types';

type Section = 'summaries' | 'texts' | 'chat';

export function AiAdmin({ projectId, aiConfigured }: { projectId: string; aiConfigured: boolean }) {
  const [section, setSection] = useState<Section>('summaries');
  return (
    <div className="stack">
      <div className="subtabs">
        {(
          [
            ['summaries', 'Zusammenfassungen'],
            ['texts', 'Freitext-Prüfung'],
            ['chat', 'Chat mit der Umfrage'],
          ] as [Section, string][]
        ).map(([k, label]) => (
          <button key={k} className={section === k ? 'on' : ''} onClick={() => setSection(k)}>
            {label}
          </button>
        ))}
      </div>
      {!aiConfigured && <div className="warn-box">ANTHROPIC_API_KEY ist auf dem Server nicht gesetzt – die KI-Funktionen sind nicht verfügbar.</div>}
      {section === 'summaries' && <Summaries projectId={projectId} aiConfigured={aiConfigured} />}
      {section === 'texts' && <TextCheck projectId={projectId} aiConfigured={aiConfigured} />}
      {section === 'chat' && <SurveyChat projectId={projectId} aiConfigured={aiConfigured} />}
    </div>
  );
}

function Summaries({ projectId, aiConfigured }: { projectId: string; aiConfigured: boolean }) {
  const { data, error, setData } = useResults(projectId, {});
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState<Set<string> | null>(null);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Wird geladen …</p>;

  const store = (key: string, s: StoredSummary) => setData({ ...data, summaries: { ...data.summaries, [key]: s } });

  const generateOne = async (key: string): Promise<StoredSummary> => {
    setBusy(key);
    const s = await api.post<StoredSummary>(`/api/admin/projects/${projectId}/ai/${key}`);
    store(key, s);
    return s;
  };

  const generate = async (key: string) => {
    setMsg('');
    try {
      await generateOne(key);
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const targets = data.survey.aiTargets;
  const sel = selected ?? new Set(targets.map((t) => t.key));
  const toggle = (key: string) => {
    const next = new Set(sel);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  /** Free-text clusters and terms first, synthesis last – it builds on the cluster results. */
  const generateSelected = async () => {
    setMsg('');
    const order = [...targets.filter((t) => t.mode !== 'synthesis'), ...targets.filter((t) => t.mode === 'synthesis')].filter((t) => sel.has(t.key));
    const failed: string[] = [];
    for (const t of order) {
      try {
        // store() updates local state; the synthesis reads the saved clusters on the server
        await generateOne(t.key);
      } catch (e) {
        failed.push(`${t.label}: ${errorText(e)}`);
      }
    }
    setBusy(null);
    if (failed.length) setMsg(failed.join(' · '));
  };

  return (
    <div className="stack">
      <p className="muted">
        Die Freitexte werden ohne Namen an die Anthropic API (Modell Claude Opus 5.5) geschickt und zu Themen bzw. Begriffen verdichtet. Die Anzahl je Thema
        zählt die App selbst. Antworten, die in der Freitext-Prüfung ausgeblendet sind, gehen nicht ein. Ergebnisse werden gespeichert und lassen sich
        bearbeiten. Die Synthese nutzt alle Kennzahlen und die vorhandenen Freitext-Zusammenfassungen, erzeugen Sie sie deshalb zuletzt.
      </p>
      <div className="card row">
        <b>Mehrere auf einmal:</b>
        {targets.map((t) => (
          <label key={t.key} className="check">
            <input type="checkbox" checked={sel.has(t.key)} onChange={() => toggle(t.key)} disabled={busy !== null} />
            {t.label}
          </label>
        ))}
        <span className="spacer" />
        <button className="btn primary" disabled={!aiConfigured || busy !== null || sel.size === 0} onClick={() => void generateSelected()}>
          {busy ? `Erstellt: ${targets.find((t) => t.key === busy)?.label ?? ''} …` : `Ausgewählte erzeugen (${sel.size})`}
        </button>
      </div>
      {msg && <p className="error">{msg}</p>}
      {targets.map((t) => {
        const s = data.summaries[t.key];
        const textCount = t.questions.reduce((a, q) => a + (data.results.questions[q]?.n ?? 0), 0);
        return (
          <div className="viz-card" key={t.key}>
            <div className="row">
              <div>
                <h3>{t.label}</h3>
                <div className="sub">
                  {t.mode === 'synthesis'
                    ? 'Synthese über alle Ergebnisse'
                    : `${t.mode === 'terms' ? 'Begriffe für die Wortwolke' : 'Themen'} · Fragen ${t.questions.join(', ')} · ${textCount} Antworten`}
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
                <SummaryView stored={s} />
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
      {v.mode === 'clusters' ? <ClusterEditor v={v} set={setV} /> : v.mode === 'terms' ? <TermsEditor v={v} set={setV} /> : <SynthesisEditor v={v} set={setV} />}
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
            {t.novel !== undefined && (
              <label className="check small" title="Thema liegt außerhalb der Ausgangshypothesen aus dem Angebot">
                <input type="checkbox" checked={t.novel} onChange={(e) => upd(i, { novel: e.target.checked })} />
                neu
              </label>
            )}
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

function TermsEditor({ v, set }: { v: TermsSummary; set: (v: AiSummary) => void }) {
  const text = v.terms.map((t) => `${t.text}: ${t.count}`).join('\n');
  return (
    <label className="field">
      <span>Begriffe (eine Zeile je Begriff, „Begriff: Anzahl“)</span>
      <textarea
        className="input"
        rows={Math.min(14, v.terms.length + 2)}
        defaultValue={text}
        onBlur={(e) =>
          set({
            ...v,
            terms: unlines(e.target.value).map((l) => {
              const i = l.lastIndexOf(':');
              const count = i > 0 ? Number(l.slice(i + 1).trim()) : NaN;
              return Number.isFinite(count) ? { text: l.slice(0, i).trim(), count } : { text: l, count: 1 };
            }),
          })
        }
      />
    </label>
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

// ---------- Free-text check ----------

interface TextList {
  questions: { id: string; short: string }[];
  items: { key: string; qid: string; text: string; name: string; hidden: boolean; reason: string; source: 'ai' | 'manual' | null }[];
  checkedAt: string | null;
}

function TextCheck({ projectId, aiConfigured }: { projectId: string; aiConfigured: boolean }) {
  const [list, setList] = useState<TextList | null>(null);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api
      .get<TextList>(`/api/admin/projects/${projectId}/texts`)
      .then(setList)
      .catch((e: unknown) => setMsg(errorText(e)));
  }, [projectId]);
  if (!list) return msg ? <p className="error">{msg}</p> : <p className="muted">Wird geladen …</p>;

  const check = async () => {
    setBusy(true);
    setMsg('');
    try {
      setList(await api.post<TextList>(`/api/admin/projects/${projectId}/texts/check`));
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (key: string, hidden: boolean) => {
    setMsg('');
    try {
      setList(await api.put<TextList>(`/api/admin/projects/${projectId}/texts`, { key, hidden }));
    } catch (e) {
      setMsg(errorText(e));
    }
  };
  const hiddenCount = list.items.filter((i) => i.hidden).length;

  return (
    <div className="stack">
      <p className="muted">
        Die KI prüft alle Freitexte auf Antworten ohne eigenen Inhalt, zum Beispiel Verweise wie „siehe vorherige Antwort“ oder „s. o.“, Platzhalter wie „–“
        oder „keine“ und Testeingaben. Ausgeblendete Antworten erscheinen nicht in Präsentation und Dashboard und gehen nicht in KI-Zusammenfassungen und
        Chat ein. Die Rohdaten bleiben unverändert (Export). Jede Entscheidung lässt sich hier von Hand ändern; eine manuelle Entscheidung bleibt auch bei
        einer erneuten Prüfung bestehen.
      </p>
      <div className="card row">
        <span>
          <b>{hiddenCount}</b> von {list.items.length} Freitext-Antworten ausgeblendet
          {list.checkedAt && <span className="small muted"> · zuletzt geprüft {fmtDateTime(list.checkedAt)}</span>}
        </span>
        <span className="spacer" />
        <label className="check small">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          alle Antworten anzeigen
        </label>
        <button className="btn primary" disabled={!aiConfigured || busy || !list.items.length} onClick={() => void check()}>
          {busy ? 'Wird geprüft …' : list.checkedAt ? 'Erneut mit KI prüfen' : 'Mit KI prüfen'}
        </button>
      </div>
      {msg && <p className="error">{msg}</p>}
      {list.questions.map((q) => {
        const items = list.items.filter((i) => i.qid === q.id && (all || i.hidden));
        if (!items.length) return null;
        return (
          <div className="viz-card" key={q.id}>
            <h3>
              {q.id} · {q.short}
            </h3>
            <div className="text-items">
              {items.map((it) => (
                <div className={`text-item${it.hidden ? ' off' : ''}`} key={it.key}>
                  <span className="txt">
                    {it.text}
                    <span className="small muted"> – {it.name}</span>
                  </span>
                  {it.hidden && <span className="pill o">{it.source === 'manual' ? 'manuell' : `KI: ${it.reason}`}</span>}
                  {!it.hidden && it.source === 'manual' && <span className="pill">manuell eingeblendet</span>}
                  <button className="btn small ghost" onClick={() => void toggle(it.key, !it.hidden)}>
                    {it.hidden ? 'Einblenden' : 'Ausblenden'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {!all && hiddenCount === 0 && <p className="empty">Keine Antwort ausgeblendet. „Alle Antworten anzeigen“ zeigt die Freitexte zum manuellen Ausblenden.</p>}
    </div>
  );
}

// ---------- Chat with the survey ----------

interface Turn {
  question: string;
  reply?: ChatReply;
  error?: string;
}

const EXAMPLES = [
  'Welche Bedenken äußern Führungskräfte, welche das Team?',
  'Welche Use-Cases werden mehrfach genannt und mit welchen Daten?',
  'Wo sehen die Gesellschaften den Reifegrad unterschiedlich?',
  'Was erwarten die Teilnehmenden konkret vom Workshop?',
];

const COVERAGE: Record<ChatReply['coverage'], string> = {
  full: '',
  partial: 'Nur teilweise aus der Umfrage beantwortbar',
  none: 'Nicht aus der Umfrage beantwortbar',
};

function Answer({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="chat-answer">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, k) => (
                <li key={k}>{l.replace(/^\s*[-•]\s+/, '')}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={b.startsWith('Einordnung (nicht aus der Umfrage)') ? 'chat-opinion' : undefined}>
            {lines.join(' ')}
          </p>
        );
      })}
    </div>
  );
}

function SurveyChat({ projectId, aiConfigured }: { projectId: string; aiConfigured: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = turns
      .filter((t) => t.reply)
      .flatMap((t) => [
        { role: 'user' as const, content: t.question },
        { role: 'assistant' as const, content: t.reply!.answer },
      ]);
    setTurns((ts) => [...ts, { question: q }]);
    setInput('');
    setBusy(true);
    try {
      const reply = await api.post<ChatReply>(`/api/admin/projects/${projectId}/chat`, { question: q, history });
      setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, reply } : t)));
    } catch (e) {
      setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, error: errorText(e) } : t)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <p className="muted">
        Stellen Sie Fragen zu den Ergebnissen. Die KI bekommt alle Antworten ohne Namen (Personen nur als Gruppe: Führung/Team, Gesellschaft, Bereich) und
        darf nur antworten, was sich aus der Umfrage ergibt. Zitate werden von der App wörtlich gegen die Antworten geprüft; nicht belegbare Zitate werden
        entfernt. Der Verlauf wird nicht gespeichert.
      </p>
      <div className="chat">
        {turns.length === 0 && (
          <div className="chat-examples">
            {EXAMPLES.map((e) => (
              <button key={e} className="btn small ghost" disabled={!aiConfigured} onClick={() => void ask(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="chat-turn">
            <div className="chat-q">{t.question}</div>
            {t.error && <p className="error">{t.error}</p>}
            {t.reply && (
              <div className="chat-a">
                {t.reply.coverage !== 'full' && <div className="warn-box small">{COVERAGE[t.reply.coverage]}</div>}
                <Answer text={t.reply.answer} />
                {t.reply.questionsUsed.length > 0 && (
                  <div className="small muted">Grundlage: {t.reply.questionsUsed.map((q) => `${q.id} ${q.short}`).join(' · ')}</div>
                )}
                {t.reply.sources.length > 0 && (
                  <details className="chat-sources">
                    <summary>{t.reply.sources.length === 1 ? '1 geprüfter Beleg' : `${t.reply.sources.length} geprüfte Belege`}</summary>
                    {t.reply.sources.map((s, k) => (
                      <div key={k} className="quote">
                        „{s.quote}“
                        <div className="who">
                          {s.question} · {s.group}
                        </div>
                      </div>
                    ))}
                  </details>
                )}
                {t.reply.droppedQuotes > 0 && (
                  <div className="small" style={{ color: 'var(--warn)' }}>
                    {t.reply.droppedQuotes} Zitat{t.reply.droppedQuotes > 1 ? 'e' : ''} der KI ließ{t.reply.droppedQuotes > 1 ? 'en' : ''} sich nicht wörtlich in den Antworten finden und
                    wurde{t.reply.droppedQuotes > 1 ? 'n' : ''} entfernt. Aussagen dazu bitte mit Vorsicht lesen.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="muted">Die KI wertet die Umfrage aus …</p>}
        <div ref={endRef} />
      </div>
      <div className="chat-input">
        <textarea
          className="input"
          rows={2}
          value={input}
          placeholder="Frage zur Umfrage … (Enter sendet, Umschalt+Enter für neue Zeile)"
          disabled={!aiConfigured}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask(input);
            }
          }}
        />
        <div className="row">
          <button className="btn primary" disabled={!aiConfigured || busy || !input.trim()} onClick={() => void ask(input)}>
            Fragen
          </button>
          {turns.length > 0 && (
            <button className="btn ghost" disabled={busy} onClick={() => setTurns([])}>
              Chat leeren
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
