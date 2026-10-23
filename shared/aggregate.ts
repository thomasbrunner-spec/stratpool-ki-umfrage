import type {
  AnswerValue,
  MaturityAnswer,
  MaturityQuestion,
  UseCaseAnswer,
  MultiAnswer,
  MultiQuestion,
  ParticipantInfo,
  Question,
  ResultFilter,
  SurveyDefinition,
  Widget,
} from './types.js';
import { isVisible } from './validate.js';

// ---------- Result types ----------

export interface TextItem {
  text: string;
  pid: string;
}

export interface CountItem {
  id: string;
  label: string;
  count: number;
  /** Share of respondents (0..1); for multi-choice shares may sum to > 1 */
  share: number;
}

export interface LevelItem {
  value: number;
  title: string;
  count: number;
  share: number;
}

export type QuestionResult =
  | { type: 'words'; n: number; words: { text: string; count: number }[] }
  | { type: 'texts'; n: number; items: TextItem[] }
  | { type: 'counts'; n: number; items: CountItem[]; other: TextItem[]; ordered: boolean }
  | { type: 'numeric'; n: number; values: number[]; mean: number | null; median: number | null; sd: number | null }
  | { type: 'levels'; n: number; levels: LevelItem[]; mean: number | null }
  | { type: 'grid'; n: number; levels: string[]; rows: GridRowResult[] }
  | { type: 'points'; n: number; budget: number; items: PointsItem[] }
  | { type: 'maturity'; n: number; na: number; now: LevelStats; target: LevelStats; gap: number | null }
  | { type: 'usecase'; n: number; items: UseCaseItem[] };

export interface LevelStats {
  n: number;
  mean: number | null;
  sd: number | null;
  /** counts per level, index 0 = level 1 */
  counts: number[];
}

export interface UseCaseItem {
  pid: string;
  task: string;
  hours: number | null;
  data: string | null;
  /** data sensitivity 1–5, null if unknown */
  level: number | null;
}

export interface GridRowResult {
  id: string;
  label: string;
  n: number;
  na: number;
  mean: number | null;
  sd: number | null;
  counts: number[];
}

export interface PointsItem {
  id: string;
  label: string;
  total: number;
  /** Share of all distributed points (0..1) */
  share: number;
}

export interface Point {
  x: number;
  y: number;
  pid: string;
}

export interface MatrixResult {
  n: number;
  points: Point[];
  midX: number;
  midY: number;
  /** Shares in order: bottom-left, top-left, bottom-right, top-right */
  quadrants: [number, number, number, number];
}

export interface CobwebDim {
  id: string;
  label: string;
  /** respondents with a rating (excl. cannot judge) */
  n: number;
  na: number;
  now: number | null;
  target: number | null;
  nowSd: number | null;
  /** mean of paired (target - now) */
  gap: number | null;
}

export interface CobwebResult {
  n: number;
  dims: CobwebDim[];
}

export interface CobwebSplitResult {
  groups: { label: string; n: number; cobweb: CobwebResult }[];
}

export interface HeroResult {
  n: number;
  count: number;
  share: number;
}

export interface FteResult {
  n: number;
  sumHours: number;
  meanHours: number | null;
  fte: number;
}

export interface PilotsResult {
  n: number;
  yes: number;
  byOption: { id: string; label: string; count: number }[];
  byFunc: { label: string; yes: number; total: number }[];
  /** participant ids of those willing to join (names are resolved client-side if allowed) */
  yesPids: string[];
}

export interface SelfVsDepthResult {
  n: number;
  points: Point[];
  /** Mean self-assessment per depth level */
  byLevel: { level: number; title: string; n: number; meanSelf: number | null }[];
}

export interface ParticipationResult {
  invited: number;
  started: number;
  completed: number;
  byCompany: { label: string; invited: number; completed: number }[];
  workshop: { invited: number; completed: number };
}

export interface ResultRow {
  participant: ParticipantInfo;
  answers: Record<string, AnswerValue>;
  completed: boolean;
}

// ---------- Helpers ----------

