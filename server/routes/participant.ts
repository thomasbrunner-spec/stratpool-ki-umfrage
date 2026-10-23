import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { missingRequired, validateAnswer } from '../../shared/validate.js';
import {
  db,
  getAnswers,
  getParticipant,
  getParticipantByToken,
  getProjectRow,
  getProjectRowBySlug,
  insertParticipant,
  saveAnswer,
  toProject,
  type ParticipantRow,
  type ProjectRow,
} from '../db.js';
import { loginLimiter, PARTICIPANT_COOKIE, requireParticipant, signInParticipant } from '../auth.js';
import { getSurvey } from '../surveys.js';

export const participantRouter = Router();

/** Answers can be changed until the project is closed or the deadline (end of day) has passed. */
export function isLocked(p: ProjectRow): boolean {
  if (p.closed) return true;
  if (!p.deadline) return false;
  return Date.now() > new Date(`${p.deadline}T23:59:59`).getTime();
}

const allowsToken = (p: ProjectRow) => p.access_mode === 'token' || p.access_mode === 'both';
const allowsPassword = (p: ProjectRow) => p.access_mode === 'password' || p.access_mode === 'both';

function sessionPayload(part: ParticipantRow, project: ProjectRow) {
  const survey = getSurvey(project.survey_id);
  const pr = toProject(project);
  return {
    participant: {
      name: part.name,
      company: part.company,
      func: part.func,
      workshop: Boolean(part.workshop),
      leader: part.leader === null ? null : part.leader === 1,
      confirmed: Boolean(part.confirmed_at),
      completed: Boolean(part.completed_at),
    },
    project: {
      name: pr.name,
      client: pr.client,
      companies: pr.companies,
      workshopDate: pr.workshopDate,
      deadline: pr.deadline,
      locked: isLocked(project),
    },
    survey,
    answers: getAnswers(part.id),
  };
}

function loadSession(req: Request, res: Response): { part: ParticipantRow; project: ProjectRow } | null {
  const part = getParticipant(req.participantId!);
  const project = part ? getProjectRow(part.project_id) : undefined;
  if (!part || !project) {
    res.clearCookie(PARTICIPANT_COOKIE);
    res.status(401).json({ error: 'Ihr Zugang ist nicht mehr gültig.' });
    return null;
  }
  return { part, project };
}

// ---------- Entry & login ----------

participantRouter.get('/entry/:slug', (req, res) => {
  const p = getProjectRowBySlug(req.params.slug);
  if (!p || !allowsPassword(p)) {
    res.status(404).json({ error: 'Diese Umfrage gibt es nicht.' });
    return;
  }
  const survey = getSurvey(p.survey_id);
  res.json({
    name: p.name,
    client: p.client,
    companies: JSON.parse(p.companies) as string[],
    functions: survey?.functions ?? [],
    workshopDate: p.workshop_date,
    locked: isLocked(p),
  });
});

participantRouter.post('/login-token', loginLimiter, (req, res) => {
  const token = z.object({ token: z.string().min(10).max(100) }).safeParse(req.body);
  const part = token.success ? getParticipantByToken(token.data.token) : undefined;
  const project = part ? getProjectRow(part.project_id) : undefined;
  if (!part || !project || !allowsToken(project)) {
    res.status(401).json({ error: 'Dieser Link ist ungültig oder abgelaufen.' });
    return;
  }
  signInParticipant(res, part.id);
  res.json({ ok: true });
});

const PasswordLogin = z.object({
  slug: z.string(),
  password: z.string().min(1).max(200),
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120),
  func: z.string().trim().max(120),
  workshop: z.boolean(),
  leader: z.boolean(),
});

