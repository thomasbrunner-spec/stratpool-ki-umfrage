import { describe, expect, it } from 'vitest';
import surveyJson from '../survey/humantech-2026.json';
import {
  aggregateAll,
  aggregateMatrix,
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

  it('grid computes mean per row and counts "cannot judge" separately', () => {
    const rows = [
      row({ D: { strategie: 1, organisation: null } }),
      row({ D: { strategie: 3, organisation: 2 } }),
    ];
    const res = aggregateQuestion(survey, q('D'), rows);
    if (res.type !== 'grid') throw new Error('wrong type');
    const strat = res.rows.find((r) => r.id === 'strategie')!;
    const org = res.rows.find((r) => r.id === 'organisation')!;
    expect(strat).toMatchObject({ n: 2, na: 0, mean: 2, counts: [1, 0, 1, 0, 0] });
    expect(org).toMatchObject({ n: 1, na: 1, mean: 2 });
  });

  it('text_list counts respondents, not fields', () => {
    const rows = [row({ F2: ['Recherche', 'Protokolle', ''] }), row({ F2: ['', '', ''] })];
    const res = aggregateQuestion(survey, q('F2'), rows);
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

  it('aggregateAll filters, ignores non-starters and computes paired gap', () => {
    const rows = [
      row({ E1: 1, E2: 4 }, { company: 'A' }),
      row({ E1: 2, E2: 4 }, { company: 'A' }),
      row({ E1: 2 }, { company: 'B', completed: false }),
      row({}, { company: 'B', completed: false }),
    ];
    const all = aggregateAll(survey, rows, {});
    expect(all.n).toBe(3);
    expect(all.participation).toMatchObject({ invited: 4, started: 3, completed: 2 });
    const cmp = all.derived['compare:E1:E2'];
    expect(cmp && 'meanGap' in cmp ? cmp.meanGap : null).toBe(2.5);

    const onlyB = aggregateAll(survey, rows, { company: 'B' });
    expect(onlyB.n).toBe(1);
    expect(onlyB.participation.invited).toBe(2);
  });
});
