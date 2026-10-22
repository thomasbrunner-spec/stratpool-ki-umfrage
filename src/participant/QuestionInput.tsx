import { useId } from 'react';
import type {
  AnswerValue,
  GridQuestion,
  MultiAnswer,
  MultiQuestion,
  PointsQuestion,
  Question,
  SingleQuestion,
  SliderQuestion,
  StairsQuestion,
  SurveyDefinition,
  TextListQuestion,
} from '../../shared/types';

export interface InputProps<Q extends Question> {
  q: Q;
  survey: SurveyDefinition;
  value: AnswerValue | undefined;
  /** debounce = true for typing, false for discrete choices (saved immediately) */
  onChange: (v: AnswerValue, debounce: boolean) => void;
  disabled?: boolean;
}

export function QuestionInput(props: InputProps<Question>) {
  const { q } = props;
  switch (q.type) {
    case 'short_text':
      return (
        <input
          className="input"
          style={{ fontSize: 22, minHeight: 58 }}
          aria-label={q.title}
          maxLength={q.maxLength}
          value={typeof props.value === 'string' ? props.value : ''}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.target.value, true)}
          autoFocus
        />
      );
    case 'long_text':
      return (
        <textarea
          className="input"
          aria-label={q.title}
          maxLength={q.maxLength}
          rows={6}
          value={typeof props.value === 'string' ? props.value : ''}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.target.value, true)}
        />
      );
    case 'text_list':
      return <TextList {...props} q={q} />;
    case 'single':
      return <Single {...props} q={q} />;
    case 'multi':
      return <Multi {...props} q={q} />;
    case 'slider':
      return <Slider {...props} q={q} />;
    case 'stairs':
      return <Stairs {...props} q={q} />;
    case 'grid':
      return <Grid {...props} q={q} />;
    case 'points':
      return <Points {...props} q={q} />;
  }
}

function TextList({ q, value, onChange, disabled }: InputProps<TextListQuestion>) {
  const list = Array.isArray(value) ? value : [];
  const vals = Array.from({ length: q.fields }, (_, i) => list[i] ?? '');
  return (
    <div className="stack">
      {vals.map((v, i) => (
        <label className="field" key={i}>
          <span>
            {i + 1}. {i < q.requiredFields ? '' : '(optional)'}
          </span>
          <textarea
            className="input"
            rows={2}
            style={{ minHeight: 70 }}
            maxLength={q.maxLength}
            placeholder={i === 0 ? q.placeholder : undefined}
            value={v}
            disabled={disabled}
            onChange={(e) => {
              const next = [...vals];
              next[i] = e.target.value;
              onChange(next, true);
            }}
          />
        </label>
      ))}
    </div>
  );
}

