import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { aggregateAll, type ResultRow } from '../../shared/aggregate.js';
import { mapCsvRows, parseCsv, toCsv } from '../../shared/csv.js';
import type { ResultFilter } from '../../shared/types.js';
import {
  db,
  getAnswers,
  getParticipant,
  getProjectRow,
  insertParticipant,
  lastActivity,
  listParticipants,
  listProjectRows,
  newToken,
  toProject,
  type ParticipantRow,
  type ProjectRow,
} from '../db.js';
import {
  ADMIN_COOKIE,
  adminNeedsSetup,
  checkAdminPassword,
  isAdmin,
  loginLimiter,
  requireAdmin,
  setupAdminPassword,
  signInAdmin,
} from '../auth.js';
import { getSurvey, listSurveys } from '../surveys.js';
import { loadResultRows } from '../results.js';
import { exportTable, exportXlsx } from '../export.js';
import {
  AiNotConfiguredError,
  getSummaries,
  saveSummary,
  summarizeClusters,
  summarizeSynthesis,
  type AiSummary,
} from '../ai.js';
import { isLocked } from './participant.js';

export const adminRouter = Router();

// ---------- Auth ----------

adminRouter.get('/status', (req, res) => {
  res.json({ needsSetup: adminNeedsSetup(), loggedIn: isAdmin(req), aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
});

adminRouter.post('/setup', loginLimiter, (req, res) => {
  const body = z.object({ password: z.string().min(10).max(200) }).safeParse(req.body);
  if (!adminNeedsSetup()) {
    res.status(400).json({ error: 'Der Admin-Zugang ist bereits eingerichtet.' });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: 'Das Passwort muss mindestens 10 Zeichen haben.' });
    return;
  }
  setupAdminPassword(body.data.password);
  signInAdmin(res);
  res.json({ ok: true });
});

adminRouter.post('/login', loginLimiter, (req, res) => {
  const password = (req.body as { password?: unknown }).password;
  if (typeof password !== 'string' || !checkAdminPassword(password)) {
    res.status(401).json({ error: 'Das Passwort ist nicht korrekt.' });
    return;
  }
  signInAdmin(res);
  res.json({ ok: true });
});

adminRouter.post('/logout', (_req, res) => {
  res.clearCookie(ADMIN_COOKIE);
  res.json({ ok: true });
});

// Everything below requires an admin session
adminRouter.use(requireAdmin);

adminRouter.get('/surveys', (_req, res) => {
  res.json(listSurveys());
});

// ---------- Helpers ----------

function projectOr404(req: Request, res: Response): ProjectRow | null {
  const p = getProjectRow(String(req.params.id));
  if (!p) res.status(404).json({ error: 'Projekt nicht gefunden.' });
  return p ?? null;
}

function participantOr404(req: Request, res: Response): ParticipantRow | null {
  const p = getParticipant(String(req.params.pid));
  if (!p) res.status(404).json({ error: 'Teilnehmer nicht gefunden.' });
  return p ?? null;
}

function participantView(p: ParticipantRow, answered: boolean, last: string | undefined) {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    company: p.company,
    func: p.func,
    roleNote: p.role_note,
    workshop: Boolean(p.workshop),
    token: p.token,
    selfRegistered: Boolean(p.self_registered),
    status: p.completed_at ? 'completed' : answered ? 'started' : 'invited',
    completedAt: p.completed_at,
    lastActivity: last ?? null,
  };
}

function counts(projectId: string) {
  return db
    .prepare(
      `SELECT COUNT(*) AS invited,
              SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN EXISTS (SELECT 1 FROM answers a WHERE a.participant_id = p.id) THEN 1 ELSE 0 END) AS started
       FROM participants p WHERE project_id = ?`,
    )
    .get(projectId) as { invited: number; completed: number | null; started: number | null };
}

const parseFilter = (q: Request['query']): ResultFilter => ({
  company: typeof q.company === 'string' && q.company ? q.company : undefined,
  func: typeof q.func === 'string' && q.func ? q.func : undefined,
  workshop: q.workshop === 'true' ? true : q.workshop === 'false' ? false : undefined,
});

