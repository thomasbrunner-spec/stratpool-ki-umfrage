import type { AnswerValue, MaturityAnswer, MultiAnswer, Question, SurveyDefinition, UseCaseAnswer } from './types.js';

/** Human-readable rendering of one answer (participant summary, admin detail view). */
export function formatAnswer(survey: SurveyDefinition, q: Question, v: AnswerValue | undefined): string {
  if (v === undefined) return '';
  switch (q.type) {
    case 'short_text':
    case 'long_text':
      return typeof v === 'string' ? v : '';
    case 'text_list':
      return Array.isArray(v) ? v.filter((t) => t.trim()).map((t) => `• ${t}`).join('\n') : '';
    case 'single':
      return q.options.find((o) => o.id === v)?.label ?? '';
    case 'multi': {
      const m = v as MultiAnswer;
      return (m.selected ?? [])
        .map((id) => {
          const o = q.options.find((x) => x.id === id);
          return o?.other && m.other ? `${o.label}: ${m.other}` : (o?.label ?? id);
        })
        .join(', ');
    }
    case 'slider':
      return typeof v === 'number' ? `${String(v).replace('.', ',')}${q.unit ? ` ${q.unit}` : ` von ${q.max}`}` : '';
    case 'stairs': {
      const l = survey.scales[q.scale]?.levels.find((x) => x.value === v);
      return l ? `${l.value} · ${l.title}` : '';
    }
    case 'grid': {
      const rec = v as Record<string, number | null>;
      const levels = survey.scales[q.scale]?.levels ?? [];
      return q.rows
        .filter((r) => r.id in rec)
        .map((r) => {
          const n = rec[r.id];
          return `${r.label}: ${n === null || n === undefined ? q.naLabel : q.viz === 'ampel' ? (levels[n - 1]?.title ?? '') : `${n} ${levels[n - 1]?.title ?? ''}`}`;
        })
        .join('\n');
    }
    case 'maturity': {
      const m = v as MaturityAnswer;
      const levels = survey.scales[q.scale]?.levels ?? [];
      const lvl = (n: number | null | undefined) => (typeof n === 'number' ? `${n} ${levels[n - 1]?.title ?? ''}` : '–');
      return m.now === null ? q.naLabel : `heute ${lvl(m.now)} → Ziel ${lvl(m.target)}`;
    }
    case 'usecase': {
      const u = v as UseCaseAnswer;
      const data = q.dataOptions.find((o) => o.id === u.data)?.label;
      return [u.task, typeof u.hours === 'number' ? `${String(u.hours).replace('.', ',')} Std./Woche` : null, data ? `Daten: ${data}` : null]
        .filter(Boolean)
        .join('\n');
    }
    case 'points': {
      const rec = v as Record<string, number>;
      return q.options
        .filter((o) => (rec[o.id] ?? 0) > 0)
        .sort((a, b) => (rec[b.id] ?? 0) - (rec[a.id] ?? 0))
        .map((o) => `${rec[o.id]} × ${o.label}`)
        .join('\n');
    }
  }
}
