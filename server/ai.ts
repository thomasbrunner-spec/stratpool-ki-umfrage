import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { aggregateAll, type ResultRow } from '../shared/aggregate.js';
import { pseudonymize } from '../shared/pseudonymize.js';
import type { AiTarget, SurveyDefinition } from '../shared/types.js';
import { neutralTitle } from '../shared/validate.js';
import type {
  AiSummary,
  ChatMessage,
  ChatReply,
  ChatSource,
  ClusterSummary,
  StoredSummary,
  SynthesisSummary,
  TermsSummary,
} from '../shared/ai-types.js';
import { collectTextItems, type TextItemRef } from '../shared/textitems.js';

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

const TermsOutput = z.object({
  terms: z.array(z.object({ text: z.string(), answerIds: z.array(z.string()) })),
});

const CheckOutput = z.object({
  flagged: z.array(z.object({ id: z.string(), reason: z.enum(['Verweis', 'Keine Angabe', 'Inhaltsleer', 'Testeintrag']) })),
});

const ChatOutput = z.object({
  coverage: z.enum(['full', 'partial', 'none']),
  answer: z.string(),
  questionsUsed: z.array(z.string()),
  quotes: z.array(z.object({ ref: z.string(), text: z.string() })),
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

interface CallOptions {
  /** system prompt blocks; the last one is cached (survey data for the chat) */
  system?: string[];
  /** previous chat turns; the prompt is appended as the last user message */
  history?: ChatMessage[];
  effort?: 'low' | 'medium' | 'high';
}

async function callModel<T extends z.ZodType>(schema: T, prompt: string, opts: CallOptions = {}): Promise<z.infer<T>> {
  const system = opts.system ?? [SYSTEM];
  const response = await client().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: system.map((text, i) => ({ type: 'text' as const, text, ...(i === system.length - 1 && system.length > 1 ? { cache_control: { type: 'ephemeral' as const } } : {}) })),
    output_config: { effort: opts.effort ?? 'high', format: betaZodOutputFormat(schema) },
    messages: [...(opts.history ?? []).map((m) => ({ role: m.role, content: m.content })), { role: 'user' as const, content: prompt }],
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
    .map((id) => neutralTitle(survey.questions.find((q) => q.id === id)?.title ?? id))
    .join(' / ');
  const prompt = `Frage an die Teilnehmenden: „${questionTitles}“

Antworten (je Zeile eine Antwort mit ID):
${answers.map((a) => `${a.id}: ${a.text.replace(/\s+/g, ' ')}`).join('\n')}

Aufgabe:
1. Bilde 3 bis 7 Themencluster. Ordne jede Antwort-ID allen Clustern zu, zu denen sie inhaltlich gehört (answerIds). Sortiere die Cluster nach Anzahl der Antworten, absteigend. Antworten ohne eigenen Inhalt (Verweise wie „siehe oben“ oder „siehe vorherige Antwort“, Platzhalter wie „-“, „keine“, „k. A.“) ordnest du keinem Cluster zu und zitierst sie nicht.
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

/** Compact, anonymous numeric digest of all questions: no participant ids, no raw texts. */
function numericDigest(survey: SurveyDefinition, rows: ResultRow[]) {
  const results = aggregateAll(survey, rows, {});
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
  return { results, digest, depth };
}

export async function summarizeSynthesis(
  survey: SurveyDefinition,
  rows: ResultRow[],
  clusterSummaries: Record<string, AiSummary>,
): Promise<SynthesisSummary> {
  const { results, digest, depth } = numericDigest(survey, rows);
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

Aufgabe: Leite für die Moderatoren eine Synthese ab. Sie wird auf zwei Präsentationsfolien gezeigt, fasse dich deshalb kurz.
- headline: eine Kernbotschaft in einem Satz (höchstens 25 Wörter)
- findings: 3–4 zentrale Befunde, jeweils mit Zahlenbezug aus den Ergebnissen. title höchstens 6 Wörter, text höchstens 30 Wörter.
- implications: 3–4 konkrete Implikationen für den Workshop-Tag (worauf achten, was priorisieren, welche Diskussion führen). title höchstens 6 Wörter, text höchstens 30 Wörter.
- openQuestions: 2–3 Fragen, die im Workshop geklärt werden sollten (je höchstens 15 Wörter)`;

  const out = await aiDeps.call(SynthesisOutput, prompt);
  return { mode: 'synthesis', ...out };
}

// ---------- Word cloud terms ----------

export async function summarizeTerms(
  survey: SurveyDefinition,
  target: AiTarget,
  rows: ResultRow[],
  allNames: string[],
): Promise<TermsSummary> {
  const items = collectTextItems(survey, rows, target.questions);
  const answers = items.map((it, i) => ({ id: `A${i + 1}`, pid: it.pid, text: pseudonymize(it.text, allNames) }));
  if (answers.length === 0) return { mode: 'terms', answerCount: 0, terms: [] };
  const questionTitles = target.questions.map((id) => neutralTitle(survey.questions.find((q) => q.id === id)?.title ?? id)).join(' / ');
  const prompt = `Frage an die Teilnehmenden: „${questionTitles}“
Gewünscht war ein Wort, viele haben aber mehrere Wörter oder kleine Sätze geschrieben.

Antworten (je Zeile eine Antwort mit ID):
${answers.map((a) => `${a.id}: ${a.text.replace(/\s+/g, ' ')}`).join('\n')}

Aufgabe: Verdichte die Antworten zu Begriffen für eine Wortwolke.
- Jeder Begriff hat 1–2 Wörter, möglichst ein Substantiv in der Schreibweise der Antworten (z. B. „Arbeitserleichterung“, „Zeitgewinn“, „Verlust des Mitdenkens“ → „Mitdenken verlieren“).
- Fasse Synonyme, Schreibvarianten und sinngleiche Begriffe zu einem Begriff zusammen.
- Eine Antwort darf zu 1–3 Begriffen gehören, wenn sie mehrere Aspekte nennt (answerIds).
- Erhalte die Haltung: kritische oder ambivalente Begriffe bleiben kritisch.
- Höchstens 20 Begriffe. Antworten ohne eigenen Inhalt ordnest du keinem Begriff zu.`;
  const out = await aiDeps.call(TermsOutput, prompt);
  const byId = new Map(answers.map((a) => [a.id, a]));
  const terms = out.terms
    .map((t) => ({ text: t.text.trim(), count: new Set(t.answerIds.filter((id) => byId.has(id)).map((id) => byId.get(id)!.pid)).size }))
    .filter((t) => t.text && t.count > 0)
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'de'));
  return { mode: 'terms', answerCount: new Set(answers.map((a) => a.pid)).size, terms };
}

