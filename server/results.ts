import type { ResultRow } from '../shared/aggregate.js';
import { getProjectAnswers, listParticipants, type ParticipantRow } from './db.js';

export function participantInfo(p: ParticipantRow) {
  return {
    id: p.id,
    name: p.name,
    company: p.company,
    func: p.func,
    workshop: Boolean(p.workshop),
    // management or head of department, from the dropdown or the internal role note ("GF DT", "AL QM")
    leader: p.func === 'Geschäftsführung' || /^(GF|AL)\b/i.test(p.role_note),
  };
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
