import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorText } from '../api';
import { match, navigate } from '../router';
import { ProjectList } from './ProjectList';
import { ProjectView } from './ProjectView';
import { Deck } from '../presentation/Deck';

interface Status {
  needsSetup: boolean;
  loggedIn: boolean;
  aiConfigured: boolean;
}

export function AdminApp({ path }: { path: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const reload = useCallback(() => {
    api.get<Status>('/api/admin/status').then(setStatus).catch(() => setStatus({ needsSetup: false, loggedIn: false, aiConfigured: false }));
  }, []);
  useEffect(reload, [reload]);

  if (!status) return null;
  if (!status.loggedIn) return <Login setup={status.needsSetup} onDone={reload} />;

  let m: Record<string, string> | null;
  if ((m = match('/admin/p/:id/praesentation', path))) return <Deck projectId={m.id!} />;

  const logout = async () => {
    await api.post('/api/admin/logout');
    navigate('/admin', true);
    reload();
  };

  m = match('/admin/p/:id', path);
  return (
    <div className="a-shell">
      <header className="a-top">
        <img src="/era-logo.png" alt="ERA Group" />
        <span className="crumb">
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              navigate('/admin');
            }}
          >
            KI-Umfrage · Admin
          </a>
        </span>
        <span className="spacer" />
        {!status.aiConfigured && <span className="pill">KI-Zusammenfassung nicht eingerichtet</span>}
        <button className="btn small ghost" onClick={() => void logout()}>
          Abmelden
        </button>
      </header>
      <main className="a-main">{m ? <ProjectView id={m.id!} aiConfigured={status.aiConfigured} /> : <ProjectList />}</main>
    </div>
  );
}

function Login({ setup, onDone }: { setup: boolean; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (setup && password !== repeat) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    try {
      await api.post(setup ? '/api/admin/setup' : '/api/admin/login', { password });
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <main className="auth">
      <div className="box">
        <img src="/era-logo.png" alt="ERA Group" />
        <h1>{setup ? 'Admin-Zugang einrichten' : 'Admin-Anmeldung'}</h1>
        <p className="muted">{setup ? 'Legen Sie das Admin-Passwort fest (mindestens 10 Zeichen).' : 'KI-Umfrage · Auswertung'}</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Passwort</span>
            <input className="input" type="password" autoComplete={setup ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={setup ? 10 : 1} autoFocus />
          </label>
          {setup && (
            <label className="field">
              <span>Passwort wiederholen</span>
              <input className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn primary" style={{ width: '100%' }}>
            {setup ? 'Einrichten' : 'Anmelden'}
          </button>
        </form>
      </div>
    </main>
  );
}
