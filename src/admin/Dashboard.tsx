import { useEffect, useState } from 'react';
import { api, errorText } from '../api';
import {
  widgetKey,
  type CobwebResult,
  type CobwebSplitResult,
  type FteResult,
  type HeroResult,
  type MatrixResult,
  type PilotsResult,
  type SelfVsDepthResult,
} from '../../shared/aggregate';
import type { ResultFilter, UseCaseQuestion, Widget } from '../../shared/types';
import {
  Blindspots,
  Bars,
  Cobweb,
  CobwebLegend,
  Gaps,
  Hero,
  LevelColumns,
  Matrix,
  QuestionViz,
  SelfVsDepth,
  UseCaseMap,
  num,
  pct,
} from '../charts/Viz';
import type { ResultsResponse } from './types';
import { neutralTitle } from '../../shared/validate';

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

export const BLUE = '#6DA7EC';
export const ORANGE = '#FD9A00';
const SPLIT_COLORS = [ORANGE, BLUE, '#C6D6E6'];

/** Renders one deck widget (shared by dashboard and presentation). */
export function WidgetViz({
  w,
  data,
  showNames,
  large,
  limit,
  step = 99,
}: {
  w: Widget;
  data: ResultsResponse;
  showNames: boolean;
  large?: boolean;
  limit?: number;
  /** current build step of the slide (presentation); dashboard shows everything */
  step?: number;
}) {
  const { survey, results, names } = data;
  const derived = results.derived[widgetKey(w)];
  const minN = data.project.minGroupSize;
  switch (w.kind) {
    case 'question': {
      const q = survey.questions.find((x) => x.id === w.q);
      const r = results.questions[w.q];
      return q && r ? <QuestionViz q={q} survey={survey} result={r} names={names} showNames={showNames} large={large} limit={limit} /> : null;
    }
    case 'depth': {
      const d = results.depth[w.q];
      return d ? <LevelColumns levels={d.levels} /> : null;
    }
    case 'self_vs_depth':
      return derived ? <SelfVsDepth data={derived as SelfVsDepthResult} /> : null;
    case 'matrix':
      return derived ? <Matrix data={derived as MatrixResult} xLabel={w.xLabel} yLabel={w.yLabel} quadrants={w.quadrants} /> : null;
    case 'cobweb': {
      const c = derived as CobwebResult | undefined;
      if (!c || c.n === 0) return <p className="empty">Noch keine Antworten.</p>;
      const layers = [
        { label: 'heute', color: BLUE, values: c.dims.map((d) => d.now) },
        ...(w.show === 'now' ? [] : [{ label: 'Ziel in drei Jahren', color: ORANGE, values: c.dims.map((d) => d.target), hidden: w.show === 'build' && step < 1 }]),
      ];
      return (
        <div className="cobweb-wrap">
          <Cobweb labels={c.dims.map((d) => d.label)} layers={layers} size={large ? 'large' : 'normal'} />
          <CobwebLegend layers={layers} />
        </div>
      );
    }
    case 'cobweb_split': {
      const sp = derived as CobwebSplitResult | undefined;
      if (!sp) return null;
      const byCompany = w.by === 'company';
      const small = sp.groups.filter((g) => g.n < minN);
      // leadership vs. team needs both groups; companies below the minimum are left out
      const shown = byCompany ? sp.groups.filter((g) => g.n >= minN) : small.length ? [] : sp.groups;
      if (shown.length < 2) {
        return (
          <p className="empty">
            Zu wenige Antworten für einen Vergleich ({sp.groups.map((g) => `${g.label}: ${g.n}`).join(', ')}; Minimum {minN} je Gruppe).
          </p>
        );
      }
      const layers = shown.map((g, i) => ({
        label: `${g.label} (n = ${g.n})`,
        color: SPLIT_COLORS[i % SPLIT_COLORS.length]!,
        values: g.cobweb.dims.map((d) => d.now),
        dashed: i % 2 === 1,
      }));
      const hidden = byCompany ? sp.groups.filter((g) => g.n > 0 && g.n < minN) : [];
      return (
        <div className="cobweb-wrap">
          <Cobweb labels={shown[0]!.cobweb.dims.map((d) => d.label)} layers={layers} size={large ? 'large' : 'normal'} />
          <CobwebLegend layers={layers} />
          <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
            {byCompany
              ? `Reifegrad heute, jeweils für die eigene Gesellschaft bewertet${hidden.length ? ` · nicht gezeigt (unter ${minN} Antworten): ${hidden.map((g) => g.label).join(', ')}` : ''}`
              : 'Reifegrad heute · Führung = Geschäftsführung und Abteilungsleitungen'}
          </p>
        </div>
      );
    }
    case 'gaps': {
      const c = derived as CobwebResult | undefined;
      return c && c.n ? (
        <div>
          <Gaps dims={c.dims} />
          <div className="legend" style={{ justifyContent: 'center' }}>
            <span>
              <i style={{ background: BLUE }} />
              heute
            </span>
            <span>
              <i style={{ background: ORANGE }} />
              Ziel in drei Jahren
            </span>
            <span>Zahl rechts: durchschnittliche Lücke in Stufen</span>
          </div>
        </div>
      ) : (
        <p className="empty">Noch keine Antworten.</p>
      );
    }
    case 'blindspots': {
      const c = derived as CobwebResult | undefined;
      return c && c.n ? <Blindspots dims={c.dims} /> : <p className="empty">Noch keine Antworten.</p>;
    }
    case 'hero': {
      const h = derived as HeroResult | undefined;
      return h && h.n ? <Hero value={pct(h.share)} text={w.text} foot={`${h.count} von ${h.n} Befragten`} /> : <p className="empty">Noch keine Antworten.</p>;
    }
    case 'hero_fte': {
      const f = derived as FteResult | undefined;
      return f && f.n ? (
        <Hero
          value={`${num(f.sumHours, 0)} Std.`}
          text={`pro Woche könnten die ${f.n} Befragten mit guter KI-Unterstützung gewinnen – grob die Kapazität von rund ${num(f.fte)} Vollzeitstellen.`}
          foot={`Summe von Selbsteinschätzungen, keine Messung – nur als Größenordnung lesen · Ø ${num(f.meanHours)} Std. pro Person und Woche, ${w.hoursPerFte} Std. je Vollzeitstelle`}
        />
      ) : (
        <p className="empty">Noch keine Antworten.</p>
      );
    }
    case 'usecase_map': {
      const q = survey.questions.find((x) => x.id === w.q) as UseCaseQuestion | undefined;
      const r = results.questions[w.q];
      const ai = data.summaries[w.ai]?.content;
      if (!q || r?.type !== 'usecase') return null;
      if (!r.n) return <p className="empty">Noch keine Antworten.</p>;
      return (
        <div>
          <UseCaseMap q={q} items={r.items} clusters={ai?.mode === 'clusters' ? ai : undefined} />
          {ai?.mode !== 'clusters' && (
            <p className="small muted" style={{ margin: 0 }}>
              Jeder Punkt ist eine genannte Aufgabe. Nach der KI-Zusammenfassung erscheinen hier gebündelte Themen.
            </p>
          )}
        </div>
      );
    }
    case 'pilots': {
      const p = derived as PilotsResult | undefined;
      if (!p || !p.n) return <p className="empty">Noch keine Antworten.</p>;
      const pilotNames = showNames ? p.yesPids.map((pid) => names[pid]).filter(Boolean) : [];
      return (
        <div className="pilots">
          <div className="pilots-head">
            <span className="hero-v" style={{ fontSize: 96 }}>
              {p.yes}
            </span>
            <span className="hero-t" style={{ fontSize: 22 }}>
              von {p.n} Befragten würden einen KI-Pilot mitgestalten
              <br />
              <span className="small muted">
                {p.byOption.map((o) => `${o.label}: ${o.count}`).join(' · ')}
              </span>
            </span>
          </div>
          <Bars
            items={p.byFunc
              .filter((f) => f.yes > 0)
              .slice(0, limit ?? Infinity)
              .map((f) => ({ label: f.label, share: f.yes / Math.max(...p.byFunc.map((x) => x.yes), 1), value: String(f.yes), sub: `von ${f.total}` }))}
          />
          {pilotNames.length > 0 && <p className="small muted">Bereit: {pilotNames.join(', ')}</p>}
        </div>
      );
    }
    default:
      return null;
  }
}

