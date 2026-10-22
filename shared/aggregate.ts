import type {
  AnswerValue,
  MultiAnswer,
  MultiQuestion,
  ParticipantInfo,
  Question,
  ResultFilter,
  SurveyDefinition,
  Widget,
} from './types.js';

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
  | { type: 'points'; n: number; budget: number; items: PointsItem[] };

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

export interface CompareStairsResult {
  today: Extract<QuestionResult, { type: 'levels' }>;
  target: Extract<QuestionResult, { type: 'levels' }>;
  nPaired: number;
  meanGap: number | null;
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
        const counts = new Array<number>(row.descriptions.length).fill(0);
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

export function aggregateCompareStairs(
  survey: SurveyDefinition,
  todayId: string,
  targetId: string,
  rows: ResultRow[],
): CompareStairsResult {
  const qToday = survey.questions.find((q) => q.id === todayId);
  const qTarget = survey.questions.find((q) => q.id === targetId);
  if (qToday?.type !== 'stairs' || qTarget?.type !== 'stairs') throw new Error('compare_stairs needs stairs questions');
  const today = aggregateQuestion(survey, qToday, rows) as Extract<QuestionResult, { type: 'levels' }>;
  const target = aggregateQuestion(survey, qTarget, rows) as Extract<QuestionResult, { type: 'levels' }>;
  const gaps: number[] = [];
  for (const r of rows) {
    const a = r.answers[todayId];
    const b = r.answers[targetId];
    if (typeof a === 'number' && typeof b === 'number') gaps.push(b - a);
  }
  return { today, target, nPaired: gaps.length, meanGap: mean(gaps) };
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
  derived: Record<string, CompareStairsResult | MatrixResult | SelfVsDepthResult>;
}

export function widgetKey(w: Widget): string {
  switch (w.kind) {
    case 'compare_stairs':
      return `compare:${w.today}:${w.target}`;
    case 'matrix':
      return `matrix:${w.x}:${w.y}`;
    case 'self_vs_depth':
      return `self:${w.self}:${w.depth}`;
    default:
      return '';
  }
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
    if (w.kind === 'compare_stairs') derived[widgetKey(w)] = aggregateCompareStairs(survey, w.today, w.target, rows);
    if (w.kind === 'matrix') derived[widgetKey(w)] = aggregateMatrix(survey, w.x, w.y, rows);
    if (w.kind === 'self_vs_depth') {
      const dq = survey.questions.find((q) => q.id === w.depth);
      if (dq?.type === 'multi') derived[widgetKey(w)] = aggregateSelfVsDepth(w.self, dq, rows);
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
