/** Minimal RFC-4180-style CSV parser (quotes, escaped quotes, ; or , delimiter). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

export interface ImportedParticipant {
  name: string;
  email: string;
  company: string;
  func: string;
  roleNote: string;
  workshop: boolean;
}

const COLS: Record<keyof ImportedParticipant, string[]> = {
  name: ['name', 'teilnehmer', 'teilnehmerin'],
  email: ['email', 'e-mail', 'mail'],
  company: ['gesellschaft', 'company', 'firma', 'unternehmen'],
  func: ['funktion', 'bereich', 'func', 'abteilung'],
  roleNote: ['kuerzel_funktion', 'rolle', 'position', 'titel'],
  workshop: ['workshop', 'ws', 'workshop_teilnehmer'],
};

const TRUTHY = new Set(['ja', 'yes', 'y', 'j', 'x', '1', 'true', 'wahr']);

/** Guesses the function/area dropdown value from a role abbreviation like "AL QM" or "GF DT". */
export function guessFunction(role: string, functions: string[]): string {
  const r = ` ${role.toLowerCase()} `;
  const rules: [RegExp, string][] = [
    [/\bgf\b|geschäftsf|ceo|managing/, 'Geschäftsführung'],
    [/\bca\b|clinical/, 'Clinical Affairs'],
    [/\bra\b|regulatory/, 'Regulatory Affairs'],
    [/\bqm\b|qualit/, 'Qualitätsmanagement'],
    [/f&e|f\+e|\bfue\b|r&d|entwicklung/, 'F&E'],
    [/produkt\s*management|produktmanag/, 'Produktmanagement'],
    [/produktion|fertigung|herstellung|\bmfg\b/, 'Produktion'],
    [/projekt/, 'Projektmanagement'],
    [/marketing/, 'Marketing'],
    [/financ|finanz|controlling/, 'Finance'],
    [/legal|recht|\bhr\b|personal/, 'Legal & HR'],
    [/\bid\b|vertrieb|sales/, 'Vertrieb/ID'],
  ];
  for (const [re, f] of rules) if (re.test(r) && functions.includes(f)) return f;
  return '';
}

export function mapCsvRows(rows: string[][], functions: string[]): { participants: ImportedParticipant[]; errors: string[] } {
  const [header, ...data] = rows;
  if (!header) return { participants: [], errors: ['Die Datei ist leer.'] };
  const h = header.map((c) => c.trim().toLowerCase());
  const idx = Object.fromEntries(
    (Object.keys(COLS) as (keyof ImportedParticipant)[]).map((k) => [k, h.findIndex((c) => COLS[k].includes(c))]),
  ) as Record<keyof ImportedParticipant, number>;
  if (idx.name < 0) return { participants: [], errors: ['Spalte „name“ fehlt in der Kopfzeile.'] };

  const get = (r: string[], k: keyof ImportedParticipant) => (idx[k] >= 0 ? (r[idx[k]] ?? '').trim() : '');
  const participants: ImportedParticipant[] = [];
  const errors: string[] = [];
  data.forEach((r, i) => {
    const name = get(r, 'name');
    if (!name) {
      errors.push(`Zeile ${i + 2}: kein Name, übersprungen.`);
      return;
    }
    const roleNote = get(r, 'roleNote');
    const func = get(r, 'func');
    participants.push({
      name,
      email: get(r, 'email'),
      company: get(r, 'company'),
      roleNote,
      func: functions.includes(func) ? func : guessFunction(func || roleNote, functions),
      workshop: TRUTHY.has(get(r, 'workshop').toLowerCase()),
    });
  });
  return { participants, errors };
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so that Excel opens UTF-8 correctly
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
}
