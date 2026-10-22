import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AnswerMap, AnswerValue } from '../shared/types.js';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve('data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(process.env.DB_FILE ?? path.join(DATA_DIR, 'umfrage.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    client TEXT NOT NULL,
    survey_id TEXT NOT NULL,
    access_mode TEXT NOT NULL DEFAULT 'token' CHECK (access_mode IN ('token', 'password', 'both')),
    shared_password_hash TEXT,
    companies TEXT NOT NULL DEFAULT '[]',
    workshop_date TEXT,
    deadline TEXT,
    closed INTEGER NOT NULL DEFAULT 0,
    show_names INTEGER NOT NULL DEFAULT 0,
    min_group_size INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    func TEXT NOT NULL DEFAULT '',
    role_note TEXT NOT NULL DEFAULT '',
    workshop INTEGER NOT NULL DEFAULT 0,
    token TEXT UNIQUE NOT NULL,
    self_registered INTEGER NOT NULL DEFAULT 0,
    confirmed_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_participants_project ON participants(project_id);

  CREATE TABLE IF NOT EXISTS answers (
    participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (participant_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS ai_summaries (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    target_key TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT NOT NULL,
    edited INTEGER NOT NULL DEFAULT 0,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (project_id, target_key)
  );

  CREATE TABLE IF NOT EXISTS slide_settings (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slide_id TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    show_names INTEGER,
    PRIMARY KEY (project_id, slide_id)
  );
`);

// ---------- Types ----------

export type AccessMode = 'token' | 'password' | 'both';

export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  client: string;
  survey_id: string;
  access_mode: AccessMode;
  shared_password_hash: string | null;
  companies: string;
  workshop_date: string | null;
  deadline: string | null;
  closed: number;
  show_names: number;
  min_group_size: number;
  created_at: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  client: string;
  surveyId: string;
  accessMode: AccessMode;
  hasSharedPassword: boolean;
  companies: string[];
  workshopDate: string | null;
  deadline: string | null;
  closed: boolean;
  showNames: boolean;
  minGroupSize: number;
  createdAt: string;
}

export interface ParticipantRow {
  id: string;
  project_id: string;
  name: string;
  email: string;
  company: string;
  func: string;
  role_note: string;
  workshop: number;
  token: string;
  self_registered: number;
  confirmed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  client: r.client,
  surveyId: r.survey_id,
  accessMode: r.access_mode,
  hasSharedPassword: Boolean(r.shared_password_hash),
  companies: JSON.parse(r.companies) as string[],
  workshopDate: r.workshop_date,
  deadline: r.deadline,
  closed: Boolean(r.closed),
  showNames: Boolean(r.show_names),
  minGroupSize: r.min_group_size,
  createdAt: r.created_at,
});

export const newToken = (): string => crypto.randomBytes(18).toString('base64url');

// ---------- Settings ----------

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value,
  );
}

// ---------- Projects ----------

export const getProjectRow = (id: string) =>
  db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;

export const getProjectRowBySlug = (slug: string) =>
  db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as ProjectRow | undefined;

export const listProjectRows = () =>
  db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as ProjectRow[];

// ---------- Participants ----------

export const getParticipant = (id: string) =>
  db.prepare('SELECT * FROM participants WHERE id = ?').get(id) as ParticipantRow | undefined;

export const getParticipantByToken = (token: string) =>
  db.prepare('SELECT * FROM participants WHERE token = ?').get(token) as ParticipantRow | undefined;

export const listParticipants = (projectId: string) =>
  db
    .prepare('SELECT * FROM participants WHERE project_id = ? ORDER BY workshop DESC, name COLLATE NOCASE')
    .all(projectId) as ParticipantRow[];

export interface NewParticipant {
  name: string;
  email?: string;
  company?: string;
  func?: string;
  roleNote?: string;
  workshop?: boolean;
  selfRegistered?: boolean;
}

export function insertParticipant(projectId: string, p: NewParticipant): ParticipantRow {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO participants (id, project_id, name, email, company, func, role_note, workshop, token, self_registered)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    p.name.trim(),
    (p.email ?? '').trim(),
    (p.company ?? '').trim(),
    (p.func ?? '').trim(),
    (p.roleNote ?? '').trim(),
    p.workshop ? 1 : 0,
    newToken(),
    p.selfRegistered ? 1 : 0,
  );
  return getParticipant(id)!;
}

// ---------- Answers ----------

export function getAnswers(participantId: string): AnswerMap {
  const rows = db.prepare('SELECT question_id, value FROM answers WHERE participant_id = ?').all(participantId) as {
    question_id: string;
    value: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.question_id, JSON.parse(r.value) as AnswerValue]));
}

export function getProjectAnswers(projectId: string): Map<string, AnswerMap> {
  const rows = db
    .prepare(
      `SELECT a.participant_id, a.question_id, a.value FROM answers a
       JOIN participants p ON p.id = a.participant_id WHERE p.project_id = ?`,
    )
    .all(projectId) as { participant_id: string; question_id: string; value: string }[];
  const map = new Map<string, AnswerMap>();
  for (const r of rows) {
    const m = map.get(r.participant_id) ?? {};
    m[r.question_id] = JSON.parse(r.value) as AnswerValue;
    map.set(r.participant_id, m);
  }
  return map;
}

export function saveAnswer(participantId: string, questionId: string, value: AnswerValue): void {
  db.prepare(
    `INSERT INTO answers (participant_id, question_id, value, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(participant_id, question_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(participantId, questionId, JSON.stringify(value));
}

export function lastActivity(projectId: string): Map<string, string> {
  const rows = db
    .prepare(
      `SELECT a.participant_id, MAX(a.updated_at) AS last FROM answers a
       JOIN participants p ON p.id = a.participant_id WHERE p.project_id = ? GROUP BY a.participant_id`,
    )
    .all(projectId) as { participant_id: string; last: string }[];
  return new Map(rows.map((r) => [r.participant_id, r.last]));
}
