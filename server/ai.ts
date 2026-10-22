import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { aggregateAll, type ResultRow } from '../shared/aggregate.js';
import { pseudonymize } from '../shared/pseudonymize.js';
import type { AiTarget, SurveyDefinition } from '../shared/types.js';
import type { AiSummary, ClusterSummary, StoredSummary, SynthesisSummary } from '../shared/ai-types.js';

export type { AiSummary };
import { db } from './db.js';

export const AI_MODEL = 'claude-opus-5-5';

// ---------- Output schemas (what the model returns) ----------

const ClusterOutput = z.object({
  themes: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      answerIds: z.array(z.string()),
      quotes: z.array(z.object({ answerId: z.string(), text: z.string() })),
      outsideHypotheses: z.boolean(),
    }),
  ),
  keyStatements: z.array(z.string()),
});

const SynthesisOutput = z.object({
  headline: z.string(),
  findings: z.array(z.object({ title: z.string(), text: z.string() })),
  implications: z.array(z.object({ title: z.string(), text: z.string() })),
  openQuestions: z.array(z.string()),
});

export class AiNotConfiguredError extends Error {}

const SYSTEM = `Du wertest eine Mitarbeitendenbefragung zu Künstlicher Intelligenz aus, die zur Vorbereitung eines KI-Strategie-Workshops in einem mittelständischen Medizintechnik-Unternehmen dient. Die Auswertung wird im Workshop von Beratern der ERA Group präsentiert.

Arbeitsweise:
- Bleibe streng bei dem, was in den Antworten steht. Erfinde keine Inhalte und keine Zahlen.
- Formuliere auf Deutsch, sachlich und knapp, in der Sie-Form, ohne Marketing-Sprache.
- Personennamen wurden vorab durch [Name] ersetzt. Nenne keine Personen und versuche nicht, sie zu identifizieren.
- Zitate müssen wörtlich aus genau einer Antwort stammen (Kürzen mit „…“ ist erlaubt).`;

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiNotConfiguredError('ANTHROPIC_API_KEY ist nicht gesetzt.');
  return new Anthropic();
}

async function callModel<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T>> {
  const response = await client().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'high', format: betaZodOutputFormat(schema) },
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Die KI hat die Anfrage abgelehnt.');
  if (response.stop_reason === 'max_tokens') throw new Error('Die Antwort der KI war zu lang und wurde abgeschnitten.');
  if (!response.parsed_output) throw new Error('Die Antwort der KI konnte nicht gelesen werden.');
  return response.parsed_output as z.infer<T>;
}

/** Indirection so tests can replace the model call */
export const aiDeps = { call: callModel };

export async function summarizeClusters(
  survey: SurveyDefinition,
  target: AiTarget,
  rows: ResultRow[],
  allNames: string[],
): Promise<ClusterSummary> {
  const answers: { id: string; pid: string; text: string }[] = [];
  for (const qid of target.questions) {
    for (const r of rows) {
      const v = r.answers[qid];
      const texts =
        typeof v === 'string'
          ? [v]
          : Array.isArray(v)
            ? v
            : v && typeof v === 'object' && 'task' in v && typeof v.task === 'string'
              ? [v.task]
              : [];
      for (const t of texts.map((x) => x.trim()).filter(Boolean)) {
        answers.push({ id: `A${answers.length + 1}`, pid: r.participant.id, text: pseudonymize(t, allNames) });
      }
    }
  }
  if (answers.length === 0) return { mode: 'clusters', answerCount: 0, themes: [], keyStatements: [] };

  const questionTitles = target.questions
    .map((id) => survey.questions.find((q) => q.id === id)?.title ?? id)
    .join(' / ');
  const prompt = `Frage an die Teilnehmenden: „${questionTitles}“

Antworten (je Zeile eine Antwort mit ID):
${answers.map((a) => `${a.id}: ${a.text.replace(/\s+/g, ' ')}`).join('\n')}

Aufgabe:
1. Bilde 3 bis 7 Themencluster. Ordne jede Antwort-ID allen Clustern zu, zu denen sie inhaltlich gehört (answerIds). Sortiere die Cluster nach Anzahl der Antworten, absteigend.
2. Gib je Cluster einen kurzen Titel (max. 6 Wörter), eine Beschreibung in 1–2 Sätzen und 1–2 prägnante wörtliche Zitate mit ihrer Antwort-ID.
3. Formuliere 2–4 Kernaussagen über alle Antworten hinweg.
4. ${
    target.hypotheses?.length
      ? `Setze outsideHypotheses auf true, wenn ein Cluster durch keine dieser Ausgangshypothesen abgedeckt ist, sonst false:\n${target.hypotheses.map((h) => `- ${h}`).join('\n')}`
      : 'Setze outsideHypotheses immer auf false.'
  }`;

  const out = await aiDeps.call(ClusterOutput, prompt);
  const byId = new Map(answers.map((a) => [a.id, a]));
  const themes = out.themes
    .map((t) => {
      const ids = [...new Set(t.answerIds.filter((id) => byId.has(id)))];
      const pids = [...new Set(ids.map((id) => byId.get(id)!.pid))];
      return {
        title: t.title,
        description: t.description,
        // Count respondents ourselves instead of trusting a model-provided number
        count: pids.length,
        pids,
        ...(target.hypotheses?.length ? { novel: t.outsideHypotheses } : {}),
        quotes: t.quotes.map((q) => ({ text: q.text, pid: byId.get(q.answerId)?.pid ?? null })),
      };
    })
    .sort((a, b) => b.count - a.count);
  return {
    mode: 'clusters',
    answerCount: new Set(answers.map((a) => a.pid)).size,
    themes,
    keyStatements: out.keyStatements,
  };
}