export const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Population standard deviation – we describe the group, not a sample. */
export function sd(xs: number[]): number | null {
  const m = mean(xs);
  if (m === null) return null;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

const isMulti = (v: AnswerValue | undefined): v is MultiAnswer =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Array.isArray((v as MultiAnswer).selected);

const isNumRecord = (v: AnswerValue | undefined): v is Record<string, number | null> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !('selected' in v);

export function applyFilter(rows: ResultRow[], f: ResultFilter): ResultRow[] {
  return rows.filter(
    (r) =>
      (!f.company || r.participant.company === f.company) &&
      (!f.func || r.participant.func === f.func) &&
      (f.workshop === undefined || r.participant.workshop === f.workshop),
  );
}

export function isFiltered(f: ResultFilter): boolean {
  return Boolean(f.company || f.func || f.workshop !== undefined);
}

const normWord = (w: string) =>
  w
    .toLowerCase()
    .replace(/[„“"'.,;:!?()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function wordCounts(texts: string[]): { text: string; count: number }[] {
  const groups = new Map<string, Map<string, number>>();
  for (const raw of texts) {
    const t = raw.trim().replace(/[.,;:!?]+$/, '');
    const key = normWord(t);
    if (!key) continue;
    const forms = groups.get(key) ?? new Map<string, number>();
    forms.set(t, (forms.get(t) ?? 0) + 1);
    groups.set(key, forms);
  }
  return [...groups.values()]
    .map((forms) => {
      const sorted = [...forms.entries()].sort((a, b) => b[1] - a[1]);
      return { text: sorted[0]![0], count: sorted.reduce((a, [, c]) => a + c, 0) };
    })
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'de'));
}

// ---------- Per-question aggregation ----------

export function aggregateQuestion(survey: SurveyDefinition, q: Question, rows: ResultRow[]): QuestionResult {
  const vals = rows
    // answers to conditional questions that are no longer visible do not count
    .filter((r) => isVisible(q, r.answers))
    .map((r) => ({ pid: r.participant.id, v: r.answers[q.id] }))
    .filter((x): x is { pid: string; v: AnswerValue } => x.v !== undefined);

  switch (q.type) {
    case 'short_text': {
      const texts = vals.filter((x) => typeof x.v === 'string' && x.v.trim()) as { pid: string; v: string }[];
      if (q.viz === 'wordcloud') return { type: 'words', n: texts.length, words: wordCounts(texts.map((t) => t.v)) };
      return { type: 'texts', n: texts.length, items: texts.map((t) => ({ text: t.v.trim(), pid: t.pid })) };
    }
    case 'long_text': {
      const items = vals
        .filter((x) => typeof x.v === 'string' && x.v.trim())
        .map((x) => ({ text: (x.v as string).trim(), pid: x.pid }));
      return { type: 'texts', n: items.length, items };
    }
    case 'text_list': {
      const items: TextItem[] = [];
      let n = 0;
      for (const x of vals) {
        if (!Array.isArray(x.v)) continue;
        const filled = x.v.map((t) => t.trim()).filter(Boolean);
        if (filled.length) n++;
        for (const t of filled) items.push({ text: t, pid: x.pid });
      }
      return { type: 'texts', n, items };
    }
    case 'single': {
      const answered = vals.filter((x) => typeof x.v === 'string');
      const n = answered.length;
      const items = q.options.map((o) => {
        const count = answered.filter((x) => x.v === o.id).length;
        return { id: o.id, label: o.label, count, share: n ? count / n : 0 };
      });
      return { type: 'counts', n, items, other: [], ordered: true };
    }
    case 'multi': {
      const answered = vals.filter((x) => isMulti(x.v) && x.v.selected.length > 0) as { pid: string; v: MultiAnswer }[];
      const n = answered.length;
      const items = q.options
        .map((o) => {
          const count = answered.filter((x) => x.v.selected.includes(o.id)).length;
          return { id: o.id, label: o.label, count, share: n ? count / n : 0 };
        })
        .sort((a, b) => b.count - a.count);
      const other = answered
        .filter((x) => x.v.other && x.v.other.trim())
        .map((x) => ({ text: x.v.other!.trim(), pid: x.pid }));
      return { type: 'counts', n, items, other, ordered: false };
    }
    case 'slider': {
      const values = vals.map((x) => x.v).filter((v): v is number => typeof v === 'number');
      return { type: 'numeric', n: values.length, values, mean: mean(values), median: median(values), sd: sd(values) };
    }
    case 'stairs': {
      const scale = survey.scales[q.scale];
      const values = vals.map((x) => x.v).filter((v): v is number => typeof v === 'number');
      return levelsResult(
        values,
        (scale?.levels ?? []).map((l) => ({ value: l.value, title: l.title })),
      );
    }
    case 'grid': {
      const scale = survey.scales[q.scale];
      const levelTitles = (scale?.levels ?? []).map((l) => l.title);
      const answered = vals.filter((x) => isNumRecord(x.v)) as { pid: string; v: Record<string, number | null> }[];
      const resRows = q.rows.map((row) => {
        const counts = new Array<number>(row.descriptions?.length ?? levelTitles.length).fill(0);
        const nums: number[] = [];
        let na = 0;
        for (const x of answered) {
          if (!(row.id in x.v)) continue;
          const v = x.v[row.id];
          if (v === null || v === undefined) na++;
          else {
            nums.push(v);
            counts[v - 1] = (counts[v - 1] ?? 0) + 1;
          }
        }
        return { id: row.id, label: row.label, n: nums.length, na, mean: mean(nums), sd: sd(nums), counts };
      });
      return { type: 'grid', n: answered.length, levels: levelTitles, rows: resRows };
    }
    case 'maturity': {
      const answered = vals.filter((x) => typeof x.v === 'object' && x.v !== null && 'now' in x.v) as { pid: string; v: MaturityAnswer }[];
      const levelsN = q.descriptions.length;
      const stats = (xs: number[]): LevelStats => {
        const counts = new Array<number>(levelsN).fill(0);
        for (const x of xs) counts[x - 1] = (counts[x - 1] ?? 0) + 1;
        return { n: xs.length, mean: mean(xs), sd: sd(xs), counts };
      };
      const nows = answered.map((x) => x.v.now).filter((v): v is number => typeof v === 'number');
      const targets = answered.map((x) => x.v.target).filter((v): v is number => typeof v === 'number');
      const gaps = answered
        .filter((x) => typeof x.v.now === 'number' && typeof x.v.target === 'number')
        .map((x) => (x.v.target as number) - (x.v.now as number));
      return {
        type: 'maturity',
        n: answered.length,
        na: answered.filter((x) => x.v.now === null).length,
        now: stats(nows),
        target: stats(targets),
        gap: mean(gaps),
      };
    }
    case 'usecase': {
      const items: UseCaseItem[] = [];
      for (const x of vals) {
        const u = x.v as UseCaseAnswer;
        if (typeof u !== 'object' || u === null || typeof u.task !== 'string' || !u.task.trim()) continue;
        items.push({
          pid: x.pid,
          task: u.task.trim(),
          hours: typeof u.hours === 'number' ? u.hours : null,
          data: u.data ?? null,
          level: q.dataOptions.find((o) => o.id === u.data)?.level ?? null,
        });
      }
      return { type: 'usecase', n: items.length, items };
    }
    case 'points': {
      const answered = vals.filter((x) => isNumRecord(x.v)) as { pid: string; v: Record<string, number | null> }[];
      const totals = q.options.map((o) => ({
        id: o.id,
        label: o.label,
        total: answered.reduce((a, x) => a + (x.v[o.id] ?? 0), 0),
      }));
      const all = totals.reduce((a, t) => a + t.total, 0);
      const items = totals
        .map((t) => ({ ...t, share: all ? t.total / all : 0 }))
        .sort((a, b) => b.total - a.total);
      return { type: 'points', n: answered.length, budget: q.budget, items };
    }
  }
}

