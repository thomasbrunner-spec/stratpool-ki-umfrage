// Seeds a demo project with 17 fictitious participants and plausible answers.
// For local testing only – never run against production data.
// Usage: DATA_DIR=./data JWT_SECRET=x npm run seed:fake
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, insertParticipant, saveAnswer } from '../server/db.js';
import { getSurvey } from '../server/surveys.js';
import { validateAnswer } from '../shared/validate.js';
import type { AnswerValue, MultiQuestion } from '../shared/types.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed fake data in production.');
  process.exit(1);
}

const SLUG = 'demo';
const survey = getSurvey('humantech-2026')!;

// Deterministic PRNG so repeated seeds give the same picture
let seed = 42;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;

const COMPANIES = ['Muster Spine GmbH', 'Muster Technik GmbH', 'Muster Gruppe', 'Muster Solutions', 'Muster México'];
const PEOPLE: [string, string, string, boolean][] = [
  ['Anna Beispiel', 'Geschäftsführung', COMPANIES[1]!, true],
  ['Bernd Exempel', 'Geschäftsführung', COMPANIES[0]!, true],
  ['Clara Muster', 'F&E', COMPANIES[1]!, true],
  ['David Probe', 'Vertrieb/ID', COMPANIES[0]!, true],
  ['Eva Test', 'Finance', COMPANIES[1]!, true],
  ['Frank Demo', 'Clinical Affairs', COMPANIES[0]!, true],
  ['Gina Platzhalter', 'Regulatory Affairs', COMPANIES[0]!, true],
  ['Hans Vorlage', 'Qualitätsmanagement', COMPANIES[0]!, true],
  ['Ida Schablone', 'F&E', COMPANIES[1]!, true],
  ['Jonas Entwurf', 'Geschäftsführung', COMPANIES[2]!, false],
  ['Karla Skizze', 'Legal & HR', COMPANIES[3]!, false],
  ['Lars Modell', 'F&E', COMPANIES[0]!, false],
  ['Mara Muster', 'F&E', COMPANIES[0]!, false],
  ['Nils Prototyp', 'Projektmanagement', COMPANIES[0]!, false],
  ['Olga Attrappe', 'Marketing', COMPANIES[0]!, false],
  ['Paul Fiktiv', 'Produktmanagement', COMPANIES[0]!, false],
  ['Rosa Annahme', 'Vertrieb/ID', COMPANIES[4]!, false],
];

const WORDS = ['Chancen', 'Effizienz', 'Neugier', 'Datenschutz', 'Zeitgewinn', 'Unsicherheit', 'Zukunft', 'Copilot', 'Chancen', 'Hype', 'Werkzeug', 'Effizienz', 'Respekt', 'Potenzial', 'Chancen'];
const TASKS = [
  'Literaturrecherche für die klinische Bewertung',
  'Technische Dokumentation nach MDR aktualisieren',
  'Protokolle von Meetings schreiben',
  'SOPs durchsuchen und Antworten finden',
  'Angebote und Ausschreibungen beantworten',
  'CAPA-Berichte formulieren',
  'Übersetzungen von Gebrauchsanweisungen',
  'Lieferantenkommunikation und Rückfragen',
  'Auswertungen in Excel für das Controlling',
  'Schulungsnachweise pflegen',
  'Verträge auf Standardklauseln prüfen',
  'Marketingtexte für Produktneuheiten',
  'Idee: interner Assistent, der Fragen zu SOPs mit Quellen beantwortet',
  'Idee: automatische Vorprüfung von Lieferantenzertifikaten',
];
const EXPECT = [
  'Eine klare Liste mit drei Use Cases, die wir im ersten Quartal starten.',
  'Klarheit, welche Tools wir nutzen dürfen und wie wir mit Daten umgehen.',
  'Eine Roadmap mit Verantwortlichen und realistischen Aufwänden.',
  'Dass wir ehrlich über Risiken bei MDR und ISO 13485 sprechen.',
  'Konkrete Ideen für meinen Bereich, nicht nur Theorie.',
  'Ein gemeinsames Verständnis, was KI für uns leisten soll.',
];
const QUESTIONS = [
  'Welche Daten dürfen wir in Copilot verwenden?',
  'Wer ist bei uns für KI verantwortlich?',
  'Wie stellen wir sicher, dass KI-Ergebnisse geprüft werden?',
  'Brauchen wir eine Schulung für alle nach dem AI Act?',
  'Was kostet ein eigener KI-Assistent?',
];
const CONCERNS = [
  'Vertrauliche Patientendaten dürfen auf keinen Fall in freie Tools gelangen.',
  'Ich habe Sorge, dass Fehler in regulatorischen Dokumenten durchrutschen.',
  'Es darf nicht nur ein weiteres Projekt ohne Umsetzung werden.',
  'Die Mitarbeitenden brauchen Zeit zum Lernen, sonst bleibt alles beim Alten.',
  '',
];

