import { describe, expect, it } from 'vitest';
import surveyJson from '../survey/humantech-2026.json';
import { fillPlaceholders, isAnswered, missingRequired, validateAnswer } from '../shared/validate';
import type { Question, SurveyDefinition } from '../shared/types';

const survey = surveyJson as unknown as SurveyDefinition;
const q = (id: string): Question => survey.questions.find((x) => x.id === id)!;

describe('survey definition', () => {
  it('has unique question ids and every deck reference resolves', () => {
    const ids = survey.questions.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of survey.deck.flatMap((s) => s.widgets)) {
      const refs = 'q' in w ? [w.q] : w.kind === 'matrix' ? [w.x, w.y] : w.kind === 'compare_stairs' ? [w.today, w.target] : w.kind === 'self_vs_depth' ? [w.self, w.depth] : [];
      for (const r of refs) expect(ids).toContain(r);
      if (w.kind === 'ai') expect(survey.aiTargets.map((t) => t.key)).toContain(w.key);
    }
  });

  it('has 18 question screens as approved in v0.2', () => {
    expect(survey.questions).toHaveLength(18);
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
    expect(validateAnswer(q('F4'), 16).ok).toBe(false);
  });

  it('checks stairs values against the scale', () => {
    expect(validateAnswer(q('E1'), 7, survey).ok).toBe(false);
    expect(validateAnswer(q('E1'), 0, survey).ok).toBe(true);
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
    const grid = q('D');
    if (grid.type !== 'grid') throw new Error('wrong type');
    const full = Object.fromEntries(grid.rows.map((r) => [r.id, null]));
    expect(isAnswered(grid, full)).toBe(true);
    expect(isAnswered(grid, { strategie: 2 })).toBe(false);
    expect(isAnswered(q('F1'), { clinical: 9 })).toBe(false);
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