function Single({ q, value, onChange, disabled }: InputProps<SingleQuestion>) {
  const name = useId();
  return (
    <div className="choices" role="radiogroup" aria-label={q.title}>
      {q.options.map((o) => {
        const on = value === o.id;
        return (
          <label key={o.id} className={`choice${on ? ' on' : ''}`}>
            <input type="radio" name={name} checked={on} disabled={disabled} onChange={() => onChange(o.id, false)} />
            <span className="mark" aria-hidden />
            <span>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function Multi({ q, value, onChange, disabled }: InputProps<MultiQuestion>) {
  const cur: MultiAnswer = value && typeof value === 'object' && 'selected' in value ? (value as MultiAnswer) : { selected: [] };
  const toggle = (id: string) => {
    const opt = q.options.find((o) => o.id === id)!;
    let selected = cur.selected.includes(id) ? cur.selected.filter((s) => s !== id) : [...cur.selected, id];
    if (!cur.selected.includes(id)) {
      // exclusive options ("keine") clear everything else and vice versa
      selected = opt.exclusive ? [id] : selected.filter((s) => !q.options.find((o) => o.id === s)?.exclusive);
    }
    if (q.max !== undefined && selected.length > q.max) return;
    onChange({ selected, ...(cur.other !== undefined ? { other: cur.other } : {}) }, false);
  };
  const full = q.max !== undefined && cur.selected.length >= q.max;
  const otherOpt = q.options.find((o) => o.other);

  const renderOption = (o: (typeof q.options)[number]) => {
    const on = cur.selected.includes(o.id);
    const blocked = !on && full && !o.exclusive;
    return (
      <label key={o.id} className={`choice multi${on ? ' on' : ''}${blocked ? ' disabled' : ''}`}>
        <input type="checkbox" checked={on} disabled={disabled || blocked} onChange={() => toggle(o.id)} />
        <span className="mark" aria-hidden />
        <span>{o.label}</span>
      </label>
    );
  };

  const groups = q.groups ?? [];
  return (
    <div className="choices" role="group" aria-label={q.title}>
      {groups.length
        ? [
            ...groups.flatMap((g) => [
              <div key={`g-${g.id}`} className="group-label">
                {g.label}
              </div>,
              ...q.options.filter((o) => o.group === g.id).map(renderOption),
            ]),
            <div key="g-rest" className="group-label" />,
            ...q.options.filter((o) => !o.group).map(renderOption),
          ]
        : q.options.map(renderOption)}
      {q.max !== undefined && <div className="small muted">{cur.selected.length} von max. {q.max} gewählt</div>}
      {otherOpt && cur.selected.includes(otherOpt.id) && (
        <input
          className="input"
          aria-label={`${otherOpt.label}: bitte angeben`}
          placeholder="Bitte angeben"
          maxLength={200}
          value={cur.other ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ selected: cur.selected, other: e.target.value }, true)}
          autoFocus
        />
      )}
    </div>
  );
}

function Slider({ q, value, onChange, disabled }: InputProps<SliderQuestion>) {
  const set = typeof value === 'number';
  const v = set ? value : (q.min + q.max) / 2;
  const fill = ((v - q.min) / (q.max - q.min)) * 100;
  const fmt = (n: number) => String(n).replace('.', ',');
  return (
    <div className="slider-wrap">
      <div className={`slider-value${set ? '' : ' unset'}`} aria-live="polite">
        {set ? (
          <>
            {fmt(v)}
            {q.unit ? <span style={{ fontSize: 24 }}> {q.unit}</span> : null}
          </>
        ) : (
          'Regler bewegen'
        )}
      </div>
      <input
        type="range"
        className={set ? '' : 'unset'}
        min={q.min}
        max={q.max}
        step={q.step}
        value={v}
        disabled={disabled}
        aria-label={q.title}
        aria-valuetext={set ? `${fmt(v)} ${q.unit ?? ''}` : 'noch nicht gewählt'}
        style={{ ['--fill' as string]: set ? `${fill}%` : '0%' }}
        onChange={(e) => onChange(Number(e.target.value), true)}
        onKeyDown={(e) => {
          // keyboard users: first arrow press sets the midpoint explicitly
          if (!set && e.key.startsWith('Arrow')) onChange(v, false);
        }}
      />
      <div className="slider-labels">
        <span>← {q.minLabel}</span>
        <span>{q.maxLabel} →</span>
      </div>
    </div>
  );
}

function Stairs({ q, survey, value, onChange, disabled }: InputProps<StairsQuestion>) {
  const name = useId();
  const scale = survey.scales[q.scale];
  if (!scale) return null;
  const bracketAt = (v: number) => scale.brackets?.find((b) => b.from === v);
  return (
    <div className="stairs" role="radiogroup" aria-label={q.title}>
      {scale.levels.map((l) => {
        const on = value === l.value;
        const br = bracketAt(l.value);
        return (
          <div key={l.value}>
            {br && <div className="stair-bracket">{br.label}</div>}
            <label className={`stair${on ? ' on' : ''}`}>
              <input
                type="radio"
                className="sr-only"
                name={name}
                checked={on}
                disabled={disabled}
                onChange={() => onChange(l.value, false)}
              />
              <span className="num">{l.value}</span>
              <span>
                <span className="t">{l.title}</span>
                <span className="d" style={{ display: 'block' }}>
                  {l.description}
                </span>
                {l.hint && <span className="h" style={{ display: 'block' }}>{l.hint}</span>}
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

function Grid({ q, survey, value, onChange, disabled }: InputProps<GridQuestion>) {
  const levels = survey.scales[q.scale]?.levels ?? [];
  const cur = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, number | null>;
  const set = (rowId: string, v: number | null) => onChange({ ...cur, [rowId]: v }, false);
  return (
    <div className="grid-q">
      {q.rows.map((r) => {
        const sel = r.id in cur ? cur[r.id] : undefined;
        return (
          <div className="grid-row" key={r.id} role="radiogroup" aria-label={r.label}>
            <div className="label">{r.label}</div>
            <div className="seg">
              {levels.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={sel === l.value}
                  aria-label={`${l.value} ${l.title}: ${r.descriptions[l.value - 1] ?? ''}`}
                  className={sel === l.value ? 'on' : ''}
                  disabled={disabled}
                  onClick={() => set(r.id, l.value)}
                >
                  <span className="n">{l.value}</span>
                  <span className="lt">{l.title}</span>
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={sel === null}
                className={`na${sel === null ? ' on' : ''}`}
                disabled={disabled}
                onClick={() => set(r.id, null)}
              >
                {q.naLabel}
              </button>
            </div>
            <div className="grid-desc">
              {typeof sel === 'number' ? (
                <>
                  <b>
                    {sel} {levels[sel - 1]?.title}:
                  </b>{' '}
                  {r.descriptions[sel - 1]}
                </>
              ) : sel === null ? (
                <span className="muted">{q.naLabel}</span>
              ) : (
                <span className="muted">Noch keine Auswahl</span>
              )}
            </div>
            <details className="levels">
              <summary>Alle Stufen anzeigen</summary>
              <ol>
                {r.descriptions.map((d, i) => (
                  <li key={i}>
                    <b>{levels[i]?.title}:</b> {d}
                  </li>
                ))}
              </ol>
            </details>
          </div>
        );
      })}
    </div>
  );
}

function Points({ q, value, onChange, disabled }: InputProps<PointsQuestion>) {
  const cur = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, number>;
  const used = Object.values(cur).reduce((a, b) => a + (b ?? 0), 0);
  const left = q.budget - used;
  const set = (id: string, n: number) => {
    const next = { ...cur, [id]: n };
    if (n === 0) delete next[id];
    onChange(next, false);
  };
  return (
    <div>
      <div className="points-left" aria-live="polite">
        <span className="big">{left}</span>
        <span className="muted">{left === 1 ? 'Punkt' : 'Punkte'} übrig von {q.budget}</span>
      </div>
      <div className="points-list">
        {q.options.map((o) => {
          const n = cur[o.id] ?? 0;
          return (
            <div key={o.id} className={`points-row${n ? ' has' : ''}`}>
              <span className="lbl">{o.label}</span>
              <div className="stepper">
                <button type="button" aria-label={`${o.label}: Punkt abziehen`} disabled={disabled || n === 0} onClick={() => set(o.id, n - 1)}>
                  −
                </button>
                <span className="v" aria-label={`${n} Punkte`}>
                  {n}
                </span>
                <button type="button" aria-label={`${o.label}: Punkt hinzufügen`} disabled={disabled || left === 0} onClick={() => set(o.id, n + 1)}>
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
