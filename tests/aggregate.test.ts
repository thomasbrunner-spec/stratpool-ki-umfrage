import { describe, expect, it } from 'vitest';
import surveyJson from '../survey/humantech-2026.json';
import {
  aggregateAll,
  aggregateFte,
  aggregateHero,
  aggregateMatrix,
  aggregatePilots,
  widgetKey,
  type CobwebSplitResult,
  aggregateQuestion,
  depthOf,
  mean,
  median,
  sd,
  wordCounts,
  type ResultRow,
} from '../shared/aggregate';
import type { AnswerValue, MultiQuestion, Question, SurveyDefinition } from '../shared/types';

const survey = surveyJson as unknown as SurveyDefinition;
const q = (id: string): Question => survey.questions.find((x) => x.id === id)!;

let seq = 0;
function row(answers: Record<string, AnswerValue>, opts: Partial<{ company: string; workshop: boolean; completed: boolean }> = {}): ResultRow {
  seq++;
  return {
    participant: { id: `p${seq}`, name: `P ${seq}`, company: opts.company ?? 'A', func: 'F&E', workshop: opts.workshop ?? true },
    answers,
    completed: opts.completed ?? true,
  };
}

describe('statistics helpers', () => {
  it('computes mean, median and population sd', () => {
    expect(mean([])).toBeNull();
    expect(mean([2, 4, 6])).toBe(4);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
});

describe('wordCounts', () => {
  it('merges case and punctuation variants and keeps the most frequent spelling', () => {
    const res = wordCounts(['Chancen', 'chancen!', 'Chancen', 'Angst', ' ', 'Effizienz.']);
    expect(res[0]).toEqual({ text: 'Chancen', count: 3 });
    expect(res.map((w) => w.text)).toEqual(['Chancen', 'Angst', 'Effizienz']);
  });
});

describe('aggregateQuestion', () => {
  it('single choice keeps option order and computes shares', () => {
    const rows = [row({ B3: 'nein' }), row({ B3: 'nein' }), row({ B3: 'regelmaessig' }), row({})];
    const res = aggregateQuestion(survey, q('B3'), rows);
    expect(res.type).toBe('counts');
    if (res.type !== 'counts') return;
    expect(res.n).toBe(3);
    expect(res.items.map((i) => i.id)).toEqual(['nein', 'gelegentlich', 'regelmaessig', 'keine_angabe']);
    expect(res.items[0]!.share).toBeCloseTo(2 / 3);
  });

  it('multi choice sorts by count, shares relative to respondents, collects "other" texts', () => {
    const rows = [
      row({ B2: { selected: ['chatgpt', 'm365_copilot'] } }),
      row({ B2: { selected: ['chatgpt'] } }),
      row({ B2: { selected: ['sonstige'], other: 'Mistral' } }),
    ];
    const res = aggregateQuestion(survey, q('B2'), rows);
    if (res.type !== 'counts') throw new Error('wrong type');
    expect(res.items[0]).toMatchObject({ id: 'chatgpt', count: 2 });
    expect(res.items[0]!.share).toBeCloseTo(2 / 3);
    expect(res.other).toEqual([{ text: 'Mistral', pid: rows[2]!.participant.id }]);
  });

  it('points sums totals and shares of all distributed points', () => {
    const rows = [row({ F1: { clinical: 6, qm: 4 } }), row({ F1: { clinical: 10 } })];
    const res = aggregateQuestion(survey, q('F1'), rows);
    if (res.type !== 'points') throw new Error('wrong type');
    expect(res.items[0]).toMatchObject({ id: 'clinical', total: 16, share: 0.8 });
    expect(res.items[1]).toMatchObject({ id: 'qm', total: 4, share: 0.2 });
  });

  it('grid (traffic light) counts per level and "cannot judge" separately', () => {
    const rows = [row({ G2: { texte: 1, mdr: null } }), row({ G2: { texte: 3, mdr: 2 } })];
    const res = aggregateQuestion(survey, q('G2'), rows);
    if (res.type !== 'grid') throw new Error('wrong type');
    const texte = res.rows.find((r) => r.id === 'texte')!;
    const mdr = res.rows.find((r) => r.id === 'mdr')!;
    expect(texte).toMatchObject({ n: 2, na: 0, counts: [1, 0, 1] });
    expect(mdr).toMatchObject({ n: 1, na: 1, counts: [0, 1, 0] });
  });

  it('text_list counts respondents, not fields', () => {
    const rows = [row({ F3: ['Recherche', 'Protokolle'] }), row({ F3: ['', ''] })];
    const res = aggregateQuestion(survey, q('F3'), rows);
    if (res.type !== 'texts') throw new Error('wrong type');
    expect(res.n).toBe(1);
    expect(res.items.map((i) => i.text)).toEqual(['Recherche', 'Protokolle']);
  });
});

describe('derived analyses', () => {
  const c2 = q('C2') as MultiQuestion;

  it('depth is the highest group level, 0 for "nothing yet"', () => {
    expect(depthOf(c2, { selected: ['texte', 'assistenten'] })).toBe(3);
    expect(depthOf(c2, { selected: ['nichts'] })).toBe(0);
    expect(depthOf(c2, { selected: ['sonstiges'], other: 'x' })).toBe(0);
    expect(depthOf(c2, undefined)).toBeNull();
  });

  it('matrix splits at the slider midpoint, points on the line count as high', () => {
    const rows = [row({ C1: 10, C3: 10 }), row({ C1: 10, C3: 90 }), row({ C1: 50, C3: 20 }), row({ C1: 80, C3: 80 })];
    const res = aggregateMatrix(survey, 'C1', 'C3', rows);
    expect(res.quadrants).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it('aggregateAll filters and ignores non-starters', () => {
    const rows = [
      row({ E2: 4 }, { company: 'A' }),
      row({ E2: 5 }, { company: 'A' }),
      row({ E2: 2 }, { company: 'B', completed: false }),
      row({}, { company: 'B', completed: false }),
    ];
    const all = aggregateAll(survey, rows, {});
    expect(all.n).toBe(3);
    expect(all.participation).toMatchObject({ invited: 4, started: 3, completed: 2 });
    const onlyB = aggregateAll(survey, rows, { company: 'B' });
    expect(onlyB.n).toBe(1);
    expect(onlyB.participation.invited).toBe(2);
  });
});

describe('maturity, cobweb and leadership split', () => {
  it('computes today/target means, paired gap and cannot-judge separately', () => {
    const rows = [row({ D1: { now: 1, target: 4 } }), row({ D1: { now: 3, target: 4 } }), row({ D1: { now: null } })];
    const r = aggregateQuestion(survey, q('D1'), rows);
    if (r.type !== 'maturity') throw new Error('wrong type');
    expect(r).toMatchObject({ n: 3, na: 1, gap: 2 });
    expect(r.now).toMatchObject({ n: 2, mean: 2, counts: [1, 0, 1, 0, 0] });
    expect(r.target.mean).toBe(4);
  });

  it('splits the cobweb into leadership and team', () => {
    const rows = [
      { ...row({ D1: { now: 3, target: 5 } }), participant: { id: 'l1', name: 'L', company: 'A', func: 'Geschäftsführung', workshop: true, leader: true } },
      row({ D1: { now: 1, target: 3 } }),
      row({ D1: { now: 2, target: 3 } }),
    ];
    const all = aggregateAll(survey, rows, {});
    const key = widgetKey({ kind: 'cobweb_split', qs: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'] });
    const split = all.derived[key] as CobwebSplitResult;
    expect(split.groups.map((g) => g.n)).toEqual([1, 2]);
    expect(split.groups[0]!.cobweb.dims[0]).toMatchObject({ id: 'D1', now: 3, target: 5, gap: 2 });
    expect(split.groups[1]!.cobweb.dims[0]).toMatchObject({ now: 1.5, target: 3 });
  });

  it('splits the cobweb by company, largest company first', () => {
    const rows = [
      row({ D1: { now: 4, target: 5 } }, { company: 'DrehTech' }),
      row({ D1: { now: 1, target: 3 } }, { company: 'HumanTech Spine' }),
      row({ D1: { now: 3, target: 3 } }, { company: 'HumanTech Spine' }),
      row({ D1: { now: 2, target: 2 } }, { company: '' }),
    ];
    const all = aggregateAll(survey, rows, {});
    const key = widgetKey({ kind: 'cobweb_split', qs: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'], by: 'company' });
    const split = all.derived[key] as CobwebSplitResult;
    expect(split.groups.map((g) => [g.label, g.n])).toEqual([
      ['HumanTech Spine', 2],
      ['DrehTech', 1],
      ['ohne Angabe', 1],
    ]);
    expect(split.groups[0]!.cobweb.dims[0]).toMatchObject({ now: 2, target: 3 });
    // leadership and company split of the same questions must not share a cache key
    expect(key).not.toBe(widgetKey({ kind: 'cobweb_split', qs: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'] }));
  });
});

describe('hero, FTE, use cases and pilots', () => {
  it('hero share counts respondents with any of the options', () => {
    expect(aggregateHero('B3', ['gelegentlich', 'regelmaessig'], [row({ B3: 'nein' }), row({ B3: 'regelmaessig' }), row({ B3: 'gelegentlich' }), row({})])).toEqual({
      n: 3,
      count: 2,
      share: 2 / 3,
    });
  });

  it('converts weekly hours into full-time equivalents', () => {
    expect(aggregateFte('F4', 40, [row({ F4: 10 }), row({ F4: 30 }), row({})])).toEqual({ n: 2, sumHours: 40, meanHours: 20, fte: 1 });
  });

  it('use-case items carry hours and data sensitivity', () => {
    const r = aggregateQuestion(survey, q('F2'), [row({ F2: { task: 'Recherche', hours: 4, data: 'oeffentlich' } }), row({ F2: { task: ' ', hours: 1, data: 'intern' } })]);
    if (r.type !== 'usecase') throw new Error('wrong type');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ task: 'Recherche', hours: 4, level: 1 });
  });

  it('pilots counts willingness per function', () => {
    const rows = [row({ H0: 'verantwortlich' }), row({ H0: 'eher_nicht' }), row({ H0: 'mitwirkend' })];
    const p = aggregatePilots(survey, 'H0', ['verantwortlich', 'mitwirkend'], rows);
    expect(p).toMatchObject({ n: 3, yes: 2 });
    expect(p.byFunc[0]).toEqual({ label: 'F&E', yes: 2, total: 3 });
  });
});