const DERIVED_TITLES: Partial<Record<Widget['kind'], string>> = {
  cobweb: 'Reifegrad-Profil: heute vs. Ziel',
  gaps: 'Lücken je Bereich',
  cobweb_split: 'Führung vs. Team',
  blindspots: 'Blinde Flecken („kann ich nicht beurteilen“)',
  hero: 'Kennzahl',
  hero_fte: 'Zeitpotenzial',
  usecase_map: 'Use-Case-Landkarte',
  pilots: 'Pilot-Bereitschaft',
  depth: 'Nutzungstiefe (höchste erreichte Stufe)',
  self_vs_depth: 'Selbsteinschätzung nach Nutzungstiefe',
  matrix: 'Matrix Kenntnisse × Chance',
};

export function Dashboard({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState<ResultFilter>({});
  const { data, error } = useResults(projectId, filter);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Wird geladen …</p>;
  const { survey, results } = data;
  const p = results.participation;
  const cobweb = Object.values(results.derived).find((d): d is CobwebResult => 'dims' in d);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

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
        {cobweb && cobweb.n > 0 && (
          <div className="kpi">
            <div className="v">
              {num(avg(cobweb.dims.map((d) => d.now)))} → {num(avg(cobweb.dims.map((d) => d.target)))}
            </div>
            <div className="l">Ø Reifegrad heute → Ziel</div>
          </div>
        )}
      </div>

      <div className="dash-grid">
        {survey.deck
          .flatMap((s) => s.widgets)
          .filter((w) => w.kind in DERIVED_TITLES)
          .filter((w, i, all) => all.findIndex((x) => JSON.stringify(x) === JSON.stringify(w)) === i)
          .map((w, i) => (
            <div className="viz-card" key={`d${i}`} style={w.kind === 'usecase_map' || w.kind === 'gaps' ? { gridColumn: '1 / -1' } : undefined}>
              <h3>{w.kind === 'cobweb_split' && w.by === 'company' ? 'Gesellschaften im Vergleich' : DERIVED_TITLES[w.kind]}</h3>
              <div className="sub">Abgeleitete Auswertung</div>
              <WidgetViz w={w} data={data} showNames />
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
                {neutralTitle(q.title)} · n = {r.n}
              </div>
              <QuestionViz q={q} survey={survey} result={r} names={data.names} showNames large={q.type === 'grid'} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