function levelsResult(values: number[], levels: { value: number; title: string }[]): Extract<QuestionResult, { type: 'levels' }> {
  const n = values.length;
  return {
    type: 'levels',
    n,
    mean: mean(values),
    levels: levels.map((l) => {
      const count = values.filter((v) => v === l.value).length;
      return { value: l.value, title: l.title, count, share: n ? count / n : 0 };
    }),
  };
}

// ---------- Derived analyses ----------

/** Highest group level reached per participant (0 = none of the grouped options). */
export function depthOf(q: MultiQuestion, v: AnswerValue | undefined): number | null {
  if (!isMulti(v) || v.selected.length === 0) return null;
  const groups = q.groups ?? [];
  let max = 0;
  for (const id of v.selected) {
    const g = groups.find((gr) => gr.id === q.options.find((o) => o.id === id)?.group);
    if (g && g.level > max) max = g.level;
  }
  return max;
}

export function depthLevels(q: MultiQuestion): { value: number; title: string }[] {
  return [
    { value: 0, title: 'Noch nichts' },
    ...[...(q.groups ?? [])].sort((a, b) => a.level - b.level).map((g) => ({ value: g.level, title: g.label })),
  ];
}

export function aggregateDepth(q: MultiQuestion, rows: ResultRow[]): Extract<QuestionResult, { type: 'levels' }> {
  const values = rows.map((r) => depthOf(q, r.answers[q.id])).filter((v): v is number => v !== null);
  return levelsResult(values, depthLevels(q));
}