export async function summarizeSynthesis(
  survey: SurveyDefinition,
  rows: ResultRow[],
  clusterSummaries: Record<string, AiSummary>,
): Promise<SynthesisSummary> {
  const results = aggregateAll(survey, rows, {});
  // Compact, anonymous numeric digest: no participant ids, no raw texts
  const digest = survey.questions
    .map((q) => {
      const r = results.questions[q.id];
      if (!r) return '';
      const head = `${q.id} ${q.short} (n=${r.n})`;
      switch (r.type) {
        case 'counts':
          return `${head}: ${r.items.map((i) => `${i.label} ${Math.round(i.share * 100)}%`).join('; ')}`;
        case 'numeric':
          return `${head}: Mittelwert ${r.mean?.toFixed(1)}, Median ${r.median?.toFixed(1)}`;
        case 'levels':
          return `${head}: Mittelwert ${r.mean?.toFixed(2)}; ${r.levels.map((l) => `${l.value} ${l.title} ${l.count}`).join('; ')}`;
        case 'grid':
          return `${head}: ${r.rows.map((row) => `${row.label} Ø ${row.mean?.toFixed(2) ?? '–'}`).join('; ')}`;
        case 'points':
          return `${head}: ${r.items.map((i) => `${i.label} ${Math.round(i.share * 100)}%`).join('; ')}`;
        case 'words':
          return `${head}: ${r.words.slice(0, 15).map((w) => `${w.text} (${w.count})`).join(', ')}`;
        case 'maturity':
          return `${head}: heute Ø ${r.now.mean?.toFixed(2) ?? '–'}, Ziel Ø ${r.target.mean?.toFixed(2) ?? '–'}, kann ich nicht beurteilen: ${r.na}`;
        case 'usecase': {
          const hours = r.items.map((i) => i.hours).filter((h): h is number => typeof h === 'number');
          const sensitive = r.items.filter((i) => (i.level ?? 0) >= 4).length;
          return `${head}: Summe ${hours.reduce((a, b) => a + b, 0)} Std./Woche für die Top-Aufgaben, davon ${sensitive} mit personen- oder patientenbezogenen Daten`;
        }
        case 'texts':
          return '';
      }
    })
    .filter(Boolean)
    .join('\n');
  const depth = Object.entries(results.depth)
    .map(([id, d]) => `${id} Nutzungstiefe (höchste Stufe): ${d.levels.map((l) => `${l.title} ${l.count}`).join('; ')}`)
    .join('\n');
  const clusters = Object.entries(clusterSummaries)
    .filter((e): e is [string, ClusterSummary] => e[1].mode === 'clusters')
    .map(([key, s]) => `${key}: ${s.themes.map((t) => `${t.title} (${t.count})`).join('; ')}. Kernaussagen: ${s.keyStatements.join(' ')}`)
    .join('\n');

  const prompt = `Ergebnisse der Befragung (${results.n} Teilnehmende), verdichtet:
${digest}
${depth}

Zusammenfassungen der Freitexte:
${clusters || '(noch keine)'}

Hintergrund: Der Workshop soll priorisierte KI-Use-Cases mit Aufwand-Nutzen-Bewertung und eine Roadmap liefern. Es gibt derzeit keine KI-Richtlinie; Microsoft Copilot ist eingeführt, daneben werden freie KI-Dienste genutzt. Datenschutz, ISO 13485, MDR und der EU AI Act (AI Literacy) sind relevant.

Aufgabe: Leite für die Moderatoren eine Synthese ab.
- headline: eine Kernbotschaft in einem Satz
- findings: 3–5 zentrale Befunde, jeweils mit Zahlenbezug aus den Ergebnissen
- implications: 3–5 konkrete Implikationen für den Workshop-Tag (worauf achten, was priorisieren, welche Diskussion führen)
- openQuestions: 2–4 Fragen, die im Workshop geklärt werden sollten`;

  const out = await aiDeps.call(SynthesisOutput, prompt);
  return { mode: 'synthesis', ...out };
}

// ---------- Persistence ----------

export function getSummaries(projectId: string): Record<string, StoredSummary> {
  const rows = db.prepare('SELECT * FROM ai_summaries WHERE project_id = ?').all(projectId) as {
    target_key: string;
    content: string;
    model: string;
    edited: number;
    generated_at: string;
  }[];
  return Object.fromEntries(
    rows.map((r) => [
      r.target_key,
      { content: JSON.parse(r.content) as AiSummary, edited: Boolean(r.edited), generatedAt: r.generated_at, model: r.model },
    ]),
  );
}

export function saveSummary(projectId: string, key: string, content: AiSummary, edited: boolean): void {
  db.prepare(
    `INSERT INTO ai_summaries (project_id, target_key, content, model, edited, generated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(project_id, target_key) DO UPDATE SET content = excluded.content, edited = excluded.edited,
       model = CASE WHEN excluded.edited = 1 THEN ai_summaries.model ELSE excluded.model END,
       generated_at = CASE WHEN excluded.edited = 1 THEN ai_summaries.generated_at ELSE excluded.generated_at END`,
  ).run(projectId, key, JSON.stringify(content), AI_MODEL, edited ? 1 : 0);
}
