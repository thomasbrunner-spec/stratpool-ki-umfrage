import { db } from './db.js';
import type { TextItemRef } from '../shared/textitems.js';

export interface TextFlag {
  key: string;
  text: string;
  hidden: boolean;
  reason: string;
  source: 'ai' | 'manual';
  updatedAt: string;
}

interface FlagRow {
  item_key: string;
  text: string;
  hidden: number;
  reason: string;
  source: 'ai' | 'manual';
  updated_at: string;
}

export function getTextFlags(projectId: string): Map<string, TextFlag> {
  const rows = db.prepare('SELECT * FROM text_flags WHERE project_id = ?').all(projectId) as FlagRow[];
  return new Map(
    rows.map((r) => [r.item_key, { key: r.item_key, text: r.text, hidden: Boolean(r.hidden), reason: r.reason, source: r.source, updatedAt: r.updated_at }]),
  );
}

/** Keys of items that are currently hidden – a flag only applies while the answer text is unchanged. */
export function hiddenKeys(flags: Map<string, TextFlag>, items: TextItemRef[]): Set<string> {
  const out = new Set<string>();
  for (const it of items) {
    const f = flags.get(it.key);
    if (f && f.hidden && f.text === it.text) out.add(it.key);
  }
  return out;
}

export function setManualFlag(projectId: string, key: string, text: string, hidden: boolean): void {
  db.prepare(
    `INSERT INTO text_flags (project_id, item_key, text, hidden, reason, source, updated_at)
     VALUES (?, ?, ?, ?, '', 'manual', datetime('now'))
     ON CONFLICT(project_id, item_key) DO UPDATE SET text = excluded.text, hidden = excluded.hidden,
       source = 'manual', updated_at = excluded.updated_at`,
  ).run(projectId, key, text, hidden ? 1 : 0);
}

/**
 * Stores the result of an AI check for the checked items. Manual decisions on an unchanged text are kept,
 * everything else is replaced by the new verdict.
 */
export function saveAiFlags(projectId: string, checked: TextItemRef[], verdicts: Map<string, string>): void {
  const existing = getTextFlags(projectId);
  const upsert = db.prepare(
    `INSERT INTO text_flags (project_id, item_key, text, hidden, reason, source, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ai', datetime('now'))
     ON CONFLICT(project_id, item_key) DO UPDATE SET text = excluded.text, hidden = excluded.hidden,
       reason = excluded.reason, source = 'ai', updated_at = excluded.updated_at`,
  );
  const tx = db.transaction(() => {
    for (const it of checked) {
      const prev = existing.get(it.key);
      if (prev?.source === 'manual' && prev.text === it.text) continue;
      const reason = verdicts.get(it.key);
      upsert.run(projectId, it.key, it.text, reason ? 1 : 0, reason ?? '');
    }
  });
  tx();
}