// ---------- Projects ----------

const ProjectInput = z.object({
  name: z.string().trim().min(2).max(120),
  client: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,40}$/, 'Kurzname: nur a–z, 0–9 und Bindestrich'),
  surveyId: z.string(),
  accessMode: z.enum(['token', 'password', 'both']),
  companies: z.array(z.string().trim().min(1).max(120)).max(30),
  workshopDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  closed: z.boolean(),
  showNames: z.boolean(),
  minGroupSize: z.number().int().min(1).max(10),
  sharedPassword: z.string().max(200).optional(),
});

adminRouter.get('/projects', (_req, res) => {
  res.json(listProjectRows().map((p) => ({ ...toProject(p), counts: counts(p.id) })));
});

adminRouter.post('/projects', (req, res) => {
  const body = ProjectInput.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? 'Ungültige Eingabe.' });
    return;
  }
  const d = body.data;
  if (d.accessMode !== 'token' && !d.sharedPassword) {
    res.status(400).json({ error: 'Für den Passwort-Zugang bitte ein Umfrage-Passwort setzen.' });
    return;
  }
  if (!getSurvey(d.surveyId)) {
    res.status(400).json({ error: 'Unbekannter Fragebogen.' });
    return;
  }
  const id = crypto.randomUUID();
  try {
    db.prepare(
      `INSERT INTO projects (id, slug, name, client, survey_id, access_mode, shared_password_hash, companies, workshop_date, deadline, closed, show_names, min_group_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      d.slug,
      d.name,
      d.client,
      d.surveyId,
      d.accessMode,
      d.sharedPassword ? bcrypt.hashSync(d.sharedPassword, 10) : null,
      JSON.stringify(d.companies),
      d.workshopDate,
      d.deadline,
      d.closed ? 1 : 0,
      d.showNames ? 1 : 0,
      d.minGroupSize,
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Dieser Kurzname ist schon vergeben.' });
      return;
    }
    throw e;
  }
  res.json(toProject(getProjectRow(id)!));
});

adminRouter.get('/projects/:id', (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  const last = lastActivity(p.id);
  res.json({
    project: { ...toProject(p), locked: isLocked(p) },
    survey: getSurvey(p.survey_id),
    participants: listParticipants(p.id).map((x) => participantView(x, last.has(x.id), last.get(x.id))),
  });
});

adminRouter.put('/projects/:id', (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  const body = ProjectInput.omit({ surveyId: true }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? 'Ungültige Eingabe.' });
    return;
  }
  const d = body.data;
  if (d.accessMode !== 'token' && !p.shared_password_hash && !d.sharedPassword) {
    res.status(400).json({ error: 'Für den Passwort-Zugang bitte ein Umfrage-Passwort setzen.' });
    return;
  }
  db.prepare(
    `UPDATE projects SET slug = ?, name = ?, client = ?, access_mode = ?, companies = ?, workshop_date = ?, deadline = ?,
       closed = ?, show_names = ?, min_group_size = ?, shared_password_hash = COALESCE(?, shared_password_hash) WHERE id = ?`,
  ).run(
    d.slug,
    d.name,
    d.client,
    d.accessMode,
    JSON.stringify(d.companies),
    d.workshopDate,
    d.deadline,
    d.closed ? 1 : 0,
    d.showNames ? 1 : 0,
    d.minGroupSize,
    d.sharedPassword ? bcrypt.hashSync(d.sharedPassword, 10) : null,
    p.id,
  );
  res.json(toProject(getProjectRow(p.id)!));
});

/** Deletes the project with all participants, answers and summaries (end-of-project deletion). */
adminRouter.delete('/projects/:id', (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  if ((req.body as { confirm?: unknown }).confirm !== p.slug) {
    res.status(400).json({ error: 'Zur Bestätigung bitte den Kurznamen des Projekts eingeben.' });
    return;
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(p.id);
  db.exec('VACUUM');
  res.json({ ok: true });
});

// ---------- Participants ----------

const ParticipantInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.union([z.literal(''), z.email()]),
  company: z.string().trim().max(120),
  func: z.string().trim().max(120),
  roleNote: z.string().trim().max(120),
  workshop: z.boolean(),
});

adminRouter.post('/projects/:id/participants', (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  const body = ParticipantInput.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? 'Ungültige Eingabe.' });
    return;
  }
  const part = insertParticipant(p.id, body.data);
  res.json(participantView(part, false, undefined));
});

adminRouter.post('/projects/:id/participants/import', (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  const csv = (req.body as { csv?: unknown }).csv;
  if (typeof csv !== 'string' || csv.length > 500_000) {
    res.status(400).json({ error: 'Bitte eine CSV-Datei hochladen.' });
    return;
  }
  const survey = getSurvey(p.survey_id);
  const { participants, errors } = mapCsvRows(parseCsv(csv), survey?.functions ?? []);
  const existing = listParticipants(p.id);
  const key = (name: string, email: string) => (email ? email.toLowerCase() : name.toLowerCase());
  const known = new Set(existing.map((e) => key(e.name, e.email)));
  let created = 0;
  const skipped: string[] = [];
  db.transaction(() => {
    for (const row of participants) {
      if (known.has(key(row.name, row.email))) {
        skipped.push(row.name);
        continue;
      }
      insertParticipant(p.id, row);
      known.add(key(row.name, row.email));
      created++;
    }
  })();
  res.json({ created, skipped, errors });
});

adminRouter.put('/participants/:pid', (req, res) => {
  const part = participantOr404(req, res);
  if (!part) return;
  const body = ParticipantInput.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? 'Ungültige Eingabe.' });
    return;
  }
  const d = body.data;
  db.prepare('UPDATE participants SET name = ?, email = ?, company = ?, func = ?, role_note = ?, workshop = ? WHERE id = ?').run(
    d.name,
    d.email,
    d.company,
    d.func,
    d.roleNote,
    d.workshop ? 1 : 0,
    part.id,
  );
  res.json({ ok: true });
});

adminRouter.delete('/participants/:pid', (req, res) => {
  const part = participantOr404(req, res);
  if (!part) return;
  db.prepare('DELETE FROM participants WHERE id = ?').run(part.id);
  res.json({ ok: true });
});

/** Removes all answers of one participant and resets the status (e.g. after test runs). */
adminRouter.delete('/participants/:pid/answers', (req, res) => {
  const part = participantOr404(req, res);
  if (!part) return;
  db.transaction(() => {
    db.prepare('DELETE FROM answers WHERE participant_id = ?').run(part.id);
    db.prepare('UPDATE participants SET completed_at = NULL WHERE id = ?').run(part.id);
  })();
  res.json({ ok: true });
});

/** Lets a participant change answers again after submitting (status goes back to "started"). */
adminRouter.post('/participants/:pid/reopen', (req, res) => {
  const part = participantOr404(req, res);
  if (!part) return;
  db.prepare('UPDATE participants SET completed_at = NULL WHERE id = ?').run(part.id);
  res.json({ ok: true });
});

adminRouter.post('/participants/:pid/token', (req, res) => {
  const part = participantOr404(req, res);
  if (!part) return;
  const token = newToken();
  db.prepare('UPDATE participants SET token = ? WHERE id = ?').run(token, part.id);
  res.json({ token });
});

adminRouter.get('/participants/:pid/answers', (req, res) => {
  const part = participantOr404(req, res);
  if (!part) return;
  res.json({ answers: getAnswers(part.id) });
});

// ---------- Results, slides, AI ----------

function presentationState(projectId: string) {
  const slides = db.prepare('SELECT slide_id, hidden, note, show_names FROM slide_settings WHERE project_id = ?').all(projectId) as {
    slide_id: string;
    hidden: number;
    note: string;
    show_names: number | null;
  }[];
  return Object.fromEntries(
    slides.map((s) => [s.slide_id, { hidden: Boolean(s.hidden), note: s.note, showNames: s.show_names === null ? null : Boolean(s.show_names) }]),
  );
}

adminRouter.get('/projects/:id/results', (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  const survey = getSurvey(p.survey_id);
  if (!survey) {
    res.status(500).json({ error: 'Fragebogen nicht gefunden.' });
    return;
  }
  const rows = loadResultRows(p.id);
  res.json({
    project: toProject(p),
    survey,
    results: aggregateAll(survey, rows, parseFilter(req.query)),
    names: Object.fromEntries(rows.map((r) => [r.participant.id, r.participant.name])),
    summaries: getSummaries(p.id),
    slides: presentationState(p.id),
  });
});

const SlideInput = z.object({
  hidden: z.boolean(),
  note: z.string().max(1000),
  showNames: z.boolean().nullable(),
});

adminRouter.put('/projects/:id/slides/:slideId', (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  const body = SlideInput.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Ungültige Eingabe.' });
    return;
  }
  const d = body.data;
  db.prepare(
    `INSERT INTO slide_settings (project_id, slide_id, hidden, note, show_names) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, slide_id) DO UPDATE SET hidden = excluded.hidden, note = excluded.note, show_names = excluded.show_names`,
  ).run(p.id, req.params.slideId, d.hidden ? 1 : 0, d.note, d.showNames === null ? null : d.showNames ? 1 : 0);
  res.json({ ok: true });
});

adminRouter.post('/projects/:id/ai/:key', async (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  const survey = getSurvey(p.survey_id);
  const target = survey?.aiTargets.find((t) => t.key === req.params.key);
  if (!survey || !target) {
    res.status(404).json({ error: 'Unbekannte Zusammenfassung.' });
    return;
  }
  const rows: ResultRow[] = loadResultRows(p.id);
  try {
    let content: AiSummary;
    if (target.mode === 'clusters') {
      content = await summarizeClusters(survey, target, rows, rows.map((r) => r.participant.name));
    } else {
      const existing = Object.fromEntries(Object.entries(getSummaries(p.id)).map(([k, v]) => [k, v.content]));
      content = await summarizeSynthesis(survey, rows, existing);
    }
    saveSummary(p.id, target.key, content, false);
    res.json(getSummaries(p.id)[target.key]);
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      res.status(503).json({ error: 'Die KI-Zusammenfassung ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt).' });
      return;
    }
    console.error('AI summary failed', e);
    res.status(502).json({ error: e instanceof Error ? `KI-Zusammenfassung fehlgeschlagen: ${e.message}` : 'KI-Zusammenfassung fehlgeschlagen.' });
  }
});

adminRouter.put('/projects/:id/ai/:key', (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  const content = (req.body as { content?: AiSummary }).content;
  if (!content || (content.mode !== 'clusters' && content.mode !== 'synthesis')) {
    res.status(400).json({ error: 'Ungültiger Inhalt.' });
    return;
  }
  saveSummary(p.id, String(req.params.key), content, true);
  res.json(getSummaries(p.id)[String(req.params.key)]);
});

// ---------- Export ----------

function exportName(p: ProjectRow, ext: string) {
  return `ki-umfrage-${p.slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

adminRouter.get('/projects/:id/export.csv', (req, res) => {
  const p = projectOr404(req, res);
  const survey = p && getSurvey(p.survey_id);
  if (!p || !survey) return;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${exportName(p, 'csv')}"`);
  res.send(toCsv(exportTable(p.id, survey)));
});

adminRouter.get('/projects/:id/export.xlsx', async (req, res) => {
  const p = projectOr404(req, res);
  const survey = p && getSurvey(p.survey_id);
  if (!p || !survey) return;
  const buf = await exportXlsx(exportTable(p.id, survey), p.name);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${exportName(p, 'xlsx')}"`);
  res.send(buf);
});

adminRouter.get('/projects/:id/export.json', (req, res) => {
  const p = projectOr404(req, res);
  if (!p) return;
  const participants = listParticipants(p.id).map((x) => ({ ...x, answers: getAnswers(x.id) }));
  res.setHeader('Content-Disposition', `attachment; filename="${exportName(p, 'json')}"`);
  res.json({
    exportedAt: new Date().toISOString(),
    project: { ...p, shared_password_hash: undefined },
    participants,
    summaries: getSummaries(p.id),
    slides: presentationState(p.id),
  });
});
