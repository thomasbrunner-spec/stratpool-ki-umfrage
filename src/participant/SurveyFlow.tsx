import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, errorText } from '../api';
import { navigate } from '../router';
import { fillPlaceholders, isAnswered, visibleQuestions } from '../../shared/validate';
import { formatAnswer } from '../../shared/format';
import type { AnswerMap, AnswerValue, Question, SurveyDefinition } from '../../shared/types';
import { QuestionInput } from './QuestionInput';
import { PersonalProfile } from './PersonalProfile';
import { fmtDate, RoleFields, type RoleValues } from './ProfileFields';

interface Session {
  participant: {
    name: string;
    company: string;
    func: string;
    workshop: boolean;
    leader: boolean | null;
    confirmed: boolean;
    completed: boolean;
  };
  project: { name: string; client: string; companies: string[]; workshopDate: string | null; deadline: string | null; locked: boolean };
  survey: SurveyDefinition;
  answers: AnswerMap;
}

type Step = 'welcome' | 'profile' | number | 'summary' | 'done';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SurveyFlow() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState('');
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [step, setStep] = useState<Step>('welcome');
  const [fromSummary, setFromSummary] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, AnswerValue>());

  useEffect(() => {
    api
      .get<Session>('/api/p/session')
      .then((s) => {
        setSession(s);
        setAnswers(s.answers);
        if (s.participant.completed || s.project.locked) setStep('summary');
        // Everyone sees the welcome screen (incl. the non-anonymity note) before the first answer
        else if (!s.participant.confirmed || Object.keys(s.answers).length === 0) setStep('welcome');
        else {
          const first = visibleQuestions(s.survey, s.answers).findIndex((q) => s.answers[q.id] === undefined);
          setStep(first === -1 ? 'summary' : first);
        }
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) navigate('/', true);
        else setLoadError(errorText(e));
      });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const save = useCallback(async (qid: string) => {
    const value = pending.current.get(qid);
    if (value === undefined) return;
    pending.current.delete(qid);
    setSaveState('saving');
    try {
      await api.put(`/api/p/answers/${qid}`, { value });
      setSaveState(pending.current.size ? 'saving' : 'saved');
      setSaveError('');
    } catch (e) {
      setSaveState('error');
      setSaveError(errorText(e));
    }
  }, []);

  const flush = useCallback(async () => {
    const ids = [...pending.current.keys()];
    for (const id of ids) {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
    }
    await Promise.all(ids.map((id) => save(id)));
  }, [save]);

  // Save outstanding answers when the tab is hidden or closed
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  const change = (qid: string, v: AnswerValue, debounce: boolean) => {
    setAnswers((a) => ({ ...a, [qid]: v }));
    pending.current.set(qid, v);
    clearTimeout(timers.current.get(qid));
    if (debounce) {
      setSaveState('saving');
      timers.current.set(qid, setTimeout(() => void save(qid), 700));
    } else void save(qid);
  };

  const vars = useMemo(
    () => ({
      workshopDate: fmtDate(session?.project.workshopDate ?? null),
      deadline: fmtDate(session?.project.deadline ?? null),
      company: session?.participant.company || 'Ihre Gesellschaft',
    }),
    [session],
  );

  if (loadError) {
    return (
      <Shell>
        <p className="error">{loadError}</p>
      </Shell>
    );
  }
  if (!session) return <Shell>{null}</Shell>;

  const { survey, participant, project } = session;
  const qs = visibleQuestions(survey, answers);
  const locked = project.locked;
  const titleOf = (q: Question) => fillPlaceholders(!participant.workshop && q.titleNonWorkshop ? q.titleNonWorkshop : q.title, vars);
  const go = async (s: Step) => {
    await flush();
    setStep(s);
  };

  // ---------- Welcome ----------
  if (step === 'welcome') {
    return (
      <Shell progress={0}>
        <div className="p-intro stack">
          <div className="p-eyebrow">{project.name}</div>
          <h1 className="p-q">{fillPlaceholders(survey.intro.title, vars)}</h1>
          <p>Guten Tag {participant.name.split(' ')[0]},</p>
          <p>{fillPlaceholders(survey.intro.text, vars)}</p>
          <div className="note">
            {survey.intro.note}{' '}
            <a href="/datenschutz">Datenschutzinformation</a>
          </div>
        </div>
        <Nav>
          <span className="spacer" />
          <button
            className="btn primary"
            onClick={() => {
              const first = qs.findIndex((q) => answers[q.id] === undefined);
              setStep(participant.confirmed ? (first === -1 ? 'summary' : first) : 'profile');
            }}
          >
            Los geht’s
          </button>
        </Nav>
      </Shell>
    );
  }

  // ---------- Profile ----------
  if (step === 'profile') {
    return (
      <Profile
        session={session}
        onBack={() => setStep('welcome')}
        onDone={(p) => {
          setSession({ ...session, participant: { ...participant, ...p, confirmed: true } });
          const first = qs.findIndex((q) => answers[q.id] === undefined);
          setStep(first === -1 ? 'summary' : first);
        }}
      />
    );
  }

  // ---------- Summary ----------
  if (step === 'summary' || step === 'done') {
    const missing = qs.filter((q) => q.required && !isAnswered(q, answers[q.id], survey));
    const completed = participant.completed || step === 'done';
    const submit = async () => {
      setSubmitError('');
      await flush();
      try {
        await api.post('/api/p/complete');
        setSession({ ...session, participant: { ...participant, completed: true } });
        setStep('done');
      } catch (e) {
        setSubmitError(errorText(e));
      }
    };
    return (
      <Shell progress={1}>
        {step === 'done' || (completed && !fromSummary) ? (
          <div className="stack" style={{ marginBottom: 28 }}>
            <h1 className="p-q orange">{survey.outro.title}</h1>
            <p style={{ fontSize: 17 }}>
              {locked ? 'Die Umfrage ist abgeschlossen. Vielen Dank für Ihre Teilnahme.' : fillPlaceholders(survey.outro.text, vars)}
            </p>
            <PersonalProfile survey={survey} answers={answers} />
          </div>
        ) : (
          <div className="stack" style={{ marginBottom: 20 }}>
            <div className="p-eyebrow">Zusammenfassung</div>
            <h1 className="p-q">Ihre Antworten</h1>
            <p className="p-help">
              {locked
                ? 'Die Umfrage ist abgeschlossen, Antworten können nicht mehr geändert werden.'
                : 'Bitte prüfen Sie Ihre Antworten. Mit „Ändern“ springen Sie zur jeweiligen Frage.'}
            </p>
          </div>
        )}
        <h2 className="head" style={{ fontSize: 20, marginBottom: 6 }}>
          {completed ? 'Ihre Antworten' : ''}
        </h2>
        <div>
          {qs.map((q, i) => {
            const text = formatAnswer(survey, q, answers[q.id]);
            const miss = q.required && !isAnswered(q, answers[q.id], survey);
            return (
              <div key={q.id} className={`summary-item${miss ? ' missing' : ''}`}>
                <div className="q">
                  <div className="t">
                    {i + 1}. {titleOf(q)}
                  </div>
                  <div className="a">{text || (miss ? 'Noch nicht beantwortet' : '—')}</div>
                </div>
                {!completed && !locked && (
                  <button
                    className="btn small ghost"
                    onClick={() => {
                      setFromSummary(true);
                      void go(i);
                    }}
                  >
                    Ändern
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <Nav>
          <span className="save-state">{saveLabel(saveState)}</span>
          <span className="spacer" />
          {!locked && !completed && (
            <button className="btn primary" disabled={missing.length > 0} onClick={() => void submit()}>
              {missing.length ? `Noch ${missing.length} offen` : 'Antworten absenden'}
            </button>
          )}
          {completed && !locked && <span className="small muted">Antworten abgesendet. Für Änderungen wenden Sie sich bitte an das ERA-Team.</span>}
        </Nav>
        {submitError && <p className="error">{submitError}</p>}
      </Shell>
    );
  }

  // ---------- Question ----------
  const idx = step;
  const q = qs[idx]!;
  const block = survey.blocks.find((b) => b.id === q.block);
  const answered = isAnswered(q, answers[q.id], survey);
  const canNext = answered || !q.required;
  const next = () => {
    if (!canNext) return;
    void go(fromSummary || idx === qs.length - 1 ? 'summary' : idx + 1);
  };

  return (
    <Shell progress={(idx + 1) / (qs.length + 1)}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          next();
        }}
      >
        <div className="p-eyebrow">
          {block?.title} · Frage {idx + 1} von {qs.length}
          {!q.required && ' · optional'}
        </div>
        <h1 className="p-q" id={`q-${q.id}`}>
          {titleOf(q)}
        </h1>
        {block?.intro && (idx === 0 || qs[idx - 1]?.block !== q.block) && <div className="note" style={{ marginBottom: 14 }}>{fillPlaceholders(block.intro, vars)}</div>}
        {q.help ? <p className="p-help">{q.help}</p> : <div style={{ height: 14 }} />}
        <QuestionInput q={{ ...q, title: titleOf(q) }} survey={survey} value={answers[q.id]} disabled={locked || participant.completed} onChange={(v, d) => change(q.id, v, d)} />
        {saveState === 'error' && <p className="error">{saveError}</p>}
        <Nav>
          <button type="button" className="btn ghost" onClick={() => void go(idx === 0 ? 'profile' : idx - 1)}>
            Zurück
          </button>
          <span className="save-state" aria-live="polite">
            {saveLabel(saveState)}
          </span>
          <span className="spacer" />
          <button type="submit" className="btn primary" disabled={!canNext} title={canNext ? undefined : 'Bitte beantworten Sie die Frage.'}>
            {fromSummary ? 'Zur Übersicht' : !answered && !q.required ? 'Überspringen' : 'Weiter'}
          </button>
        </Nav>
      </form>
    </Shell>
  );
}

const saveLabel = (s: SaveState) =>
  s === 'saving' ? 'Speichert …' : s === 'saved' ? 'Gespeichert ✓' : s === 'error' ? 'Nicht gespeichert' : '';

function Shell({ children, progress }: { children: React.ReactNode; progress?: number }) {
  return (
    <div className="p-shell">
      <header className="p-top">
        <img src="/era-logo.png" alt="ERA Group" />
        <span className="title">KI-Umfrage</span>
      </header>
      {progress !== undefined && (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <main className="p-main">{children}</main>
    </div>
  );
}

function Nav({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-nav">
      <div className="inner">{children}</div>
    </div>
  );
}

function Profile({
  session,
  onBack,
  onDone,
}: {
  session: Session;
  onBack: () => void;
  onDone: (p: { name: string; company: string; func: string; workshop: boolean; leader: boolean }) => void;
}) {
  const { participant, project, survey } = session;
  const known = survey.functions.includes(participant.func);
  const [name, setName] = useState(participant.name);
  const [company, setCompany] = useState(participant.company);
  const [func, setFunc] = useState(known ? participant.func : participant.func ? 'Sonstiges' : '');
  const [funcOther, setFuncOther] = useState(known ? '' : participant.func.replace(/^Sonstiges:\s*/, ''));
  // invited participants: workshop flag is prefilled from the CSV, the leadership role is asked once
  const [roles, setRoles] = useState<RoleValues>({ leader: participant.leader, workshop: participant.workshop });
  const [error, setError] = useState('');
  const companies = company && !project.companies.includes(company) ? [...project.companies, company] : project.companies;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const f = func === 'Sonstiges' && funcOther.trim() ? `Sonstiges: ${funcOther.trim()}` : func;
    const p = { name, company, func: f, workshop: roles.workshop === true, leader: roles.leader === true };
    try {
      await api.put('/api/p/profile', p);
      onDone(p);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Shell progress={0}>
      <form onSubmit={submit} className="stack">
        <div className="p-eyebrow">Zu Ihrer Person</div>
        <h1 className="p-q">Stimmen diese Angaben?</h1>
        <p className="p-help">Wir nutzen sie, um die Ergebnisse nach Gesellschaft, Bereich und Rolle auswerten zu können.</p>
        <label className="field">
          <span>Name</span>
          <input className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className="field">
          <span>Gesellschaft</span>
          {companies.length ? (
            <select className="input" required value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">Bitte wählen</option>
              {companies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input className="input" required value={company} onChange={(e) => setCompany(e.target.value)} />
          )}
        </label>
        <label className="field">
          <span>Funktion / Bereich</span>
          <select className="input" required value={func} onChange={(e) => setFunc(e.target.value)}>
            <option value="">Bitte wählen</option>
            {survey.functions.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        {func === 'Sonstiges' && (
          <label className="field">
            <span>Welcher Bereich?</span>
            <input className="input" value={funcOther} onChange={(e) => setFuncOther(e.target.value)} />
          </label>
        )}
        <RoleFields value={roles} workshopDate={project.workshopDate} onChange={setRoles} />
        {error && <p className="error">{error}</p>}
        <Nav>
          <button type="button" className="btn ghost" onClick={onBack}>
            Zurück
          </button>
          <span className="spacer" />
          <button className="btn primary">Weiter</button>
        </Nav>
      </form>
    </Shell>
  );
}
