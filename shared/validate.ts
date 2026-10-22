import type { AnswerMap, AnswerValue, MaturityAnswer, MultiAnswer, Question, SurveyDefinition, UseCaseAnswer } from './types.js';

export type ValidationResult = { ok: true; value: AnswerValue } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const cleanText = (v: unknown, max: number): string | null =>
  typeof v === 'string' ? v.trim().slice(0, max) : null;

/**
 * Validates and normalises a single answer against its question definition.
 * Partial answers are allowed (autosave); completeness is checked by isAnswered().
 */
export function validateAnswer(q: Question, raw: unknown, survey?: SurveyDefinition): ValidationResult {
  const fail = (error: string): ValidationResult => ({ ok: false, error });
  switch (q.type) {
    case 'short_text':
    case 'long_text': {
      const t = cleanText(raw, q.maxLength);
      return t === null ? fail('Text erwartet.') : { ok: true, value: t };
    }
    case 'text_list': {
      if (!Array.isArray(raw)) return fail('Liste erwartet.');
      const list = Array.from({ length: q.fields }, (_, i) => cleanText(raw[i] ?? '', q.maxLength) ?? '');
      return { ok: true, value: list };
    }
    case 'single': {
      if (typeof raw !== 'string' || !q.options.some((o) => o.id === raw)) return fail('Ungültige Auswahl.');
      return { ok: true, value: raw };
    }
    case 'multi': {
      if (!isRecord(raw) || !Array.isArray(raw.selected)) return fail('Auswahl erwartet.');
      const ids = new Set(q.options.map((o) => o.id));
      const selected = [...new Set(raw.selected.filter((s): s is string => typeof s === 'string'))];
      if (selected.some((s) => !ids.has(s))) return fail('Ungültige Auswahl.');
      const exclusive = selected.filter((s) => q.options.find((o) => o.id === s)?.exclusive);
      if (exclusive.length > 0 && selected.length > 1) return fail('Diese Auswahl schließt andere Antworten aus.');
      if (q.max !== undefined && selected.length > q.max) return fail(`Maximal ${q.max} Antworten.`);
      const value: MultiAnswer = { selected };
      const otherOpt = q.options.find((o) => o.other);
      if (otherOpt && selected.includes(otherOpt.id)) {
        value.other = cleanText(raw.other ?? '', 200) ?? '';
      }
      return { ok: true, value };
    }
    case 'slider': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return fail('Zahl erwartet.');
      if (raw < q.min || raw > q.max) return fail('Wert außerhalb des Bereichs.');
      return { ok: true, value: Math.round(raw / q.step) * q.step };
    }
    case 'stairs': {
      if (typeof raw !== 'number' || !Number.isInteger(raw)) return fail('Stufe erwartet.');
      const scale = survey?.scales[q.scale];
      if (scale && !scale.levels.some((l) => l.value === raw)) return fail('Ungültige Stufe.');
      return { ok: true, value: raw };
    }
    case 'grid': {
      if (!isRecord(raw)) return fail('Bewertung erwartet.');
      const max = survey?.scales[q.scale]?.levels.length ?? 5;
      const value: Record<string, number | null> = {};
      for (const row of q.rows) {
        if (!(row.id in raw)) continue;
        const v = raw[row.id];
        if (v === null) value[row.id] = null;
        else if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= (row.descriptions?.length ?? max)) value[row.id] = v;
        else return fail('Ungültige Stufe.');
      }
      return { ok: true, value };
    }
    case 'maturity': {
      if (!isRecord(raw)) return fail('Bewertung erwartet.');
      const inRange = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= q.descriptions.length);
      if (!('now' in raw) || !inRange(raw.now)) return fail('Ungültige Stufe für heute.');
      const value: MaturityAnswer = { now: raw.now as number | null };
      // "cannot judge" today makes a target meaningless
      if (value.now !== null && raw.target !== undefined) {
        if (!inRange(raw.target)) return fail('Ungültige Stufe für das Ziel.');
        value.target = raw.target as number | null;
      }
      return { ok: true, value };
    }
    case 'usecase': {
      if (!isRecord(raw)) return fail('Angaben erwartet.');
      const task = cleanText(raw.task ?? '', q.maxLength) ?? '';
      let hours: number | null = null;
      if (raw.hours !== null && raw.hours !== undefined) {
        if (typeof raw.hours !== 'number' || !Number.isFinite(raw.hours) || raw.hours < 0 || raw.hours > q.hoursMax) {
          return fail('Ungültige Stundenzahl.');
        }
        hours = Math.round(raw.hours / q.hoursStep) * q.hoursStep;
      }
      let data: string | null = null;
      if (raw.data !== null && raw.data !== undefined) {
        if (typeof raw.data !== 'string' || !q.dataOptions.some((o) => o.id === raw.data)) return fail('Ungültige Datenart.');
        data = raw.data;
      }
      const value: UseCaseAnswer = { task, hours, data };
      return { ok: true, value };
    }
    case 'points': {
      if (!isRecord(raw)) return fail('Punkte erwartet.');
      const value: Record<string, number> = {};
      let sum = 0;
      for (const o of q.options) {
        const v = raw[o.id];
        if (v === undefined || v === 0) continue;
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return fail('Ungültige Punktzahl.');
        value[o.id] = v;
        sum += v;
      }
      if (sum > q.budget) return fail(`Maximal ${q.budget} Punkte.`);
      return { ok: true, value };
    }
  }
}

