import { useCallback, useEffect, useRef, useState } from 'react';
import { widgetKey, type CompareStairsResult, type QuestionResult } from '../../shared/aggregate';
import type { DeckSlide, ResultFilter, Widget } from '../../shared/types';
import { navigate } from '../router';
import { num, pct } from '../charts/Viz';
import { SummaryView } from '../charts/AiViews';
import { useResults, WidgetViz } from '../admin/Dashboard';
import type { ResultsResponse } from '../admin/types';

interface Kpi {
  label: string;
  value: string;
  accent?: boolean;
}

/** Key figure shown in the right-hand KPI box (as in the reference video). */
function kpisFor(w: Widget, data: ResultsResponse): Kpi[] {
  const { results, survey } = data;
  if (w.kind === 'compare_stairs') {
    const d = results.derived[widgetKey(w)] as CompareStairsResult | undefined;
    if (!d) return [];
    return [
      { label: 'Ø heute', value: num(d.today.mean) },
      { label: 'Ø Ziel in 3 Jahren', value: num(d.target.mean), accent: true },
      { label: 'Abstand', value: d.meanGap === null ? '–' : `+${num(d.meanGap)} Stufen` },
    ];
  }
  if (w.kind === 'ai') {
    const s = data.summaries[w.key]?.content;
    if (s?.mode !== 'clusters') return [];
    return [
      { label: 'Antworten', value: String(s.answerCount) },
      { label: 'Themen', value: String(s.themes.length), accent: true },
    ];
  }
  if (w.kind !== 'question') return [];
  const r: QuestionResult | undefined = results.questions[w.q];
  const q = survey.questions.find((x) => x.id === w.q);
  if (!r || !q) return [];
  const n: Kpi = { label: 'Antworten', value: String(r.n) };
  switch (r.type) {
    case 'counts': {
      const top = [...r.items].sort((a, b) => b.count - a.count)[0];
      return top ? [n, { label: top.label, value: pct(top.share), accent: true }] : [n];
    }
    case 'numeric':
      return [n, { label: q.type === 'slider' && q.unit ? `Ø ${q.unit}` : 'Mittelwert', value: num(r.mean), accent: true }];
    case 'points': {
      const top = r.items[0];
      return top ? [n, { label: top.label, value: pct(top.share), accent: true }] : [n];
    }
    case 'grid': {
      const means = r.rows.map((x) => x.mean).filter((x): x is number => x !== null);
      const avg = means.length ? means.reduce((a, b) => a + b, 0) / means.length : null;
      return [n, { label: 'Ø Reifegrad (1–5)', value: num(avg), accent: true }];
    }
    case 'words':
      return r.words[0] ? [n, { label: 'häufigstes Wort', value: r.words[0].text, accent: true }] : [n];
    case 'levels':
      return [n, { label: 'Mittelwert', value: num(r.mean), accent: true }];
    default:
      return [n];
  }
}

function widgetTitle(w: Widget, data: ResultsResponse): string {
  switch (w.kind) {
    case 'question':
      return data.survey.questions.find((q) => q.id === w.q)?.title ?? '';
    case 'depth':
      return 'Nutzungstiefe: höchste erreichte Stufe je Person';
    case 'self_vs_depth':
      return 'Selbsteinschätzung nach Nutzungstiefe';
    case 'matrix':
      return `${w.xLabel} × ${w.yLabel}`;
    case 'ai':
      return data.survey.aiTargets.find((t) => t.key === w.key)?.label ?? '';
    default:
      return '';
  }
}

