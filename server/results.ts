import { isLeader, type ResultRow } from '../shared/aggregate.js';
import { applyHiddenTexts, collectTextItems } from '../shared/textitems.js';
import type { SurveyDefinition } from '../shared/types.js';
import { getProjectAnswers, getProjectRow, listParticipants, type ParticipantRow } from './db.js';
import { getSurvey } from './surveys.js';
import { getTextFlags, hiddenKeys } from './textflags.js';

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

/** All participants of a project with their raw answers. */
export function loadRawRows(projectId: string): ResultRow[] {
  const answers = getProjectAnswers(projectId);
  return listParticipants(projectId).map((p) => ({
    participant: participantInfo(p),
    answers: answers.get(p.id) ?? {},
    completed: Boolean(p.completed_at),
  }));
}

/** Hidden free-text items of a project (non-substantive answers), based on the current answers. */
export function hiddenTextKeys(projectId: string, survey: SurveyDefinition, raw: ResultRow[]): Set<string> {
  return hiddenKeys(getTextFlags(projectId), collectTextItems(survey, raw));
}

/**
 * All participants with their answers, ready for aggregation and AI:
 * free texts marked as non-substantive are left out.
 */
export function loadResultRows(projectId: string): ResultRow[] {
  const raw = loadRawRows(projectId);
  const p = getProjectRow(projectId);
  const survey = p && getSurvey(p.survey_id);
  if (!survey) return raw;
  return applyHiddenTexts(survey, raw, hiddenTextKeys(projectId, survey, raw));
}
