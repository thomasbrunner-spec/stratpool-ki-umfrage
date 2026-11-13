import { beforeAll, describe, expect, it } from 'vitest';
import surveyJson from '../survey/humantech-2026.json';
import { aggregateAll, type ResultRow } from '../shared/aggregate';
import { applyHiddenTexts, collectTextItems, textKey } from '../shared/textitems';
import { slideTakeaway } from '../shared/takeaway';
import type { SurveyDefinition } from '../shared/types';

const survey = surveyJson as unknown as SurveyDefinition;
let ai: typeof import('../server/ai');

beforeAll(async () => {
  process.env.DB_FILE = ':memory:';
  ai = await import('../server/ai');
});

const person = (id: string, name: string, answers: ResultRow['answers'], leader = false): ResultRow => ({
  participant: { id, name, company: 'HumanTech Spine', func: 'Qualitätsmanagement', workshop: true, leader },
  answers,
  completed: true,
});

describe('free-text items and hiding', () => {
  const rows = [
    person('p1', 'Erika Muster', { H1: 'Klare Regeln', H2: 'siehe vorherige Antwort', F3: ['Reklamationen', 's. o.'], F2: { task: 'Literaturrecherche', hours: 4, data: 'oeffentlich' } }),
    person('p2', 'Max Beispiel', { H2: 'Welche Tools sind erlaubt?', F2: { task: '-', hours: 2, data: 'intern' } }),
  ];

  it('collects texts from short/long texts, text lists and use-case tasks with stable keys', () => {
    const items = collectTextItems(survey, rows);
    const keys = items.map((i) => i.key);
    expect(keys).toContain(textKey('p1', 'H2', 0));
    expect(keys).toContain(textKey('p1', 'F3', 1));
    expect(keys).toContain(textKey('p2', 'F2', 0));
    expect(items.find((i) => i.key === textKey('p1', 'F3', 1))?.text).toBe('s. o.');
  });

  it('removes hidden items before aggregation – single texts, list entries and use cases', () => {
    const hidden = new Set([textKey('p1', 'H2', 0), textKey('p1', 'F3', 1), textKey('p2', 'F2', 0)]);
    const out = applyHiddenTexts(survey, rows, hidden);
    expect(out[0]!.answers.H2).toBeUndefined();
    expect(out[0]!.answers.F3).toEqual(['Reklamationen']);
    expect(out[1]!.answers.F2).toBeUndefined();
    // untouched rows are passed through as they are
    expect(applyHiddenTexts(survey, rows, new Set())).toBe(rows);
    const res = aggregateAll(survey, out, {});
    const h2 = res.questions.H2;
    expect(h2?.type === 'texts' && h2.items.map((i) => i.text)).toEqual(['Welche Tools sind erlaubt?']);
  });
});

describe('checkTexts', () => {
  it('maps flagged ids back to item keys and never sends names', async () => {
    let prompt = '';
    ai.aiDeps.call = (async (_s: unknown, p: string) => {
      prompt = p;
      return { flagged: [{ id: 'T2', reason: 'Verweis' }, { id: 'T99', reason: 'Inhaltsleer' }] };
    }) as typeof ai.aiDeps.call;
    const rows = [person('p1', 'Erika Muster', { H1: 'Regeln wie Erika Muster sagt', H2: 'siehe vorherige Antwort' })];
    const items = collectTextItems(survey, rows);
    const res = await ai.checkTexts(survey, items, ['Erika Muster']);
    expect(prompt).not.toContain('Erika');
    expect([...res.entries()]).toEqual([[items[1]!.key, 'Verweis']]);
  });
});

describe('summarizeTerms', () => {
  it('counts respondents per term itself and drops unknown ids', async () => {
    ai.aiDeps.call = (async () => ({
      terms: [
        { text: 'Arbeitserleichterung', answerIds: ['A1', 'A2', 'A2', 'A9'] },
        { text: 'Mitdenken verlieren', answerIds: ['A3'] },
        { text: 'Leer', answerIds: [] },
      ],
    })) as typeof ai.aiDeps.call;
    const rows = [
      person('p1', 'A B', { A1: 'Arbeitserleichterung' }),
      person('p2', 'C D', { A1: 'Effizienzsteigerung/Arbeitserleichterung' }),
      person('p3', 'E F', { A1: 'Verlust des Mitdenkens' }),
    ];
    const target = survey.aiTargets.find((t) => t.key === 'A1')!;
    expect(target.mode).toBe('terms');
    const res = await ai.summarizeTerms(survey, target, rows, []);
    expect(res).toEqual({
      mode: 'terms',
      answerCount: 3,
      terms: [
        { text: 'Arbeitserleichterung', count: 2 },
        { text: 'Mitdenken verlieren', count: 1 },
      ],
    });
  });
});

describe('chat guardrails', () => {
  it('accepts only quotes that occur word for word in the referenced answer', () => {
    expect(ai.quoteMatches('klare Regeln', 'Wir brauchen klare Regeln für alle.')).toBe(true);
    expect(ai.quoteMatches('Wir brauchen … für alle', 'Wir brauchen klare Regeln für alle.')).toBe(true);
    expect(ai.quoteMatches('„klare  Regeln“', 'Wir brauchen klare Regeln.')).toBe(true);
    expect(ai.quoteMatches('strenge Regeln', 'Wir brauchen klare Regeln.')).toBe(false);
    expect(ai.quoteMatches('für alle … Wir brauchen', 'Wir brauchen klare Regeln für alle.')).toBe(false);
  });

  it('builds a pseudonymised context and drops unverifiable quotes', async () => {
    let system: string[] = [];
    ai.aiDeps.call = (async (_s: unknown, _p: string, opts?: { system?: string[] }) => {
      system = opts?.system ?? [];
      return {
        coverage: 'full',
        answer: 'Die Führung wünscht klare Regeln.',
        questionsUsed: ['H1', 'XX'],
        quotes: [
          { ref: 'R01·H1', text: 'klare Regeln' },
          { ref: 'R01·H1', text: 'erfundenes Zitat' },
          { ref: 'R09·H1', text: 'klare Regeln' },
        ],
      };
    }) as typeof ai.aiDeps.call;
    const rows = [person('p1', 'Erika Muster', { H1: 'Erika Muster wünscht klare Regeln', C1: 40 }, true)];
    const reply = await ai.chatAboutSurvey(survey, rows, ['Erika Muster'], [], 'Was wünscht die Führung?');
    const data = system.join('\n');
    expect(data).not.toContain('Erika');
    expect(data).toContain('R01 [Führung · HumanTech Spine · Qualitätsmanagement');
    expect(data).toContain('R01·H1: „[Name] wünscht klare Regeln“');
    expect(reply.sources).toEqual([{ ref: 'R01·H1', question: expect.any(String), group: 'Führung · HumanTech Spine · Qualitätsmanagement', quote: 'klare Regeln' }]);
    expect(reply.droppedQuotes).toBe(2);
    expect(reply.questionsUsed.map((q) => q.id)).toEqual(['H1']);
  });
});

describe('slide takeaway', () => {
  it('states the gap between chance and knowledge on the matrix slide', () => {
    const rows = [30, 40, 50, 45].map((c1, i) => person(`p${i}`, `N ${i}`, { C1: c1, C3: 80 }));
    const slide = survey.deck.find((s) => s.id === 's-self')!;
    const t = slideTakeaway(slide, aggregateAll(survey, rows, {}));
    expect(t?.strong).toMatch(/Erwartung ist deutlich größer/);
    expect(t?.text).toContain('Chance Ø 80 von 100');
  });
});