db.prepare('DELETE FROM projects WHERE slug = ?').run(SLUG);
const projectId = crypto.randomUUID();
db.prepare(
  `INSERT INTO projects (id, slug, name, client, survey_id, access_mode, shared_password_hash, companies, workshop_date, deadline)
   VALUES (?, ?, ?, ?, ?, 'both', ?, ?, ?, ?)`,
).run(projectId, SLUG, 'Demo – KI-Umfrage', 'Muster Spine GmbH (Demo)', survey.id, bcrypt.hashSync('demo', 10), JSON.stringify(COMPANIES), '2026-11-26', '2026-11-18');

const q = (id: string) => survey.questions.find((x) => x.id === id)!;
const c2 = q('C2') as MultiQuestion;

PEOPLE.forEach(([name, func, company, workshop], idx) => {
  const p = insertParticipant(projectId, { name, func, company, workshop, roleNote: func, email: `${name.split(' ')[0]!.toLowerCase()}@example.com` });
  if (idx === 16) return; // one invited person who has not started
  const k = clamp(0.45 + gauss() * 0.6 + (func === 'F&E' ? 0.15 : 0), 0, 1); // knowledge trait
  const opt = clamp(0.55 + gauss() * 0.5 + k * 0.2, 0, 1); // optimism trait
  const a: Record<string, AnswerValue> = {};
  a.A1 = pick(WORDS);
  a.B1 = ['nie', 'selten', 'monatlich', 'woechentlich', 'taeglich', 'mehrmals_taeglich'][clamp(Math.round(k * 5 + gauss()), 0, 5)]!;
  const tools = ['m365_copilot', 'copilot_chat', 'chatgpt', 'deepl', 'claude', 'perplexity', 'gemini'].filter((_, i) => rnd() < k * (i < 3 ? 1.1 : 0.5));
  a.B2 = tools.length ? { selected: tools } : { selected: ['keine'] };
  a.B3 = rnd() < 0.15 ? 'keine_angabe' : ['nein', 'gelegentlich', 'regelmaessig'][clamp(Math.round(k * 2.2 + gauss() * 0.8), 0, 2)]!;
  a.C1 = Math.round(clamp(k * 100 + gauss() * 15, 2, 98));
  const depthMax = clamp(Math.round(k * 4 + gauss()), 0, 4);
  const did = c2.options.filter((o) => {
    const lvl = c2.groups?.find((g) => g.id === o.group)?.level ?? 99;
    return lvl <= depthMax && rnd() < 0.75;
  });
  a.C2 = did.length ? { selected: did.map((o) => o.id) } : { selected: ['nichts'] };
  a.C3 = Math.round(clamp(opt * 100 + gauss() * 12, 5, 100));
  a.E1 = clamp(Math.round(1.4 + gauss() * 1.2), 0, 4);
  a.E2 = clamp(Math.round(3.6 + opt * 1.2 + gauss()), 2, 6);
  const grid = q('D');
  if (grid.type === 'grid') {
    a.D = Object.fromEntries(grid.rows.map((r) => [r.id, rnd() < 0.12 ? null : clamp(Math.round(1.8 + gauss() * 1.1 + (r.id === 'datenschutz' ? 0.6 : 0)), 1, 5)]));
  }
  const prefs = ['clinical', 'regulatory', 'qm', 'wissen', 'fue', 'vertrieb', 'marketing', 'finance', 'einkauf', 'legal_hr', 'schulung'];
  const pts: Record<string, number> = {};
  for (let i = 0; i < 10; i++) {
    const id = rnd() < 0.55 ? prefs[Math.floor(rnd() * 4)]! : pick(prefs);
    pts[id] = (pts[id] ?? 0) + 1;
  }
  a.F1 = pts;
  a.F2 = [pick(TASKS), rnd() < 0.7 ? pick(TASKS) : '', rnd() < 0.4 ? pick(TASKS) : ''];
  a.F4 = Math.round(clamp(2 + opt * 6 + gauss() * 3, 0, 15) * 2) / 2;
  const barriers = ['datenschutz', 'regeln', 'wissen', 'zeit', 'tools', 'qualitaet', 'regulatorik'];
  a.G1 = { selected: [...new Set([pick(barriers.slice(0, 3)), pick(barriers)])].slice(0, 2) };
  a.G3 = { selected: ['tools', 'daten', 'pruefpflichten', 'kennzeichnung', 'schulung', 'verantwortung', 'freigabe'].filter(() => rnd() < 0.55) };
  if ((a.G3 as { selected: string[] }).selected.length === 0) a.G3 = { selected: ['daten'] };
  a.H1 = pick(EXPECT);
  if (rnd() < 0.6) a.H2 = pick(QUESTIONS);
  const concern = pick(CONCERNS);
  if (concern) a.H3 = concern;

  // Two participants stopped halfway
  const keys = Object.keys(a);
  const upto = idx === 14 || idx === 15 ? Math.floor(keys.length / 2) : keys.length;
  for (const id of keys.slice(0, upto)) {
    const v = validateAnswer(q(id), a[id], survey);
    if (!v.ok) throw new Error(`Invalid fake answer for ${id}: ${v.error}`);
    saveAnswer(p.id, id, v.value);
  }
  db.prepare(`UPDATE participants SET confirmed_at = datetime('now')${upto === keys.length ? ", completed_at = datetime('now')" : ''} WHERE id = ?`).run(p.id);
});

console.log(`Demo project "${SLUG}" seeded with ${PEOPLE.length} fictitious participants (password: demo).`);