/** Whether the stored answer counts as complete for a required question. */
export function isAnswered(q: Question, v: AnswerValue | undefined, survey?: SurveyDefinition): boolean {
  if (v === undefined) return false;
  switch (q.type) {
    case 'short_text':
    case 'long_text':
      return typeof v === 'string' && v.trim().length > 0;
    case 'text_list':
      return Array.isArray(v) && v.slice(0, q.requiredFields).every((t) => t.trim().length > 0);
    case 'single':
      return typeof v === 'string';
    case 'multi': {
      if (!isRecord(v) || !Array.isArray(v.selected) || v.selected.length === 0) return false;
      const otherOpt = q.options.find((o) => o.other);
      if (otherOpt && (v.selected as string[]).includes(otherOpt.id)) {
        const other: unknown = v.other;
        return typeof other === 'string' && other.trim().length > 0;
      }
      return true;
    }
    case 'slider':
      return typeof v === 'number';
    case 'stairs': {
      if (typeof v !== 'number') return false;
      const scale = survey?.scales[q.scale];
      return scale ? scale.levels.some((l) => l.value === v) : true;
    }
    case 'grid':
      return isRecord(v) && q.rows.every((r) => r.id in v);
    case 'maturity': {
      if (!isRecord(v) || !('now' in v)) return false;
      return v.now === null || typeof v.target === 'number';
    }
    case 'usecase': {
      if (!isRecord(v)) return false;
      const u = v as unknown as UseCaseAnswer;
      return typeof u.task === 'string' && u.task.trim().length > 0 && typeof u.hours === 'number' && typeof u.data === 'string';
    }
    case 'points': {
      if (!isRecord(v)) return false;
      const sum = Object.values(v).reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      return sum === q.budget;
    }
  }
}

/** Conditional questions are only shown when the referenced answer contains one of the options. */
export function isVisible(q: Question, answers: AnswerMap): boolean {
  if (!q.showIf) return true;
  const ref = answers[q.showIf.q];
  if (typeof ref === 'string') return q.showIf.anyOf.includes(ref);
  if (isRecord(ref) && Array.isArray(ref.selected)) return (ref.selected as string[]).some((s) => q.showIf!.anyOf.includes(s));
  return false;
}

export function visibleQuestions(survey: SurveyDefinition, answers: AnswerMap): Question[] {
  return survey.questions.filter((q) => isVisible(q, answers));
}

export function missingRequired(survey: SurveyDefinition, answers: AnswerMap): string[] {
  return visibleQuestions(survey, answers)
    .filter((q) => q.required && !isAnswered(q, answers[q.id], survey))
    .map((q) => q.id);
}

/** Replaces {{workshopDate}} / {{deadline}} placeholders in participant-facing texts. */
export function fillPlaceholders(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] || '[noch offen]');
}
