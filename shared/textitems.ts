import type { ResultRow } from './aggregate.js';
import type { SurveyDefinition } from './types.js';

/** One free-text answer (or one entry of a text list / the task of a use-case profile). */
export interface TextItemRef {
  /** stable key: participant|question|index */
  key: string;
  pid: string;
  qid: string;
  idx: number;
  text: string;
}

export const textKey = (pid: string, qid: string, idx: number) => `${pid}|${qid}|${idx}`;

const FREE_TEXT_TYPES = new Set(['short_text', 'long_text', 'text_list', 'usecase']);

/** Question ids whose answers contain free text. */
export function freeTextQuestionIds(survey: SurveyDefinition): string[] {
  return survey.questions.filter((q) => FREE_TEXT_TYPES.has(q.type)).map((q) => q.id);
}

/** All non-empty free-text items of the given rows, in survey order. */
export function collectTextItems(survey: SurveyDefinition, rows: ResultRow[], onlyQuestions?: string[]): TextItemRef[] {
  const out: TextItemRef[] = [];
  for (const q of survey.questions) {
    if (!FREE_TEXT_TYPES.has(q.type)) continue;
    if (onlyQuestions && !onlyQuestions.includes(q.id)) continue;
    for (const r of rows) {
      const v = r.answers[q.id];
      const pid = r.participant.id;
      const push = (text: unknown, idx: number) => {
        if (typeof text === 'string' && text.trim()) out.push({ key: textKey(pid, q.id, idx), pid, qid: q.id, idx, text: text.trim() });
      };
      if (q.type === 'text_list' && Array.isArray(v)) v.forEach((t, i) => push(t, i));
      else if (q.type === 'usecase' && v && typeof v === 'object' && !Array.isArray(v) && 'task' in v) push((v as { task?: unknown }).task, 0);
      else if (typeof v === 'string') push(v, 0);
    }
  }
  return out;
}

/**
 * Removes hidden free-text items (e.g. "siehe vorherige Antwort") before aggregation.
 * Single texts and use-case profiles disappear completely, text lists lose the hidden entries.
 */
export function applyHiddenTexts(survey: SurveyDefinition, rows: ResultRow[], hidden: Set<string>): ResultRow[] {
  if (hidden.size === 0) return rows;
  const types = new Map(survey.questions.map((q) => [q.id, q.type]));
  return rows.map((r) => {
    let answers = r.answers;
    for (const [qid, v] of Object.entries(r.answers)) {
      const type = types.get(qid);
      if (!type || !FREE_TEXT_TYPES.has(type)) continue;
      const pid = r.participant.id;
      if (type === 'text_list' && Array.isArray(v)) {
        if (!v.some((_, i) => hidden.has(textKey(pid, qid, i)))) continue;
        answers = { ...answers, [qid]: v.filter((_, i) => !hidden.has(textKey(pid, qid, i))) };
      } else if (hidden.has(textKey(pid, qid, 0))) {
        answers = { ...answers };
        delete answers[qid];
      }
    }
    return answers === r.answers ? r : { ...r, answers };
  });
}
