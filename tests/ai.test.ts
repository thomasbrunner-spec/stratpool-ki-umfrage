import { beforeAll, describe, expect, it } from 'vitest';
import surveyJson from '../survey/humantech-2026.json';
import type { ResultRow } from '../shared/aggregate';
import type { SurveyDefinition } from '../shared/types';

const survey = surveyJson as unknown as SurveyDefinition;
let ai: typeof import('../server/ai');

beforeAll(async () => {
  process.env.DB_FILE = ':memory:';
  ai = await import('../server/ai');
});

const row = (id: string, name: string, h1: string): ResultRow => ({
  participant: { id, name, company: 'A', func: 'F&E', workshop: true },
  answers: { H1: h1 },
  completed: true,
});

describe('summarizeClusters', () => {
  it('pseudonymizes input, counts respondents itself and maps quotes back to participants', async () => {
    let prompt = '';
    ai.aiDeps.call = (async (_schema: unknown, p: string) => {
      prompt = p;
      return {
        themes: [
          { title: 'Roadmap', description: 'd', answerIds: ['A1', 'A2', 'A99'], quotes: [{ answerId: 'A2', text: 'Roadmap' }] },
          { title: 'Regeln', description: 'd', answerIds: ['A3'], quotes: [] },
        ],
        keyStatements: ['k'],
      };
    }) as typeof ai.aiDeps.call;

    const rows = [
      row('p1', 'Erika Muster', 'Eine Roadmap, wie Erika Muster sagte'),
      row('p2', 'Max Beispiel', 'Roadmap mit Verantwortlichen'),
      row('p3', 'Ida Test', 'Klare Regeln'),
      row('p4', 'Leer Person', '   '),
    ];
    const target = survey.aiTargets.find((t) => t.key === 'H1')!;
    const res = await ai.summarizeClusters(survey, target, rows, rows.map((r) => r.participant.name));

    expect(prompt).not.toContain('Erika');
    expect(prompt).toContain('[Name]');
    expect(res.answerCount).toBe(3);
    expect(res.themes[0]).toMatchObject({ title: 'Roadmap', count: 2, quotes: [{ text: 'Roadmap', pid: 'p2' }] });
    expect(res.themes[1]).toMatchObject({ title: 'Regeln', count: 1 });
  });

  it('does not call the model when there are no texts', async () => {
    ai.aiDeps.call = (async () => {
      throw new Error('should not be called');
    }) as typeof ai.aiDeps.call;
    const target = survey.aiTargets.find((t) => t.key === 'H3')!;
    const res = await ai.summarizeClusters(survey, target, [row('p1', 'A B', 'x')], []);
    expect(res.themes).toEqual([]);
  });
});
