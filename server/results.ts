import type { ResultRow } from '../shared/aggregate.js';
import { getProjectAnswers, listParticipants, type ParticipantRow } from './db.js';

export function participantInfo(p: ParticipantRow) {
  return { id: p.id, name: p.name, company: p.company, func: p.func, workshop: Boolean(p.workshop) };
}

/** All participants of a project with their answers, ready for aggregation. */
export function loadResultRows(projectId: string): ResultRow[] {
  const answers = getProjectAnswers(projectId);
  return listParticipants(projectId).map((p) => ({
    participant: participantInfo(p),
    answers: answers.get(p.id) ?? {},
    completed: Boolean(p.completed_at),
  }));
}
