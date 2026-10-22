import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { getSetting, setSetting } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set (e.g. `openssl rand -hex 32`).');
  process.exit(1);
}
const SECRET: string = JWT_SECRET;

export const ADMIN_COOKIE = 'ku_admin';
export const PARTICIPANT_COOKIE = 'ku_participant';
const ADMIN_TTL_H = 12;
const PARTICIPANT_TTL_D = 60;

const secure = process.env.NODE_ENV === 'production';

interface AdminClaims {
  typ: 'admin';
}
interface ParticipantClaims {
  typ: 'participant';
  pid: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    participantId?: string;
  }
}

function setCookie(res: Response, name: string, payload: AdminClaims | ParticipantClaims, maxAgeMs: number): void {
  const token = jwt.sign(payload, SECRET, { expiresIn: Math.floor(maxAgeMs / 1000) });
  res.cookie(name, token, { httpOnly: true, sameSite: 'lax', secure, maxAge: maxAgeMs, path: '/' });
}

function readClaims(req: Request, name: string): Record<string, unknown> | null {
  const token = (req.cookies as Record<string, string | undefined>)[name];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, SECRET);
    return typeof decoded === 'object' ? (decoded as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ---------- Admin ----------

/** Admin password: ADMIN_PASSWORD env wins; otherwise a hash stored by first-run setup. */
const envAdminHash = process.env.ADMIN_PASSWORD ? bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10) : null;

export const adminNeedsSetup = (): boolean => !envAdminHash && !getSetting('admin_password_hash');

export function setupAdminPassword(password: string): void {
  setSetting('admin_password_hash', bcrypt.hashSync(password, 10));
}

export function checkAdminPassword(password: string): boolean {
  const hash = envAdminHash ?? getSetting('admin_password_hash');
  return Boolean(hash && bcrypt.compareSync(password, hash));
}

export const signInAdmin = (res: Response) => setCookie(res, ADMIN_COOKIE, { typ: 'admin' }, ADMIN_TTL_H * 3600_000);

export const isAdmin = (req: Request): boolean => readClaims(req, ADMIN_COOKIE)?.typ === 'admin';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'Nicht angemeldet.' });
    return;
  }
  next();
}

// ---------- Participant ----------

export const signInParticipant = (res: Response, pid: string) =>
  setCookie(res, PARTICIPANT_COOKIE, { typ: 'participant', pid }, PARTICIPANT_TTL_D * 86400_000);

export function requireParticipant(req: Request, res: Response, next: NextFunction): void {
  const claims = readClaims(req, PARTICIPANT_COOKIE);
  if (claims?.typ !== 'participant' || typeof claims.pid !== 'string') {
    res.status(401).json({ error: 'Bitte melden Sie sich erneut an.' });
    return;
  }
  req.participantId = claims.pid;
  next();
}

// ---------- Rate limiting ----------

export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.' },
});