export function aggregateSelfVsDepth(selfId: string, q: MultiQuestion, rows: ResultRow[]): SelfVsDepthResult {
  const points: Point[] = [];
  for (const r of rows) {
    const self = r.answers[selfId];
    const depth = depthOf(q, r.answers[q.id]);
    if (typeof self === 'number' && depth !== null) points.push({ x: depth, y: self, pid: r.participant.id });
  }
  const byLevel = depthLevels(q).map((l) => {
    const ys = points.filter((p) => p.x === l.value).map((p) => p.y);
    return { level: l.value, title: l.title, n: ys.length, meanSelf: mean(ys) };
  });
  return { n: points.length, points, byLevel };
}

export function aggregateMatrix(
  survey: SurveyDefinition,
  xId: string,
  yId: string,
  rows: ResultRow[],
): MatrixResult {
  const mid = (id: string) => {
    const q = survey.questions.find((qq) => qq.id === id);
    return q?.type === 'slider' ? (q.min + q.max) / 2 : 50;
  };
  const midX = mid(xId);
  const midY = mid(yId);
  const points: Point[] = [];
  for (const r of rows) {
    const x = r.answers[xId];
    const y = r.answers[yId];
    if (typeof x === 'number' && typeof y === 'number') points.push({ x, y, pid: r.participant.id });
  }
  const n = points.length;
  const q = [0, 0, 0, 0];
  for (const p of points) {
    const right = p.x >= midX ? 2 : 0;
    const top = p.y >= midY ? 1 : 0;
    q[right + top]!++;
  }
  const share = (c: number) => (n ? c / n : 0);
  return { n, points, midX, midY, quadrants: [share(q[0]!), share(q[1]!), share(q[2]!), share(q[3]!)] };
}

export function aggregateCobweb(survey: SurveyDefinition, qids: string[], rows: ResultRow[]): CobwebResult {
  const dims: CobwebDim[] = [];
  for (const id of qids) {
    const q = survey.questions.find((x) => x.id === id);
    if (q?.type !== 'maturity') continue;
    const r = aggregateQuestion(survey, q, rows);
    if (r.type !== 'maturity') continue;
    dims.push({
      id,
      label: (q as MaturityQuestion).dimension,
      n: r.now.n,
      na: r.na,
      now: r.now.mean,
      target: r.target.mean,
      nowSd: r.now.sd,
      gap: r.gap,
    });
  }
  const answered = rows.filter((r) => qids.some((id) => r.answers[id] !== undefined)).length;
  return { n: answered, dims };
}

export function aggregateHero(q: string, options: string[], rows: ResultRow[]): HeroResult {
  const answered = rows.filter((r) => typeof r.answers[q] === 'string');
  const count = answered.filter((r) => options.includes(r.answers[q] as string)).length;
  return { n: answered.length, count, share: answered.length ? count / answered.length : 0 };
}

export function aggregateFte(q: string, hoursPerFte: number, rows: ResultRow[]): FteResult {
  const hours = rows.map((r) => r.answers[q]).filter((v): v is number => typeof v === 'number');
  const sumHours = hours.reduce((a, b) => a + b, 0);
  return { n: hours.length, sumHours, meanHours: mean(hours), fte: sumHours / hoursPerFte };
}

export function aggregatePilots(survey: SurveyDefinition, qid: string, yes: string[], rows: ResultRow[]): PilotsResult {
  const q = survey.questions.find((x) => x.id === qid);
  const answered = rows.filter((r) => typeof r.answers[qid] === 'string');
  const isYes = (r: ResultRow) => yes.includes(r.answers[qid] as string);
  const funcs = [...new Set(answered.map((r) => r.participant.func || '—'))].sort((a, b) => a.localeCompare(b, 'de'));
  return {
    n: answered.length,
    yes: answered.filter(isYes).length,
    byOption:
      q?.type === 'single'
        ? q.options.map((o) => ({ id: o.id, label: o.label, count: answered.filter((r) => r.answers[qid] === o.id).length }))
        : [],
    byFunc: funcs
      .map((f) => {
        const inF = answered.filter((r) => (r.participant.func || '—') === f);
        return { label: f, yes: inF.filter(isYes).length, total: inF.length };
      })
      .sort((a, b) => b.yes - a.yes),
    yesPids: answered.filter(isYes).map((r) => r.participant.id),
  };
}

export function aggregateParticipation(rows: ResultRow[], startedIds: Set<string>): ParticipationResult {
  const companies = [...new Set(rows.map((r) => r.participant.company))].sort((a, b) => a.localeCompare(b, 'de'));
  const ws = rows.filter((r) => r.participant.workshop);
  return {
    invited: rows.length,
    started: rows.filter((r) => startedIds.has(r.participant.id)).length,
    completed: rows.filter((r) => r.completed).length,
    byCompany: companies.map((c) => {
      const inC = rows.filter((r) => r.participant.company === c);
      return { label: c || '—', invited: inC.length, completed: inC.filter((r) => r.completed).length };
    }),
    workshop: { invited: ws.length, completed: ws.filter((r) => r.completed).length },
  };
}

