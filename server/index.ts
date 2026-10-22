import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import './auth.js'; // fails fast without JWT_SECRET
import { participantRouter } from './routes/participant.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3210);

app.set('trust proxy', 1); // behind Traefik (Coolify): needed for rate limiting by client IP
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/p', participantRouter);
app.use('/api/admin', adminRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Nicht gefunden.' });
});

const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Interner Fehler.' });
});

app.listen(PORT, () => {
  console.log(`KI-Umfrage läuft auf http://localhost:${PORT}`);
});
