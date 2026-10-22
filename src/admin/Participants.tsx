import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, errorText } from '../api';
import { formatAnswer } from '../../shared/format';
import type { AnswerMap } from '../../shared/types';
import { fmtDate, fmtDateTime, STATUS_LABEL, type ParticipantView, type ProjectDetail } from './types';

const linkFor = (token: string) => `${location.origin}/t/${token}`;

function useToast() {
  const [msg, setMsg] = useState('');
  const show = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2200);
  };
  return { toast: msg ? <div className="toast">{msg}</div> : null, show };
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
}

export function Participants({ data, reload }: { data: ProjectDetail; reload: () => void }) {
  const { project, participants, survey } = data;
  const [modal, setModal] = useState<'add' | 'import' | 'texts' | { edit: ParticipantView } | { answers: ParticipantView } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { toast, show } = useToast();

  const c = useMemo(
    () => ({
      invited: participants.length,
      started: participants.filter((p) => p.status !== 'invited').length,
      completed: participants.filter((p) => p.status === 'completed').length,
      ws: participants.filter((p) => p.workshop).length,
      wsDone: participants.filter((p) => p.workshop && p.status === 'completed').length,
    }),
    [participants],
  );

  const del = async (p: ParticipantView) => {
    if (confirmDelete !== p.id) {
      setConfirmDelete(p.id);
      return;
    }
    await api.del(`/api/admin/participants/${p.id}`);
    setConfirmDelete(null);
    reload();
  };

  const usesToken = project.accessMode !== 'password';

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi v={c.invited} l="Eingeladen" />
        <Kpi v={c.started} l="Begonnen" />
        <Kpi v={c.completed} l="Abgeschlossen" />
        <Kpi v={`${c.wsDone}/${c.ws}`} l="Workshop-Teilnehmende fertig" />
      </div>
      <div className="row">
        <button className="btn" onClick={() => setModal('add')}>
          Person hinzufügen
        </button>
        <button className="btn" onClick={() => setModal('import')}>
          CSV importieren
        </button>
        <button className="btn" onClick={() => setModal('texts')}>
          Einladungs- & Erinnerungstexte
        </button>
        {project.accessMode !== 'token' && (
          <span className="small muted">
            Passwort-Link:{' '}
            <a href={`/u/${project.slug}`} target="_blank" rel="noreferrer">
              {location.origin}/u/{project.slug}
            </a>
          </span>
        )}
      </div>

      {participants.length === 0 ? (
        <p className="empty">Noch keine Teilnehmenden. Importieren Sie die Liste als CSV oder legen Sie Personen einzeln an.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Gesellschaft</th>
                <th>Bereich</th>
                <th>Workshop</th>
                <th>Status</th>
                <th>Letzte Aktivität</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                    <div className="small muted">
                      {[p.roleNote, p.email].filter(Boolean).join(' · ')}
                      {p.selfRegistered && <span className="pill" style={{ marginLeft: 6 }}>selbst registriert</span>}
                    </div>
                  </td>
                  <td>{p.company || '–'}</td>
                  <td>{p.func || '–'}</td>
                  <td>{p.workshop ? 'ja' : '–'}</td>
                  <td>
                    <span className={`pill ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td className="small">{fmtDateTime(p.completedAt ?? p.lastActivity)}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      {usesToken && !p.selfRegistered && (
                        <button
                          className="btn small"
                          onClick={() =>
                            void copy(linkFor(p.token)).then(() => show(`Link für ${p.name} kopiert`))
                          }
                        >
                          Link
                        </button>
                      )}
                      <button className="btn small" disabled={p.status === 'invited'} onClick={() => setModal({ answers: p })}>
                        Antworten
                      </button>
                      <button className="btn small ghost" onClick={() => setModal({ edit: p })}>
                        Bearbeiten
                      </button>
                      <button className={`btn small ${confirmDelete === p.id ? 'danger' : 'ghost'}`} onClick={() => void del(p)} onBlur={() => setConfirmDelete(null)}>
                        {confirmDelete === p.id ? 'Wirklich löschen?' : 'Löschen'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'add' && (
        <Modal onClose={() => setModal(null)}>
          <ParticipantForm
            title="Person hinzufügen"
            functions={survey.functions}
            companies={project.companies}
            onSubmit={async (v) => {
              await api.post(`/api/admin/projects/${project.id}/participants`, v);
              setModal(null);
              reload();
            }}
          />
        </Modal>
      )}
      {modal && typeof modal === 'object' && 'edit' in modal && (
        <Modal onClose={() => setModal(null)}>
          <ParticipantForm
            title="Person bearbeiten"
            functions={survey.functions}
            companies={project.companies}
            initial={modal.edit}
            onSubmit={async (v) => {
              await api.put(`/api/admin/participants/${modal.edit.id}`, v);
              setModal(null);
              reload();
            }}
            extra={
              !modal.edit.selfRegistered && usesToken ? (
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() =>
                    void api.post(`/api/admin/participants/${modal.edit.id}/token`).then(() => {
                      show('Neuer Link erzeugt – der alte ist ungültig');
                      reload();
                    })
                  }
                >
                  Link neu erzeugen
                </button>
              ) : null
            }
          />
        </Modal>
      )}
      {modal === 'import' && (
        <Modal onClose={() => setModal(null)}>
          <CsvImport projectId={project.id} onDone={reload} />
        </Modal>
      )}
      {modal === 'texts' && (
        <Modal onClose={() => setModal(null)}>
          <Texts data={data} onCopied={show} />
        </Modal>
      )}
      {modal && typeof modal === 'object' && 'answers' in modal && (
        <Modal onClose={() => setModal(null)}>
          <AnswersView data={data} p={modal.answers} />
        </Modal>
      )}
      {toast}
    </div>
  );
}

function Kpi({ v, l }: { v: number | string; l: string }) {
  return (
    <div className="kpi">
      <div className="v">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="row" style={{ justifyContent: 'flex-end', marginBottom: -8 }}>
          <button className="btn small ghost" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface PForm {
  name: string;
  email: string;
  company: string;
  func: string;
  roleNote: string;
  workshop: boolean;
}

function ParticipantForm({
  title,
  functions,
  companies,
  initial,
  onSubmit,
  extra,
}: {
  title: string;
  functions: string[];
  companies: string[];
  initial?: PForm;
  onSubmit: (v: PForm) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [v, setV] = useState<PForm>(
    initial
      ? { name: initial.name, email: initial.email, company: initial.company, func: initial.func, roleNote: initial.roleNote, workshop: initial.workshop }
      : { name: '', email: '', company: '', func: '', roleNote: '', workshop: false },
  );
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit(v);
    } catch (err) {
      setError(errorText(err));
    }
  };
  const set = (k: keyof PForm) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="stack">
      <h2 style={{ fontSize: 22 }}>{title}</h2>
      <label className="field">
        <span>Name</span>
        <input className="input" required value={v.name} onChange={set('name')} />
      </label>
      <label className="field">
        <span>E-Mail (optional)</span>
        <input className="input" type="email" value={v.email} onChange={set('email')} />
      </label>
      <label className="field">
        <span>Gesellschaft</span>
        <input className="input" list="companies" value={v.company} onChange={set('company')} />
        <datalist id="companies">
          {companies.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="field">
        <span>Funktion / Bereich</span>
        <select className="input" value={functions.includes(v.func) || !v.func ? v.func : '__custom'}
          onChange={(e) => e.target.value !== '__custom' && setV({ ...v, func: e.target.value })}
        >
          <option value="">–</option>
          {functions.map((f) => (
            <option key={f}>{f}</option>
          ))}
          {!functions.includes(v.func) && v.func && <option value="__custom">{v.func}</option>}
        </select>
      </label>
      <label className="field">
        <span>Rolle / Kürzel (nur intern, z. B. „AL QM“)</span>
        <input className="input" value={v.roleNote} onChange={set('roleNote')} />
      </label>
      <label className="check">
        <input type="checkbox" checked={v.workshop} onChange={(e) => setV({ ...v, workshop: e.target.checked })} />
        Nimmt am Workshop teil
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn primary">Speichern</button>
        {extra}
      </div>
    </form>
  );
}

function CsvImport({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [result, setResult] = useState<{ created: number; skipped: string[]; errors: string[] } | null>(null);
  const [error, setError] = useState('');
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const csv = await file.text();
      const r = await api.post<{ created: number; skipped: string[]; errors: string[] }>(`/api/admin/projects/${projectId}/participants/import`, { csv });
      setResult(r);
      onDone();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <div className="stack">
      <h2 style={{ fontSize: 22 }}>Teilnehmende per CSV importieren</h2>
      <p className="muted small">
        Kopfzeile mit Spaltennamen, Trennzeichen Semikolon oder Komma. Erkannte Spalten: <b>name</b> (Pflicht), email, gesellschaft, funktion/bereich,
        kuerzel_funktion/rolle, workshop (ja/nein). Der Bereich wird aus Kürzeln wie „AL QM“ vorgeschlagen. Bereits vorhandene Personen (gleiche
        E-Mail bzw. gleicher Name) werden übersprungen.
      </p>
      <div className="code">nr;name;kuerzel_funktion;gesellschaft;email;workshop{'\n'}1;Erika Muster;AL QM;Muster GmbH;e.muster@example.com;ja</div>
      <input type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} />
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="card">
          <p>
            <b>{result.created}</b> Personen importiert.
          </p>
          {result.skipped.length > 0 && <p className="small muted">Übersprungen (schon vorhanden): {result.skipped.join(', ')}</p>}
          {result.errors.length > 0 && <p className="small error">{result.errors.join(' ')}</p>}
          <p className="small muted">Bitte prüfen Sie Gesellschaft und Bereich in der Liste und korrigieren Sie bei Bedarf.</p>
        </div>
      )}
    </div>
  );
}

function Texts({ data, onCopied }: { data: ProjectDetail; onCopied: (m: string) => void }) {
  const { project, participants } = data;
  const open = participants.filter((p) => p.status !== 'completed' && !p.selfRegistered);
  const until = project.deadline ? fmtDate(project.deadline) : '[Stichtag]';
  const ws = project.workshopDate ? fmtDate(project.workshopDate) : '[Workshop-Datum]';
  const access =
    project.accessMode === 'password'
      ? `Link: ${location.origin}/u/${project.slug}\nPasswort: [Umfrage-Passwort]`
      : 'Ihr persönlicher Link: [LINK]';
  const invitation = `Betreff: Ihre Sicht zählt – kurze Umfrage zu KI bei ${project.client}

Guten Tag [Name],

am ${ws} findet unser KI-Strategie-Workshop statt. Damit wir ihn gezielt auf Ihre Themen ausrichten können, bitten wir Sie um Ihre Einschätzung in einer kurzen Online-Umfrage (ca. 10 Minuten, auch am Handy möglich).

${access}

Sie können jederzeit unterbrechen und später weitermachen. Bitte nehmen Sie bis zum ${until} teil.

Die Antworten werden mit Ihrem Namen gespeichert und ausschließlich von den ERA-Moderatoren ausgewertet; im Workshop zeigen wir zusammengefasste Ergebnisse.

Vielen Dank und viele Grüße
[Absender]`;
  const reminder = `Betreff: Erinnerung – Umfrage zu KI bei ${project.client}

Guten Tag [Name],

eine kurze Erinnerung an unsere Umfrage zur Vorbereitung des KI-Workshops am ${ws}. Sie dauert ca. 10 Minuten und läuft noch bis zum ${until}. Falls Sie schon begonnen haben, setzen Sie einfach dort fort, wo Sie aufgehört haben.

${access}

Vielen Dank und viele Grüße
[Absender]`;
  const list = open.map((p) => `${p.name}${p.email ? ` <${p.email}>` : ''}${project.accessMode !== 'password' ? `\n${linkFor(p.token)}` : ''}`).join('\n\n');
  return (
    <div className="stack">
      <h2 style={{ fontSize: 22 }}>Einladungs- & Erinnerungstexte</h2>
      <p className="small muted">Entwürfe zum Kopieren. Platzhalter in eckigen Klammern vor dem Versand ersetzen. Es werden keine Mails automatisch verschickt.</p>
      {[
        ['Einladung', invitation],
        ['Erinnerung', reminder],
        [`Noch offen (${open.length}) – Namen, E-Mail, persönliche Links`, list || 'Alle eingeladenen Personen haben abgeschlossen.'],
      ].map(([title, text]) => (
        <div key={title}>
          <div className="row" style={{ marginBottom: 6 }}>
            <b>{title}</b>
            <span className="spacer" />
            <button className="btn small" onClick={() => void copy(text!).then(() => onCopied(`${title} kopiert`))}>
              Kopieren
            </button>
          </div>
          <div className="code">{text}</div>
        </div>
      ))}
    </div>
  );
}

function AnswersView({ data, p }: { data: ProjectDetail; p: ParticipantView }) {
  const [answers, setAnswers] = useState<AnswerMap | null>(null);
  useEffect(() => {
    void api.get<{ answers: AnswerMap }>(`/api/admin/participants/${p.id}/answers`).then((r) => setAnswers(r.answers));
  }, [p.id]);
  return (
    <div>
      <h2 style={{ fontSize: 22 }}>{p.name}</h2>
      <p className="small muted">
        {[p.company, p.func, p.workshop ? 'Workshop' : null, STATUS_LABEL[p.status]].filter(Boolean).join(' · ')}
      </p>
      {!answers ? (
        <p className="muted">Wird geladen …</p>
      ) : (
        data.survey.questions.map((q, i) => (
          <div key={q.id} className="summary-item">
            <div className="q">
              <div className="t">
                {i + 1}. {q.short}
              </div>
              <div className="a">{formatAnswer(data.survey, q, answers[q.id]) || '—'}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
