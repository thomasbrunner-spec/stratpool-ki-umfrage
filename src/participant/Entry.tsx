import { useEffect, useState, type FormEvent } from 'react';
import { api, errorText } from '../api';
import { navigate } from '../router';
import { RoleFields, type RoleValues } from './ProfileFields';

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth">
      <div className="box">
        <img src="/era-logo.png" alt="ERA Group" />
        {children}
      </div>
    </main>
  );
}

/** Root page: resumes an existing session, otherwise points to the invitation link. */
export function Landing() {
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    api
      .get('/api/p/session')
      .then(() => navigate('/umfrage', true))
      .catch(() => setChecking(false));
  }, []);
  if (checking) return <AuthShell>{null}</AuthShell>;
  return (
    <AuthShell>
      <h1>KI-Umfrage</h1>
      <p className="muted">Bitte öffnen Sie die Umfrage über den Link aus Ihrer Einladung.</p>
    </AuthShell>
  );
}

export function TokenEntry({ token }: { token: string }) {
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .post('/api/p/login-token', { token })
      .then(() => navigate('/umfrage', true))
      .catch((e: unknown) => setError(errorText(e)));
  }, [token]);
  return (
    <AuthShell>
      {error ? (
        <>
          <h1>Link ungültig</h1>
          <p className="muted">{error}</p>
          <p className="muted small">Bitte wenden Sie sich an die Person, die Ihnen die Einladung geschickt hat.</p>
        </>
      ) : (
        <p className="muted">Einen Moment, die Umfrage wird geöffnet …</p>
      )}
    </AuthShell>
  );
}

interface EntryInfo {
  name: string;
  client: string;
  companies: string[];
  functions: string[];
  workshopDate: string | null;
  locked: boolean;
}

export function PasswordEntry({ slug }: { slug: string }) {
  const [info, setInfo] = useState<EntryInfo | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ password: '', name: '', company: '', func: '', funcOther: '' });
  const [roles, setRoles] = useState<RoleValues>({ leader: null, workshop: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<EntryInfo>(`/api/p/entry/${encodeURIComponent(slug)}`)
      .then(setInfo)
      .catch((e: unknown) => setError(errorText(e)));
  }, [slug]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const func = form.func === 'Sonstiges' && form.funcOther.trim() ? `Sonstiges: ${form.funcOther.trim()}` : form.func;
      await api.post('/api/p/login-password', {
        slug,
        password: form.password,
        name: form.name,
        company: form.company,
        func,
        workshop: roles.workshop === true,
        leader: roles.leader === true,
      });
      navigate('/umfrage', true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (!info) {
    return (
      <AuthShell>
        <h1>KI-Umfrage</h1>
        <p className={error ? 'error' : 'muted'}>{error || 'Wird geladen …'}</p>
      </AuthShell>
    );
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <AuthShell>
      <h1>{info.name}</h1>
      <p className="muted">Bitte melden Sie sich mit dem Umfrage-Passwort aus Ihrer Einladung an.</p>
      <form onSubmit={submit}>
        <label className="field">
          <span>Umfrage-Passwort</span>
          <input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={set('password')} />
        </label>
        <label className="field">
          <span>Ihr Name</span>
          <input className="input" autoComplete="name" required minLength={2} value={form.name} onChange={set('name')} />
        </label>
        <label className="field">
          <span>Gesellschaft</span>
          <select className="input" required value={form.company} onChange={set('company')}>
            <option value="">Bitte wählen</option>
            {info.companies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Funktion / Bereich</span>
          <select className="input" required value={form.func} onChange={set('func')}>
            <option value="">Bitte wählen</option>
            {info.functions.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        {form.func === 'Sonstiges' && (
          <label className="field">
            <span>Welcher Bereich?</span>
            <input className="input" value={form.funcOther} onChange={set('funcOther')} />
          </label>
        )}
        <RoleFields value={roles} workshopDate={info.workshopDate} onChange={setRoles} />
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || info.locked} style={{ width: '100%' }}>
          {info.locked ? 'Die Umfrage ist abgeschlossen' : 'Zur Umfrage'}
        </button>
        <p className="small muted">
          <a href="/datenschutz">Datenschutzinformation</a>
        </p>
      </form>
    </AuthShell>
  );
}
