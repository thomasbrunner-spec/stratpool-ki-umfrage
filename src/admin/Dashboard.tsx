import { useEffect, useState } from 'react';
import { api, errorText } from '../api';
import { widgetKey, type CompareStairsResult, type MatrixResult, type SelfVsDepthResult } from '../../shared/aggregate';
import type { ResultFilter, Widget } from '../../shared/types';
import { CompareStairs, LevelColumns, Matrix, QuestionViz, SelfVsDepth, num } from '../charts/Viz';
import type { ResultsResponse } from './types';

export function useResults(projectId: string, filter: ResultFilter) {
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState('');
  const key = JSON.stringify(filter);
  useEffect(() => {
    const qs = new URLSearchParams();
    if (filter.company) qs.set('company', filter.company);
    if (filter.func) qs.set('func', filter.func);
    if (filter.workshop !== undefined) qs.set('workshop', String(filter.workshop));
    let alive = true;
    const load = () =>
      api
        .get<ResultsResponse>(`/api/admin/projects/${projectId}/results?${qs.toString()}`)
        .then((d) => alive && setData(d))
        .catch((e: unknown) => alive && setError(errorText(e)));
    void load();
    // live dashboard: refresh every 30 s
    const t = setInterval(() => void load(), 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, key]);
  return { data, error, setData };
}

export function FilterBar({ data, filter, setFilter }: { data: ResultsResponse; filter: ResultFilter; setFilter: (f: ResultFilter) => void }) {
  const companies = [...new Set([...data.project.companies, ...data.results.participation.byCompany.map((c) => c.label)])].filter((c) => c && c !== '—');
  return (
    <div className="filters">
      <label className="field">
        <span>Gesellschaft</span>
        <select className="input" value={filter.company ?? ''} onChange={(e) => setFilter({ ...filter, company: e.target.value || undefined })}>
          <option value="">Alle</option>
          {companies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Bereich</span>
        <select className="input" value={filter.func ?? ''} onChange={(e) => setFilter({ ...filter, func: e.target.value || undefined })}>
          <option value="">Alle</option>
          {data.survey.functions.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Workshop-Teilnahme</span>
        <select
          className="input"
          value={filter.workshop === undefined ? '' : String(filter.workshop)}
          onChange={(e) => setFilter({ ...filter, workshop: e.target.value === '' ? undefined : e.target.value === 'true' })}
        >
          <option value="">Alle</option>
          <option value="true">Nur Workshop-Teilnehmende</option>
          <option value="false">Nur Umfrage</option>
        </select>
      </label>
      {(filter.company || filter.func || filter.workshop !== undefined) && (
        <button className="btn small ghost" onClick={() => setFilter({})}>
          Filter zurücksetzen
        </button>
      )}
    </div>
  );
}

/** Renders one deck widget (shared by dashboard and presentation). */
export function WidgetViz({ w, data, showNames, large, limit }: { w: Widget; data: ResultsResponse; showNames: boolean; large?: boolean; limit?: number }) {
  const { survey, results, names } = data;
  switch (w.kind) {
    case 'question': {
      const q = survey.questions.find((x) => x.id === w.q);
      const r = results.questions[w.q];
      return q && r ? <QuestionViz q={q} survey={survey} result={r} names={names} showNames={showNames} large={large} limit={limit} /> : null;
    }
    case 'compare_stairs': {
      const d = results.derived[widgetKey(w)] as CompareStairsResult | undefined;
      const q = survey.questions.find((x) => x.id === w.today);
      return d && q?.type === 'stairs' ? <CompareStairs data={d} survey={survey} scaleId={q.scale} /> : null;
    }
    case 'depth': {
      const d = results.depth[w.q];
      return d ? <LevelColumns levels={d.levels} /> : null;
    }
    case 'self_vs_depth': {
      const d = results.derived[widgetKey(w)] as SelfVsDepthResult | undefined;
      return d ? <SelfVsDepth data={d} /> : null;
    }
    case 'matrix': {
      const d = results.derived[widgetKey(w)] as MatrixResult | undefined;
      return d ? <Matrix data={d} xLabel={w.xLabel} yLabel={w.yLabel} quadrants={w.quadrants} /> : null;
    }
    default:
      return null;
  }
}

export function Dashboard({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState<ResultFilter>({});
  const { data, error } = useResults(projectId, filter);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Wird geladen …</p>;
  const { survey, results } = data;
  const p = results.participation;
  const cmp = Object.values(results.derived).find((d): d is CompareStairsResult => 'meanGap' in d);

  return (
    <div>
      <FilterBar data={data} filter={filter} setFilter={setFilter} />
      <div className="kpis">
        <div className="kpi">
          <div className="v">{results.n}</div>
          <div className="l">Antworten (im Filter)</div>
        </div>
        <div className="kpi">
          <div className="v">
            {p.completed}/{p.invited}
          </div>
          <div className="l">Abgeschlossen</div>
        </div>
        {cmp && (
          <div className="kpi">
            <div className="v">
              {num(cmp.today.mean)} → {num(cmp.target.mean)}
            </div>
            <div className="l">AI-Native-Stufe heute → Ziel</div>
          </div>
        )}
      </div>

      <div className="dash-grid">
        {survey.deck
          .flatMap((s) => s.widgets)
          .filter((w) => w.kind === 'compare_stairs' || w.kind === 'depth' || w.kind === 'self_vs_depth' || w.kind === 'matrix')
          .map((w, i) => (
            <div className="viz-card" key={`d${i}`} style={w.kind === 'compare_stairs' ? { gridColumn: '1 / -1' } : undefined}>
              <h3>
                {w.kind === 'compare_stairs'
                  ? 'Transformationspfad: heute vs. in drei Jahren'
                  : w.kind === 'depth'
                    ? 'Nutzungstiefe (höchste erreichte Stufe)'
                    : w.kind === 'self_vs_depth'
                      ? 'Selbsteinschätzung nach Nutzungstiefe'
                      : `Matrix ${w.kind === 'matrix' ? `${w.xLabel} × ${w.yLabel}` : ''}`}
              </h3>
              <div className="sub">Abgeleitete Auswertung</div>
              <WidgetViz w={w} data={data} showNames large={w.kind === 'compare_stairs'} />
            </div>
          ))}
        {survey.questions.map((q, i) => {
          const r = results.questions[q.id];
          if (!r) return null;
          return (
            <div className="viz-card" key={q.id} style={q.type === 'grid' ? { gridColumn: '1 / -1' } : undefined}>
              <h3>
                {i + 1}. {q.short}
              </h3>
              <div className="sub">
                {q.title} · n = {r.n}
              </div>
              <QuestionViz q={q} survey={survey} result={r} names={data.names} showNames large={q.type === 'grid'} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
