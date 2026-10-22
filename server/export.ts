import ExcelJS from 'exceljs';
import type { AnswerValue, MultiAnswer, Question, SurveyDefinition } from '../shared/types.js';
import { getAnswers, listParticipants, type ParticipantRow } from './db.js';

type Cell = string | number | null;

function columnsFor(survey: SurveyDefinition, q: Question): { header: string; get: (v: AnswerValue | undefined) => Cell }[] {
  const label = `${q.id} ${q.short}`;
  switch (q.type) {
    case 'grid':
      return q.rows.map((r) => ({
        header: `${q.id} ${r.label}`,
        get: (v) => {
          if (!v || typeof v !== 'object' || Array.isArray(v) || !(r.id in v)) return null;
          const n = (v as Record<string, number | null>)[r.id];
          return n === null || n === undefined ? 'k. A.' : n;
        },
      }));
    case 'points':
      return q.options.map((o) => ({
        header: `${q.id} ${o.label}`,
        get: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? ((v as Record<string, number>)[o.id] ?? 0) : null),
      }));
    case 'multi':
      return [
        {
          header: label,
          get: (v) => {
            const m = v as MultiAnswer | undefined;
            if (!m?.selected) return null;
            return m.selected
              .map((id) => {
                const o = q.options.find((x) => x.id === id);
                return o?.other && m.other ? `${o.label}: ${m.other}` : (o?.label ?? id);
              })
              .join(' | ');
          },
        },
      ];
    case 'single':
      return [{ header: label, get: (v) => (typeof v === 'string' ? (q.options.find((o) => o.id === v)?.label ?? v) : null) }];
    case 'stairs':
      return [
        {
          header: label,
          get: (v) => {
            if (typeof v !== 'number') return null;
            const lvl = survey.scales[q.scale]?.levels.find((l) => l.value === v);
            return lvl ? `${v} ${lvl.title}` : v;
          },
        },
      ];
    case 'text_list':
      return [{ header: label, get: (v) => (Array.isArray(v) ? v.filter((t) => t.trim()).join(' | ') : null) }];
    default:
      return [{ header: label, get: (v) => (typeof v === 'string' || typeof v === 'number' ? v : null) }];
  }
}

const status = (p: ParticipantRow, answered: boolean) =>
  p.completed_at ? 'abgeschlossen' : answered ? 'begonnen' : 'eingeladen';

export function exportTable(projectId: string, survey: SurveyDefinition): Cell[][] {
  const cols = survey.questions.flatMap((q) => columnsFor(survey, q).map((c) => ({ ...c, qid: q.id })));
  const header: Cell[] = ['Name', 'E-Mail', 'Gesellschaft', 'Funktion/Bereich', 'Rolle', 'Workshop', 'Status', 'Abgeschlossen am', ...cols.map((c) => c.header)];
  const rows = listParticipants(projectId).map((p) => {
    const a = getAnswers(p.id);
    return [
      p.name,
      p.email,
      p.company,
      p.func,
      p.role_note,
      p.workshop ? 'ja' : 'nein',
      status(p, Object.keys(a).length > 0),
      p.completed_at,
      ...cols.map((c) => c.get(a[c.qid])),
    ];
  });
  return [header, ...rows];
}

export async function exportXlsx(table: Cell[][], title: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ERA Group – KI-Umfrage';
  const ws = wb.addWorksheet(title.slice(0, 31) || 'Antworten');
  ws.addRows(table);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  ws.columns.forEach((c) => {
    c.width = 22;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
