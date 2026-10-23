import { isLeader, type ResultRow } from '../shared/aggregate.js';
import { getProjectAnswers, listParticipants, type ParticipantRow } from './db.js';

export function participantInfo(p: ParticipantRow) {
  return {
    id: p.id,
    name: p.name,
    company: p.company,
    func: p.func,
    workshop: Boolean(p.workshop),
    leader: isLeader({ leader: p.leader === null ? null : p.leader === 1, func: p.func, roleNote: p.role_note }),
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