participantRouter.post('/login-password', loginLimiter, (req, res) => {
  const body = PasswordLogin.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Bitte alle Angaben zu Ihrer Person ausfüllen.' });
    return;
  }
  const project = getProjectRowBySlug(body.data.slug);
  if (
    !project ||
    !allowsPassword(project) ||
    !project.shared_password_hash ||
    !bcrypt.compareSync(body.data.password, project.shared_password_hash)
  ) {
    res.status(401).json({ error: 'Das Passwort ist nicht korrekt.' });
    return;
  }
  // Re-entry from another device: match a self-registered participant by name + company.
  // Invited participants are never matched here, so the shared password cannot open their answers.
  const existing = db
    .prepare(
      `SELECT * FROM participants WHERE project_id = ? AND self_registered = 1 AND lower(trim(name)) = lower(?)
       AND (company = '' OR ? = '' OR company = ?) ORDER BY created_at LIMIT 1`,
    )
    .get(project.id, body.data.name, body.data.company, body.data.company) as ParticipantRow | undefined;
  const part =
    existing ??
    insertParticipant(project.id, {
      name: body.data.name,
      company: body.data.company,
      func: body.data.func,
      workshop: body.data.workshop,
      leader: body.data.leader,
      selfRegistered: true,
    });
  if (!existing) db.prepare(`UPDATE participants SET confirmed_at = datetime('now') WHERE id = ?`).run(part.id);
  signInParticipant(res, part.id);
  res.json({ ok: true });
});

participantRouter.post('/logout', (_req, res) => {
  res.clearCookie(PARTICIPANT_COOKIE);
  res.json({ ok: true });
});

// ---------- Session ----------

participantRouter.get('/session', requireParticipant, (req, res) => {
  const s = loadSession(req, res);
  if (s) res.json(sessionPayload(s.part, s.project));
});

// Submitted answers are final; the admin can reopen a participant if a change is needed.
const SUBMITTED_ERROR = 'Ihre Antworten sind bereits abgesendet und können nicht mehr geändert werden.';

const Profile = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120),
  func: z.string().trim().max(120),
  workshop: z.boolean(),
  leader: z.boolean(),
});

participantRouter.put('/profile', requireParticipant, (req, res) => {
  const s = loadSession(req, res);
  if (!s) return;
  const body = Profile.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Bitte alle Angaben zu Ihrer Person ausfüllen.' });
    return;
  }
  if (s.part.completed_at) {
    res.status(423).json({ error: SUBMITTED_ERROR });
    return;
  }
  db.prepare(
    `UPDATE participants SET name = ?, company = ?, func = ?, workshop = ?, leader = ?, confirmed_at = COALESCE(confirmed_at, datetime('now'))
     WHERE id = ?`,
  ).run(body.data.name, body.data.company, body.data.func, body.data.workshop ? 1 : 0, body.data.leader ? 1 : 0, s.part.id);
  res.json({ ok: true });
});

participantRouter.put('/answers/:qid', requireParticipant, (req, res) => {
  const s = loadSession(req, res);
  if (!s) return;
  if (isLocked(s.project)) {
    res.status(423).json({ error: 'Die Umfrage ist abgeschlossen. Antworten können nicht mehr geändert werden.' });
    return;
  }
  if (s.part.completed_at) {
    res.status(423).json({ error: SUBMITTED_ERROR });
    return;
  }
  const survey = getSurvey(s.project.survey_id);
  const q = survey?.questions.find((x) => x.id === req.params.qid);
  if (!survey || !q) {
    res.status(404).json({ error: 'Unbekannte Frage.' });
    return;
  }
  const result = validateAnswer(q, (req.body as { value?: unknown }).value, survey);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  saveAnswer(s.part.id, q.id, result.value);
  res.json({ ok: true, value: result.value });
});

participantRouter.post('/complete', requireParticipant, (req, res) => {
  const s = loadSession(req, res);
  if (!s) return;
  const survey = getSurvey(s.project.survey_id);
  if (!survey) {
    res.status(500).json({ error: 'Fragebogen nicht gefunden.' });
    return;
  }
  const missing = missingRequired(survey, getAnswers(s.part.id));
  if (missing.length) {
    res.status(400).json({ error: 'Es fehlen noch Pflichtantworten.', missing });
    return;
  }
  db.prepare(`UPDATE participants SET completed_at = COALESCE(completed_at, datetime('now')) WHERE id = ?`).run(s.part.id);
  res.json({ ok: true });
});
