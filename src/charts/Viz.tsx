import type {
  CobwebDim,
  LevelItem,
  MatrixResult,
  QuestionResult,
  SelfVsDepthResult,
  TextItem,
  UseCaseItem,
} from '../../shared/aggregate';
import type { ClusterSummary } from '../../shared/ai-types';
import type { GridQuestion, MaturityQuestion, Question, Scale, SliderQuestion, SurveyDefinition, UseCaseQuestion } from '../../shared/types';

const C = {
  orange: '#FD9A00',
  blue: '#6DA7EC',
  muted: '#3E6B9B',
  line: '#1B4677',
  ink: '#FFFFFF',
  ink2: '#C6D6E6',
  ink3: '#8FA9C4',
  panel: '#0B2E55',
  deep: '#00244A',
  good: '#1BAF7A',
  warn: '#EDA100',
  bad: '#E66767',
};

export const pct = (x: number) => `${Math.round(x * 100)} %`;
export const num = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined ? '–' : x.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Deterministic jitter so dots do not move between renders */
function jitter(seed: string, spread: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (((h >>> 0) % 1000) / 1000 - 0.5) * spread;
}

export interface VizProps {
  q: Question;
  survey: SurveyDefinition;
  result: QuestionResult;
  names?: Record<string, string>;
  showNames?: boolean;
  large?: boolean;
  /** Max rows for bar lists / walls (presentation); zero rows are dropped when set */
  limit?: number;
}

export function QuestionViz({ q, survey, result, names, showNames, large, limit }: VizProps) {
  const cut = <T extends { share: number }>(xs: T[]) => (limit ? xs.filter((x) => x.share > 0).slice(0, limit) : xs);
  if (result.n === 0) return <p className="empty">Noch keine Antworten.</p>;
  switch (result.type) {
    case 'words':
      return <WordCloud words={result.words} large={large} />;
    case 'texts':
      return q.type === 'short_text' ? (
        <Wall items={result.items} names={names} showNames={showNames} limit={limit} />
      ) : (
        <Quotes items={result.items} names={names} showNames={showNames} />
      );
    case 'counts':
      return result.ordered ? (
        <Columns items={result.items.map((i) => ({ label: i.label, share: i.share, count: i.count }))} />
      ) : (
        <>
          <Bars items={cut(result.items).map((i) => ({ label: i.label, share: i.share, value: `${pct(i.share)}`, sub: `${i.count}×` }))} />
          {result.other.length > 0 && (
            <p className="small muted" style={{ marginTop: 10 }}>
              Sonstiges: {result.other.map((o) => o.text).join(' · ')}
            </p>
          )}
        </>
      );
    case 'numeric': {
      const sq = q as SliderQuestion;
      return sq.viz === 'gauge' ? <Gauge q={sq} mean={result.mean} n={result.n} /> : <DotPlot q={sq} values={result.values} mean={result.mean} />;
    }
    case 'levels': {
      const scale = q.type === 'stairs' ? survey.scales[q.scale] : undefined;
      return scale ? (
        <StairsChart scale={scale} series={[{ label: 'Antworten', color: C.orange, levels: result.levels }]} />
      ) : (
        <LevelColumns levels={result.levels} />
      );
    }
    case 'grid':
      return (q as GridQuestion).viz === 'ampel' ? (
        <AmpelBars q={q as GridQuestion} survey={survey} result={result} />
      ) : (
        <MaturityProfile q={q as GridQuestion} survey={survey} result={result} large={large} />
      );
    case 'maturity':
      return (
        <Gaps
          dims={[{ id: q.id, label: (q as MaturityQuestion).dimension, n: result.now.n, na: result.na, now: result.now.mean, target: result.target.mean, nowSd: result.now.sd, gap: result.gap }]}
          max={(q as MaturityQuestion).descriptions.length}
        />
      );
    case 'usecase':
      return <UseCaseList q={q as UseCaseQuestion} items={result.items} limit={limit} />;
    case 'points':
      return (
        <Bars
          ranked
          items={cut(result.items).map((i) => ({ label: i.label, share: i.share, value: pct(i.share), sub: `${i.total} Pkt.` }))}
        />
      );
  }
}

// ---------- Bars & columns ----------