// ---------- Full result set ----------

export interface SurveyResults {
  filter: ResultFilter;
  /** Number of participants in the filter who answered at least one question */
  n: number;
  participation: ParticipationResult;
  questions: Record<string, QuestionResult>;
  depth: Record<string, Extract<QuestionResult, { type: 'levels' }>>;
  /** Derived analyses used by deck widgets, keyed by widgetKey() */
  derived: Record<string, DerivedResult>;
}

export type DerivedResult = MatrixResult | SelfVsDepthResult | CobwebResult | CobwebSplitResult | HeroResult | FteResult | PilotsResult;

export function widgetKey(w: Widget): string {
  switch (w.kind) {
    case 'matrix':
      return `matrix:${w.x}:${w.y}`;
    case 'self_vs_depth':
      return `self:${w.self}:${w.depth}`;
    case 'cobweb':
    case 'gaps':
    case 'blindspots':
      return `cobweb:${w.qs.join(',')}`;
    case 'cobweb_split':
      return `split:${w.by ?? 'leader'}:${w.qs.join(',')}`;
    case 'hero':
      return `hero:${w.q}:${w.options.join(',')}`;
    case 'hero_fte':
      return `fte:${w.q}:${w.hoursPerFte}`;
    case 'pilots':
      return `pilots:${w.q}`;
    default:
      return '';
  }
}

export const LEADERSHIP_LABELS = ['Führung (GF/AL)', 'Team'] as const;

/** Groups for the cobweb comparison: leadership vs. team, or one group per company. */
export function splitGroups(rows: ResultRow[], by: 'leader' | 'company'): { label: string; rows: ResultRow[] }[] {
  if (by === 'leader') {
    return [
      { label: LEADERSHIP_LABELS[0], rows: rows.filter((r) => r.participant.leader) },
      { label: LEADERSHIP_LABELS[1], rows: rows.filter((r) => !r.participant.leader) },
    ];
  }
  const companies = [...new Set(rows.map((r) => r.participant.company || 'ohne Angabe'))];
  return companies.map((c) => ({ label: c, rows: rows.filter((r) => (r.participant.company || 'ohne Angabe') === c) }));
}

export function aggregateAll(survey: SurveyDefinition, allRows: ResultRow[], filter: ResultFilter): SurveyResults {
  const inFilter = applyFilter(allRows, filter);
  const startedIds = new Set(inFilter.filter((r) => Object.keys(r.answers).length > 0).map((r) => r.participant.id));
  const rows = inFilter.filter((r) => startedIds.has(r.participant.id));
  const questions: Record<string, QuestionResult> = {};
  const depth: SurveyResults['depth'] = {};
  for (const q of survey.questions) {
    questions[q.id] = aggregateQuestion(survey, q, rows);
    if (q.type === 'multi' && q.groups?.length) depth[q.id] = aggregateDepth(q, rows);
  }
  const derived: SurveyResults['derived'] = {};
  for (const w of survey.deck.flatMap((sl) => sl.widgets)) {
    const key = widgetKey(w);
    if (!key || derived[key]) continue;
    switch (w.kind) {
      case 'matrix':
        derived[key] = aggregateMatrix(survey, w.x, w.y, rows);
        break;
      case 'self_vs_depth': {
        const dq = survey.questions.find((q) => q.id === w.depth);
        if (dq?.type === 'multi') derived[key] = aggregateSelfVsDepth(w.self, dq, rows);
        break;
      }
      case 'cobweb':
      case 'gaps':
      case 'blindspots':
        derived[key] = aggregateCobweb(survey, w.qs, rows);
        break;
      case 'cobweb_split': {
        const groups = splitGroups(rows, w.by ?? 'leader').map((g) => {
          const cobweb = aggregateCobweb(survey, w.qs, g.rows);
          return { label: g.label, n: cobweb.n, cobweb };
        });
        // companies: the one with the most maturity ratings comes first
        if (w.by === 'company') groups.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'de'));
        derived[key] = { groups };
        break;
      }
      case 'hero':
        derived[key] = aggregateHero(w.q, w.options, rows);
        break;
      case 'hero_fte':
        derived[key] = aggregateFte(w.q, w.hoursPerFte, rows);
        break;
      case 'pilots':
        derived[key] = aggregatePilots(survey, w.q, w.yes, rows);
        break;
    }
  }
  return {
    filter,
    n: rows.length,
    participation: aggregateParticipation(inFilter, startedIds),
    questions,
    depth,
    derived,
  };
}
