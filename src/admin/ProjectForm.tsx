import { useState, type FormEvent } from 'react';
import { errorText } from '../api';
import type { AccessMode } from './types';

export interface ProjectFormValue {
  name: string;
  client: string;
  slug: string;
  surveyId: string;
  accessMode: AccessMode;
  companies: string[];
  workshopDate: string | null;
  deadline: string | null;
  closed: boolean;
  showNames: boolean;
  minGroupSize: number;
  sharedPassword?: string;
}

export const emptyProject: ProjectFormValue = {
  name: '',
  client: '',
  slug: '',
  surveyId: '',
  accessMode: 'token',
  companies: [],
  workshopDate: null,
  deadline: null,
  closed: false,
  showNames: false,
  minGroupSize: 3,
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export function ProjectForm({
  initial,
  surveys,
  isNew,
  hasSharedPassword,
  onSubmit,
  onCancel,
}: {
  initial: ProjectFormValue;
  surveys?: { id: string; title: string; version: string }[];
  isNew?: boolean;
  hasSharedPassword?: boolean;
  onSubmit: (v: ProjectFormValue) => Promise<void>;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [companiesText, setCompaniesText] = useState(initial.companies.join('\n'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      await onSubmit({
        ...v,
        companies: companiesText
          .split('\n')
          .map((c) => c.trim())
          .filter(Boolean),
        ...(password ? { sharedPassword: password } : {}),
      });
      setPassword('');
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const usesPassword = v.accessMode !== 'token';
  return (
    <form onSubmit={submit} className="stack" style={{ maxWidth: 720 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <label className="field">
          <span>Projektname</span>
          <input
            className="input"
            required
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value, slug: slugTouched ? v.slug : slugify(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Kunde</span>
          <input className="input" required value={v.client} onChange={(e) => setV({ ...v, client: e.target.value })} />
        </label>
        <label className="field">
          <span>Kurzname (für den Passwort-Link /u/…)</span>
          <input
            className="input"
            required
            pattern="[a-z0-9][a-z0-9\-]{1,40}"
            value={v.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setV({ ...v, slug: e.target.value });
            }}
          />
        </label>
        {isNew && surveys && (
          <label className="field">
            <span>Fragebogen</span>
            <select className="input" required value={v.surveyId} onChange={(e) => setV({ ...v, surveyId: e.target.value })}>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} (v{s.version})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Workshop-Datum</span>
          <input className="input" type="date" value={v.workshopDate ?? ''} onChange={(e) => setV({ ...v, workshopDate: e.target.value || null })} />
        </label>
        <label className="field">
          <span>Stichtag (Änderungen bis einschließlich)</span>
          <input className="input" type="date" value={v.deadline ?? ''} onChange={(e) => setV({ ...v, deadline: e.target.value || null })} />
        </label>
      </div>

      <label className="field">
        <span>Gesellschaften (eine pro Zeile, erscheinen als Auswahlliste)</span>
        <textarea className="input" rows={4} value={companiesText} onChange={(e) => setCompaniesText(e.target.value)} />
      </label>

      <fieldset className="card" style={{ border: '1px solid var(--line)' }}>
        <legend className="small muted" style={{ padding: '0 6px' }}>
          Zugang für Teilnehmende
        </legend>
        <div className="stack">
          {(
            [
              ['token', 'Persönliche Einladungslinks (empfohlen)'],
              ['password', 'Gemeinsames Umfrage-Passwort mit Selbstregistrierung'],
              ['both', 'Beides'],
            ] as const
          ).map(([mode, label]) => (
            <label key={mode} className="check">
              <input type="radio" name="access" checked={v.accessMode === mode} onChange={() => setV({ ...v, accessMode: mode })} />
              {label}
            </label>
          ))}
          {usesPassword && (
            <label className="field">
              <span>Umfrage-Passwort {hasSharedPassword ? '(leer lassen = unverändert)' : ''}</span>
              <input className="input" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} required={!hasSharedPassword} />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className="card" style={{ border: '1px solid var(--line)' }}>
        <legend className="small muted" style={{ padding: '0 6px' }}>
          Auswertung
        </legend>
        <div className="stack">
          <label className="check">
            <input type="checkbox" checked={v.showNames} onChange={(e) => setV({ ...v, showNames: e.target.checked })} />
            Namen bei Zitaten in der Präsentation zeigen (global, je Folie überschreibbar)
          </label>
          <label className="field" style={{ maxWidth: 320 }}>
            <span>Mindestgröße gefilterter Gruppen in der Präsentation</span>
            <input className="input" type="number" min={1} max={10} value={v.minGroupSize} onChange={(e) => setV({ ...v, minGroupSize: Number(e.target.value) })} />
          </label>
          {!isNew && (
            <label className="check">
              <input type="checkbox" checked={v.closed} onChange={(e) => setV({ ...v, closed: e.target.checked })} />
              Umfrage geschlossen (keine Antworten/Änderungen mehr möglich)
            </label>
          )}
        </div>
      </fieldset>

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn primary">{isNew ? 'Projekt anlegen' : 'Speichern'}</button>
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Abbrechen
          </button>
        )}
        {saved && !isNew && <span className="small muted">Gespeichert ✓</span>}
      </div>
    </form>
  );
}