export function Bars({ items, ranked }: { items: { label: string; share: number; value: string; sub?: string }[]; ranked?: boolean }) {
  const max = Math.max(...items.map((i) => i.share), 0.0001);
  const topShare = items[0]?.share ?? 0;
  return (
    <div className="bars">
      {items.map((it, i) => (
        <div key={it.label} className={`bar-row${it.share === topShare && it.share > 0 ? ' top' : ''}`}>
          <span className="lbl">
            {ranked && <span className="muted">{i + 1}. </span>}
            {it.label}
          </span>
          <span className="track">
            <span className="fill" style={{ width: `${(it.share / max) * 100}%`, display: 'block' }} />
          </span>
          <span className="val">
            {it.value}
            {it.sub && <small>{it.sub}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Columns({ items }: { items: { label: string; share: number; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.share), 0.0001);
  return (
    <div className="cols">
      {items.map((it) => (
        <div key={it.label} className={`col${it.share === max && it.share > 0 ? ' top' : ''}`} title={`${it.count} Antworten`}>
          <span className="pct">{pct(it.share)}</span>
          <span className="c" style={{ height: `${(it.share / max) * 78}%` }} />
          <span className="x">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LevelColumns({ levels }: { levels: LevelItem[] }) {
  return <Columns items={levels.map((l) => ({ label: `${l.value} ${l.title}`, share: l.share, count: l.count }))} />;
}

// ---------- Word cloud ----------

export function WordCloud({ words, large }: { words: { text: string; count: number }[]; large?: boolean }) {
  const top = words.slice(0, 40);
  const max = Math.max(...top.map((w) => w.count), 1);
  const min = Math.min(...top.map((w) => w.count), max);
  // Interleave big and small words for a balanced cloud
  const ordered = top.flatMap((w, i) => (i % 2 ? [] : [w])).concat(top.filter((_, i) => i % 2).reverse());
  const base = large ? 18 : 14;
  const span = large ? 46 : 30;
  return (
    <div className="wordcloud">
      {ordered.map((w) => {
        const t = max === min ? 1 : (w.count - min) / (max - min);
        const isTop = w.count === max;
        return (
          <span
            key={w.text}
            title={`${w.count}×`}
            style={{ fontSize: base + t * span, color: isTop ? C.orange : t > 0.4 ? C.ink : C.ink2, opacity: 0.6 + t * 0.4 }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}

// ---------- Texts ----------

const who = (pid: string, names?: Record<string, string>, show?: boolean) => (show && names?.[pid] ? names[pid] : null);

export function Wall({ items, names, showNames, limit }: { items: TextItem[]; names?: Record<string, string>; showNames?: boolean; limit?: number }) {
  const groups = new Map<string, { text: string; pids: string[] }>();
  for (const it of items) {
    const key = it.text.toLowerCase().replace(/[\s?!.]+$/g, '').trim();
    const g = groups.get(key) ?? { text: it.text, pids: [] };
    g.pids.push(it.pid);
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, b) => b.pids.length - a.pids.length).slice(0, limit ?? Infinity);
  return (
    <div className="wall">
      {list.map((g, i) => (
        <div className="item" key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          {g.pids.length > 1 && <span className="head orange" style={{ fontSize: 18 }}>{g.pids.length}×</span>}
          <span style={{ flex: 1 }}>
            {g.text}
            {showNames && <span className="small muted"> – {g.pids.map((pid) => names?.[pid]).filter(Boolean).join(', ')}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Quotes({ items, names, showNames }: { items: TextItem[]; names?: Record<string, string>; showNames?: boolean }) {
  return (
    <div className="quotes">
      {items.map((it, i) => (
        <div className="quote" key={i}>
          {it.text}
          {who(it.pid, names, showNames) && <div className="who">{who(it.pid, names, showNames)}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------- Dot plot ----------

export function DotPlot({ q, values, mean }: { q: SliderQuestion; values: number[]; mean: number | null }) {
  const W = 600;
  const H = 230;
  const pad = 26;
  const range = q.max - q.min;
  const binW = range <= 20 ? 1 : range / 20;
  const bins = new Map<number, number>();
  const dots: { x: number; k: number; v: number }[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    const b = Math.round((v - q.min) / binW);
    const k = bins.get(b) ?? 0;
    bins.set(b, k + 1);
    dots.push({ x: b, k, v });
  }
  const maxStack = Math.max(...bins.values(), 1);
  const r = Math.min(9, (H - 70) / (maxStack * 2.3));
  const xOf = (v: number) => pad + ((v - q.min) / range) * (W - 2 * pad);
  const yBase = H - 40;
  const ticks = Array.from({ length: 6 }, (_, i) => q.min + (range / 5) * i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Verteilung, Mittelwert ${num(mean)}`}>
      <line x1={pad} x2={W - pad} y1={yBase + 12} y2={yBase + 12} stroke={C.line} />
      {ticks.map((t) => (
        <text key={t} x={xOf(t)} y={yBase + 30} fill={C.ink3} fontSize="12" textAnchor="middle">
          {num(t, 0)}
        </text>
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={xOf(q.min + d.x * binW)} cy={yBase - d.k * r * 2.3} r={r} fill={C.ink} opacity={0.9} />
      ))}
      {mean !== null && (
        <g>
          <line x1={xOf(mean)} x2={xOf(mean)} y1={22} y2={yBase + 12} stroke={C.orange} strokeWidth={2.5} />
          <rect x={xOf(mean) - 34} y={2} width={68} height={22} rx={11} fill={C.orange} />
          <text x={xOf(mean)} y={17.5} fontSize="13" fontWeight="700" fill={C.deep} textAnchor="middle">
            Ø {num(mean)}
          </text>
        </g>
      )}
      <text x={pad} y={H - 2} fill={C.ink3} fontSize="12">
        ← {q.minLabel}
      </text>
      <text x={W - pad} y={H - 2} fill={C.ink3} fontSize="12" textAnchor="end">
        {q.maxLabel} →
      </text>
    </svg>
  );
}

// ---------- Gauge ----------

export function Gauge({ q, mean, n }: { q: SliderQuestion; mean: number | null; n: number }) {
  const W = 400;
  const H = 250;
  const cx = W / 2;
  const cy = 200;
  const R = 150;
  const t = mean === null ? 0 : (mean - q.min) / (q.max - q.min);
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from);
    const a1 = Math.PI * (1 - to);
    const x0 = cx + R * Math.cos(a0);
    const y0 = cy - R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1);
    const y1 = cy - R * Math.sin(a1);
    return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
  };
  const na = Math.PI * (1 - t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 300 }} role="img" aria-label={`Mittelwert ${num(mean, 0)} von ${q.max}`}>
      <path d={arc(0, 1)} stroke={C.line} strokeWidth={30} fill="none" />
      {t > 0 && <path d={arc(0, Math.max(t, 0.005))} stroke={C.orange} strokeWidth={30} fill="none" />}
      {Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI * (1 - i / 10);
        return (
          <text key={i} x={cx + (R + 28) * Math.cos(a)} y={cy - (R + 28) * Math.sin(a) + 4} fill={C.ink3} fontSize="11" textAnchor="middle">
            {q.min + ((q.max - q.min) / 10) * i}
          </text>
        );
      })}
      <line x1={cx} y1={cy} x2={cx + (R - 30) * Math.cos(na)} y2={cy - (R - 30) * Math.sin(na)} stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={9} fill={C.deep} stroke={C.ink} strokeWidth={3} />
      <text x={cx - R} y={cy + 32} fill={C.ink3} fontSize="13" textAnchor="middle">
        {q.minLabel}
      </text>
      <text x={cx + R} y={cy + 32} fill={C.ink3} fontSize="13" textAnchor="middle">
        {q.maxLabel}
      </text>
      <text x={cx} y={cy + 40} fill={C.ink} fontSize="34" textAnchor="middle" fontFamily="Varela Round">
        {num(mean, 0)}
        <tspan fontSize="14" fill={C.ink3}>
          {' '}
          von {q.max} · n={n}
        </tspan>
      </text>
    </svg>
  );
}

// ---------- Maturity profile (radar + heatmap) ----------

export function MaturityProfile({ q, survey, result, large }: { q: GridQuestion; survey: SurveyDefinition; result: Extract<QuestionResult, { type: 'grid' }>; large?: boolean }) {
  const levels = survey.scales[q.scale]?.levels ?? [];
  const maxLevel = levels.length || 5;
  const W = 560;
  const H = 440;
  const cx = W / 2;
  const cy = H / 2 + 4;
  const R = 150;
  const N = result.rows.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / N;
    const r = (v / maxLevel) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
  const means = result.rows.map((r) => r.mean ?? 0);
  const upper = result.rows.map((r) => Math.min(maxLevel, (r.mean ?? 0) + (r.sd ?? 0)));
  const lower = result.rows.map((r) => Math.max(0, (r.mean ?? 0) - (r.sd ?? 0)));
  const maxCount = Math.max(...result.rows.flatMap((r) => [...r.counts, r.na]), 1);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: large ? '1.1fr 1fr' : 'minmax(0,1fr)', gap: 16, alignItems: 'center' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Reifegrad-Profil">
        {Array.from({ length: maxLevel }, (_, l) => (
          <polygon key={l} points={poly(Array(N).fill(l + 1))} fill="none" stroke={C.line} />
        ))}
        {result.rows.map((r, i) => {
          const [x, y] = pt(i, maxLevel);
          const [lx, ly] = pt(i, maxLevel + 1.05);
          return (
            <g key={r.id}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} />
              <text x={lx} y={ly - 7} fill={C.ink2} fontSize="14" textAnchor={Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end'}>
                {r.label.split(/ (?=&)/).map((line, k) => (
                  <tspan key={k} x={lx} dy={k ? 16 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        <polygon points={poly(upper)} fill="none" stroke={C.blue} strokeDasharray="4 4" opacity={0.7} />
        <polygon points={poly(lower)} fill="none" stroke={C.blue} strokeDasharray="4 4" opacity={0.7} />
        <polygon points={poly(means)} fill="rgba(253,154,0,0.22)" stroke={C.orange} strokeWidth={2.5} />
        {means.map((m, i) => {
          const [x, y] = pt(i, m);
          return <circle key={i} cx={x} cy={y} r={4} fill={C.orange} />;
        })}
        {Array.from({ length: maxLevel }, (_, l) => (
          <text key={l} x={cx + 4} y={cy - ((l + 1) / maxLevel) * R + 4} fontSize="10" fill={C.ink3}>
            {l + 1}
          </text>
        ))}
      </svg>
      <div>
        <table className="heat" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3 }}>
          <thead>
            <tr>
              <th />
              {levels.map((l) => (
                <th key={l.value} title={l.title}>
                  {l.value}
                </th>
              ))}
              <th title={q.naLabel}>k. A.</th>
              <th>Ø</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.id}>
                <td className="lbl">{r.label}</td>
                {r.counts.map((c, i) => (
                  <td key={i} style={{ background: c ? `rgba(253,154,0,${0.15 + 0.75 * (c / maxCount)})` : 'rgba(255,255,255,0.03)', color: c / maxCount > 0.5 ? C.deep : C.ink }}>
                    {c || ''}
                  </td>
                ))}
                <td style={{ color: C.ink3 }}>{r.na || ''}</td>
                <td style={{ fontFamily: 'Varela Round' }}>{num(r.mean)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="legend" style={{ marginTop: 10 }}>
          <span>
            <i style={{ background: C.orange }} />
            Mittelwert
          </span>
          <span>
            <i style={{ border: `1px dashed ${C.blue}` }} />
            ± Standardabweichung
          </span>
          <span>{levels.map((l) => `${l.value} ${l.title}`).join(' · ')}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Stairs (AI-Native levels) ----------

export function StairsChart({ scale, series }: { scale: Scale; series: { label: string; color: string; levels: LevelItem[] }[] }) {
  const levels = scale.levels;
  const W = 1000;
  const H = 400;
  const colW = W / levels.length;
  const baseY = 310;
  const stepH = 28;
  const barMax = 220;
  const maxShare = Math.max(...series.flatMap((sr) => sr.levels.map((l) => l.share)), 0.0001);
  const bw = (colW * 0.56) / series.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Verteilung auf die Stufen">
      {series.length > 1 && (
        <g fontSize="13">
          {series.map((sr, k) => (
            <g key={sr.label} transform={`translate(${k * 140},0)`}>
              <rect x={0} y={4} width={12} height={12} rx={2} fill={sr.color} />
              <text x={18} y={15} fill={C.ink2}>
                {sr.label}
              </text>
            </g>
          ))}
        </g>
      )}
      {levels.map((l, i) => {
        const x = i * colW;
        const stairTop = baseY - (i + 1) * stepH;
        const cx = x + colW / 2;
        return (
          <g key={l.value}>
            <rect x={x + 4} y={stairTop} width={colW - 8} height={baseY - stairTop} rx={8} fill={C.panel} stroke={C.line} opacity={0.9} />
            <text x={x + 12} y={baseY - 8} fill={C.ink3} fontSize="12">
              {l.value}
            </text>
            {series.map((sr, k) => {
              const item = sr.levels.find((it) => it.value === l.value);
              const h = item ? (item.share / maxShare) * barMax : 0;
              const bx = cx - (bw * series.length) / 2 + k * bw + 2;
              return (
                <g key={sr.label}>
                  {h > 0 && <rect x={bx} y={baseY - h} width={bw - 4} height={h} rx={4} fill={sr.color} />}
                  {item && item.count > 0 && (
                    <text x={bx + (bw - 4) / 2} y={baseY - h - 7} fill={sr.color} fontSize="15" textAnchor="middle" fontFamily="Varela Round">
                      {item.count}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={cx} y={baseY + 22} fill={C.ink} fontSize="15" textAnchor="middle" fontFamily="Varela Round">
              {l.title}
            </text>
          </g>
        );
      })}
      {scale.brackets?.map((b) => (
        <g key={b.label}>
          <line x1={b.from * colW + 8} x2={(b.to + 1) * colW - 8} y1={baseY + 40} y2={baseY + 40} stroke={C.ink3} strokeWidth={2} />
          <text x={b.from * colW + 8} y={baseY + 60} fill={C.ink3} fontSize="12" letterSpacing="1.5">
            {b.label.toUpperCase()}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------- Cobweb (maturity radar, today vs. target) ----------

export interface CobwebLayer {
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  /** hidden until revealed (presentation build step); always visible in print */
  hidden?: boolean;
}

export function Cobweb({ labels, layers, max = 5, size = 'normal' }: { labels: string[]; layers: CobwebLayer[]; max?: number; size?: 'normal' | 'large' }) {
  const W = 640;
  const H = 470;
  const cx = W / 2;
  const cy = H / 2 + 6;
  const R = size === 'large' ? 175 : 165;
  const N = labels.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / N;
    const r = (v / max) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = (vals: (number | null)[]) => vals.map((v, i) => pt(i, v ?? 0).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: '100%' }} role="img" aria-label="Reifegrad-Profil">
      <defs>
        <radialGradient id="cw-bg">
          <stop offset="0%" stopColor="#0F3A69" />
          <stop offset="100%" stopColor="#0B2E55" />
        </radialGradient>
      </defs>
      <polygon points={poly(Array(N).fill(max))} fill="url(#cw-bg)" stroke={C.line} />
      {Array.from({ length: max - 1 }, (_, l) => (
        <polygon key={l} points={poly(Array(N).fill(l + 1))} fill="none" stroke={C.line} />
      ))}
      {labels.map((label, i) => {
        const [x, y] = pt(i, max);
        const [lx, ly] = pt(i, max + 0.95);
        const anchor = Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end';
        return (
          <g key={label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} />
            <text x={lx} y={ly - 7} fill={C.ink2} fontSize="15" textAnchor={anchor}>
              {label.split(/ (?=&)/).map((line, k) => (
                <tspan key={k} x={lx} dy={k ? 17 : 0}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      {Array.from({ length: max }, (_, l) => (
        <text key={l} x={cx + 5} y={cy - ((l + 1) / max) * R + 4} fontSize="11" fill={C.ink3}>
          {l + 1}
        </text>
      ))}
      {layers.map((layer) => (
        <g key={layer.label} className={layer.hidden ? 'build-hidden' : 'build-shown'}>
          <polygon
            points={poly(layer.values)}
            fill={layer.dashed ? 'none' : `${layer.color}33`}
            stroke={layer.color}
            strokeWidth={3}
            strokeDasharray={layer.dashed ? '6 5' : undefined}
            strokeLinejoin="round"
          />
          {layer.values.map((v, i) => {
            if (v === null) return null;
            const [x, y] = pt(i, v);
            return <circle key={i} cx={x} cy={y} r={5} fill={layer.color} />;
          })}
        </g>
      ))}
    </svg>
  );
}

export function CobwebLegend({ layers }: { layers: { label: string; color: string; dashed?: boolean; hidden?: boolean }[] }) {
  return (
    <div className="legend" style={{ justifyContent: 'center', fontSize: 14 }}>
      {layers.map((l) => (
        <span key={l.label} className={l.hidden ? 'build-hidden' : 'build-shown'}>
          <i style={l.dashed ? { border: `2px dashed ${l.color}` } : { background: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  );
}

// ---------- Gaps: dumbbell today → target ----------

export function Gaps({ dims, max = 5 }: { dims: CobwebDim[]; max?: number }) {
  const rows = [...dims].sort((a, b) => (b.gap ?? -9) - (a.gap ?? -9));
  const W = 900;
  const rowH = 52;
  const padL = 260;
  const padR = 90;
  const H = rows.length * rowH + 40;
  const xOf = (v: number) => padL + ((v - 1) / (max - 1)) * (W - padL - padR);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Lücke zwischen heute und Ziel je Bereich">
      {Array.from({ length: max }, (_, i) => (
        <g key={i}>
          <line x1={xOf(i + 1)} x2={xOf(i + 1)} y1={10} y2={H - 26} stroke={C.line} strokeDasharray="3 5" />
          <text x={xOf(i + 1)} y={H - 8} fill={C.ink3} fontSize="12" textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
      {rows.map((d, i) => {
        const y = 30 + i * rowH;
        const top = i === 0 && (d.gap ?? 0) > 0;
        return (
          <g key={d.id}>
            <text x={padL - 18} y={y + 5} fill={top ? C.ink : C.ink2} fontSize="16" textAnchor="end" fontFamily={top ? 'Varela Round' : undefined}>
              {d.label}
            </text>
            {d.now !== null && d.target !== null && (
              <line x1={xOf(d.now)} x2={xOf(d.target)} y1={y} y2={y} stroke={top ? C.orange : C.muted} strokeWidth={top ? 6 : 4} strokeLinecap="round" />
            )}
            {d.now !== null && <circle cx={xOf(d.now)} cy={y} r={9} fill={C.blue} />}
            {d.target !== null && <circle cx={xOf(d.target)} cy={y} r={9} fill={C.orange} />}
            <text x={W - padR + 20} y={y + 6} fill={top ? C.orange : C.ink} fontSize="18" fontFamily="Varela Round">
              {d.gap === null ? '–' : `+${num(d.gap)}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Blind spots: share "cannot judge" ----------

export function Blindspots({ dims }: { dims: CobwebDim[] }) {
  const items = dims
    .map((d) => ({ label: d.label, share: d.n + d.na ? d.na / (d.n + d.na) : 0, count: d.na }))
    .sort((a, b) => b.share - a.share);
  return <Bars items={items.map((i) => ({ label: i.label, share: i.share, value: pct(i.share), sub: `${i.count}× k. A.` }))} />;
}

// ---------- Traffic light (AI usage rules) ----------

export function AmpelBars({ q, survey, result }: { q: GridQuestion; survey: SurveyDefinition; result: Extract<QuestionResult, { type: 'grid' }> }) {
  const levels = survey.scales[q.scale]?.levels ?? [];
  const toneColor = (t?: string) => (t === 'good' ? C.good : t === 'warn' ? C.warn : t === 'bad' ? C.bad : C.muted);
  return (
    <div className="ampel">
      <div className="legend" style={{ marginBottom: 12 }}>
        {levels.map((l) => (
          <span key={l.value}>
            <i style={{ background: toneColor(l.tone) }} />
            {l.title}
          </span>
        ))}
        <span>
          <i style={{ background: C.muted }} />
          {q.naLabel}
        </span>
      </div>
      {result.rows.map((r) => {
        const total = r.counts.reduce((a, b) => a + b, 0) + r.na;
        const parts = [...r.counts.map((c, i) => ({ c, color: toneColor(levels[i]?.tone) })), { c: r.na, color: C.muted }];
        return (
          <div className="ampel-row" key={r.id}>
            <span className="lbl">{r.label}</span>
            <span className="stack">
              {parts.map((p, i) =>
                p.c > 0 ? (
                  <span key={i} style={{ width: `${(p.c / total) * 100}%`, background: p.color }}>
                    {p.c / total >= 0.12 ? pct(p.c / total) : ''}
                  </span>
                ) : null,
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Big numbers ----------

export function Hero({ value, text, foot }: { value: string; text: string; foot?: string }) {
  return (
    <div className="hero">
      <div className="hero-v">{value}</div>
      <div className="hero-t">{text}</div>
      {foot && <div className="hero-f">{foot}</div>}
    </div>
  );
}

// ---------- Use cases ----------

export function UseCaseList({ q, items, limit }: { q: UseCaseQuestion; items: UseCaseItem[]; limit?: number }) {
  const sorted = [...items].sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0)).slice(0, limit ?? Infinity);
  return (
    <table className="tbl" style={{ fontSize: 13.5 }}>
      <thead>
        <tr>
          <th>Aufgabe</th>
          <th style={{ textAlign: 'right' }}>Std./Woche</th>
          <th>Daten</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((it, i) => (
          <tr key={i}>
            <td>{it.task}</td>
            <td style={{ textAlign: 'right', fontFamily: 'Varela Round' }}>{it.hours === null ? '–' : num(it.hours)}</td>
            <td className="muted">{q.dataOptions.find((o) => o.id === it.data)?.label.replace(/ \(.*\)$/, '') ?? '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Use-case landscape: x = data sensitivity (feasibility), y = weekly hours.
 * With an AI cluster summary the clusters become bubbles, otherwise each answer is a dot.
 */
export function UseCaseMap({ q, items, clusters }: { q: UseCaseQuestion; items: UseCaseItem[]; clusters?: ClusterSummary }) {
  const W = 1000;
  const H = 470;
  const padL = 60;
  const padB = 70;
  const padT = 20;
  const known = items.filter((i) => i.level !== null && i.hours !== null);
  const unknown = items.length - known.length;
  const maxH = Math.max(q.hoursMax / 2, ...known.map((i) => i.hours ?? 0));
  const xOf = (lvl: number) => padL + ((lvl - 0.5) / 5) * (W - padL - 20);
  const yOf = (h: number) => padT + (1 - h / maxH) * (H - padT - padB);
  const hoursSorted = known.map((i) => i.hours ?? 0).sort((a, b) => a - b);
  const midH = hoursSorted.length ? hoursSorted[Math.floor(hoursSorted.length / 2)]! : maxH / 2;
  const midX = xOf(2.5);
  const midY = yOf(midH);

  type Bubble = { x: number; y: number; r: number; label?: string; n: number; key: string };
  let bubbles: Bubble[];
  if (clusters && clusters.themes.some((t) => t.pids?.length)) {
    bubbles = clusters.themes
      .map((t, k): Bubble | null => {
        const its = known.filter((i) => t.pids?.includes(i.pid));
        if (!its.length) return null;
        const lv = its.map((i) => i.level ?? 0).sort((a, b) => a - b);
        const level = lv[Math.floor(lv.length / 2)]!;
        const hours = its.reduce((a, i) => a + (i.hours ?? 0), 0) / its.length;
        return { x: xOf(level) + jitter(t.title, 30), y: yOf(hours), r: 14 + Math.sqrt(its.length) * 12, label: t.title, n: its.length, key: `t${k}` };
      })
      .filter((b): b is Bubble => b !== null);
  } else {
    bubbles = known.map((i) => ({ x: xOf(i.level!) + jitter(i.pid, 70), y: yOf(i.hours!), r: 8, n: 1, key: i.pid }));
  }

  const qLabel = (x: number, y: number, t: string, hi?: boolean, anchor: 'start' | 'end' = 'start') => (
    <text x={x} y={y} fill={hi ? C.orange : C.ink3} fontSize={hi ? 15 : 12} letterSpacing="1.4" textAnchor={anchor} fontFamily={hi ? 'Varela Round' : undefined}>
      {t.toUpperCase()}
    </text>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Use-Case-Landkarte">
      <rect x={padL} y={padT} width={midX - padL} height={midY - padT} fill="rgba(253,154,0,0.08)" />
      <line x1={midX} x2={midX} y1={padT} y2={H - padB} stroke={C.line} />
      <line x1={padL} x2={W - 20} y1={midY} y2={midY} stroke={C.line} />
      {qLabel(padL + 12, padT + 22, 'Quick-Win-Kandidaten', true)}
      {qLabel(W - 32, padT + 20, 'Hoher Hebel, hohe Anforderungen', false, 'end')}
      {qLabel(padL + 12, H - padB - 12, 'Einfach, kleiner Hebel')}
      {qLabel(W - 32, H - padB - 12, 'Später prüfen', false, 'end')}
      {q.dataOptions
        .filter((o) => o.level !== null)
        .map((o) => (
          <text key={o.id} x={xOf(o.level!)} y={H - padB + 22} fill={C.ink2} fontSize="12" textAnchor="middle">
            {o.label.replace(/ \(.*\)$/, '')}
          </text>
        ))}
      <text x={(padL + W) / 2} y={H - 10} fill={C.ink3} fontSize="12" textAnchor="middle">
        Datensensibilität →{unknown ? `   (${unknown} ohne Angabe nicht dargestellt)` : ''}
      </text>
      {[0, maxH / 2, maxH].map((h) => (
        <text key={h} x={padL - 10} y={yOf(h) + 4} fill={C.ink3} fontSize="11" textAnchor="end">
          {num(h, 0)}
        </text>
      ))}
      <text x={16} y={(padT + H - padB) / 2} fill={C.ink3} fontSize="12" textAnchor="middle" transform={`rotate(-90 16 ${(padT + H - padB) / 2})`}>
        Std. pro Woche →
      </text>
      {bubbles.map((b) => {
        const quick = b.x < midX && b.y < midY;
        return (
          <g key={b.key}>
            <circle cx={b.x} cy={b.y} r={b.r} fill={quick ? C.orange : C.blue} opacity={0.85} stroke={C.deep} strokeWidth={2} />
            {b.label && (
              <text x={b.x} y={b.y - b.r - 8} fill={C.ink} fontSize="14" textAnchor="middle" fontFamily="Varela Round">
                {b.label} ({b.n})
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Scatter: self-assessment vs. usage depth ----------

function wrap2(t: string): string[] {
  const words = t.split(' ');
  if (t.length <= 14 || words.length < 2) return [t];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

export function SelfVsDepth({ data }: { data: SelfVsDepthResult }) {
  const W = 560;
  const H = 330;
  const padL = 40;
  const padB = 62;
  const n = data.byLevel.length;
  const colW = (W - padL - 10) / n;
  const xOf = (lvl: number) => padL + colW * (lvl + 0.5);
  const yOf = (v: number) => 10 + (1 - v / 100) * (H - padB - 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Selbsteinschätzung nach Nutzungstiefe">
      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 10} y1={yOf(t)} y2={yOf(t)} stroke={C.line} strokeDasharray={t === 50 ? '0' : '3 4'} />
          <text x={padL - 8} y={yOf(t) + 4} fill={C.ink3} fontSize="11" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {data.byLevel.map((l) => (
        <g key={l.level}>
          <text x={xOf(l.level)} y={H - padB + 18} fill={C.ink2} fontSize="12" textAnchor="middle">
            {wrap2(l.title).map((line, k) => (
              <tspan key={k} x={xOf(l.level)} dy={k ? 14 : 0}>
                {line}
              </tspan>
            ))}
          </text>
          <text x={xOf(l.level)} y={H - padB + 48} fill={C.ink3} fontSize="11" textAnchor="middle">
            n={l.n}
          </text>
          {l.meanSelf !== null && (
            <line x1={xOf(l.level) - colW * 0.32} x2={xOf(l.level) + colW * 0.32} y1={yOf(l.meanSelf)} y2={yOf(l.meanSelf)} stroke={C.orange} strokeWidth={3} />
          )}
        </g>
      ))}
      {data.points.map((p) => (
        <circle key={p.pid} cx={xOf(p.x) + jitter(p.pid, colW * 0.5)} cy={yOf(p.y)} r={6} fill={C.ink} opacity={0.85} />
      ))}
      <text x={12} y={H / 2 - 20} fill={C.ink3} fontSize="11" transform={`rotate(-90 12 ${H / 2 - 20})`} textAnchor="middle">
        Selbsteinschätzung
      </text>
    </svg>
  );
}

// ---------- Scatter matrix with quadrants ----------

export function Matrix({ data, xLabel, yLabel, quadrants }: { data: MatrixResult; xLabel: string; yLabel: string; quadrants: [string, string, string, string] }) {
  const W = 560;
  const H = 340;
  const pad = 30;
  const xOf = (v: number) => pad + (v / 100) * (W - 2 * pad);
  const yOf = (v: number) => pad + (1 - v / 100) * (H - 2 * pad);
  const maxQ = Math.max(...data.quadrants);
  // order: bottom-left, top-left, bottom-right, top-right
  const pos = [
    { x: pad + 10, y: H - pad - 12, a: 'start' },
    { x: pad + 10, y: pad + 22, a: 'start' },
    { x: W - pad - 10, y: H - pad - 12, a: 'end' },
    { x: W - pad - 10, y: pad + 22, a: 'end' },
  ] as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${xLabel} und ${yLabel}`}>
      <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill="rgba(255,255,255,0.02)" stroke={C.line} rx={8} />
      <line x1={xOf(data.midX)} x2={xOf(data.midX)} y1={pad} y2={H - pad} stroke={C.line} />
      <line y1={yOf(data.midY)} y2={yOf(data.midY)} x1={pad} x2={W - pad} stroke={C.line} />
      {quadrants.map((label, i) => {
        const p = pos[i]!;
        const share = data.quadrants[i]!;
        const hi = share === maxQ && share > 0;
        return (
          <g key={label}>
            <text x={p.x} y={p.y - 18} fill={C.ink3} fontSize="11" letterSpacing="1.2" textAnchor={p.a}>
              {label.toUpperCase()}
            </text>
            <text x={p.x} y={p.y + 2} fill={hi ? C.orange : C.ink2} fontSize="20" fontFamily="Varela Round" textAnchor={p.a}>
              {pct(share)}
            </text>
          </g>
        );
      })}
      {data.points.map((pt) => (
        <circle key={pt.pid} cx={xOf(pt.x)} cy={yOf(pt.y)} r={6} fill={C.orange} opacity={0.85} stroke={C.deep} />
      ))}
      <text x={W / 2} y={H - 8} fill={C.ink3} fontSize="12" textAnchor="middle">
        {xLabel} →
      </text>
      <text x={12} y={H / 2} fill={C.ink3} fontSize="12" textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`}>
        {yLabel} →
      </text>
    </svg>
  );
}