// ---------- Check free texts for non-substantive answers ----------

/** Asks the model which free-text items carry no content of their own. Returns key → reason for flagged items. */
export async function checkTexts(survey: SurveyDefinition, items: TextItemRef[], allNames: string[]): Promise<Map<string, string>> {
  const verdicts = new Map<string, string>();
  const CHUNK = 200;
  for (let start = 0; start < items.length; start += CHUNK) {
    const chunk = items.slice(start, start + CHUNK);
    const ids = new Map(chunk.map((it, i) => [`T${i + 1}`, it]));
    const byQuestion = new Map<string, string[]>();
    for (const [id, it] of ids) {
      const lines = byQuestion.get(it.qid) ?? [];
      lines.push(`${id}: ${pseudonymize(it.text, allNames).replace(/\s+/g, ' ')}`);
      byQuestion.set(it.qid, lines);
    }
    const blocks = [...byQuestion.entries()].map(([qid, lines]) => {
      const q = survey.questions.find((x) => x.id === qid);
      return `Frage ${qid}: „${neutralTitle(q?.title ?? qid)}“\n${lines.join('\n')}`;
    });
    const prompt = `Prüfe die folgenden Freitext-Antworten einer Befragung. Markiere nur Antworten, die für die Auswertung keinen eigenen Inhalt haben:
- Verweis: verweist nur auf eine andere Antwort oder Frage, gleich in welcher Formulierung (z. B. „siehe oben“, „s. o.“, „wie vorher“, „siehe vorherige Antwort“, „siehe Frage 3“, „dito“).
- Keine Angabe: drückt nur aus, dass man nichts sagen möchte oder nichts weiß (z. B. „-“, „keine“, „nichts“, „k. A.“, „weiß nicht“, „nein“).
- Inhaltsleer: Zeichenfolgen ohne Bedeutung, nur Satzzeichen oder offensichtlich abgebrochene Eingaben.
- Testeintrag: offensichtliche Testeingaben („test“, „asdf“).

Nicht markieren: kurze, aber inhaltliche Antworten (z. B. „Präsentationen“, „Vision zu KI“), Kritik, Skepsis oder Ablehnung, Fragen, Antworten mit Rechtschreibfehlern.
Im Zweifel nicht markieren.

${blocks.join('\n\n')}`;
    const out = await aiDeps.call(CheckOutput, prompt);
    for (const f of out.flagged) {
      const it = ids.get(f.id);
      if (it) verdicts.set(it.key, f.reason);
    }
  }
  return verdicts;
}

// ---------- Chat about the survey ----------

