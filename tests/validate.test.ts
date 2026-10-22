import { describe, expect, it } from 'vitest';
import surveyJson from '../survey/humantech-2026.json';
import { fillPlaceholders, isAnswered, isVisible, missingRequired, validateAnswer } from '../shared/validate';
import type { Question, SurveyDefinition } from '../shared/types';

const survey = surveyJson as unknown as SurveyDefinition;
const q = (id: string): Question => survey.questions.find((x) => x.id === id)!;

describe('survey definition', () => {
  it('has unique question ids and every deck reference resolves', () => {
    const ids = survey.questions.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of survey.deck.flatMap((s) => s.widgets)) {
      const refs =
        'q' in w ? [w.q] : 'qs' in w ? w.qs : w.kind === 'matrix' ? [w.x, w.y] : w.kind === 'self_vs_depth' ? [w.self, w.depth] : [];
      for (const r of refs) expect(ids).toContain(r);
      if (w.kind === 'ai') expect(survey.aiTargets.map((t) => t.key)).toContain(w.key);
    }
  });

  it('has 25 questions as approved in v0.4 (incl. the conditional Copilot score)', () => {
    expect(survey.questions).toHaveLength(25);
  });
});

describe('validateAnswer', () => {
  it('rejects exclusive option combined with others', () => {
    expect(validateAnswer(q('B2'), { selected: ['keine', 'chatgpt'] }).ok).toBe(false);
    expect(validateAnswer(q('B2'), { selected: ['keine'] }).ok).toBe(true);
  });

  it('enforces max selections', () => {
    expect(validateAnswer(q('G1'), { selected: ['zeit', 'tools', 'wissen'] }).ok).toBe(false);
  });

  it('enforces the points budget', () => {
    expect(validateAnswer(q('F1'), { clinical: 8, qm: 3 }).ok).toBe(false);
    expect(validateAnswer(q('F1'), { clinical: 8, qm: 2 })).toEqual({ ok: true, value: { clinical: 8, qm: 2 } });
  });

  it('rounds slider values to the step and rejects out-of-range values', () => {
    expect(validateAnswer(q('F4'), 3.3)).toEqual({ ok: true, value: 3.5 });
    expect(validateAnswer(q('F4'), 20).ok).toBe(true);
    expect(validateAnswer(q('F4'), 21).ok).toBe(false);
  });

  it('checks stairs values against the scale', () => {
    expect(validateAnswer(q('E2'), 7, survey).ok).toBe(false);
    expect(validateAnswer(q('E2'), 0, survey).ok).toBe(true);
  });

  it('trims and truncates texts', () => {
    expect(validateAnswer(q('A1'), '  Chancen  ')).toEqual({ ok: true, value: 'Chancen' });
  });
});

describe('completeness', () => {
  it('requires "other" text when "Sonstige" is chosen', () => {
    expect(isAnswered(q('B2'), { selected: ['sonstige'] })).toBe(false);
    expect(isAnswered(q('B2'), { selected: ['sonstige'], other: 'Mistral' })).toBe(true);
  });

  it('requires all grid rows (null = cannot judge counts) and the full points budget', () => {
    const grid = q('G2');
    if (grid.type !== 'grid') throw new Error('wrong type');
    const full = Object.fromEntries(grid.rows.map((r) => [r.id, null]));
    expect(isAnswered(grid, full)).toBe(true);
    expect(isAnswered(grid, { texte: 2 })).toBe(false);
    expect(validateAnswer(grid, { texte: 4 }, survey).ok).toBe(false);
    expect(isAnswered(q('F1'), { clinical: 9 })).toBe(false);
  });

  it('maturity needs today and target, or "cannot judge"', () => {
    expect(isAnswered(q('D1'), { now: 2 })).toBe(false);
    expect(isAnswered(q('D1'), { now: 2, target: 4 })).toBe(true);
    expect(isAnswered(q('D1'), { now: null })).toBe(true);
    expect(validateAnswer(q('D1'), { now: null, target: 3 })).toEqual({ ok: true, value: { now: null } });
    expect(validateAnswer(q('D1'), { now: 6 }).ok).toBe(false);
  });

  it('use-case profile needs task, hours and data class', () => {
    expect(isAnswered(q('F2'), { task: 'Recherche', hours: 3, data: null })).toBe(false);
    expect(isAnswered(q('F2'), { task: 'Recherche', hours: 3, data: 'intern' })).toBe(true);
    expect(validateAnswer(q('F2'), { task: 'x', hours: 3.2, data: 'intern' })).toEqual({ ok: true, value: { task: 'x', hours: 3, data: 'intern' } });
    expect(validateAnswer(q('F2'), { task: 'x', hours: 25, data: 'intern' }).ok).toBe(false);
    expect(validateAnswer(q('F2'), { task: 'x', hours: 2, data: 'quatsch' }).ok).toBe(false);
  });

  it('shows the Copilot score only to Copilot users and does not require it otherwise', () => {
    const b2a = q('B2a');
    expect(isVisible(b2a, { B2: { selected: ['chatgpt'] } })).toBe(false);
    expect(isVisible(b2a, { B2: { selected: ['chatgpt', 'copilot_chat'] } })).toBe(true);
    expect(missingRequired(survey, { B2: { selected: ['chatgpt'] } })).not.toContain('B2a');
    expect(missingRequired(survey, { B2: { selected: ['m365_copilot'] } })).toContain('B2a');
  });

  it('ignores answers to questions that are hidden again', async () => {
    const { aggregateQuestion } = await import('../shared/aggregate');
    const rows = [
      { participant: { id: 'a', name: 'A', company: '', func: '', workshop: false }, answers: { B2: { selected: ['chatgpt'] }, B2a: 9 }, completed: true },
      { participant: { id: 'b', name: 'B', company: '', func: '', workshop: false }, answers: { B2: { selected: ['copilot_chat'] }, B2a: 5 }, completed: true },
    ];
    const r = aggregateQuestion(survey, q('B2a'), rows);
    expect(r.type === 'numeric' && r.values).toEqual([5]);
  });

  it('lists missing required questions, optional ones are ignored', () => {
    const missing = missingRequired(survey, {});
    expect(missing).not.toContain('H2');
    expect(missing).toContain('A1');
  });

  it('fills placeholders with a visible fallback', () => {
    expect(fillPlaceholders('Am {{workshopDate}} bis {{deadline}}', { workshopDate: '12.11.2026' })).toBe(
      'Am 12.11.2026 bis [noch offen]',
    );
  });
});