function SlideView({ s, data, index, total, filtered, suppressed }: { s: DeckSlide; data: ResultsResponse; index: number; total: number; filtered: boolean; suppressed: boolean }) {
  const setting = data.slides[s.id];
  const showNames = setting?.showNames ?? data.project.showNames;
  const n = data.results.n;
  const footer = (
    <>
      <img className="logo" src="/era-logo.png" alt="ERA Group" />
      <span className="src">
        Quelle: Vorab-Befragung, n = {n}
        {filtered ? ' (gefiltert)' : ''}
      </span>
      <span className="pageno">
        {index + 1} / {total}
      </span>
    </>
  );

  if (s.widgets[0]?.kind === 'participation') {
    const p = data.results.participation;
    return (
      <>
        <div className="eyebrow">{s.eyebrow}</div>
        <h1>{s.title}</h1>
        <div className="sub">
          {data.project.client}
          {data.project.workshopDate ? ` · Workshop am ${new Date(`${data.project.workshopDate}T12:00:00`).toLocaleDateString('de-DE', { dateStyle: 'long' })}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 40, marginTop: 48 }}>
          <div>
            <div className="big head" style={{ fontSize: 64, color: 'var(--orange)' }}>
              {p.completed}
              <span style={{ fontSize: 28, color: 'var(--ink-3)' }}> / {p.invited}</span>
            </div>
            <div className="muted">haben die Umfrage abgeschlossen</div>
          </div>
          <div style={{ fontSize: 15, color: 'var(--ink-2)', alignSelf: 'end' }}>
            {p.byCompany.map((c) => (
              <div key={c.label}>
                {c.label}: {c.completed} / {c.invited}
              </div>
            ))}
          </div>
        </div>
        {setting?.note && <div className="note-mod">{setting.note}</div>}
        {footer}
      </>
    );
  }

  const single = s.widgets.length === 1;
  const kpis = single ? kpisFor(s.widgets[0]!, data) : [];
  const isSynthesis = s.widgets.length === 1 && s.widgets[0]!.kind === 'ai' && data.summaries[s.widgets[0]!.key]?.content.mode === 'synthesis';

  return (
    <>
      <div className="eyebrow">{s.eyebrow}</div>
      <h2>{s.title}</h2>
      {suppressed ? (
        <p className="suppressed">
          Zu wenige Antworten für diese Auswahl (n = {n}, Minimum {data.project.minGroupSize}) – zum Schutz der Teilnehmenden ausgeblendet.
        </p>
      ) : (
        <div className={`body${single && kpis.length && !isSynthesis ? ' kpi-right' : s.widgets.length > 1 ? ' w2' : ''}`}>
          {s.widgets.map((w, i) => (
            <div className="panel" key={i}>
              {!(single && w.kind === 'compare_stairs') && !isSynthesis && <h4>{widgetTitle(w, data)}</h4>}
              <div className="viz">
                {w.kind === 'ai' ? (
                  <SummaryView stored={data.summaries[w.key]} names={data.names} showNames={showNames} compact={!single} maxThemes={single ? 6 : 4} />
                ) : (
                  <WidgetViz w={w} data={data} showNames={showNames} large={single} limit={single ? 9 : 7} />
                )}
              </div>
            </div>
          ))}
          {single && kpis.length > 0 && !isSynthesis && (
            <div className="kpibox">
              {kpis.map((k) => (
                <div key={k.label}>
                  <div className="l">{k.label}</div>
                  <div className={`v${k.accent ? ' o' : ''}`} style={k.value.length > 8 ? { fontSize: 30 } : undefined}>
                    {k.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {setting?.note && <div className="note-mod">{setting.note}</div>}
      {footer}
    </>
  );
}

export function Deck({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState<ResultFilter>({});
  const { data, error } = useResults(projectId, filter);
  const [cur, setCur] = useState(() => Math.max(0, Number(location.hash.slice(1)) - 1 || 0));
  const [overview, setOverview] = useState(false);
  const [hud, setHud] = useState(true);
  const deckRef = useRef<HTMLDivElement>(null);
  const hudTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const slides = data ? data.survey.deck.filter((s) => !data.slides[s.id]?.hidden) : [];
  const total = slides.length;
  const show = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(total - 1, i));
      setCur(next);
      history.replaceState(null, '', `#${next + 1}`);
    },
    [total],
  );

  useEffect(() => {
    const fit = () => {
      if (deckRef.current) deckRef.current.style.transform = `scale(${Math.min(innerWidth / 1280, innerHeight / 720)})`;
    };
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') return;
      if (e.key === 'Escape') setOverview(false);
      else if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        show(cur + 1);
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        show(cur - 1);
      } else if (e.key === 'Home') show(0);
      else if (e.key === 'End') show(total - 1);
      else if (e.key === 'o' || e.key === 'O') setOverview((o) => !o);
      else if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [cur, show, total]);

  useEffect(() => {
    const onMove = () => {
      setHud(true);
      clearTimeout(hudTimer.current);
      hudTimer.current = setTimeout(() => setHud(false), 2500);
    };
    addEventListener('mousemove', onMove);
    onMove();
    return () => removeEventListener('mousemove', onMove);
  }, []);

  if (error) return <p className="error" style={{ padding: 40 }}>{error}</p>;
  if (!data) return null;

  const filtered = Boolean(filter.company || filter.func || filter.workshop !== undefined);
  const suppressed = filtered && data.results.n < data.project.minGroupSize;
  const companies = data.results.participation.byCompany.map((c) => c.label);

  return (
    <>
      <div className="deck-stage">
        <div className="deck" ref={deckRef}>
          {slides.map((s, i) => (
            <section key={s.id} className={`slide${i === cur ? ' on' : ''}${s.widgets[0]?.kind === 'participation' ? ' title-slide' : ''}`} aria-hidden={i !== cur}>
              <SlideView s={s} data={data} index={i} total={total} filtered={filtered} suppressed={suppressed} />
            </section>
          ))}
        </div>
      </div>
      <div className={`deck-hud${hud ? ' show' : ''}`}>
        <button onClick={() => navigate(`/admin/p/${projectId}#slides`)} title="Zurück zum Admin">
          ✕
        </button>
        <button onClick={() => show(cur - 1)} aria-label="Vorherige Folie">
          ←
        </button>
        <span>
          {cur + 1} / {total}
        </span>
        <button onClick={() => show(cur + 1)} aria-label="Nächste Folie">
          →
        </button>
        <button onClick={() => setOverview((o) => !o)}>Übersicht</button>
        <select
          aria-label="Auswahl"
          value={filter.workshop !== undefined ? `ws:${filter.workshop}` : filter.company ? `c:${filter.company}` : ''}
          onChange={(e) => {
            const v = e.target.value;
            setFilter(v.startsWith('ws:') ? { workshop: v === 'ws:true' } : v.startsWith('c:') ? { company: v.slice(2) } : {});
          }}
          style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 8px', color: 'var(--ink)' }}
        >
          <option value="">Alle Antworten</option>
          <option value="ws:true">Nur Workshop-Teilnehmende</option>
          <option value="ws:false">Nur Umfrage</option>
          {companies.map((c) => (
            <option key={c} value={`c:${c}`}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className={`deck-overview${overview ? ' on' : ''}`} onClick={() => setOverview(false)}>
        <h4 className="muted" style={{ marginBottom: 16 }}>
          Folienübersicht – Folie anklicken oder Esc
        </h4>
        <div className="g">
          {slides.map((s, i) => (
            <div
              key={s.id}
              className={`th${i === cur ? ' cur' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                show(i);
                setOverview(false);
              }}
            >
              <div className="n">{i + 1}</div>
              <div className="t">{s.title}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