const normQuote = (s: string) =>
  s
    .toLowerCase()
    .replace(/[„“"‚‘'«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** A quote is verified when all its parts (split at "…") occur in this order in the source text. */
export function quoteMatches(quote: string, source: string): boolean {
  const src = normQuote(source);
  const parts = quote
    .split(/…|\.\.\./)
    .map(normQuote)
    .map((p) => p.replace(/^[\s.,;:!?-]+|[\s.,;:!?-]+$/g, ''))
    .filter(Boolean);
  if (!parts.length) return false;
  let pos = 0;
  for (const p of parts) {
    const at = src.indexOf(p, pos);
    if (at < 0) return false;
    pos = at + p.length;
  }
  return true;
}

function describeAnswer(survey: SurveyDefinition, q: SurveyDefinition['questions'][number], v: unknown): string | null {
  const label = (opts: { id: string; label: string }[], id: string) => opts.find((o) => o.id === id)?.label ?? id;
  const scaleTitle = (scale: string, value: number) => survey.scales[scale]?.levels.find((l) => l.value === value)?.title ?? '';
  switch (q.type) {
    case 'single':
      return typeof v === 'string' ? label(q.options, v) : null;
    case 'multi': {
      if (!v || typeof v !== 'object' || !('selected' in v)) return null;
      const m = v as { selected: string[]; other?: string };
      const parts = m.selected.map((id) => label(q.options, id));
      return parts.length ? parts.join('; ') + (m.other ? ` (Sonstiges: ${m.other})` : '') : 'nichts ausgewählt';
    }
    case 'slider':
      return typeof v === 'number' ? `${v}${q.unit ? ` ${q.unit}` : ''} (Skala ${q.min} „${q.minLabel}“ bis ${q.max} „${q.maxLabel}“)` : null;
    case 'stairs':
      return typeof v === 'number' ? `Stufe ${v} ${scaleTitle(q.scale, v)}` : null;
    case 'maturity': {
      if (!v || typeof v !== 'object' || !('now' in v)) return null;
      const m = v as { now: number | null; target?: number | null };
      if (m.now === null) return 'kann ich nicht beurteilen';
      return `heute ${m.now} ${scaleTitle(q.scale, m.now)}${typeof m.target === 'number' ? `, Ziel in drei Jahren ${m.target} ${scaleTitle(q.scale, m.target)}` : ''}`;
    }
    case 'grid': {
      if (!v || typeof v !== 'object') return null;
      const rec = v as Record<string, number | null>;
      return q.rows
        .filter((r) => r.id in rec)
        .map((r) => `${r.label}: ${rec[r.id] === null ? q.naLabel : `${rec[r.id]} ${scaleTitle(q.scale, rec[r.id] as number)}`}`)
        .join('; ');
    }
    case 'points': {
      if (!v || typeof v !== 'object') return null;
      const rec = v as Record<string, number | null>;
      const parts = q.options.filter((o) => (rec[o.id] ?? 0) > 0).map((o) => `${o.label}: ${rec[o.id]}`);
      return parts.length ? parts.join('; ') : 'keine Punkte vergeben';
    }
    default:
      return null;
  }
}

interface ChatContext {
  data: string;
  refs: Map<string, { text: string; qid: string; group: string }>;
}

/** Builds the pseudonymised data block for the chat: questionnaire, key figures and one record per respondent. */
export function buildChatContext(survey: SurveyDefinition, rows: ResultRow[], allNames: string[]): ChatContext {
  const refs: ChatContext['refs'] = new Map();
  const questionnaire = survey.questions
    .map((q) => {
      const opts = 'options' in q && Array.isArray(q.options) ? ` · Optionen: ${q.options.map((o) => o.label).join(' | ')}` : '';
      return `${q.id} (${q.type}) ${q.short}: „${neutralTitle(q.title)}“${opts}`;
    })
    .join('\n');
  const { results, digest, depth } = numericDigest(survey, rows);
  const textItems = collectTextItems(survey, rows);
  const textsByPid = new Map<string, TextItemRef[]>();
  for (const it of textItems) textsByPid.set(it.pid, [...(textsByPid.get(it.pid) ?? []), it]);

  const records = rows.map((r, i) => {
    const rid = `R${String(i + 1).padStart(2, '0')}`;
    const p = r.participant;
    const group = [p.leader ? 'Führung' : 'Team', p.company || 'Gesellschaft unbekannt', p.func || 'Bereich unbekannt'].join(' · ');
    const lines = [`${rid} [${group} · Workshop: ${p.workshop ? 'ja' : 'nein'} · ${r.completed ? 'abgeschlossen' : 'nicht abgeschlossen'}]`];
    const texts = textsByPid.get(p.id) ?? [];
    for (const q of survey.questions) {
      const v = r.answers[q.id];
      if (v === undefined) continue;
      const own = texts.filter((t) => t.qid === q.id);
      if (own.length) {
        for (const t of own) {
          const ref = own.length > 1 || q.type === 'text_list' ? `${rid}·${q.id}·${t.idx + 1}` : `${rid}·${q.id}`;
          const text = pseudonymize(t.text, allNames).replace(/\s+/g, ' ');
          refs.set(ref, { text, qid: q.id, group });
          lines.push(`  ${ref}: „${text}“`);
        }
        if (q.type === 'usecase' && v && typeof v === 'object' && 'hours' in v) {
          const u = v as { hours: number | null; data: string | null };
          const data = q.dataOptions.find((o) => o.id === u.data)?.label ?? 'keine Angabe';
          lines.push(`    ${q.id} Zeitaufwand: ${u.hours ?? 'keine Angabe'} Std./Woche · Daten: ${data}`);
        }
        continue;
      }
      const d = describeAnswer(survey, q, v);
      if (d) lines.push(`  ${q.id}: ${d}`);
    }
    return lines.join('\n');
  });

  const data = `UMFRAGEDATEN (${results.n} Datensätze; Personen sind mit R-Nummern pseudonymisiert, Namen wurden durch [Name] ersetzt)

FRAGEBOGEN
${questionnaire}

KENNZAHLEN (aus allen Datensätzen berechnet)
${digest}
${depth}

DATENSÄTZE
${records.join('\n\n')}`;
  return { data, refs };
}

const CHAT_RULES = `Du beantwortest Fragen der Moderatoren zur Befragung. Grundlage ist ausschließlich der Block UMFRAGEDATEN.

Regeln gegen Erfindungen:
- Jede Aussage muss sich direkt aus den Umfragedaten ergeben. Nutze kein Allgemeinwissen über KI, das Unternehmen oder die Branche als Tatsache.
- Zahlen übernimmst du aus den KENNZAHLEN oder zählst sie aus den DATENSÄTZEN aus. Nenne immer die Basis (z. B. „5 von 14“). Schätze nichts.
- Lässt sich die Frage nicht oder nur teilweise aus den Daten beantworten, sag das im ersten Satz ausdrücklich und setze coverage auf "none" bzw. "partial". Rate nicht und fülle keine Lücken.
- Wirst du um eine Einschätzung oder Empfehlung gebeten, trenne klar: erst was die Daten zeigen, dann einen Absatz, der mit „Einordnung (nicht aus der Umfrage):“ beginnt.
- Zitate (quotes) müssen wörtlich aus genau einer Antwort stammen und deren Referenz (ref, z. B. „R03·H3“) tragen. Kürzen mit „…“ ist erlaubt. Belege jede Aussage über Freitexte mit mindestens einem Zitat.
- Nenne keine Namen und versuche nicht, Personen zu identifizieren. Beschreibe Personen über ihre Gruppe (Führung/Team, Gesellschaft, Bereich). Weise bei Gruppen unter 3 Personen auf die geringe Aussagekraft hin.
- questionsUsed: die Fragen-IDs, auf die sich die Antwort stützt.

Form: Deutsch, Sie-Form, sachlich und knapp (höchstens etwa 150 Wörter). Absätze und Aufzählungen mit „- “ sind erlaubt, kein weiteres Markdown. Keine R-Nummern im Antworttext, die gehören in die Zitate.`;

export async function chatAboutSurvey(
  survey: SurveyDefinition,
  rows: ResultRow[],
  allNames: string[],
  history: ChatMessage[],
  question: string,
): Promise<ChatReply> {
  const ctx = buildChatContext(survey, rows, allNames);
  const out = await aiDeps.call(ChatOutput, question, {
    system: [`${SYSTEM}\n\n${CHAT_RULES}`, ctx.data],
    history: history.slice(-10),
    effort: 'medium',
  });
  const sources: ChatSource[] = [];
  let dropped = 0;
  for (const q of out.quotes) {
    const ref = q.ref.trim().replace(/\s+/g, '').replace(/[·.]/g, '·');
    const src = ctx.refs.get(ref);
    if (!src || !quoteMatches(q.text, src.text)) {
      dropped++;
      continue;
    }
    const question = survey.questions.find((x) => x.id === src.qid);
    sources.push({ ref, question: question?.short ?? src.qid, group: src.group, quote: q.text.trim() });
  }
  const known = new Map(survey.questions.map((q) => [q.id, q.short]));
  return {
    answer: out.answer.trim(),
    coverage: out.coverage,
    questionsUsed: [...new Set(out.questionsUsed)].filter((id) => known.has(id)).map((id) => ({ id, short: known.get(id)! })),
    sources,
    droppedQuotes: dropped,
  };
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
